"use client";

import { useEffect, useState } from "react";

interface Props {
  order: any;
}

export default function AuditTrail({ order }: Props) {
  const [orderEvents, setOrderEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!order?.id) {
      setOrderEvents([]);
      return;
    }

    async function loadOrderEvents() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/trm/order-events?orderId=${encodeURIComponent(order.id)}`, { cache: "no-store" });
        const result = await response.json().catch(() => null);
        if (!response.ok || result?.success !== true) {
          throw new Error(result?.message || "Unable to load this order's audit trail.");
        }
        if (active) setOrderEvents(Array.isArray(result.events) ? result.events : []);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load this order's audit trail.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadOrderEvents();
    return () => { active = false; };
  }, [order?.id]);

  if (!order) return null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-8 py-6">
        <h2 className="text-2xl font-bold text-slate-900">Audit Trail</h2>
        <p className="mt-2 text-sm text-slate-500">Operational history for this territory order.</p>
      </div>
      <div className="divide-y divide-slate-100">
        {loading ? <p className="px-8 py-6 text-sm text-slate-500">Loading order history…</p> : error ? <p role="alert" className="px-8 py-6 text-sm text-red-700">{error}</p> : orderEvents.length === 0 ? <p className="px-8 py-6 text-sm text-slate-500">No audit events recorded for this order.</p> : orderEvents.map((event) => (
          <div key={event.id} className="flex items-center justify-between gap-4 px-8 py-5">
            <div><h3 className="font-semibold text-slate-900">{event.title || String(event.event_type || "Order update").replace(/_/g, " ")}</h3><p className="mt-1 text-xs text-slate-500">{event.description || event.actor_type || "Order activity"}</p></div>
            <div className="shrink-0 text-right"><p className="text-sm font-medium text-slate-700">{new Date(event.created_at).toLocaleDateString()}</p><p className="text-sm text-slate-500">{new Date(event.created_at).toLocaleTimeString()}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}
