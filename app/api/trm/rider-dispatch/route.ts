import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireOperationalEmployee } from "@/lib/server/operationalEmployeeContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRM_ROLES = ["trm", "territory", "territorymanager", "territoryrelationshipmanager"];
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, private" } });

function distanceMeters(aLat:number,aLng:number,bLat:number,bLng:number) {
  const rad=(x:number)=>x*Math.PI/180;
  const dLat=rad(bLat-aLat),dLng=rad(bLng-aLng);
  const a=Math.sin(dLat/2)**2+Math.cos(rad(aLat))*Math.cos(rad(bLat))*Math.sin(dLng/2)**2;
  return Math.round(6371008.8*2*Math.asin(Math.sqrt(Math.min(1,a))));
}

async function resolveTrmTerritory(employeeId:string) {
  const {data:assignments,error}=await adminClient
    .from("mkh_trm_territory_assignments")
    .select("territory_id")
    .eq("employee_id",employeeId)
    .eq("status","active")
    .limit(2);
  if(error) throw error;
  if(!assignments?.length) throw new Error("No active territory is assigned to your TRM account.");
  if(assignments.length!==1) throw new Error("Your TRM account has multiple active territory assignments. Contact Admin.");
  const {data:territory,error:territoryError}=await adminClient
    .from("territories").select("id,name,is_active").eq("id",assignments[0].territory_id).maybeSingle();
  if(territoryError||!territory||!territory.is_active) throw new Error("Your assigned territory is missing or inactive.");
  return territory;
}

export async function GET() {
  const access=await requireOperationalEmployee(TRM_ROLES,"Territory Relationship Manager");
  if("response" in access) return access.response;
  try {
    const territory=await resolveTrmTerritory(access.context.employee.id);
    const {data:zones,error:zonesError}=await adminClient.from("zones")
      .select("id,name,territory_id").eq("territory_id",territory.id).eq("is_active",true);
    if(zonesError) throw zonesError;
    const zoneIds=(zones??[]).map((z:any)=>z.id);
    if(!zoneIds.length) return json({success:true,territory:{id:territory.id,name:territory.name},orders:[],riders:[]});

    const {data:zoneLinks,error:zoneLinkError}=await adminClient.from("zone_vendors")
      .select("vendor_id,zone_id").in("zone_id",zoneIds).eq("status","active").is("unassigned_at",null);
    if(zoneLinkError) throw zoneLinkError;
    const vendorZoneIds=new Map<string,string[]>();
    for(const link of zoneLinks??[]) vendorZoneIds.set(link.vendor_id,[...(vendorZoneIds.get(link.vendor_id)??[]),link.zone_id]);
    const vendorIds=[...vendorZoneIds.entries()].filter(([,ids])=>ids.length===1).map(([id])=>id);
    if(!vendorIds.length) return json({success:true,territory:{id:territory.id,name:territory.name},orders:[],riders:[]});

    const [ordersResult,coverageResult,homeResult,profilesResult,locationsResult,vendorLocationsResult,activeOrdersResult] = await Promise.all([
      adminClient.from("orders").select("id,order_number,vendor_id,status,payment_status,payment_method,total,created_at,delivery_address,rider_id")
        .in("vendor_id",vendorIds).eq("status","ready_for_pickup").is("rider_id",null)
        .order("created_at",{ascending:true}).limit(250),
      adminClient.from("vendor_riders").select("vendor_id,rider_id").in("vendor_id",vendorIds).eq("status","active").is("unassigned_at",null),
      adminClient.from("rider_home_zone_assignments").select("rider_id,home_zone_id,availability_status")
        .in("home_zone_id",zoneIds).eq("status","active").is("unassigned_at",null),
      adminClient.from("profiles").select("id,full_name,email,status,role").eq("role","rider").eq("status","active"),
      adminClient.from("rider_locations").select("rider_id,latitude,longitude,updated_at").gte("updated_at",new Date(Date.now()-60_000).toISOString()),
      adminClient.from("vendor_business_locations")
        .select("vendor_id,latitude,longitude,address_verification_status,locality_match_status,locality_id,google_place_id")
        .in("vendor_id",vendorIds).eq("address_verification_status","verified").eq("locality_match_status","matched")
        .not("locality_id","is",null).not("google_place_id","is",null),
      adminClient.from("orders").select("rider_id,status").in("vendor_id",vendorIds)
        .in("status",["assigned","accepted","picked_up"]).not("rider_id","is",null),
    ]);
    const failure=[ordersResult.error,coverageResult.error,homeResult.error,profilesResult.error,locationsResult.error,vendorLocationsResult.error,activeOrdersResult.error].find(Boolean);
    if(failure) throw failure;

    const readyOrderIds=(ordersResult.data??[]).map((o:any)=>o.id);
    const initialOfferHistory=readyOrderIds.length
      ? await adminClient.from("rider_dispatch_offers").select("id,order_id,rider_id,offer_status,expires_at,dispatch_mode")
          .in("order_id",readyOrderIds)
      : {data:[],error:null} as any;
    if(initialOfferHistory.error) throw initialOfferHistory.error;

    // Expired offers are closed by the existing rider response RPC, which
    // writes the dispatch audit and advances the next designated rider.
    const expiredOffers=(initialOfferHistory.data??[]).filter((o:any)=>o.offer_status==="offered"&&Date.parse(o.expires_at)<=Date.now());
    for(const offer of expiredOffers){
      const result=await adminClient.rpc("mkh_rider_respond_to_dispatch_offer",{
        p_rider_id:offer.rider_id,p_offer_id:offer.id,p_action:"decline",
      });
      if(result.error) console.error("TRM expired pickup offer cleanup failed:",result.error.message);
    }

    const [offerHistoryResult,offersResult]=await Promise.all([
      readyOrderIds.length
        ? adminClient.from("rider_dispatch_offers").select("id,order_id,rider_id,offer_status,expires_at,dispatch_mode").in("order_id",readyOrderIds)
        : Promise.resolve({data:[],error:null} as any),
      adminClient.from("rider_dispatch_offers").select("id,order_id,rider_id,offer_status,expires_at,dispatch_mode")
        .in("offer_status",["offered","accepted"]),
    ]);
    if(offerHistoryResult.error||offersResult.error) throw offerHistoryResult.error||offersResult.error;

    const offers=offersResult.data??[];
    const offerHistory=offerHistoryResult.data??[];
    const activeOfferByOrder=new Map<string,any>();
    const activeOfferRiders=new Set<string>();
    for(const offer of offers){activeOfferByOrder.set(offer.order_id,offer);activeOfferRiders.add(offer.rider_id);}
    const offerHistoryByOrder=new Map<string,any[]>();
    for(const offer of offerHistory) offerHistoryByOrder.set(offer.order_id,[...(offerHistoryByOrder.get(offer.order_id)??[]),offer]);
    const ridersById=new Map((profilesResult.data??[]).map((p:any)=>[p.id,p]));
    const homeByRider=new Map((homeResult.data??[]).map((h:any)=>[h.rider_id,h]));
    const locationByRider=new Map((locationsResult.data??[]).map((l:any)=>[l.rider_id,l]));
    const activeOrderRiders=new Set((activeOrdersResult.data??[]).map((o:any)=>o.rider_id));
    const vendorCoverage=new Map<string,string[]>();
    for(const row of coverageResult.data??[]) vendorCoverage.set(row.vendor_id,[...(vendorCoverage.get(row.vendor_id)??[]),row.rider_id]);
    const vendorLocation=new Map((vendorLocationsResult.data??[]).map((v:any)=>[v.vendor_id,v]));

    const orders=(ordersResult.data??[]).map((order:any)=>{
      const vendorZone=vendorZoneIds.get(order.vendor_id)?.[0]??null;
      const vendorCoord=vendorLocation.get(order.vendor_id) as any;
      const activeOffer=activeOfferByOrder.get(order.id);
      const coverage=(vendorCoverage.get(order.vendor_id)??[]).map((riderId:string)=>{
        const home=homeByRider.get(riderId) as any;
        const profile=ridersById.get(riderId) as any;
        const loc=locationByRider.get(riderId) as any;
        return {
          rider_id:riderId,
          full_name:profile?.full_name??"Rider",
          home_zone_id:home?.home_zone_id??null,
          availability_status:home?.availability_status??"unavailable",
          gps_live:!!loc,
          gps_age_seconds:loc?Math.max(0,Math.floor((Date.now()-Date.parse(loc.updated_at))/1000)):null,
          already_offered:(offerHistoryByOrder.get(order.id)??[]).some((o:any)=>o.rider_id===riderId),
          occupied:activeOrderRiders.has(riderId)||activeOfferRiders.has(riderId),
        };
      });
      const eligibleDesignated=coverage.filter((r:any)=>r.home_zone_id===vendorZone&&r.availability_status==="available"&&r.gps_live&&!r.occupied&&!r.already_offered);
      const designatedStillPending=eligibleDesignated.length>0;
      const eligibleCrossZoneRiders=(homeResult.data??[]).filter((home:any)=>{
        if(home.home_zone_id===vendorZone||home.availability_status!=="available") return false;
        const profile=ridersById.get(home.rider_id) as any;
        const loc=locationByRider.get(home.rider_id) as any;
        return !!profile&&!!loc&&!activeOrderRiders.has(home.rider_id)&&!activeOfferRiders.has(home.rider_id);
      }).map((home:any)=>{
        const profile=ridersById.get(home.rider_id) as any;
        const loc=locationByRider.get(home.rider_id) as any;
        const vendorLat=Number(vendorCoord?.latitude),vendorLng=Number(vendorCoord?.longitude);
        const riderLat=Number(loc.latitude),riderLng=Number(loc.longitude);
        const validCoordinates=Number.isFinite(vendorLat)&&vendorLat>=-90&&vendorLat<=90&&Number.isFinite(vendorLng)&&vendorLng>=-180&&vendorLng<=180
          &&Number.isFinite(riderLat)&&riderLat>=-90&&riderLat<=90&&Number.isFinite(riderLng)&&riderLng>=-180&&riderLng<=180;
        const distance=validCoordinates
          ? distanceMeters(vendorLat,vendorLng,riderLat,riderLng)
          : null;
        const riderZone=(zones??[]).find((z:any)=>z.id===home.home_zone_id);
        return {rider_id:home.rider_id,full_name:profile.full_name??"Rider",email:profile.email,
          home_zone_id:home.home_zone_id,home_zone_name:riderZone?.name??"Home zone",
          distance_meters:distance,gps_updated_at:loc.updated_at};
      }).sort((a:any,b:any)=>(a.distance_meters??Number.MAX_SAFE_INTEGER)-(b.distance_meters??Number.MAX_SAFE_INTEGER));

      const paymentAllowed=order.payment_status==="paid"||["cash_on_delivery","cod"].includes(String(order.payment_method??"").toLowerCase());
      const vendorLat=Number(vendorCoord?.latitude),vendorLng=Number(vendorCoord?.longitude);
      const verifiedVendorOrigin=Number.isFinite(vendorLat)&&vendorLat>=-90&&vendorLat<=90&&Number.isFinite(vendorLng)&&vendorLng>=-180&&vendorLng<=180;
      return {
        id:order.id,order_number:order.order_number,vendor_id:order.vendor_id,
        vendor_name:(vendorIds.length?undefined:undefined),
        vendor_zone_id:vendorZone,vendor_zone_name:(zones??[]).find((z:any)=>z.id===vendorZone)?.name??"Zone",
        status:order.status,payment_status:order.payment_status,payment_method:order.payment_method,
        created_at:order.created_at,delivery_address:order.delivery_address,
        active_offer:activeOffer??null,
        designated_riders:coverage,
        designated_coverage_pending:designatedStillPending,
        can_cross_zone_dispatch:paymentAllowed&&verifiedVendorOrigin&&!activeOffer&&!designatedStillPending,
        cross_zone_candidates:eligibleCrossZoneRiders.filter((r:any)=>r.distance_meters!==null),
      };
    });

    const vendorNamesResult=await adminClient.from("vendors").select("id,name").in("id",vendorIds);
    if(vendorNamesResult.error) throw vendorNamesResult.error;
    const vendorNames=new Map((vendorNamesResult.data??[]).map((v:any)=>[v.id,v.name]));
    for(const order of orders)(order as any).vendor_name=vendorNames.get((order as any).vendor_id)??"Vendor";

    return json({
      success:true,
      territory:{id:territory.id,name:territory.name},
      orders,
      riders:orders.flatMap((order:any)=>order.cross_zone_candidates).filter((r:any,i:number,all:any[])=>all.findIndex(x=>x.rider_id===r.rider_id)===i),
      refreshedAt:new Date().toISOString(),
    });
  } catch(error){
    console.error("TRM rider dispatch queue failed:",error);
    const message=error instanceof Error?error.message:"Unable to load cross-zone dispatch queue.";
    return json({success:false,message},500);
  }
}

export async function POST(request:Request) {
  const access=await requireOperationalEmployee(TRM_ROLES,"Territory Relationship Manager");
  if("response" in access) return access.response;
  let body:any;
  try{body=await request.json();}catch{return json({success:false,message:"A valid dispatch request is required."},400);}
  const orderId=String(body?.orderId??""),riderId=String(body?.riderId??""),reason=typeof body?.reason==="string"?body.reason.trim():"";
  if(!/^[0-9a-f-]{36}$/i.test(orderId)||!/^[0-9a-f-]{36}$/i.test(riderId))
    return json({success:false,message:"Select a valid ready order and rider."},400);
  if(reason.length<10||reason.length>500) return json({success:false,message:"Enter a dispatch reason between 10 and 500 characters."},400);
  const {data,error}=await adminClient.rpc("mkh_trm_dispatch_cross_zone_rider",{
    p_actor_id:access.context.userId,p_order_id:orderId,p_rider_id:riderId,p_reason:reason,
  });
  if(error) return json({success:false,message:error.message},409);
  return json({success:true,result:data});
}
