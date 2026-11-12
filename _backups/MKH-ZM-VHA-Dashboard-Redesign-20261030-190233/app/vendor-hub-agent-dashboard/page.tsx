"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ClipboardList, Clock3, LogOut, PackageCheck, RefreshCw, Store } from "lucide-react";

type VhaOrder = {
  id: string;
  order_number: string | null;
  status: string;
  created_at: string;
  rider_id: string | null;
  rider_name: string | null;
  order_items?: Array<{ id: string; name: string; quantity: number }>;
};

type DashboardData = {
  success: boolean;
  assigned: boolean;
  message?: string;
  agent?: { name: string };
  vendor?: { id: string; name: string; status: string; location: string | null; owner_name: string | null };
  metrics?: { activeOrders: number; awaitingAcceptance: number; preparing: number; readyForPickup: number; completedToday: number };
  orders?: VhaOrder[];
  refreshedAt?: string;
};

const dateTime = (value: string) => new Date(value).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function statusClass(status: string) {
  const key = status.toLowerCase();
  if (["delivered", "ready_for_pickup"].includes(key)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["preparing", "picked_up", "assigned"].includes(key)) return "border-blue-200 bg-blue-50 text-blue-700";
  if (["cancelled", "failed"].includes(key)) return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export default function VendorHubAgentDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/vha/dashboard", { cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok || result?.success !== true) {
        throw new Error(result?.message || "Unable to load the Vendor Hub Agent dashboard.");
      }
      setData(result as DashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the Vendor Hub Agent dashboard.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
  }

  const metrics = data?.metrics;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-orange-700"><Store size={22}/></div><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">Mammy Kitchen Hub</p><h1 className="text-xl font-black">Vendor Hub Agent</h1></div></div>
          <div className="flex items-center gap-2"><button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={15} className={loading ? "animate-spin" : ""}/>Refresh</button><button onClick={() => void logout()} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"><LogOut size={15}/>Sign out</button></div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
        {loading && !data && <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">Loading your assigned vendor…</div>}
        {data && !data.assigned && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 className="text-lg font-bold text-amber-900">Vendor assignment required</h2><p className="mt-1 text-sm text-amber-800">{data.message}</p><p className="mt-3 text-sm text-amber-800">Please contact Admin to complete your VHA → Vendor assignment.</p></section>}
        {data?.assigned && data.vendor && (
          <>
            <section className="relative overflow-hidden rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
              <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-orange-500/20 blur-3xl"/>
              <div className="relative flex flex-wrap items-end justify-between gap-5">
                <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-300">Vendor operations desk</p><h2 className="mt-2 text-3xl font-black sm:text-4xl">Hello, {data.agent?.name}</h2><p className="mt-3 text-slate-300">Your order preparation and handover overview.</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4"><p className="text-xs uppercase tracking-wider text-slate-400">Assigned vendor</p><p className="mt-1 text-xl font-bold">{data.vendor.name}</p><p className="text-sm text-slate-300">{data.vendor.location || "Location not recorded"}</p><p className="mt-2 text-xs text-orange-200">{data.vendor.owner_name || "Vendor owner not recorded"}</p></div>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {[
                { label: "Active orders", value: metrics?.activeOrders ?? 0, icon: ClipboardList },
                { label: "Awaiting acceptance", value: metrics?.awaitingAcceptance ?? 0, icon: Clock3 },
                { label: "Preparing", value: metrics?.preparing ?? 0, icon: PackageCheck },
                { label: "Ready for pickup", value: metrics?.readyForPickup ?? 0, icon: Store },
                { label: "Completed today", value: metrics?.completedToday ?? 0, icon: Clock3 },
              ].map((card) => { const Icon = card.icon; return <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-500">{card.label}</p><Icon size={19} className="text-orange-600"/></div><p className="mt-3 text-3xl font-black tabular-nums">{card.value}</p></article>; })}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-bold">Vendor order board</h3><p className="text-sm text-slate-500">Orders for {data.vendor.name}, newest first.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{data.orders?.length ?? 0} recent orders</span></div>
              {!data.orders?.length ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><p className="font-semibold text-slate-700">No orders yet</p><p className="mt-1 text-sm text-slate-500">New customer orders for your assigned vendor will appear here.</p></div> : (
                <div className="space-y-3">{data.orders.map((order) => <article key={order.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{order.order_number || `Order ${order.id.slice(0, 8)}`}</p><p className="mt-1 text-xs text-slate-500">Received {dateTime(order.created_at)}</p></div><div className="flex items-center gap-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(order.status)}`}>{order.status.replace(/_/g, " ")}</span></div></div><div className="mt-3 flex flex-wrap gap-2">{(order.order_items ?? []).map((item) => <span key={item.id} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-700">{item.quantity} × {item.name}</span>)}</div><p className="mt-3 text-xs text-slate-500">{order.rider_name ? `Rider: ${order.rider_name}` : "Rider not assigned yet"}</p></article>)}</div>
              )}
            </section>
            <p className="text-xs text-slate-400">This first release is an operational, read-only view. Order acceptance, preparation and handover controls will be connected after the order-fulfilment walkthrough. Last refreshed: {data.refreshedAt ? dateTime(data.refreshedAt) : "just now"}.</p>
          </>
        )}
      </div>
    </main>
  );
}
