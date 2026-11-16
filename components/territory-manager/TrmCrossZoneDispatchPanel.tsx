"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type DispatchSnapshot = {
  territory_name?: string;
  zones?: any[];
  riders?: any[];
  vendors?: any[];
  ready_orders?: any[];
  active_offers?: any[];
};

export default function TrmCrossZoneDispatchPanel() {
  const [supabase] = useState(() => createClient());
  const [snapshot, setSnapshot] = useState<DispatchSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingOrderId, setSavingOrderId] = useState("");
  const [selectedRiders, setSelectedRiders] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState("");

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    const { data, error } = await supabase.rpc("mkh_trm_get_dispatch_snapshot");
    if (error) {
      setSnapshot(null);
      setErrorMessage(error.message || "Unable to load this TRM's dispatch view.");
    } else {
      setSnapshot((data || {}) as DispatchSnapshot);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    const channel = supabase
      .channel("trm-rider-dispatch-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => { void loadSnapshot(); }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_events",
          filter: "event_type=eq.rider_dispatch_offer",
        },
        () => { void loadSnapshot(); }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadSnapshot, supabase]);

  const riders = snapshot?.riders ?? [];
  const orders = snapshot?.ready_orders ?? [];
  const activeOffers = snapshot?.active_offers ?? [];

  const readyCount = useMemo(
    () => orders.length,
    [orders]
  );

  async function requestCrossZoneOffer(order: any) {
    const riderId = selectedRiders[order.id] || "";
    const reason = (reasons[order.id] || "").trim();
    if (!riderId) {
      alert("Select an eligible rider from another zone in your territory.");
      return;
    }
    if (reason.length < 10) {
      alert("Enter a clear reason of at least 10 characters.");
      return;
    }

    setSavingOrderId(order.id);
    const { error } = await supabase.rpc("mkh_trm_create_cross_zone_dispatch_offer", {
      p_order_id: order.id,
      p_rider_id: riderId,
      p_reason: reason,
    });
    setSavingOrderId("");
    if (error) {
      alert(error.message);
      await loadSnapshot();
      return;
    }
    setReasons((current) => ({ ...current, [order.id]: "" }));
    await loadSnapshot();
  }

  return (
    <section className="mb-8 space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Territory operations · temporary dispatch only</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">Rider dispatch & cross-zone support</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {snapshot?.territory_name ? `Territory: ${snapshot.territory_name}. ` : ""}
            The vendor's verified four-rider group is offered first. You may request a temporary cross-zone offer only after that process has no eligible first-line rider.
          </p>
        </div>
        <button type="button" onClick={() => void loadSnapshot()} disabled={loading} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {loading ? "Refreshing…" : "Refresh dispatch"}
        </button>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div>
      )}

      {loading && !snapshot ? (
        <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">Loading territory dispatch records…</div>
      ) : snapshot ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ready orders</p><p className="mt-1 text-2xl font-black">{readyCount}</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active offers / assignments</p><p className="mt-1 text-2xl font-black">{activeOffers.length}</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">GPS-fresh eligible riders</p><p className="mt-1 text-2xl font-black">{riders.filter((rider: any) => rider.dispatch_eligible).length}</p></div>
          </div>

          {activeOffers.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-bold text-slate-900">Current territory offers</h3>
              {activeOffers.map((offer: any) => (
                <div key={offer.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">
                  <span><strong>{offer.order_number || offer.order_id.slice(0, 8)}</strong> · {offer.vendor_name} · {offer.rider_name}</span>
                  <span className="font-semibold text-blue-800">{offer.offer_status.replaceAll("_", " ")} · {offer.dispatch_mode.replaceAll("_", " ")}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3">
            <h3 className="font-bold text-slate-900">Ready for Pickup orders</h3>
            {orders.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No unassigned Ready for Pickup orders in this territory.</p>
            ) : orders.map((order: any) => {
              const candidates = riders.filter(
                (rider: any) => rider.dispatch_eligible && rider.home_zone_id && rider.home_zone_id !== order.zone_id
              );
              const canFallback = Boolean(order.cross_zone_fallback_ready);
              const selectedRider = selectedRiders[order.id] || candidates[0]?.id || "";
              return (
                <article key={order.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{order.order_number || order.id.slice(0, 8)} · {order.vendor_name}</p>
                      <p className="mt-1 text-sm text-slate-500">Vendor zone: {order.zone_name} · Verified coverage: {order.coverage_count}/4</p>
                    </div>
                    {order.active_offer ? (
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
                        {order.active_offer.offer_status.replaceAll("_", " ")} · {order.active_offer.rider_name}
                      </span>
                    ) : order.payment_eligible ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">Awaiting eligible pickup</span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Payment not yet confirmed</span>
                    )}
                  </div>

                  {order.active_offer ? (
                    <p className="mt-3 text-sm text-slate-600">The designated rider has an outstanding offer or accepted assignment. Cross-zone override is not available while it remains active.</p>
                  ) : !order.payment_eligible ? (
                    <p className="mt-3 text-sm text-amber-800">Dispatch stays blocked until payment is confirmed under the current MKH payment rules.</p>
                  ) : !canFallback ? (
                    <p className="mt-3 text-sm text-slate-600">The automatic vendor-coverage process has not exhausted the eligible designated riders. Refresh after the offer is answered or expires.</p>
                  ) : candidates.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-600">No eligible rider from another zone in this territory is currently online, available and reporting fresh GPS.</p>
                  ) : (
                    <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1.4fr_auto] md:items-end">
                      <label className="text-xs font-semibold text-slate-600">
                        Eligible rider · home zone
                        <select value={selectedRider} onChange={(event) => setSelectedRiders((current) => ({ ...current, [order.id]: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800">
                          {candidates.map((rider: any) => <option key={rider.id} value={rider.id}>{rider.full_name} · {rider.home_zone_name}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        Required reason for temporary dispatch
                        <input value={reasons[order.id] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [order.id]: event.target.value }))} placeholder="Explain why vendor coverage is unavailable (min. 10 characters)" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                      </label>
                      <button type="button" onClick={() => void requestCrossZoneOffer(order)} disabled={savingOrderId === order.id || reasons[order.id]?.trim().length < 10} className="rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50">
                        {savingOrderId === order.id ? "Sending…" : "Send cross-zone offer"}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}
