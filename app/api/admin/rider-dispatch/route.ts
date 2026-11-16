import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireMkhAdmin } from "@/lib/server/mkhAdminAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, private" } });
}

export async function GET() {
  const access = await requireMkhAdmin();
  if (!access.ok) return json({ success: false, message: access.message }, access.status);

  const [ridersResult,zonesResult,assignmentsResult,vendorsResult,coverageResult,vendorZonesResult] = await Promise.all([
    adminClient.from("profiles").select("id,full_name,email,phone,status,role").eq("role","rider").order("full_name"),
    adminClient.from("zones").select("id,name,territory_id,is_active,territories(id,name,is_active)").eq("is_active",true).order("name"),
    adminClient.from("rider_home_zone_assignments").select("id,rider_id,home_zone_id,availability_status,assigned_at,assignment_reason").eq("status","active").is("unassigned_at",null),
    adminClient.from("vendors").select("id,name,status").eq("status","active").order("name"),
    adminClient.from("vendor_riders").select("id,vendor_id,rider_id,status,assigned_at,unassigned_at").eq("status","active").is("unassigned_at",null),
    adminClient.from("zone_vendors").select("vendor_id,zone_id").eq("status","active").is("unassigned_at",null),
  ]);

  const error = ridersResult.error || zonesResult.error || assignmentsResult.error || vendorsResult.error || coverageResult.error || vendorZonesResult.error;
  if (error) {
    console.error("Admin rider dispatch workspace failed:", error);
    return json({ success:false, message:"Unable to load rider zone and coverage records." },500);
  }

  const riderIds = (ridersResult.data ?? []).map((r:any)=>r.id);
  const vendorIds = (vendorsResult.data ?? []).map((v:any)=>v.id);
  const [locationsResult,offersResult] = await Promise.all([
    riderIds.length
      ? adminClient.from("rider_locations").select("rider_id,updated_at,latitude,longitude").in("rider_id",riderIds)
      : Promise.resolve({data:[],error:null} as any),
    riderIds.length
      ? adminClient.from("rider_dispatch_offers").select("id,rider_id,order_id,offer_status,dispatch_mode,expires_at").in("rider_id",riderIds).in("offer_status",["offered","accepted"])
      : Promise.resolve({data:[],error:null} as any),
  ]);
  if (locationsResult.error || offersResult.error) {
    console.error("Admin rider dispatch GPS/offer lookup failed:", locationsResult.error || offersResult.error);
    return json({success:false,message:"Unable to load rider GPS and dispatch status."},500);
  }

  const now=Date.now();
  const locationByRider=new Map((locationsResult.data??[]).map((row:any)=>[row.rider_id,row]));
  const assignmentByRider=new Map((assignmentsResult.data??[]).map((row:any)=>[row.rider_id,row]));
  const activeOfferByRider=new Map((offersResult.data??[]).map((row:any)=>[row.rider_id,row]));
  const riderRows=(ridersResult.data??[]).map((rider:any)=>{
    const home:any=assignmentByRider.get(rider.id);
    const gps:any=locationByRider.get(rider.id);
    const age=gps?.updated_at?Math.floor((now-Date.parse(gps.updated_at))/1000):null;
    const vendorCoverage=(coverageResult.data??[]).filter((row:any)=>row.rider_id===rider.id).map((row:any)=>row.vendor_id);
    return {
      ...rider,
      home_zone_id:home?.home_zone_id??null,
      availability_status:home?.availability_status??"unassigned",
      gps_updated_at:gps?.updated_at??null,
      gps_age_seconds:age,
      gps_status:age!==null&&age>=0&&age<=60?"live":"stale",
      vendor_coverage_ids:vendorCoverage,
      active_dispatch_offer:activeOfferByRider.get(rider.id)??null,
    };
  });

  const coverage=(coverageResult.data??[]).map((row:any)=>({
    ...row,
    vendor_name:(vendorsResult.data??[]).find((v:any)=>v.id===row.vendor_id)?.name??"Vendor",
    rider_name:(ridersResult.data??[]).find((r:any)=>r.id===row.rider_id)?.full_name??"Rider",
    rider_email:(ridersResult.data??[]).find((r:any)=>r.id===row.rider_id)?.email??null,
  }));

  return json({
    success:true,
    riders:riderRows,
    zones:zonesResult.data??[],
    vendors:(vendorsResult.data??[]).map((vendor:any)=>({
      ...vendor,
      zone_id:(vendorZonesResult.data??[]).find((row:any)=>row.vendor_id===vendor.id)?.zone_id??null,
    })),
    vendorZones:vendorZonesResult.data??[],
    assignments:assignmentsResult.data??[],
    coverage,
    refreshedAt:new Date().toISOString(),
  });
}

export async function POST(request:Request) {
  const access=await requireMkhAdmin();
  if (!access.ok) return json({success:false,message:access.message},access.status);

  let body:any;
  try { body=await request.json(); } catch { return json({success:false,message:"Invalid assignment request."},400); }
  const action=String(body?.action??"");
  const reason=typeof body?.reason==="string"?body.reason.trim():"";
  if(reason.length<10||reason.length>500) return json({success:false,message:"Enter a reason between 10 and 500 characters."},400);

  let result:any=null;
  if(action==="assign_home_zone") {
    if(!UUID.test(String(body.riderId??""))||!UUID.test(String(body.zoneId??""))) {
      return json({success:false,message:"Select a valid rider and home zone."},400);
    }
    const {data,error}=await adminClient.rpc("mkh_admin_assign_rider_home_zone",{
      p_actor_id:access.userId,p_rider_id:body.riderId,p_zone_id:body.zoneId,p_reason:reason,
    });
    if(error) {
      console.error("Admin rider home-zone assignment failed:",error);
      return json({success:false,message:error.message||"Unable to assign rider home zone."},409);
    }
    result=data;
  } else if(action==="add_vendor_rider"||action==="remove_vendor_rider") {
    if(!UUID.test(String(body.riderId??""))||!UUID.test(String(body.vendorId??""))) {
      return json({success:false,message:"Select a valid rider and vendor."},400);
    }
    const {data,error}=await adminClient.rpc("mkh_admin_update_vendor_rider_coverage",{
      p_actor_id:access.userId,
      p_vendor_id:body.vendorId,
      p_rider_id:body.riderId,
      p_action:action==="add_vendor_rider"?"add":"remove",
      p_reason:reason,
    });
    if(error) {
      console.error("Admin vendor rider coverage update failed:",error);
      return json({success:false,message:error.message||"Unable to update vendor rider coverage."},409);
    }
    result=data;
  } else {
    return json({success:false,message:"Unknown rider dispatch action."},400);
  }

  return json({success:true,result});
}
