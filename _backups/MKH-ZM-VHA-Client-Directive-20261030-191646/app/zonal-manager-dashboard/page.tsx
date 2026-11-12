import type { LucideIcon } from "lucide-react";
"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, AlertTriangle, BarChart3, Bell, Bike, Building2, CalendarDays,
  CheckCircle2, ChevronRight, Clock3, LayoutDashboard, LogOut, MapPin,
  MapPinned, Menu, Package, RefreshCw, Search, ShieldCheck, Store,
} from "lucide-react";
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";

type ZoneRider = {
  id: string;
  name: string;
  phone: string | null;
  status: string;
  operationalStatus: "inactive" | "available" | "assigned" | "delivering";
  vendorNames: string[];
  currentOrder: { id: string; order_number: string | null; status: string } | null;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
    speed: number;
    heading: number;
    updatedAt: string;
    ageMinutes: number;
    fresh: boolean;
  } | null;
};

type ZoneVendor = {
  id: string;
  name: string;
  status: string;
  location: string | null;
  cuisine?: string | null;
  rating?: number | null;
  recentOrderCount: number;
};

type ZoneOrder = {
  id: string;
  order_number: string | null;
  vendor_id: string;
  vendor_name: string;
  rider_id: string | null;
  rider_name: string | null;
  status: string;
  created_at: string;
  accepted_at?: string | null;
  delivered_at: string | null;
};

type DashboardData = {
  success: boolean;
  assigned: boolean;
  message?: string;
  manager?: { name: string };
  zone?: { id: string; name: string; code: string | null; territory_id: string };
  territory?: { id: string; name: string };
  trm?: { name: string } | null;
  metrics?: {
    totalOrders: number;
    activeVendors: number;
    assignedRiders: number;
    activeRiders: number;
    gpsFresh: number;
    todayOrders: number;
    openOrders: number;
    waitingForPickup: number;
    deliveredToday: number;
    potentialDelays: number;
    averageSlaMinutes: number | null;
    unresolvedVendorZoneMappings: number;
  };
  vendors?: ZoneVendor[];
  riders?: ZoneRider[];
  orders?: ZoneOrder[];
  reportSampleSize?: number;
  refreshedAt?: string;
};

type Tab = "overview" | "map" | "vendors" | "riders" | "orders" | "reports" | "issues" | "settings";

const NAV: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "map", label: "My Zone & Live Map", icon: MapPinned },
  { id: "vendors", label: "Vendors", icon: Store },
  { id: "riders", label: "Riders", icon: Bike },
  { id: "orders", label: "Zone Orders", icon: Package },
  { id: "issues", label: "Issues & Escalations", icon: AlertTriangle },
  { id: "reports", label: "Reports & Insights", icon: BarChart3 },
  { id: "settings", label: "Settings & Access", icon: ShieldCheck },
];

const statusTone = (status: string) => {
  const value = String(status || "").toLowerCase();
  if (["delivered", "active", "ready_for_pickup", "available"].includes(value)) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (["preparing", "accepted", "picked_up", "assigned", "delivering"].includes(value)) return "bg-blue-50 text-blue-700 ring-blue-200";
  if (["cancelled", "failed", "inactive"].includes(value)) return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
};

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-NG", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function initials(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ZM";
}

function MetricCard({ label, value, detail, icon: Icon, tone = "orange" }: {
  label: string; value: string | number; detail: string; icon: LucideIcon; tone?: "orange" | "blue" | "green" | "gold";
}) {
  const tones = {
    orange: "bg-orange-50 text-orange-600 ring-orange-100",
    blue: "bg-blue-50 text-blue-600 ring-blue-100",
    green: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    gold: "bg-amber-50 text-amber-600 ring-amber-100",
  };
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_3px_14px_rgba(15,23,42,0.04)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-500">{label}</p>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${tones[tone]}`}><Icon size={19} /></span>
      </div>
      <p className="mt-3 text-3xl font-black tracking-tight text-slate-950 tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </article>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center"><p className="font-semibold text-slate-700">{title}</p><p className="mt-1 text-sm text-slate-500">{message}</p></div>;
}

function ZoneMapPanel({ riders }: { riders: ZoneRider[] }) {
  const mapKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const recordedLocations = riders.filter((rider) => rider.location && Number.isFinite(rider.location.latitude) && Number.isFinite(rider.location.longitude));
  const points = recordedLocations.filter((rider) => rider.location?.fresh === true);
  const center = useMemo(() => {
    if (!points.length) return { lat: 6.5833, lng: 3.35 };
    return {
      lat: points.reduce((sum, rider) => sum + rider.location!.latitude, 0) / points.length,
      lng: points.reduce((sum, rider) => sum + rider.location!.longitude, 0) / points.length,
    };
  }, [points]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div><h3 className="font-bold text-slate-900">Rider location map</h3><p className="text-xs text-slate-500">GPS positions from riders linked to this zone or currently serving its orders.</p></div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{points.length} fresh GPS positions</span>
      </div>
      {mapKey && points.length > 0 ? (
        <LoadScript googleMapsApiKey={mapKey}>
          <GoogleMap mapContainerStyle={{ width: "100%", height: "310px" }} center={center} zoom={12} options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: true, clickableIcons: false }}>
            {points.map((rider) => <Marker key={rider.id} position={{ lat: rider.location!.latitude, lng: rider.location!.longitude }} title={`${rider.name} · ${rider.operationalStatus} · ${rider.location!.ageMinutes} min ago`} />)}
          </GoogleMap>
        </LoadScript>
      ) : (
        <div className="flex min-h-[250px] flex-col items-center justify-center bg-[radial-gradient(circle_at_1px_1px,#dbe4ef_1px,transparent_0)] [background-size:22px_22px] px-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><MapPin size={22}/></span>
          <p className="mt-3 font-semibold text-slate-800">{points.length ? "Map key unavailable" : recordedLocations.length ? "No fresh GPS positions" : "No GPS positions received yet"}</p>
          <p className="mt-1 max-w-md text-sm text-slate-500">{points.length ? "The assigned riders and their last location details are listed below. Configure the browser Maps key to display the live map." : recordedLocations.length ? `${recordedLocations.length} stored rider location(s) are older than five minutes. They are listed below as stale and are not plotted as live positions.` : "Rider locations will appear here when assigned riders share a GPS update. No location is invented or inferred."}</p>
        </div>
      )}
      <div className="grid gap-2 border-t border-slate-100 p-4 sm:grid-cols-2">
        {riders.slice(0, 6).map((rider) => (
          <div key={rider.id} className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
            <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{rider.name}</p><p className="truncate text-xs text-slate-500">{rider.location ? `${rider.location.accuracy || "—"}m accuracy · ${rider.location.ageMinutes} min ago` : "Location not received"}</p></div>
            <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${rider.location?.fresh ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{rider.location?.fresh ? "FRESH" : "STALE / NONE"}</span>
          </div>
        ))}
        {!riders.length && <p className="px-2 py-3 text-sm text-slate-500">No riders are currently linked to vendors in this zone.</p>}
      </div>
    </section>
  );
}

export default function ZonalManagerDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [query, setQuery] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/zm/dashboard", { cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (response.status === 401) { router.replace("/login"); return; }
      if (!response.ok || result?.success !== true) throw new Error(result?.message || "Unable to load your zone intelligence.");
      setData(result as DashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load your zone intelligence.");
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { void load(); const id = window.setInterval(() => void load(true), 60_000); return () => window.clearInterval(id); }, [load]);

  async function logout() {
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().auth.signOut();
    router.replace("/login");
  }

  const vendors = data?.vendors ?? [];
  const riders = data?.riders ?? [];
  const orders = data?.orders ?? [];
  const filteredVendors = useMemo(() => vendors.filter((row) => `${row.name} ${row.location ?? ""}`.toLowerCase().includes(query.toLowerCase())), [vendors, query]);
  const filteredRiders = useMemo(() => riders.filter((row) => `${row.name} ${row.vendorNames.join(" ")}`.toLowerCase().includes(query.toLowerCase())), [riders, query]);
  const filteredOrders = useMemo(() => orders.filter((row) => `${row.order_number ?? ""} ${row.vendor_name} ${row.rider_name ?? ""} ${row.status}`.toLowerCase().includes(query.toLowerCase())), [orders, query]);
  const metrics = data?.metrics;
  const now = Date.now();
  const issueOrders = orders.filter((order) => ["pending", "accepted", "preparing", "ready_for_pickup", "assigned", "picked_up"].includes(order.status.toLowerCase()) && now - new Date(order.created_at).getTime() >= 30 * 60 * 1000);
  const orderStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const order of orders) counts[order.status] = (counts[order.status] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [orders]);
  const activeTab = NAV.find((item) => item.id === tab)?.label ?? "Dashboard";

  return (
    <div className="min-h-screen bg-[#F3F6FA] text-slate-900 lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      {mobileNavOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col bg-[#0C172B] text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[108px] flex-col items-center justify-center border-b border-white/10 px-5">
          <Image src="/logo.png" alt="Mammy Kitchen Hub" width={150} height={78} className="h-[54px] w-auto object-contain" priority />
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Zone Operations Centre</p>
        </div>
        <div className="px-5 pb-2 pt-6 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Management</div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {NAV.map((item) => { const Icon = item.icon; const selected = tab === item.id; return <button key={item.id} onClick={() => { setTab(item.id); setMobileNavOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${selected ? "bg-[#07966B] text-white shadow-lg shadow-emerald-950/20" : "text-slate-300 hover:bg-white/8 hover:text-white"}`}><Icon size={18}/>{item.label}<ChevronRight size={15} className={`ml-auto ${selected ? "opacity-100" : "opacity-0"}`}/></button>; })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="mb-3 rounded-xl bg-white/5 p-3"><div className="flex items-center gap-2 text-xs font-semibold text-emerald-300"><ShieldCheck size={15}/> Zone-restricted access</div><p className="mt-1 text-[11px] leading-4 text-slate-400">Only records assigned to your active zone are returned.</p></div>
          <button onClick={() => void logout()} className="flex w-full items-center gap-3 rounded-xl bg-white/10 px-3 py-3 text-sm font-semibold text-slate-200 hover:bg-white/15"><LogOut size={17}/>Sign out</button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex min-h-[78px] items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 shadow-[0_2px_10px_rgba(15,23,42,0.03)] backdrop-blur sm:px-6 xl:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setMobileNavOpen(true)} className="rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden" aria-label="Open navigation"><Menu size={19}/></button>
            <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-600">Mammy Kitchen Hub</p><h1 className="truncate text-lg font-black text-slate-900 sm:text-xl">Zone Manager Dashboard</h1><p className="flex items-center gap-1 text-xs text-slate-500"><MapPin size={12}/>{data?.territory?.name ?? "Territory loading"} · {data?.zone?.name ?? "Zone loading"}</p></div>
          </div>
          <div className="hidden max-w-[330px] flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 lg:flex"><Search size={17} className="shrink-0 text-slate-400"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search vendors, riders or orders..." className="ml-2 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" aria-label="Search zone records"/><kbd className="rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-400">Search</kbd></div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3"><button className="relative rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Notifications"><Bell size={19}/><span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-orange-500"/></button><div className="flex items-center gap-2"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#07966B] text-sm font-black text-white">{initials(data?.manager?.name ?? "Zone Manager")}</div><div className="hidden min-w-0 sm:block"><p className="max-w-[150px] truncate text-sm font-bold text-slate-800">{data?.manager?.name ?? "Zone Manager"}</p><p className="text-[11px] text-slate-500">Zone Manager</p></div></div><button onClick={() => void load()} disabled={loading} className="hidden items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 md:flex"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/>Refresh</button></div>
        </header>

        <main className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-6 xl:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{activeTab}</p><h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{tab === "overview" ? `Good day, ${(data?.manager?.name ?? "Jude").split(" ")[0]}` : activeTab}</h2><p className="mt-1 text-sm text-slate-500">Manage vendor coverage, rider readiness and service delivery across your assigned zone.</p></div><div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500"><CalendarDays size={14}/>{new Date().toLocaleDateString("en-NG", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</div></div>

          {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
          {loading && !data && <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">Loading your assigned zone intelligence…</div>}
          {data && !data.assigned && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-bold text-amber-900">Zone assignment required</h2><p className="mt-1 text-sm text-amber-800">{data.message}</p></section>}

          {data?.assigned && (
            <>
              {(metrics?.unresolvedVendorZoneMappings ?? 0) > 0 && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>{metrics?.unresolvedVendorZoneMappings} vendor mapping(s) withheld.</strong> A vendor linked to more than one active zone is excluded until Admin resolves the duplicate assignment.</div>}
              <section className="relative overflow-hidden rounded-[22px] bg-gradient-to-r from-[#0B1930] via-[#102746] to-[#172D4A] px-5 py-5 text-white shadow-sm sm:px-7">
                <div className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full bg-orange-500/15 blur-3xl"/>
                <div className="relative flex flex-wrap items-center justify-between gap-5">
                  <div className="max-w-2xl"><p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-orange-300">Zone operations centre</p><h3 className="mt-2 text-2xl font-black sm:text-[28px]">{data.zone?.name ?? "Your assigned zone"}</h3><p className="mt-1 text-sm text-slate-300">{data.territory?.name ?? "Territory"} territory · Your coverage and service intelligence, limited to this zone.</p><div className="mt-4 flex flex-wrap gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-200"><span className="h-2 w-2 rounded-full bg-emerald-400"/>Zone assignment active</span>{data.zone?.code && <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200">{data.zone.code}</span>}</div></div>
                  <div className="min-w-[235px] rounded-2xl border border-white/10 bg-white/[0.07] px-5 py-4 backdrop-blur"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Reporting line</p><p className="mt-1 text-lg font-black">{data.manager?.name}</p><p className="text-xs text-slate-300">Zone Manager</p><div className="mt-3 border-t border-white/10 pt-3"><p className="text-[10px] uppercase tracking-wider text-slate-400">Territory Relationship Manager</p><p className="mt-1 text-sm font-bold text-orange-200">{data.trm?.name ?? "Not resolved"}</p></div></div>
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                <MetricCard label="Total orders (zone)" value={metrics?.totalOrders ?? 0} detail="All recorded orders from assigned zone vendors" icon={Package} tone="orange"/>
                <MetricCard label="Assigned vendors" value={metrics?.activeVendors ?? 0} detail="Active vendors in your assigned zone" icon={Store} tone="blue"/>
                <MetricCard label="Assigned riders" value={metrics?.assignedRiders ?? 0} detail={`${metrics?.activeRiders ?? 0} active rider accounts`} icon={Bike} tone="green"/>
                <MetricCard label="On-time delivery" value="N/A" detail="An approved zone SLA target is not configured" icon={Clock3} tone="gold"/>
              </section>
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {[
                  { label: "Orders today", value: metrics?.todayOrders ?? 0, icon: Package, tone: "text-orange-600 bg-orange-50" },
                  { label: "Open orders", value: metrics?.openOrders ?? 0, icon: Activity, tone: "text-blue-600 bg-blue-50" },
                  { label: "Waiting for pickup", value: metrics?.waitingForPickup ?? 0, icon: Bike, tone: "text-amber-600 bg-amber-50" },
                  { label: "Delivered today", value: metrics?.deliveredToday ?? 0, icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-50" },
                  { label: "Fresh rider GPS", value: `${metrics?.gpsFresh ?? 0} / ${metrics?.assignedRiders ?? 0}`, icon: MapPinned, tone: "text-indigo-600 bg-indigo-50" },
                ].map((item) => { const Icon = item.icon; return <div key={item.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3"><span className={`rounded-lg p-2 ${item.tone}`}><Icon size={17}/></span><div className="min-w-0"><p className="text-lg font-black text-slate-900 tabular-nums">{item.value}</p><p className="text-[11px] text-slate-500">{item.label}</p></div></div>; })}
              </section>

              <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5">{NAV.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setTab(item.id)} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${tab === item.id ? "bg-[#0E243E] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}><Icon size={14}/>{item.label}</button>; })}</div><button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 md:hidden"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/>Refresh</button></div>

              {tab === "overview" && <div className="grid gap-5 2xl:grid-cols-[1.25fr_0.75fr]">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">Latest zone orders</h3><p className="text-xs text-slate-500">Most recent orders from vendors assigned to this zone.</p></div><button onClick={() => setTab("orders")} className="text-xs font-bold text-orange-600">View all <ChevronRight size={13} className="inline"/></button></div><OrderTable orders={filteredOrders.slice(0, 8)}/></section>
                <div className="space-y-5"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><h3 className="font-bold text-slate-900">Vendor coverage</h3><p className="text-xs text-slate-500">Assigned vendor footprint for this zone.</p></div><Building2 size={19} className="text-orange-600"/></div><VendorRows vendors={filteredVendors.slice(0, 6)}/><button onClick={() => setTab("vendors")} className="mt-3 text-xs font-bold text-orange-600">Open vendor directory <ChevronRight size={13} className="inline"/></button></section>
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-3 flex items-center justify-between"><div><h3 className="font-bold text-slate-900">Rider readiness</h3><p className="text-xs text-slate-500">Assignment and GPS freshness.</p></div><Bike size={19} className="text-blue-600"/></div><RiderRows riders={filteredRiders.slice(0, 5)}/><button onClick={() => setTab("riders")} className="mt-3 text-xs font-bold text-orange-600">Open rider coverage <ChevronRight size={13} className="inline"/></button></section></div>
              </div>}

              {tab === "map" && <div className="grid gap-5 2xl:grid-cols-[1.5fr_0.5fr]"><ZoneMapPanel riders={riders}/><section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-bold text-slate-900">Zone assignment</h3><p className="mt-1 text-xs text-slate-500">Authoritative coverage from the current ZM assignment.</p><dl className="mt-5 space-y-4">{[["Zone", data.zone?.name], ["Zone code", data.zone?.code || "Not configured"], ["Territory", data.territory?.name], ["TRM", data.trm?.name || "Not resolved"], ["Active vendors", String(metrics?.activeVendors ?? 0)], ["Assigned riders", String(metrics?.assignedRiders ?? 0)]].map(([label, value]) => <div key={label} className="border-b border-slate-100 pb-3"><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 text-sm font-bold text-slate-800">{value}</dd></div>)}</dl></section></div>}
              {tab === "vendors" && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">Vendors assigned to {data.zone?.name}</h3><p className="text-xs text-slate-500">Only active zone/vendor links are included.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{filteredVendors.length} vendors</span></div><VendorTable vendors={filteredVendors}/></section>}
              {tab === "riders" && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4"><h3 className="font-bold text-slate-900">Rider coverage</h3><p className="text-xs text-slate-500">Riders linked to vendors in your zone or currently handling an order from this zone.</p></div><RiderTable riders={filteredRiders}/></section>}
              {tab === "orders" && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4"><h3 className="font-bold text-slate-900">Zone order board</h3><p className="text-xs text-slate-500">Latest {data.reportSampleSize ?? orders.length} orders loaded for this zone. KPI counters are exact database counts.</p></div><OrderTable orders={filteredOrders}/></section>}
              {tab === "issues" && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><h3 className="font-bold text-slate-900">Potential attention queue</h3><p className="text-xs text-slate-500">Open orders older than 30 minutes, flagged for human review—not automatically classified as breaches.</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{issueOrders.length} to review</span></div>{issueOrders.length ? <OrderTable orders={issueOrders}/> : <EmptyState title="No aged open orders in the recent sample" message="There are currently no open orders older than 30 minutes in the loaded zone order set."/>}</section>}
              {tab === "reports" && <div className="grid gap-5 xl:grid-cols-2"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Order status mix</h3><p className="mb-5 text-xs text-slate-500">Distribution across the {data.reportSampleSize ?? orders.length} most recent zone orders loaded.</p>{orderStatusCounts.length ? <div className="space-y-4">{orderStatusCounts.map(([status, count]) => <div key={status}><div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="font-semibold capitalize text-slate-700">{status.replace(/_/g, " ")}</span><span className="font-bold tabular-nums text-slate-900">{count}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#0B8F68]" style={{ width: `${Math.max(2, (count / Math.max(1, orders.length)) * 100)}%` }}/></div></div>)}</div> : <EmptyState title="No order history yet" message="Status analysis will appear when orders are recorded for this zone."/>}</section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Service performance snapshot</h3><p className="text-xs text-slate-500">Metrics based on the current assigned zone.</p><div className="mt-5 grid grid-cols-2 gap-3">{[["Orders today", metrics?.todayOrders ?? 0], ["Open now", metrics?.openOrders ?? 0], ["Delivered today", metrics?.deliveredToday ?? 0], ["Potential delays", metrics?.potentialDelays ?? 0]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-4"><p className="text-2xl font-black text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>)}</div><p className="mt-4 text-xs leading-5 text-slate-400">On-time delivery percentage is not displayed because an approved zone SLA target and reliable completion timestamps have not yet been configured for this dashboard.</p></section></div>}
              {tab === "settings" && <section className="grid gap-5 xl:grid-cols-2"><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Your management identity</h3><p className="mt-1 text-xs text-slate-500">Identity and role assignments are administered through MKH HR and Admin.</p><dl className="mt-5 space-y-4">{[["Employee", data.manager?.name], ["Role", "Zone Manager"], ["Assigned zone", data.zone?.name], ["Parent territory", data.territory?.name], ["Reporting TRM", data.trm?.name || "Not resolved"]].map(([label, value]) => <div key={label} className="border-b border-slate-100 pb-3"><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 text-sm font-bold text-slate-800">{value}</dd></div>)}</dl></article><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Access and workspace controls</h3><div className="mt-4 space-y-3"><div className="rounded-xl bg-emerald-50 p-4"><p className="flex items-center gap-2 text-sm font-bold text-emerald-800"><ShieldCheck size={16}/>Zone-scoped access active</p><p className="mt-1 text-xs leading-5 text-emerald-700">The server resolves your current zone assignment. Dashboard requests cannot select another employee's zone.</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-sm font-bold text-slate-800">Assignment changes</p><p className="mt-1 text-xs leading-5 text-slate-500">Contact Admin for zone reassignment or HR for employee-role changes. These controls are intentionally not editable in this read-only dashboard release.</p></div></div></article></section>}
              <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-400"><span>Read-only operational intelligence · Zone access enforced by server</span><span>Last updated {fmtDate(data.refreshedAt)} · Auto-refresh 60 sec</span></div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function VendorRows({ vendors }: { vendors: ZoneVendor[] }) {
  if (!vendors.length) return <EmptyState title="No assigned vendors" message="No active vendor links are currently recorded for this zone."/>;
  return <div className="divide-y divide-slate-100">{vendors.map((vendor) => <div key={vendor.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800 capitalize">{vendor.name}</p><p className="truncate text-xs text-slate-500">{vendor.location || "Location not recorded"}</p></div><div className="text-right"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusTone(vendor.status)}`}>{vendor.status}</span><p className="mt-1 text-[10px] text-slate-400">{vendor.recentOrderCount} recent orders</p></div></div>)}</div>;
}

function VendorTable({ vendors }: { vendors: ZoneVendor[] }) {
  if (!vendors.length) return <EmptyState title="No vendors found" message="This zone has no matching active vendor assignments."/>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="rounded-l-lg px-3 py-3">Vendor</th><th className="px-3 py-3">Location</th><th className="px-3 py-3">Status</th><th className="rounded-r-lg px-3 py-3 text-right">Recent orders</th></tr></thead><tbody className="divide-y divide-slate-100">{vendors.map((vendor) => <tr key={vendor.id}><td className="px-3 py-3 font-bold capitalize text-slate-800">{vendor.name}</td><td className="px-3 py-3 text-slate-500">{vendor.location || "Not recorded"}</td><td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone(vendor.status)}`}>{vendor.status}</span></td><td className="px-3 py-3 text-right font-bold tabular-nums">{vendor.recentOrderCount}</td></tr>)}</tbody></table></div>;
}

function RiderRows({ riders }: { riders: ZoneRider[] }) {
  if (!riders.length) return <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No riders are currently linked to this zone.</p>;
  return <div className="space-y-3">{riders.map((rider) => <div key={rider.id} className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-black text-blue-700">{initials(rider.name)}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{rider.name}</p><p className="truncate text-[11px] text-slate-400">{rider.vendorNames.join(", ") || "Zone order"}</p></div></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${statusTone(rider.operationalStatus)}`}>{rider.operationalStatus}</span></div>)}</div>;
}

function RiderTable({ riders }: { riders: ZoneRider[] }) {
  if (!riders.length) return <EmptyState title="No assigned riders found" message="Riders linked to this zone's vendors will appear here."/>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="rounded-l-lg px-3 py-3">Rider</th><th className="px-3 py-3">Vendor coverage</th><th className="px-3 py-3">Current activity</th><th className="px-3 py-3">GPS freshness</th><th className="rounded-r-lg px-3 py-3">GPS accuracy</th></tr></thead><tbody className="divide-y divide-slate-100">{riders.map((rider) => <tr key={rider.id}><td className="px-3 py-3"><p className="font-bold text-slate-800">{rider.name}</p><p className="text-xs text-slate-400">{rider.phone || "Phone not recorded"}</p></td><td className="px-3 py-3 text-slate-600">{rider.vendorNames.join(", ") || "Linked through zone order"}</td><td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone(rider.operationalStatus)}`}>{rider.currentOrder?.order_number ? `${rider.operationalStatus} · ${rider.currentOrder.order_number}` : rider.operationalStatus}</span></td><td className="px-3 py-3 text-slate-600">{rider.location ? `${rider.location.ageMinutes} min ago` : "No location"}</td><td className="px-3 py-3 text-slate-600">{rider.location ? `${rider.location.accuracy || "—"} m` : "—"}</td></tr>)}</tbody></table></div>;
}

function OrderTable({ orders }: { orders: ZoneOrder[] }) {
  if (!orders.length) return <EmptyState title="No matching orders" message="There are no orders in the current zone scope for this view."/>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="rounded-l-lg px-3 py-3">Order</th><th className="px-3 py-3">Vendor</th><th className="px-3 py-3">Rider</th><th className="px-3 py-3">Status</th><th className="rounded-r-lg px-3 py-3">Received</th></tr></thead><tbody className="divide-y divide-slate-100">{orders.map((order) => <tr key={order.id}><td className="px-3 py-3 font-bold text-slate-800">{order.order_number || `#${order.id.slice(0, 8)}`}</td><td className="px-3 py-3 capitalize text-slate-700">{order.vendor_name}</td><td className="px-3 py-3 text-slate-500">{order.rider_name || "Awaiting assignment"}</td><td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone(order.status)}`}>{order.status.replace(/_/g, " ")}</span></td><td className="px-3 py-3 text-xs text-slate-500">{fmtDate(order.created_at)}</td></tr>)}</tbody></table></div>;
}
