"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, RefreshCw } from "lucide-react";

type OrderEvent = {
  id: string;
  order_id: string;
  event_type: string;
  title: string | null;
  description: string | null;
  actor_type: string | null;
  actor_id: string | null;
  created_at: string;
};

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
    averageSLA: number;
  };
  liveEvents?: OrderEvent[];
  refreshedAt?: string;
};

const formatNaira = (amount: number) =>
  `₦${Number(amount || 0).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });

export default function TerritoryRelationshipManagerDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/trm/dashboard", { cache: "no-store" });
      const result = await response.json().catch(() => null);

      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok || result?.success !== true) {
        throw new Error(result?.message || "Unable to load your territory dashboard.");
      }
      setData(result as DashboardData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load your territory dashboard.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadDashboard();
    const refreshId = window.setInterval(() => void loadDashboard(), 45_000);
    return () => window.clearInterval(refreshId);
  }, [loadDashboard]);

  const metrics = data?.metrics;
  const cards = [
    {
      title: "Today's Orders",
      value: metrics?.todayOrders ?? 0,
      color: "border-orange-500",
      bg: "bg-orange-50",
      icon: "📦",
      description: "Orders created in your territory today",
    },
    {
      title: "Revenue Today",
      value: formatNaira(metrics?.todayRevenue ?? 0),
      color: "border-[#D4AF37]",
      bg: "bg-amber-50",
      icon: "💰",
      description: "Delivered order value in your territory",
    },
    {
      title: "Active Riders",
      value: metrics?.activeRiders ?? 0,
      color: "border-emerald-500",
      bg: "bg-emerald-50",
      icon: "🏍",
      description: "Active riders linked to territory vendors",
    },
    {
      title: "Active Vendors",
      value: metrics?.activeVendors ?? 0,
      color: "border-blue-500",
      bg: "bg-blue-50",
      icon: "🏪",
      description: "Active vendors assigned within your territory",
    },
    {
      title: "Open Exceptions",
      value: metrics?.openExceptions ?? 0,
      color: "border-red-500",
      bg: "bg-red-50",
      icon: "🚨",
      description: "Territory orders requiring attention",
    },
    {
      title: "Average SLA",
      value: `${metrics?.averageSLA ?? 0} mins`,
      color: "border-slate-500",
      bg: "bg-slate-100",
      icon: "⏱",
      description: "Today's accepted → delivered average",
    },
  ];

  const quickActions = [
    { icon: "🚨", title: "Dispatch", subtitle: "Operations", color: "bg-red-50 border-red-200" },
    { icon: "🏍", title: "Riders", subtitle: "Management", color: "bg-emerald-50 border-emerald-200" },
    { icon: "🏪", title: "Vendors", subtitle: "Center", color: "bg-orange-50 border-orange-200" },
    { icon: "📦", title: "Orders", subtitle: "Queue", color: "bg-blue-50 border-blue-200" },
    { icon: "💰", title: "Finance", subtitle: "Control", color: "bg-amber-50 border-amber-200" },
    { icon: "🗺", title: "Territory", subtitle: "Map", color: "bg-slate-100 border-slate-300" },
  ];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-[#F97316] shadow-2xl">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#D4AF37]/20 blur-3xl" />
        <div className="absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-6 px-10 py-8">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.35em] text-[#0F172A]">MAMMY KITCHEN HUB</p>
            <h1 className="mt-3 text-4xl font-black leading-tight text-white">
              Territory Relationship<br />Manager Operations Center
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-orange-100">
              Monitor operations, strengthen vendor relationships, coordinate riders, supervise territory performance, manage exceptions and make executive decisions from one unified command center.
            </p>
            {data?.assigned && data.territory?.name && (
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 py-2 text-sm font-semibold text-white">
                <MapPin size={16} /> Your territory: {data.territory.name}
              </div>
            )}
          </div>
          <div className="hidden xl:block">
            <div className="rounded-3xl bg-white p-8 shadow-xl">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#64748B]">SYSTEM STATUS</p>
              <div className="mt-5 flex items-center gap-3">
                <div className={`h-4 w-4 rounded-full ${data?.assigned ? "bg-[#16A34A]" : "bg-amber-500"}`} />
                <span className="text-3xl font-black text-[#0F172A]">{data?.assigned ? "ONLINE" : "CHECK ASSIGNMENT"}</span>
              </div>
              <p className="mt-4 max-w-64 text-sm text-[#64748B]">
                {data?.assigned ? "Your operational view is restricted to your assigned territory." : "An active territory assignment is required to load territory operations."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-700">{data?.manager?.name ?? "Territory Relationship Manager"}</p>
          <p className="text-xs text-slate-500">{data?.territory?.name ?? "Territory assignment"}</p>
        </div>
        <button type="button" onClick={() => void loadDashboard()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh dashboard
        </button>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {data && !data.assigned && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{data.message || "No active territory assignment was found for this account."}</div>}

      {loading && !data ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Loading your territory dashboard…</div>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {cards.map((card) => (
              <div key={card.title} className={`rounded-2xl border-l-4 ${card.color} ${card.bg} p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">{card.title}</p>
                    <h2 className="mt-3 text-3xl font-black text-slate-900">{card.value}</h2>
                    <p className="mt-3 text-xs font-medium text-slate-400">{card.description}</p>
                  </div>
                  <div className="text-4xl">{card.icon}</div>
                </div>
              </div>
            ))}
          </section>

          <section className="mt-8">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[#0F172A]">Executive Quick Actions</h2>
                <p className="text-sm text-slate-500">Frequently used operational tools.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-6">
              {quickActions.map((action) => (
                <button key={action.title} type="button" className={`rounded-2xl border ${action.color} p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}>
                  <div className="text-4xl">{action.icon}</div>
                  <h3 className="mt-5 text-lg font-bold text-[#0F172A]">{action.title}</h3>
                  <p className="text-sm text-slate-500">{action.subtitle}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-10 rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-8 py-6">
              <div>
                <h2 className="text-2xl font-bold text-[#0F172A]">Live Operations Feed</h2>
                <p className="mt-1 text-sm text-slate-500">Recent order events from vendors assigned to {data?.territory?.name ?? "your territory"}.</p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2">
                <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-semibold text-emerald-700">SCOPED FEED</span>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {!data?.liveEvents?.length ? (
                <div className="px-8 py-10 text-center text-sm text-slate-500">No order events for your territory yet.</div>
              ) : data.liveEvents.map((event) => (
                <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 px-8 py-5 transition-colors hover:bg-slate-50">
                  <div className="flex min-w-0 items-center gap-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-2xl">📦</div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800">{event.title || String(event.event_type || "Order update").replace(/_/g, " ")}</p>
                      <p className="mt-1 truncate text-sm text-slate-500">{event.description || "Territory order activity"}</p>
                    </div>
                  </div>
                  <p className="shrink-0 text-xs text-slate-400">{formatDateTime(event.created_at)}</p>
                </div>
              ))}
            </div>
          </section>

          <p className="text-xs text-slate-400">
            Territory-only operational summary. Data refreshes automatically every 45 seconds. Last refreshed: {data?.refreshedAt ? formatDateTime(data.refreshedAt) : "not yet refreshed"}.
          </p>
        </>
      )}
    </div>
  );
}
