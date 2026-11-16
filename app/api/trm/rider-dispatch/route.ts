import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireOperationalEmployee } from "@/lib/server/operationalEmployeeContext";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const TRM_ROLES=["trm","territory","territorymanager","territoryrelationshipmanager"];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body:unknown,status=200){
  return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store, private"}});
}
function distanceMeters(aLat:number,aLng:number,bLat:number,bLng:number){
  const r=(n:number)=>n*Math.PI/180;
  const dLat=r(bLat-aLat),dLng=r(bLng-aLng);
  const x=Math.sin(dLat/2)**2+Math.cos(r(aLat))*Math.cos(r(bLat))*Math.sin(dLng/2)**2;
  return Math.round(6371008.8*2*Math.asin(Math.sqrt(Math.min(1,x))));
}

async function resolveTrmScope(employeeId:string){
  const {data:assignments,error}=await adminClient
    .from("mkh_trm_territory_assignments")
    .select("territory_id,assigned_at,status")
    .eq("employee_id",employeeId).eq("status","active")
    .order("assigned_at",{ascending:false}).limit(2);
  if(error)throw new Error("Unable to load TRM territory assignment.");
  if(!assignments?.length)throw new Error("No active territory is assigned to this TRM.");
  if(assignments.length!==1)throw new Error("This TRM has multiple active territory assignments. Contact Admin.");
  const {data:territory,error:territoryError}=await adminClient
    .from("territories").select("id,name,is_active")
    .eq("id",assignments[0].territory_id).maybeSingle();
  if(territoryError||!territory||territory.is_active!==true)throw new Error("The assigned territory is missing or inactive.");
  const {data:zones,error:zonesError}=await adminClient
    .from("zones").select("id,name,territory_id").eq("territory_id",territory.id).eq("is_active",true);
  if(zonesError)throw new Error("Unable to load active zones in this territory.");
  return {territory,zones:zones??[]};
}

export async function GET(){
  const access=await requireOperationalEmployee(TRM_ROLES,"Territory Relationship Manager");
  if("response" in access)return access.response;
  try{
    const {territory,zones}=await resolveTrmScope(access.context.employee.id);
    const zoneIds=zones.map((z:any)=>z.id);
    if(!zoneIds.length)return json({success:true,territory,orders:[],riders:[],refreshedAt:new Date().toISOString()});

    const [vendorLinksResult,homeResult]=await Promise.all([
      adminClient.from("zone_vendors").select("vendor_id,zone_id")
        .in("zone_id",zoneIds).eq("status","active").is("unassigned_at",null),
      adminClient.from("rider_home_zone_assignments")
        .select("rider_id,home_zone_id,availability_status")
        .in("home_zone_id",zoneIds).eq("status","active").is("unassigned_at",null),
    ]);
    if(vendorLinksResult.error||homeResult.error)throw new Error("Unable to load vendor or home-zone assignments.");

    const vendorsById=new Map<string,any>();
    for(const link of vendorLinksResult.data??[]){
      const previous=vendorsById.get(link.vendor_id);
      if(previous&&previous.zone_id!==link.zone_id)throw new Error("A vendor has duplicate active zone assignments. Contact Admin.");
      vendorsById.set(link.vendor_id,{vendor_id:link.vendor_id,zone_id:link.zone_id});
    }
    const vendorIds=[...vendorsById.keys()];
    const [vendorResult,ordersResult]=await Promise.all([
      vendorIds.length?adminClient.from("vendors").select("id,name,status").in("id",vendorIds):Promise.resolve({data:[],error:null} as any),
      vendorIds.length?adminClient.from("orders").select("id,order_number,vendor_id,status,payment_status,payment_method,total,created_at,delivery_address").in("vendor_id",vendorIds).eq("status","ready_for_pickup").is("rider_id",null).order("created_at",{ascending:true}).limit(200):Promise.resolve({data:[],error:null} as any),
    ]);
    if(vendorResult.error||ordersResult.error)throw new Error("Unable to load territory vendors or ready pickup orders.");
    const vendors=new Map((vendorResult.data??[]).map((v:any)=>[v.id,v]));
    const readyOrders=(ordersResult.data??[]).filter((order:any)=>{
      const vendor=vendors.get(order.vendor_id) as any;
      return vendor&&String(vendor.status??"").toLowerCase()==="active";
    });

    const riderIds=[...new Set((homeResult.data??[]).map((row:any)=>row.rider_id))];
    const [riderProfilesResult,locationsResult,activeOrdersResult,offersResult,coverageResult]=await Promise.all([
      riderIds.length?adminClient.from("profiles").select("id,full_name,email,phone,status,role").in("id",riderIds).eq("role","rider"):Promise.resolve({data:[],error:null} as any),
      riderIds.length?adminClient.from("rider_locations").select("rider_id,latitude,longitude,updated_at").in("rider_id",riderIds):Promise.resolve({data:[],error:null} as any),
      riderIds.length?adminClient.from("orders").select("rider_id,id,status").in("rider_id",riderIds).in("status",["assigned","accepted","picked_up"]):Promise.resolve({data:[],error:null} as any),
      riderIds.length?adminClient.from("rider_dispatch_offers").select("rider_id,id,offer_status").in("rider_id",riderIds).in("offer_status",["offered","accepted"]):Promise.resolve({data:[],error:null} as any),
      vendorIds.length?adminClient.from("vendor_riders").select("vendor_id,rider_id").in("vendor_id",vendorIds).eq("status","active").is("unassigned_at",null):Promise.resolve({data:[],error:null} as any),
    ]);
    const errors=riderProfilesResult.error||locationsResult.error||activeOrdersResult.error||offersResult.error||coverageResult.error;
    if(errors)throw new Error("Unable to load rider availability and GPS.");
    const profiles=new Map((riderProfilesResult.data??[]).map((p:any)=>[p.id,p]));
    const locations=new Map((locationsResult.data??[]).map((l:any)=>[l.rider_id,l]));
    const busy=new Set((activeOrdersResult.data??[]).map((x:any)=>x.rider_id));
    const hasOffer=new Set((offersResult.data??[]).map((x:any)=>x.rider_id));
    const coverageByVendor=new Map<string,string[]>();
    for(const row of coverageResult.data??[]){
      const list=coverageByVendor.get(row.vendor_id)??[];
      list.push(row.rider_id);coverageByVendor.set(row.vendor_id,list);
    }
    const homeByRider=new Map((homeResult.data??[]).map((h:any)=>[h.rider_id,h]));
    const now=Date.now();
    const riders=(homeResult.data??[]).map((home:any)=>{
      const profile:any=profiles.get(home.rider_id);
      const location:any=locations.get(home.rider_id);
      const age=location?.updated_at?Math.floor((now-Date.parse(location.updated_at))/1000):null;
      return {
        id:home.rider_id,
        full_name:profile?.full_name??"Rider",
        email:profile?.email??null,
        phone:profile?.phone??null,
        status:profile?.status??"inactive",
        home_zone_id:home.home_zone_id,
        home_zone_name:zones.find((z:any)=>z.id===home.home_zone_id)?.name??"Zone",
        availability_status:home.availability_status,
        gps_updated_at:location?.updated_at??null,
        gps_age_seconds:age,
        gps_status:age!==null&&age>=0&&age<=60?"live":"stale",
        latitude:location?.latitude??null,
        longitude:location?.longitude??null,
        operational_status:busy.has(home.rider_id)?"occupied":hasOffer.has(home.rider_id)?"offer_pending":"available",
        eligible:profile?.status==="active"&&home.availability_status==="available"&&age!==null&&age>=0&&age<=60&&!busy.has(home.rider_id)&&!hasOffer.has(home.rider_id),
      };
    });

    const originsResult=vendorIds.length
      ? await adminClient.from("vendor_business_locations")
          .select("vendor_id,business_address,latitude,longitude,google_place_id,address_verification_status,locality_match_status,verified_at")
          .in("vendor_id",vendorIds)
          .eq("address_verification_status","verified")
          .eq("locality_match_status","matched")
          .not("locality_id","is",null)
          .not("google_place_id","is",null)
      : {data:[],error:null} as any;
    if(originsResult.error)throw new Error("Unable to load verified vendor GPS origins.");
    const originByVendor=new Map<string,any>();
    for(const origin of originsResult.data??[]){
      const old=originByVendor.get(origin.vendor_id);
      if(!old||Date.parse(origin.verified_at??"")>Date.parse(old.verified_at??""))originByVendor.set(origin.vendor_id,origin);
    }

    const orders=readyOrders.map((order:any)=>{
      const vendor=vendors.get(order.vendor_id) as any;
      const vendorZoneId=vendorsById.get(order.vendor_id)?.zone_id;
      const origin=originByVendor.get(order.vendor_id);
      const originValid=origin&&Number.isFinite(Number(origin.latitude))&&Number.isFinite(Number(origin.longitude));
      const eligibleRiders=riders.filter((r:any)=>r.eligible&&r.home_zone_id!==vendorZoneId&&originValid&&Number.isFinite(Number(r.latitude))&&Number.isFinite(Number(r.longitude)))
        .map((r:any)=>({...r,distance_meters:distanceMeters(Number(r.latitude),Number(r.longitude),Number(origin.latitude),Number(origin.longitude))}))
        .sort((a:any,b:any)=>a.distance_meters-b.distance_meters);
      const vendorCoverage=coverageByVendor.get(order.vendor_id)??[];
      const designatedRiderAvailable=vendorCoverage.some((riderId:string)=>{
        const r=riders.find((candidate:any)=>candidate.id===riderId);
        return Boolean(r?.eligible&&r.home_zone_id===vendorZoneId&&originValid);
      });
      return {
        ...order,
        vendor_name:vendor?.name??"Vendor",
        vendor_zone_id:vendorZoneId,
        vendor_zone_name:zones.find((z:any)=>z.id===vendorZoneId)?.name??"Zone",
        verified_vendor_origin_available:Boolean(originValid),
        designated_rider_available:designatedRiderAvailable,
        cross_zone_riders:eligibleRiders,
      };
    });

    return json({success:true,territory,orders,riders:riders.map(({latitude,longitude,...r}:any)=>r),refreshedAt:new Date().toISOString()});
  }catch(error){
    console.error("TRM rider cross-zone dispatch workspace failed:",error);
    return json({success:false,message:error instanceof Error?error.message:"Unable to load cross-zone dispatch."},409);
  }
}

export async function POST(request:Request){
  const access=await requireOperationalEmployee(TRM_ROLES,"Territory Relationship Manager");
  if("response" in access)return access.response;
  let body:any;
  try{body=await request.json();}catch{return json({success:false,message:"Invalid cross-zone dispatch request."},400);}
  const orderId=String(body?.orderId??"");
  const riderId=String(body?.riderId??"");
  const reason=typeof body?.reason==="string"?body.reason.trim():"";
  if(!UUID.test(orderId)||!UUID.test(riderId)||reason.length<10||reason.length>500){
    return json({success:false,message:"Select a ready order, a rider and enter a reason between 10 and 500 characters."},400);
  }
  const {data,error}=await adminClient.rpc("mkh_trm_dispatch_cross_zone_rider",{
    p_actor_id:access.context.userId,p_order_id:orderId,p_rider_id:riderId,p_reason:reason,
  });
  if(error){
    console.error("TRM cross-zone dispatch failed:",error);
    return json({success:false,message:error.message||"Unable to issue this cross-zone pickup offer."},409);
  }
  return json({success:true,result:data});
}
