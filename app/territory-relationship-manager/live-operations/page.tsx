"use client";

import { useCallback, useEffect, useState } from "react";
import TerritoryActivityFeed from "@/components/territory-manager/TerritoryActivityFeed";

type OrderRow = any;
type LiveResponse = {
  success: boolean;
  assigned: boolean;
  message?: string;
  territory?: { id: string; name: string } | null;
  orders?: OrderRow[];
  territoryEvents?: any[];
  snapshot?: { ridersOnline: number; activeDeliveries: number; readyOrders: number; operationalHealth: string };
};

function waitingMinutes(createdAt: string) {
  const timestamp = new Date(createdAt).getTime();
  return Number.isFinite(timestamp) ? Math.max(0, Math.floor((Date.now() - timestamp) / 60000)) : 0;
}

export default function LiveOperationsPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [snapshot, setSnapshot] = useState({ ridersOnline: 0, activeDeliveries: 0, readyOrders: 0, operationalHealth: "Waiting" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [territoryName, setTerritoryName] = useState("your assigned territory");

  const loadWorkspace = useCallback(async () => {
    try {
      setError("");
      const response = await fetch("/api/trm/workspace?section=live", { cache: "no-store" });
      const result = await response.json().catch(() => null) as LiveResponse | null;
      if (!response.ok || result?.success !== true) throw new Error(result?.message || "Unable to load territory live operations.");
      setOrders(Array.isArray(result.orders) ? result.orders : []);
      setEvents(Array.isArray(result.territoryEvents) ? result.territoryEvents : []);
      if (result.snapshot) setSnapshot(result.snapshot);
      setTerritoryName(result.territory?.name || "your assigned territory");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load territory live operations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
    const timer = window.setInterval(() => void loadWorkspace(), 30_000);
    return () => window.clearInterval(timer);
  }, [loadWorkspace]);

  const alerts = orders
    .filter((order) => ["pending", "accepted", "preparing", "ready_for_pickup"].includes(String(order.status ?? "").toLowerCase()))
    .map((order) => {
      const minutes = waitingMinutes(order.created_at);
      const severity = minutes >= 30 ? "CRITICAL" : minutes >= 15 ? "ATTENTION" : "NORMAL";
      const colour = minutes >= 30 ? "bg-red-100 text-red-700" : minutes >= 15 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700";
      const status = String(order.status ?? "").replace(/_/g, " ").replace(/\b\w/g, (letter: string) => letter.toUpperCase());
      const action = order.status === "pending" ? "Monitor Vendor" : order.status === "accepted" ? "Monitor Kitchen" : order.status === "preparing" ? "Follow Up" : "Assign Rider";
      return { id: order.id, severity, colour, vendor: order.vendors?.name || "Vendor", stage: status, waiting: `${minutes} mins`, action };
    })
    .sort((a, b) => (a.severity === "CRITICAL" ? -1 : 0) - (b.severity === "CRITICAL" ? -1 : 0));

  const deliveries = orders.filter((order) => String(order.status ?? "").toLowerCase() === "picked_up");

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-[#0F172A] px-7 py-5 text-white shadow-lg">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-orange-400">MAMMY KITCHEN HUB</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black">Live Operations Center</h1>
            <p className="mt-1 text-sm text-slate-300">Operational activity for {territoryName} only.</p>
          </div>
          <span className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300">Server-scoped feed · 30s refresh</span>
        </div>
      </section>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { title: "Riders Online", value: snapshot.ridersOnline },
          { title: "Active Deliveries", value: snapshot.activeDeliveries },
          { title: "Ready for Pickup", value: snapshot.readyOrders },
        ].map((card) => (
          <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">{card.title}</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{loading ? "—" : card.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-xl font-bold text-slate-900">Operational Alerts</h2>
          <p className="mt-1 text-sm text-slate-500">Open order stages within {territoryName}.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50"><tr className="text-left text-xs font-bold uppercase text-slate-500"><th className="px-5 py-3">Severity</th><th className="px-5 py-3">Vendor</th><th className="px-5 py-3">Stage</th><th className="px-5 py-3">Waiting</th><th className="px-5 py-3">Suggested action</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="p-8 text-center text-sm text-slate-500">Loading territory orders…</td></tr> : alerts.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-sm text-slate-500">No open operational alerts in this territory.</td></tr> : alerts.map((item) => (
                <tr key={item.id} className="border-t border-slate-100"><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.colour}`}>{item.severity}</span></td><td className="px-5 py-4 font-medium text-slate-800">{item.vendor}</td><td className="px-5 py-4 capitalize">{item.stage}</td><td className="px-5 py-4">{item.waiting}</td><td className="px-5 py-4 text-sm text-slate-600">{item.action}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5"><h2 className="text-xl font-bold text-slate-900">Live Delivery Monitor</h2><p className="mt-1 text-sm text-slate-500">Orders currently on the road within {territoryName}.</p></div>
        <div className="overflow-x-auto"><table className="w-full"><thead className="bg-slate-50"><tr className="text-left text-xs font-bold uppercase text-slate-500"><th className="px-5 py-3">Order</th><th className="px-5 py-3">Vendor</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Rider</th><th className="px-5 py-3">Status</th></tr></thead><tbody>
          {deliveries.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-sm text-slate-500">No active deliveries in this territory.</td></tr> : deliveries.map((order) => <tr key={order.id} className="border-t border-slate-100"><td className="px-5 py-4 font-semibold">{order.order_number || order.id.slice(0, 8)}</td><td className="px-5 py-4">{order.vendors?.name || "Vendor"}</td><td className="px-5 py-4">{order.profiles?.full_name || "Customer"}</td><td className="px-5 py-4">{order.riders?.full_name || "Unassigned"}</td><td className="px-5 py-4"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">Out for delivery</span></td></tr>)}
        </tbody></table></div>
      </section>

      <TerritoryActivityFeed events={events.map((event: any) => ({
        id: event.id,
        orderNumber: event.orders?.order_number || "Order",
        vendor: event.orders?.vendors?.name || "Vendor",
        event: event.title || String(event.event_type || "Order update").replace(/_/g, " "),
        timestamp: event.created_at,
      }))} />
    </div>
  );
}
