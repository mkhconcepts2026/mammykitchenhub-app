"use client";

import { useEffect, useMemo, useState } from "react";

import RiderKPICards from "@/components/territory-manager/RiderKPICards";
import RiderTable from "@/components/territory-manager/RiderTable";
import RiderDrawer from "@/components/territory-manager/RiderDrawer";

import { RiderRecord } from "@/types/rider";

export default function RidersPage() {
  const [loading, setLoading] = useState(true);

  const [riders, setRiders] = useState<RiderRecord[]>([]);

  const [selectedRider, setSelectedRider] =
    useState<RiderRecord | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [crossZoneOrders,setCrossZoneOrders]=useState<any[]>([]);
  const [dispatchSelections,setDispatchSelections]=useState<Record<string,string>>({});
  const [dispatchReasons,setDispatchReasons]=useState<Record<string,string>>({});
  const [dispatchingOrderId,setDispatchingOrderId]=useState<string|null>(null);
  const [dispatchMessage,setDispatchMessage]=useState("");

  async function loadRiders() {
    try {
      setLoading(true);
      const response = await fetch("/api/trm/workspace?section=riders", { cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) {
        throw new Error(result?.message || "Unable to load riders assigned to your territory.");
      }
      const latestRiders = Array.isArray(result.riders) ? result.riders as RiderRecord[] : [];
      setRiders(latestRiders);
      const dispatchResponse=await fetch("/api/trm/rider-dispatch",{cache:"no-store"});
      const dispatchData=await dispatchResponse.json().catch(()=>null);
      if(!dispatchResponse.ok||dispatchData?.success!==true){
        throw new Error(dispatchData?.message||"Unable to load cross-zone dispatch orders.");
      }
      setCrossZoneOrders(Array.isArray(dispatchData.orders)?dispatchData.orders:[]);
    } catch (error) {
      console.error("Failed to load territory riders:", error);
    } finally {
      setLoading(false);
    }
  }
  async function dispatchCrossZone(orderId:string){
    const riderId=dispatchSelections[orderId]||"";
    const reason=(dispatchReasons[orderId]||"").trim();
    if(!riderId){setDispatchMessage("Select an available rider from another zone.");return;}
    if(reason.length<10){setDispatchMessage("Enter a reason of at least 10 characters for the cross-zone dispatch.");return;}
    setDispatchingOrderId(orderId);setDispatchMessage("");
    try{
      const response=await fetch("/api/trm/rider-dispatch",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({orderId,riderId,reason})
      });
      const result=await response.json().catch(()=>null);
      if(!response.ok||result?.success!==true)throw new Error(result?.message||"Cross-zone dispatch could not be issued.");
      setDispatchMessage("Pickup offer sent to the selected rider. Their home zone has not changed.");
      setDispatchReasons(current=>({...current,[orderId]:""}));
      await loadRiders();
    }catch(error){
      setDispatchMessage(error instanceof Error?error.message:"Cross-zone dispatch failed.");
    }finally{setDispatchingOrderId(null);}
  }


  useEffect(() => {
    void loadRiders();
    const refreshId = window.setInterval(() => void loadRiders(), 30_000);
    return () => window.clearInterval(refreshId);
  }, []);

  useEffect(() => {
    if (selectedRider && !riders.some((rider) => rider.id === selectedRider.id)) {
      setSelectedRider(null);
      setDrawerOpen(false);
    }
  }, [riders, selectedRider]);

  const totalRiders = riders.length;

  const activeRiders = useMemo(
    () =>
      riders.filter(
        (rider) =>
          rider.operational_status !== "offline"
      ).length,
    [riders]
  );

  const offlineRiders = useMemo(
    () =>
      riders.filter(
        (rider) =>
          rider.operational_status === "offline"
      ).length,
    [riders]
  );

  const outstandingWallet = useMemo(
    () =>
      riders.reduce(
        (sum, rider) =>
          sum + (rider.pending_balance ?? 0),
        0
      ),
    [riders]
  );

  return (
    <div className="space-y-8">

      {/* Hero */}

      <section className="relative overflow-hidden rounded-3xl bg-[#F97316] shadow-2xl">

        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#D4AF37]/20 blur-3xl" />

        <div className="absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex items-center justify-between px-10 py-8">

          <div>

            <p className="text-sm font-bold uppercase tracking-[0.35em] text-[#0F172A]">
              MAMMY KITCHEN HUB
            </p>

            <h1 className="mt-3 text-4xl font-black text-white">
              Rider Command Center
            </h1>

            <p className="mt-4 max-w-2xl text-orange-100">
              Supervise riders across your territory,
              monitor operational status and support
              delivery performance.
            </p>

          </div>

        </div>

      </section>

      <RiderKPICards
        totalRiders={totalRiders}
        activeRiders={activeRiders}
        offlineRiders={offlineRiders}
        outstandingWallet={outstandingWallet}
      />

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-orange-600">TRM authorised fallback</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Ready for Pickup — Cross-Zone Dispatch</h2>
          <p className="mt-1 text-sm text-slate-600">Only orders in your territory appear. Designated vendor riders are offered the order first; use a cross-zone rider only when the vendor coverage group has no eligible rider.</p>
        </div>
        {dispatchMessage&&<div role="status" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{dispatchMessage}</div>}
        {crossZoneOrders.length===0&&<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No unassigned orders are currently marked Ready for Pickup in this territory.</p>}
        <div className="space-y-3">
          {crossZoneOrders.map((order:any)=>(
            <div key={order.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-slate-900">{order.order_number||order.id}</p>
                  <p className="text-sm text-slate-600">{order.vendor_name} · {order.vendor_zone_name}</p>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">Ready for Pickup</span>
              </div>
              {order.active_offer?(
                <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">
                  Pickup offer already sent to <strong>{order.active_offer.rider_name}</strong> ({order.active_offer.dispatch_mode==="trm_cross_zone"?"cross-zone rider":"vendor coverage rider"}). Waiting for their response until {new Date(order.active_offer.expires_at).toLocaleTimeString("en-NG",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}.
                </div>
              ):order.designated_rider_available?(
                <p className="mt-3 text-sm text-amber-800">A designated vendor rider is available. Allow the automatic vendor-coverage offer to be accepted or declined first.</p>
              ):(
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">Available rider from another zone
                    <select value={dispatchSelections[order.id]||""} onChange={e=>setDispatchSelections(v=>({...v,[order.id]:e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3">
                      <option value="">Select rider</option>
                      {(order.cross_zone_riders||[]).map((r:any)=><option key={r.id} value={r.id}>{r.full_name} · {r.home_zone_name} · {(r.distance_meters/1000).toFixed(1)} km · GPS Live</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">Reason for cross-zone dispatch
                    <input value={dispatchReasons[order.id]||""} onChange={e=>setDispatchReasons(v=>({...v,[order.id]:e.target.value}))} maxLength={500} placeholder="Explain why this zone needs support" className="mt-1 w-full rounded-lg border border-slate-300 p-3"/>
                  </label>
                  <div className="md:col-span-2">
                    {(order.cross_zone_riders||[]).length===0&&<p className="mb-2 text-sm text-slate-500">No eligible cross-zone rider has fresh GPS and available status right now.</p>}
                    <button type="button" onClick={()=>void dispatchCrossZone(order.id)} disabled={dispatchingOrderId===order.id||(order.cross_zone_riders||[]).length===0} className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{dispatchingOrderId===order.id?"Sending offer…":"Send cross-zone pickup offer"}</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {riders.some((rider) => rider.wallet_scope_limited) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Some riders are linked to vendors outside this territory. Their account-wide wallet balances are hidden here to prevent cross-territory financial data exposure.
        </div>
      )}

      <RiderTable
        riders={riders}
        loading={loading}
        onView={(rider) => {
          setSelectedRider(rider);
          setDrawerOpen(true);
        }}
      />

      <RiderDrawer
        rider={selectedRider}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedRider(null);
        }}
      />

    </div>
  );
}