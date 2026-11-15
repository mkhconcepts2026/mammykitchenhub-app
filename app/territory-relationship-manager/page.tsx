"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MapPin, RefreshCw, Store, Bike, Package, AlertTriangle, Wallet } from "lucide-react";

type DashboardData = {
  success: boolean;
  assigned: boolean;
  message?: string;
  manager?: { name: string };
  territory?: { id: string; name: string } | null;
  metrics?: {
    todayOrders: number;
    todayRevenue: number;
    activeRiders: number;
    activeVendors: number;
    openExceptions: number;
    averageSLA: number | null;
  };
  liveEvents?: Array<{
    id: string;
    title: string | null;
    event_type: string;
    description: string | null;
    created_at: string;
  }>;
  refreshedAt?: string;
};

const formatNaira = (value: number) => `₦${Number(value ?? 0).toLocaleString("en-NG")}`;
const formatTime = (value?: string) => value ? new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function TerritoryRelationshipManagerDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setError("");
      const response = await fetch("/api/trm/workspace?section=overview", { cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) {
        throw new Error(result?.message || "Unable to load your territory dashboard.");
      }
      setData(result as DashboardData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load your territory dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
    const refresh = window.setInterval(() => void loadDashboard(), 45_000);
    return () => window.clearInterval(refresh);
  }, [loadDashboard]);

  const metrics = data?.metrics;
  const cards = [
    { title: "Today's Orders", value: metrics?.todayOrders ?? "—", icon: Package, style: "border-orange-500 bg-orange-50" },
    { title: "Revenue Today", value: metrics ? formatNaira(metrics.todayRevenue) : "—", icon: Wallet, style: "border-amber-500 bg-amber-50" },
    { title: "Active Riders", value: metrics?.activeRiders ?? "—", icon: Bike, style: "border-emerald-500 bg-emerald-50" },
    { title: "Active Vendors", value: metrics?.activeVendors ?? "—", icon: Store, style: "border-blue-500 bg-blue-50" },
    { title: "Open Exceptions", value: metrics?.openExceptions ?? "—", icon: AlertTriangle, style: "border-red-500 bg-red-50" },
    { title: "Average SLA", value: metrics?.averageSLA == null ? "N/A" : `${metrics.averageSLA} mins`, icon: RefreshCw, style: "border-slate-500 bg-slate-100" },
  ];

  const actions = [
    { title: "Live Operations", detail: "Monitor current territory activity", href: "/territory-relationship-manager/live-operations" },
    { title: "Orders", detail: "View territory orders", href: "/territory-relationship-manager/orders" },
    { title: "Riders", detail: "View territory riders", href: "/territory-relationship-manager/riders" },
    { title: "Vendors", detail: "View territory vendors", href: "/territory-relationship-manager/vendors" },
    { title: "Territory Map", detail: "View assigned rider locations", href: "/territory-relationship-manager/territory-map" },
    { title: "Finance", detail: "View territory financial records", href: "/territory-relationship-manager/finance" },
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-[#F97316] px-7 py-5 shadow-lg">
        <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[#D4AF37]/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#0F172A]">MAMMY KITCHEN HUB</p>
            <h1 className="mt-2 text-2xl font-black leading-tight text-white md:text-3xl">Territory Relationship Manager Operations Center</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-orange-50">Monitor operations, vendors, riders and orders assigned to your territory.</p>
            {data?.assigned && data.territory?.name && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-xs font-semibold text-white">
                <MapPin size={14} /> Your territory: {data.territory.name}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-md">
            <span className={`h-3 w-3 rounded-full ${data?.assigned ? "bg-emerald-500" : "bg-amber-500"}`} />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">System status</p>
              <p className="text-xl font-black text-slate-900">{loading ? "LOADING" : data?.assigned ? "ONLINE" : "CHECK ASSIGNMENT"}</p>
            </div>
          </div>
        </div>
      </section>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {data && !data.assigned && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{data.message || "An active territory assignment is required."}</div>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">{data?.manager?.name || "Territory Relationship Manager"}</p>
          <p className="text-xs text-slate-500">{data?.territory?.name || "Territory not assigned"} · Server-verified territory view</p>
        </div>
        <button type="button" onClick={() => void loadDashboard()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""}/> Refresh dashboard
        </button>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className={`rounded-xl border-l-4 ${card.style} p-5 shadow-sm`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-500">{card.title}</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{card.value}</p>
                </div>
                <Icon className="text-slate-500" size={24}/>
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-xl font-bold text-slate-900">Executive Quick Actions</h2>
          <p className="mt-1 text-sm text-slate-500">Each workspace displays information assigned to your territory.</p>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {actions.map((action) => (
            <Link key={action.href} href={action.href} className="rounded-xl border border-slate-200 p-4 transition hover:border-orange-300 hover:bg-orange-50">
              <p className="font-semibold text-slate-900">{action.title}</p>
              <p className="mt-1 text-xs text-slate-500">{action.detail}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Territory Activity</h2>
            <p className="mt-1 text-sm text-slate-500">Recent events from orders belonging to your assigned territory.</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Territory-scoped feed</span>
        </div>
        <div className="divide-y divide-slate-100">
          {loading && !data ? <p className="p-6 text-sm text-slate-500">Loading territory activity…</p> : !data?.liveEvents?.length ? <p className="p-6 text-sm text-slate-500">No order events for this territory yet.</p> : data.liveEvents.map((event) => (
            <div key={event.id} className="px-6 py-4">
              <p className="text-sm font-semibold text-slate-800">{event.title || event.event_type.replace(/_/g, " ")}</p>
              <p className="mt-1 text-sm text-slate-500">{event.description || "Territory order activity"}</p>
              <p className="mt-1 text-xs text-slate-400">{formatTime(event.created_at)}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs text-slate-400">Server-scoped territory data. Refreshed: {formatTime(data?.refreshedAt)}. Average SLA displays N/A when no completed delivery sample exists.</p>
    </div>
  );
}
