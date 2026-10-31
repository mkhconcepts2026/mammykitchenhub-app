"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Activity, Bike, Building2, Clock3, LogOut, MapPin, RefreshCw, Store } from "lucide-react";

type DashboardData = {
  assigned: boolean;
  message?: string;
  manager?: { name: string };
  zone?: { id: string; name: string; code: string | null; territory_id: string };
  territory?: { id: string; name: string } | null;
  trm?: { name: string } | null;
  metrics?: { activeVendors: number; openOrders: number; waitingForPickup: number; deliveredToday: number };
  vendors?: Array<{ id: string; name: string; status: string; location: string | null }>;
  orders?: Array<{ id: string; order_number: string | null; vendor_id: string; vendor_name: string; rider_name: string | null; status: string; created_at: string }>;
  refreshedAt?: string;
};

const dateTime = (value: string) => new Date(value).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function statusClass(status: string) {
  const key = status.toLowerCase();
  if (["delivered", "ready_for_pickup"].includes(key)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (["preparing", "picked_up", "assigned"].includes(key)) return "bg-blue-50 text-blue-700 border-blue-200";
  if (["cancelled", "failed"].includes(key)) return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export default function ZonalManagerDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"overview" | "vendors" | "orders">("overview");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/zm/dashboard", { cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok || result?.success !== true) {
        throw new Error(result?.message || "Unable to load the Zone Manager dashboard.");
      }
      setData(result as DashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the Zone Manager dashboard.");
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
  const nav = [
    { id: "overview", label: "Overview" },
    { id: "vendors", label: "My vendors" },
    { id: "orders", label: "Zone orders" },
  ] as const;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-orange-700"><MapPin size={22} /></div>
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">Mammy Kitchen Hub</p><h1 className="text-xl font-black">Zone Manager Dashboard</h1></div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={15} className={loading ? "animate-spin" : ""}/>Refresh</button>
            <button onClick={() => void logout()} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"><LogOut size={15}/>Sign out</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
        {loading && !data ? <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">Loading your zone operations…</div> : null}
        {data && !data.assigned && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 className="text-lg font-bold text-amber-900">Zone assignment required</h2><p className="mt-1 text-sm text-amber-800">{data.message}</p><p className="mt-3 text-sm text-amber-800">Please contact Admin to complete your ZM → Zone assignment.</p></section>}
        {data?.assigned && (
          <>
            <section className="relative overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-sm sm:p-8">
              <div className="pointer-events-none absolute -right-14 -top-20 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
              <div className="relative flex flex-wrap items-end justify-between gap-6">
                <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-300">Zone operations centre</p><h2 className="mt-2 text-3xl font-black sm:text-4xl">Welcome, {data.manager?.name}</h2><p className="mt-3 text-slate-300">Your operational coverage and service activity, limited to your assigned zone.</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4"><p className="text-xs uppercase tracking-wider text-slate-400">Assigned zone</p><p className="mt-1 text-xl font-bold">{data.zone?.name}</p><p className="text-sm text-slate-300">{data.territory?.name ?? "Territory not loaded"}{data.zone?.code ? ` · ${data.zone.code}` : ""}</p><p className="mt-2 text-xs text-orange-200">TRM: {data.trm?.name ?? "Not resolved"}</p></div>
              </div>
            </section>

            <nav className="flex flex-wrap gap-2" aria-label="Zone dashboard sections">
              {nav.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${tab === item.id ? "bg-orange-600 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"}`}>{item.label}</button>)}
            </nav>

            {tab === "overview" && (
              <>
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Active vendors", value: metrics?.activeVendors ?? 0, icon: Store },
                    { label: "Open orders", value: metrics?.openOrders ?? 0, icon: Activity },
                    { label: "Waiting for pickup", value: metrics?.waitingForPickup ?? 0, icon: Bike },
                    { label: "Delivered today", value: metrics?.deliveredToday ?? 0, icon: Clock3 },
                  ].map((card) => { const Icon = card.icon; return <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-500">{card.label}</p><Icon className="text-orange-600" size={20}/></div><p className="mt-3 text-3xl font-black tabular-nums">{card.value}</p></article>; })}
                </section>
                <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                  <article className="rounded-2xl border border-slate-200 bg-white p-5"><div className="mb-4 flex items-center justify-between"><div><h3 className="text-lg font-bold">Latest zone orders</h3><p className="text-sm text-slate-500">Operational visibility across your zone.</p></div><button onClick={() => setTab("orders")} className="text-sm font-semibold text-orange-700">View all</button></div><OrderList orders={(data.orders ?? []).slice(0, 6)} /></article>
                  <article className="rounded-2xl border border-slate-200 bg-white p-5"><div className="mb-4 flex items-center justify-between"><div><h3 className="text-lg font-bold">Zone vendor coverage</h3><p className="text-sm text-slate-500">Vendors assigned to your zone.</p></div><Building2 className="text-orange-600"/></div><VendorList vendors={(data.vendors ?? []).slice(0, 8)} /></article>
                </section>
              </>
            )}
            {tab === "vendors" && <section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="mb-4 text-lg font-bold">Vendors in {data.zone?.name}</h3><VendorList vendors={data.vendors ?? []} /></section>}
            {tab === "orders" && <section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="mb-4 text-lg font-bold">Zone order board</h3><OrderList orders={data.orders ?? []} /></section>}
            <p className="text-xs text-slate-400">Read-only operations preview. Order fulfilment actions will be added after the agreed fulfilment walkthrough. Last refreshed: {data.refreshedAt ? dateTime(data.refreshedAt) : "just now"}.</p>
          </>
        )}
      </div>
    </main>
  );
}

function VendorList({ vendors }: { vendors: NonNullable<DashboardData["vendors"]> }) {
  if (!vendors.length) return <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">No active vendors are currently assigned to this zone.</p>;
  return <div className="divide-y divide-slate-100">{vendors.map((vendor) => <div key={vendor.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="truncate font-semibold">{vendor.name}</p><p className="truncate text-xs text-slate-500">{vendor.location || "Location not recorded"}</p></div><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${vendor.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{vendor.status}</span></div>)}</div>;
}

function OrderList({ orders }: { orders: NonNullable<DashboardData["orders"]> }) {
  if (!orders.length) return <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">No orders found for this zone yet.</p>;
  return <div className="divide-y divide-slate-100">{orders.map((order) => <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="font-semibold">{order.order_number || `Order ${order.id.slice(0, 8)}`}</p><p className="text-xs text-slate-500">{order.vendor_name} · {dateTime(order.created_at)}</p><p className="text-xs text-slate-500">{order.rider_name ? `Rider: ${order.rider_name}` : "Awaiting rider assignment"}</p></div><div className="flex items-center gap-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(order.status)}`}>{order.status.replace(/_/g, " ")}</span></div></div>)}</div>;
}
