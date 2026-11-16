"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Bike, MapPin, ShieldAlert } from "lucide-react";

type Candidate={rider_id:string;full_name:string;email:string|null;home_zone_id:string;home_zone_name:string;distance_meters:number;gps_updated_at:string};
type DispatchOrder={
 id:string;order_number:string|null;vendor_id:string;vendor_name:string;vendor_zone_id:string;vendor_zone_name:string;
 payment_status:string;payment_method:string|null;created_at:string;delivery_address:string|null;
 active_offer:any|null;designated_riders:any[];designated_coverage_pending:boolean;
 can_cross_zone_dispatch:boolean;cross_zone_candidates:Candidate[];
};
type Response={success:boolean;message?:string;territory?:{id:string;name:string};orders:DispatchOrder[]};

function formatDistance(meters:number){return meters<1000?`${Math.round(meters)} m`:`${(meters/1000).toFixed(1)} km`;}

export default function CrossZoneDispatchPanel(){
 const [data,setData]=useState<Response|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [reasons,setReasons]=useState<Record<string,string>>({});
 const [riders,setRiders]=useState<Record<string,string>>({});
 const [savingOrder,setSavingOrder]=useState("");
 const load=useCallback(async()=>{
  try{
   setError("");
   const response=await fetch("/api/trm/rider-dispatch",{cache:"no-store"});
   const result=await response.json().catch(()=>null);
   if(!response.ok||result?.success!==true)throw new Error(result?.message||"Unable to load the cross-zone dispatch queue.");
   setData(result as Response);
  }catch(e){setError(e instanceof Error?e.message:"Unable to load the cross-zone dispatch queue.");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{
  void load();
  const id=window.setInterval(()=>void load(),15000);
  return()=>window.clearInterval(id);
 },[load]);

 async function dispatch(order:DispatchOrder){
  const riderId=riders[order.id]||"";
  const reason=reasons[order.id]||"";
  if(!riderId||reason.trim().length<10){setError("Select an available rider and enter a reason of at least 10 characters.");return;}
  setSavingOrder(order.id);setError("");setNotice("");
  try{
   const response=await fetch("/api/trm/rider-dispatch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderId:order.id,riderId,reason})});
   const result=await response.json().catch(()=>null);
   if(!response.ok||result?.success!==true)throw new Error(result?.message||"Cross-zone dispatch could not be created.");
   setNotice(`Pickup offer sent to the selected rider for ${order.order_number||"this order"}. The rider must accept it.`);
   setReasons(s=>({...s,[order.id]:""}));
   setRiders(s=>({...s,[order.id]:""}));
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Cross-zone dispatch failed.");}
  finally{setSavingOrder("");}
 }

 return(
  <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
   <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
    <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">TRM-authorised fallback</p><h2 className="mt-1 text-xl font-bold text-slate-900">Cross-zone rider dispatch</h2><p className="mt-1 text-sm text-slate-500">Only for a ready order after eligible designated vendor riders have received their offers. Home-zone assignments never change.</p></div>
    <button type="button" onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/>Refresh</button>
   </div>
   <div className="space-y-4 p-5">
    {error&&<div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
    {notice&&<div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</div>}
    {data?.territory&&<p className="text-xs font-semibold text-slate-500">Territory: {data.territory.name} · Refreshes every 15 seconds</p>}
    {loading&&!data?<p className="py-8 text-center text-sm text-slate-500">Loading ready orders and available riders…</p>:
     !data?.orders?.length?<p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">There are no unassigned Ready for Pickup orders in this territory.</p>:
     data.orders.map(order=><article key={order.id} className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
       <div><h3 className="font-bold text-slate-900">{order.order_number||order.id.slice(0,8)} · {order.vendor_name}</h3><p className="mt-1 text-xs text-slate-500">Vendor zone: {order.vendor_zone_name} · {order.payment_status==="paid"?"Paid":String(order.payment_method||"").toUpperCase()}</p><p className="mt-1 text-xs text-slate-500">Ready since {new Date(order.created_at).toLocaleString("en-NG")}</p></div>
       {order.active_offer?<span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Designated offer active · {new Date(order.active_offer.expires_at).toLocaleTimeString("en-NG")}</span>:<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">Unassigned</span>}
      </div>
      <div className="mt-3 rounded-lg bg-slate-50 p-3">
       <p className="text-xs font-semibold text-slate-600">Vendor coverage attempts</p>
       {order.designated_riders.length===0?<p className="mt-1 text-xs text-amber-800">No designated four-rider group is configured for this vendor. Contact Admin before cross-zone fallback.</p>:
        <div className="mt-2 flex flex-wrap gap-2">{order.designated_riders.map((r:any)=><span key={r.rider_id} className={`rounded-full px-2.5 py-1 text-xs ${r.already_offered?"bg-emerald-100 text-emerald-800":"bg-white text-slate-600 ring-1 ring-slate-200"}`}>{r.full_name} · {r.already_offered?"Offered":r.occupied?"Occupied":r.gps_live?"Available":"GPS stale"}</span>)}</div>}
      </div>
      {order.active_offer?<p className="mt-3 text-sm text-amber-800">Wait for the active 30-second pickup offer to be accepted, declined or expire before overriding.</p>:
       order.designated_coverage_pending?<p className="mt-3 text-sm text-amber-800">The eligible designated vendor rider group has not finished receiving offers. Let automatic dispatch run first.</p>:
       !order.can_cross_zone_dispatch?<p className="mt-3 text-sm text-slate-500">Cross-zone dispatch is not available. Check that the order is paid (or COD test), and the vendor has a verified Google business location.</p>:
       <div className="mt-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Bike className="h-4 w-4 text-orange-600"/>Available riders from other zones</div>
        {order.cross_zone_candidates.length===0?<p className="text-sm text-slate-500">No available rider with fresh GPS in another zone of this territory.</p>:
         <>
          <div className="grid gap-2 md:grid-cols-2">{order.cross_zone_candidates.map(r=><label key={r.rider_id} className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 ${riders[order.id]===r.rider_id?"border-orange-400 bg-orange-50":"border-slate-200"}`}><span className="flex min-w-0 items-center gap-2"><input type="radio" name={`rider-${order.id}`} checked={riders[order.id]===r.rider_id} onChange={()=>setRiders(s=>({...s,[order.id]:r.rider_id}))}/><span className="min-w-0"><strong className="block truncate text-sm">{r.full_name}</strong><span className="block text-xs text-slate-500">{r.home_zone_name} · GPS {Math.max(0,Math.floor((Date.now()-Date.parse(r.gps_updated_at))/1000))}s ago</span></span></span><span className="shrink-0 text-sm font-bold text-orange-700">{formatDistance(r.distance_meters)}</span></label>)}</div>
          <label className="block text-xs font-semibold text-slate-600">Dispatch reason (required)
           <textarea value={reasons[order.id]||""} onChange={e=>setReasons(s=>({...s,[order.id]:e.target.value}))} rows={2} placeholder="e.g. All designated vendor riders in Zone A are occupied." className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm font-normal"/>
          </label>
          <button type="button" onClick={()=>void dispatch(order)} disabled={savingOrder===order.id||!riders[order.id]||(reasons[order.id]||"").trim().length<10} className="rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40">{savingOrder===order.id?"Sending offer…":"Authorise cross-zone pickup offer"}</button>
         </>}
       </div>}
      <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-slate-500"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0"/>Rider proximity is calculated from fresh device GPS to the vendor's Admin-verified Google coordinates. Cross-zone deployment is temporary and audited.</p>
     </article>)}
   </div>
  </section>
 );
}
