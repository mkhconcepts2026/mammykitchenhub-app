import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function json(body:unknown,status=200){
  return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store, private"}});
}

async function riderSession(){
  const supabase=await createClient();
  const {data:{user},error}=await supabase.auth.getUser();
  if(error||!user) return {error:json({success:false,message:"Please sign in again."},401)} as const;
  const {data:profile,error:profileError}=await adminClient
    .from("profiles").select("id,full_name,email,role,status")
    .eq("id",user.id).maybeSingle();
  if(profileError||!profile||String(profile.role??"").toLowerCase()!=="rider"||String(profile.status??"").toLowerCase()!=="active"){
    return {error:json({success:false,message:"An active rider account is required."},403)} as const;
  }
  return {user,profile} as const;
}

export async function GET(){
  const session=await riderSession();
  if("error" in session) return session.error;
  const riderId=session.user.id;

  const {error:refreshError}=await adminClient.rpc("mkh_refresh_rider_dispatch_queue",{p_rider_id:riderId});
  if(refreshError) console.error("Rider dispatch queue refresh failed:",refreshError.message);

  const [homeResult,coverageResult,offerResult,locationResult,activeOrderResult]=await Promise.all([
    adminClient.from("rider_home_zone_assignments")
      .select("id,home_zone_id,availability_status,assigned_at,zones(id,name,territory_id,territories(id,name))")
      .eq("rider_id",riderId).eq("status","active").is("unassigned_at",null).maybeSingle(),
    adminClient.from("vendor_riders")
      .select("id,vendor_id,status,assigned_at,vendors(id,name)")
      .eq("rider_id",riderId).eq("status","active").is("unassigned_at",null),
    adminClient.from("rider_dispatch_offers")
      .select("id,order_id,vendor_id,home_zone_id,vendor_zone_id,dispatch_mode,distance_meters,offer_status,offered_at,expires_at,authorization_reason")
      .eq("rider_id",riderId).eq("offer_status","offered").gt("expires_at",new Date().toISOString())
      .order("offered_at",{ascending:false}),
    adminClient.from("rider_locations").select("updated_at,latitude,longitude").eq("rider_id",riderId).maybeSingle(),
    adminClient.from("orders").select("id,order_number,status,vendor_id").eq("rider_id",riderId).in("status",["assigned","accepted","picked_up"]).limit(1),
  ]);

  const error=homeResult.error||coverageResult.error||offerResult.error||locationResult.error||activeOrderResult.error;
  if(error){
    console.error("Rider dispatch dashboard load failed:",error);
    return json({success:false,message:"Unable to load your rider dispatch workspace."},500);
  }

  const offers=offerResult.data??[];
  const orderIds=[...new Set(offers.map((offer:any)=>offer.order_id).filter(Boolean))];
  const {data:orders,error:ordersError}=orderIds.length
    ? await adminClient.from("orders").select(`
        id,order_number,status,total,food_amount,delivery_fee,platform_fee,
        vendor_amount,rider_amount,mkh_amount,
        delivery_address,customer_notes,customer_phone,payment_method,payment_status,
        picked_up_at,created_at,delivery_quote_id,
        vendors:vendors!orders_vendor_id_fkey(name,location),
        profiles:profiles!orders_user_id_fkey(full_name,email,phone),
        order_items!order_items_order_id_fkey(id,name,quantity,price)
      `).in("id",orderIds)
    : {data:[],error:null} as any;
  if(ordersError){
    console.error("Rider dispatch offer order detail lookup failed:",ordersError);
    return json({success:false,message:"Unable to load pickup details."},500);
  }

  const orderById=new Map((orders??[]).map((order:any)=>[order.id,order]));
  const hydratedOffers=offers.map((offer:any)=>({
    ...offer,
    order:orderById.get(offer.order_id)??null,
  })).filter((offer:any)=>offer.order);

  const gpsUpdatedAt=locationResult.data?.updated_at??null;
  const gpsAge=gpsUpdatedAt?Math.max(0,Math.floor((Date.now()-Date.parse(gpsUpdatedAt))/1000)):null;

  return json({
    success:true,
    rider:{id:riderId,name:session.profile.full_name,email:session.profile.email},
    homeZone:homeResult.data?.zones??null,
    availabilityStatus:homeResult.data?.availability_status??"unassigned",
    vendorCoverage:(coverageResult.data??[]).map((row:any)=>({
      id:row.id,vendorId:row.vendor_id,vendorName:row.vendors?.name??"Vendor",
    })),
    gps:{updatedAt:gpsUpdatedAt,ageSeconds:gpsAge,status:gpsAge!==null&&gpsAge<=60?"live":"stale"},
    activeOrder:(activeOrderResult.data??[])[0]??null,
    offers:hydratedOffers,
    refreshedAt:new Date().toISOString(),
  });
}

export async function POST(request:Request){
  const session=await riderSession();
  if("error" in session) return session.error;
  let body:any;
  try{body=await request.json();}catch{return json({success:false,message:"Invalid rider dispatch request."},400);}

  const action=String(body?.action??"");
  if(action==="respond"){
    const offerId=String(body?.offerId??"");
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(offerId)||
       !["accept","decline"].includes(String(body?.decision??""))){
      return json({success:false,message:"Select a valid pickup offer and response."},400);
    }
    const {data,error}=await adminClient.rpc("mkh_rider_respond_to_dispatch_offer",{
      p_rider_id:session.user.id,p_offer_id:offerId,p_action:body.decision,
    });
    if(error){
      console.error("Rider dispatch response failed:",error);
      return json({success:false,message:error.message||"Unable to respond to this pickup offer."},409);
    }
    return json(data);
  }

  if(action==="availability"){
    const status=String(body?.status??"");
    if(!["available","unavailable"].includes(status)){
      return json({success:false,message:"Choose Available or Unavailable."},400);
    }
    const {data,error}=await adminClient.rpc("mkh_rider_set_dispatch_availability",{
      p_rider_id:session.user.id,p_availability_status:status,
    });
    if(error){
      console.error("Rider availability update failed:",error);
      return json({success:false,message:error.message||"Unable to update rider availability."},409);
    }
    if(status==="available"){
      const refresh=await adminClient.rpc("mkh_refresh_rider_dispatch_queue",{p_rider_id:session.user.id});
      if(refresh.error) console.error("Rider dispatch refresh after availability change failed:",refresh.error.message);
    }
    return json(data);
  }

  if(action==="refresh"){
    const {data,error}=await adminClient.rpc("mkh_refresh_rider_dispatch_queue",{p_rider_id:session.user.id});
    if(error){
      console.error("Rider dispatch refresh failed:",error);
      return json({success:false,message:"Unable to refresh pickup offers."},500);
    }
    return json({success:true,offersRefreshed:data??0});
  }

  return json({success:false,message:"Unknown rider dispatch action."},400);
}
