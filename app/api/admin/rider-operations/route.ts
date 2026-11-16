import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireMkhAdmin } from "@/lib/server/mkhAdminAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, private" } });

export async function GET() {
  const access = await requireMkhAdmin();
  if (!access.ok) return json({ success: false, message: access.message }, access.status);

  const [r, z, v, h, c, zv, l, ha, ca] = await Promise.all([
    adminClient.from("profiles").select("id,full_name,email,status").eq("role","rider").order("full_name"),
    adminClient.from("zones").select("id,name,code,territory_id,is_active,territories:territory_id(id,name)").order("name"),
    adminClient.from("vendors").select("id,name,status").eq("status","active").order("name"),
    adminClient.from("rider_home_zone_assignments").select("id,rider_id,home_zone_id,status,availability_status,assigned_at,unassigned_at,assignment_reason").order("assigned_at",{ascending:false}),
    adminClient.from("vendor_riders").select("id,vendor_id,rider_id,status,assigned_at,unassigned_at").order("assigned_at",{ascending:false}),
    adminClient.from("zone_vendors").select("id,zone_id,vendor_id,status,unassigned_at").eq("status","active").is("unassigned_at",null),
    adminClient.from("rider_locations").select("rider_id,updated_at"),
    adminClient.from("rider_home_zone_assignment_audit").select("id,rider_id,previous_zone_id,new_zone_id,action,reason,created_at").order("created_at",{ascending:false}).limit(50),
    adminClient.from("vendor_rider_coverage_audit").select("id,vendor_id,rider_id,action,reason,created_at").order("created_at",{ascending:false}).limit(50),
  ]);
  const failure = [r.error,z.error,v.error,h.error,c.error,zv.error,l.error,ha.error,ca.error].find(Boolean);
  if (failure) {
    console.error("Admin rider operations load failed:", failure);
    return json({ success:false, message:"Unable to load rider zone and vendor coverage records." },500);
  }

  const riders = r.data ?? [], zones = z.data ?? [], vendors = v.data ?? [];
  const riderById = new Map(riders.map((x:any)=>[x.id,x]));
  const zoneById = new Map(zones.map((x:any)=>[x.id,x]));
  const vendorById = new Map(vendors.map((x:any)=>[x.id,x]));
  const homeByRider = new Map<string,any>();
  for (const row of h.data ?? []) if (row.status==="active" && !row.unassigned_at && !homeByRider.has(row.rider_id)) homeByRider.set(row.rider_id,row);
  const coverageByVendor = new Map<string,any[]>();
  const coverageByRider = new Map<string,any[]>();
  for (const row of c.data ?? []) if (row.status==="active" && !row.unassigned_at) {
    coverageByVendor.set(row.vendor_id,[...(coverageByVendor.get(row.vendor_id)??[]),row]);
    coverageByRider.set(row.rider_id,[...(coverageByRider.get(row.rider_id)??[]),row]);
  }
  const zoneVendorLinks = zv.data ?? [];
  const vendorZoneIds = new Map<string,string[]>();
  const zoneVendorIds = new Map<string,string[]>();
  for (const row of zoneVendorLinks) {
    vendorZoneIds.set(row.vendor_id,[...(vendorZoneIds.get(row.vendor_id)??[]),row.zone_id]);
    zoneVendorIds.set(row.zone_id,[...(zoneVendorIds.get(row.zone_id)??[]),row.vendor_id]);
  }
  const gpsByRider = new Map((l.data??[]).map((x:any)=>[x.rider_id,x.updated_at]));
  const riderRows = riders.map((x:any)=>{
    const home=homeByRider.get(x.id), zone=home?zoneById.get(home.home_zone_id):null, updated=gpsByRider.get(x.id) as string|null;
    const age=updated?Math.max(0,Math.floor((Date.now()-Date.parse(updated))/1000)):null;
    return {
      id:x.id,full_name:x.full_name,email:x.email,status:x.status,
      home_zone_id:home?.home_zone_id??null,home_zone_name:zone?.name??null,territory_id:zone?.territory_id??null,
      availability_status:home?.availability_status??null,gps_updated_at:updated,
      gps_age_seconds:age,gps_status:age!==null&&age<=60?"live":"stale",
      vendor_coverage:(coverageByRider.get(x.id)??[]).map((q:any)=>({vendor_id:q.vendor_id,vendor_name:vendorById.get(q.vendor_id)?.name??"Vendor"})),
    };
  });
  const vendorRows = vendors.map((x:any)=>{
    const assignedZones=vendorZoneIds.get(x.id)??[],zoneId=assignedZones.length===1?assignedZones[0]:null,zone=zoneId?zoneById.get(zoneId):null;
    const links=coverageByVendor.get(x.id)??[];
    return {...x,zone_id:zoneId,zone_name:zone?.name??null,territory_id:zone?.territory_id??null,
      active_zone_link_count:assignedZones.length,coverage_count:links.length,
      riders:links.map((q:any)=>({id:q.rider_id,full_name:riderById.get(q.rider_id)?.full_name??"Rider",email:riderById.get(q.rider_id)?.email??null}))};
  });
  const activeZones=zones.filter((x:any)=>x.is_active);
  const zoneRows=zones.map((x:any)=>{
    const ids=[...new Set(zoneVendorIds.get(x.id)??[])];
    return {id:x.id,name:x.name,code:x.code,territory_id:x.territory_id,territory_name:x.territories?.name??"Territory",
      is_active:x.is_active,active_vendor_count:ids.length,max_vendors:5,capacity_exception:ids.length>5,
      active_zone_count_for_territory:activeZones.filter((z:any)=>z.territory_id===x.territory_id).length,max_zones:6,
      vendors:ids.map((id)=>vendorById.get(id)?.name??"Vendor")};
  });
  return json({success:true,riders:riderRows,vendors:vendorRows,zones:zoneRows,
    limits:{max_zones_per_territory:6,max_vendors_per_zone:5,designated_riders_per_vendor:4},
    home_zone_audit:ha.data??[],vendor_coverage_audit:ca.data??[]});
}

export async function POST(request:Request) {
  const access=await requireMkhAdmin();
  if (!access.ok) return json({success:false,message:access.message},access.status);
  let body:any;
  try { body=await request.json(); } catch { return json({success:false,message:"A valid assignment request is required."},400); }
  const action=String(body?.action??""),riderId=String(body?.riderId??""),reason=typeof body?.reason==="string"?body.reason.trim():"";
  if(!/^[0-9a-f-]{36}$/i.test(riderId)) return json({success:false,message:"Select a valid rider."},400);
  if(reason.length<10||reason.length>500) return json({success:false,message:"Enter a reason between 10 and 500 characters."},400);
  let rpc:string, args:Record<string,unknown>;
  if(action==="assign_home_zone"){
    const zoneId=String(body.zoneId??"");
    if(!/^[0-9a-f-]{36}$/i.test(zoneId)) return json({success:false,message:"Select an active home zone."},400);
    rpc="mkh_admin_assign_rider_home_zone";
    args={p_actor_id:access.userId,p_rider_id:riderId,p_zone_id:zoneId,p_reason:reason};
  } else if(action==="add_vendor_coverage"||action==="remove_vendor_coverage"){
    const vendorId=String(body.vendorId??"");
    if(!/^[0-9a-f-]{36}$/i.test(vendorId)) return json({success:false,message:"Select an active vendor."},400);
    rpc="mkh_admin_update_vendor_rider_coverage";
    args={p_actor_id:access.userId,p_vendor_id:vendorId,p_rider_id:riderId,p_action:action==="add_vendor_coverage"?"add":"remove",p_reason:reason};
  } else return json({success:false,message:"Unknown rider assignment action."},400);
  const {data,error}=await adminClient.rpc(rpc,args);
  if(error) return json({success:false,message:error.message||"The assignment could not be saved."},409);
  return json({success:true,result:data});
}
