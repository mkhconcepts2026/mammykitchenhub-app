"use client";
import type { LucideIcon } from "lucide-react";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  AlertTriangle, BarChart3, Bell, CheckCircle2, ChefHat, ChevronRight,
  ClipboardCheck, ClipboardList, Clock3, LayoutDashboard, LogOut, Menu,
  Package, PackageCheck, RefreshCw, Search, ShieldCheck, Store, Truck, Utensils,
  Bike, CalendarDays,
} from "lucide-react";

type VhaOrder = {
  id: string;
  order_number: string | null;
  status: string;
  created_at: string;
  delivered_at?: string | null;
  rider_id: string | null;
  rider_name: string | null;
  order_items?: Array<{ id: string; name: string; quantity: number }>;
};

type MenuItem = { id: string; name: string; price: number; available: boolean };
type AssignedRider = { id: string; name: string; phone: string | null; status: string; operationalStatus: string; currentOrder: { orderNumber: string | null; status: string } | null };
type DashboardData = {
  success: boolean;
  assigned: boolean;
  message?: string;
  agent?: { name: string };
  vendor?: { id: string; name: string; status: string; location: string | null; owner_name: string | null; cuisine?: string | null; rating?: number | null };
  metrics?: { ordersToday: number; activeOrders: number; awaitingAcceptance: number; preparing: number; readyForPickup: number; pickedUp: number; completedToday: number; assignedRiders: number; menuItems: number; availableMenuItems: number; unavailableMenuItems: number };
  orders?: VhaOrder[];
  menuItems?: MenuItem[];
  assignedRiders?: AssignedRider[];
  reportSampleSize?: number;
  refreshedAt?: string;
};

type Tab = "overview" | "vendor" | "orders" | "preparation" | "handover" | "menu" | "reports" | "quality" | "settings";
const NAV: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "vendor", label: "My Vendor", icon: Store },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "preparation", label: "Preparation", icon: ChefHat },
  { id: "handover", label: "Rider Handover", icon: Bike },
  { id: "menu", label: "Inventory & Menu", icon: Utensils },
  { id: "quality", label: "Quality Control", icon: ClipboardCheck },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: ShieldCheck },
];
const ACTIVE = new Set(["pending", "accepted", "preparing", "ready_for_pickup", "assigned", "picked_up"]);

function statusTone(status: string) {
  const value = String(status || "").toLowerCase();
  if (["delivered", "active", "ready_for_pickup", "available"].includes(value)) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (["preparing", "accepted", "picked_up", "assigned", "delivering"].includes(value)) return "bg-blue-50 text-blue-700 ring-blue-200";
  if (["cancelled", "failed", "inactive"].includes(value)) return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
}
function fmtDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-NG", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function initials(value: string) { return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "VH"; }
function MetricCard({ label, value, detail, icon: Icon, tone = "orange" }: { label: string; value: string | number; detail: string; icon: LucideIcon; tone?: "orange" | "blue" | "green" | "gold" }) {
  const tones = { orange: "bg-orange-50 text-orange-600 ring-orange-100", blue: "bg-blue-50 text-blue-600 ring-blue-100", green: "bg-emerald-50 text-emerald-600 ring-emerald-100", gold: "bg-amber-50 text-amber-600 ring-amber-100" };
  return <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_3px_14px_rgba(15,23,42,0.04)] sm:p-5"><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-slate-500">{label}</p><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${tones[tone]}`}><Icon size={19}/></span></div><p className="mt-3 text-3xl font-black tracking-tight text-slate-950 tabular-nums">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></article>;
}
function EmptyState({ title, message }: { title: string; message: string }) { return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center"><p className="font-semibold text-slate-700">{title}</p><p className="mt-1 text-sm text-slate-500">{message}</p></div>; }

export default function VendorHubAgentDashboardPage() {
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
      const response = await fetch("/api/vha/dashboard", { cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (response.status === 401) { router.replace("/login"); return; }
      if (!response.ok || result?.success !== true) throw new Error(result?.message || "Unable to load your vendor operations desk.");
      setData(result as DashboardData);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load your vendor operations desk."); }
    finally { setLoading(false); }
  }, [router]);
  useEffect(() => { void load(); const id = window.setInterval(() => void load(true), 45_000); return () => window.clearInterval(id); }, [load]);

  async function logout() { await createClient().auth.signOut(); router.replace("/login"); }

  const orders = data?.orders ?? [];
  const menuItems = data?.menuItems ?? [];
  const riders = data?.assignedRiders ?? [];
  const filteredOrders = useMemo(() => orders.filter((order) => `${order.order_number ?? ""} ${order.status} ${(order.order_items ?? []).map((item) => item.name).join(" ")} ${order.rider_name ?? ""}`.toLowerCase().includes(query.toLowerCase())), [orders, query]);
  const filteredMenu = useMemo(() => menuItems.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())), [menuItems, query]);
  const metrics = data?.metrics;
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const order of orders) counts[order.status] = (counts[order.status] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [orders]);
  const preparingOrders = filteredOrders.filter((order) => ["accepted", "preparing"].includes(order.status.toLowerCase()));
  const handoverOrders = filteredOrders.filter((order) => ["ready_for_pickup", "assigned", "picked_up"].includes(order.status.toLowerCase()));
  const activeTab = NAV.find((item) => item.id === tab)?.label ?? "Dashboard";

  return (
    <div className="min-h-screen bg-[#F3F6FA] text-slate-900 lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      {mobileNavOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden" onClick={() => setMobileNavOpen(false)}/>}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col bg-[#0C172B] text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[108px] flex-col items-center justify-center border-b border-white/10 px-5"><Image src="/logo.png" alt="Mammy Kitchen Hub" width={150} height={78} className="h-[54px] w-auto object-contain" priority/><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Vendor Operations Desk</p></div>
        <div className="px-5 pb-2 pt-6 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">My vendor</div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">{NAV.map((item) => { const Icon = item.icon; const selected = tab === item.id; return <button key={item.id} onClick={() => { setTab(item.id); setMobileNavOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${selected ? "bg-[#A97813] text-white shadow-lg shadow-amber-950/20" : "text-slate-300 hover:bg-white/8 hover:text-white"}`}><Icon size={18}/>{item.label}<ChevronRight size={15} className={`ml-auto ${selected ? "opacity-100" : "opacity-0"}`}/></button>; })}</nav>
        <div className="border-t border-white/10 p-4"><div className="mb-3 rounded-xl bg-white/5 p-3"><div className="flex items-center gap-2 text-xs font-semibold text-amber-200"><ShieldCheck size={15}/> Single-vendor access</div><p className="mt-1 text-[11px] leading-4 text-slate-400">Your account can access only its one active assigned vendor.</p></div><button onClick={() => void logout()} className="flex w-full items-center gap-3 rounded-xl bg-white/10 px-3 py-3 text-sm font-semibold text-slate-200 hover:bg-white/15"><LogOut size={17}/>Sign out</button></div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex min-h-[78px] items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 shadow-[0_2px_10px_rgba(15,23,42,0.03)] backdrop-blur sm:px-6 xl:px-8">
          <div className="flex min-w-0 items-center gap-3"><button onClick={() => setMobileNavOpen(true)} className="rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden" aria-label="Open navigation"><Menu size={19}/></button><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-600">Mammy Kitchen Hub</p><h1 className="truncate text-lg font-black text-slate-900 sm:text-xl">Vendor Hub Agent</h1><p className="truncate text-xs text-slate-500">{data?.vendor?.name ?? "Assigned vendor workspace"}</p></div></div>
          <div className="hidden max-w-[330px] flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 lg:flex"><Search size={17} className="shrink-0 text-slate-400"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search orders, menu items or riders..." className="ml-2 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" aria-label="Search vendor records"/></div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3"><button className="relative rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Notifications"><Bell size={19}/><span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-orange-500"/></button><div className="flex items-center gap-2"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#A97813] text-sm font-black text-white">{initials(data?.agent?.name ?? "Vendor Agent")}</div><div className="hidden min-w-0 sm:block"><p className="max-w-[150px] truncate text-sm font-bold text-slate-800">{data?.agent?.name ?? "Vendor Hub Agent"}</p><p className="text-[11px] text-slate-500">Vendor Hub Agent</p></div></div><button onClick={() => void load()} disabled={loading} className="hidden items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 md:flex"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/>Refresh</button></div>
        </header>

        <main className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-6 xl:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{activeTab}</p><h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{tab === "overview" ? `Good day, ${(data?.agent?.name ?? "Phil").split(" ")[0]}` : activeTab}</h2><p className="mt-1 text-sm text-slate-500">One-vendor order preparation, quality visibility and rider handover.</p></div><div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500"><CalendarDays size={14}/>{new Date().toLocaleDateString("en-NG", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</div></div>
          {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
          {loading && !data && <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">Loading your assigned vendor operations…</div>}
          {data && !data.assigned && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-bold text-amber-900">Vendor assignment required</h2><p className="mt-1 text-sm text-amber-800">{data.message}</p><p className="mt-2 text-sm text-amber-800">Please contact Admin to complete your VHA → Vendor assignment.</p></section>}

          {data?.assigned && data.vendor && <>
            <section className="relative overflow-hidden rounded-[22px] bg-gradient-to-r from-[#101A2D] via-[#1C2638] to-[#382A0E] px-5 py-5 text-white shadow-sm sm:px-7">
              <div className="pointer-events-none absolute -right-10 -top-20 h-56 w-56 rounded-full bg-amber-400/15 blur-3xl"/>
              <div className="relative flex flex-wrap items-center justify-between gap-5"><div className="max-w-2xl"><p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-amber-300">Vendor operations desk</p><h3 className="mt-2 text-2xl font-black sm:text-[28px]">Hello, {data.agent?.name}</h3><p className="mt-1 text-sm text-slate-300">Your vendor's order flow, preparation queue and rider handover overview.</p><div className="mt-4 flex flex-wrap gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-200"><span className="h-2 w-2 rounded-full bg-emerald-400"/>Vendor assignment active</span><span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200">1 assigned vendor</span></div></div><div className="min-w-[245px] rounded-2xl border border-white/10 bg-white/[0.07] px-5 py-4 backdrop-blur"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Assigned vendor</p><p className="mt-1 text-xl font-black capitalize">{data.vendor.name}</p><p className="mt-1 text-sm text-slate-300">{data.vendor.location || "Location not recorded"}</p><p className="mt-2 text-xs text-amber-200">{data.vendor.owner_name || "Vendor owner not recorded"}</p></div></div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard label="My vendor" value="1" detail="One active vendor assignment" icon={Store} tone="green"/>
              <MetricCard label="Orders today" value={metrics?.ordersToday ?? 0} detail="Created by customers today" icon={ClipboardList} tone="orange"/>
              <MetricCard label="Preparing" value={metrics?.preparing ?? 0} detail={`${metrics?.awaitingAcceptance ?? 0} awaiting acceptance`} icon={ChefHat} tone="gold"/>
              <MetricCard label="Ready for pickup" value={metrics?.readyForPickup ?? 0} detail="Awaiting rider collection" icon={PackageCheck} tone="blue"/>
              <MetricCard label="Picked up" value={metrics?.pickedUp ?? 0} detail="With riders for delivery" icon={Bike} tone="green"/>
            </section>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-xl border border-slate-200 bg-white px-4 py-3"><div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Package size={15} className="text-blue-600"/>Active orders</div><p className="mt-2 text-2xl font-black text-slate-900">{metrics?.activeOrders ?? 0}</p></div><div className="rounded-xl border border-slate-200 bg-white px-4 py-3"><div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><CheckCircle2 size={15} className="text-emerald-600"/>Completed today</div><p className="mt-2 text-2xl font-black text-slate-900">{metrics?.completedToday ?? 0}</p></div><div className="rounded-xl border border-slate-200 bg-white px-4 py-3"><div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Bike size={15} className="text-blue-600"/>Assigned riders</div><p className="mt-2 text-2xl font-black text-slate-900">{metrics?.assignedRiders ?? 0}</p></div><div className="rounded-xl border border-slate-200 bg-white px-4 py-3"><div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Utensils size={15} className="text-orange-600"/>Menu availability</div><p className="mt-2 text-2xl font-black text-slate-900">{metrics?.availableMenuItems ?? 0}<span className="ml-1 text-sm font-semibold text-slate-400">/ {metrics?.menuItems ?? 0}</span></p></div></section>

            <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5">{NAV.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setTab(item.id)} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${tab === item.id ? "bg-[#8F6812] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}><Icon size={14}/>{item.label}</button>; })}</div><button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 md:hidden"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/>Refresh</button></div>

            {tab === "overview" && <div className="grid gap-5 2xl:grid-cols-[1.3fr_0.7fr]">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">Vendor order board</h3><p className="text-xs text-slate-500">Latest orders for {data.vendor.name}, newest first.</p></div><button onClick={() => setTab("orders")} className="text-xs font-bold text-amber-700">Open order board <ChevronRight size={13} className="inline"/></button></div><OrderCards orders={filteredOrders.slice(0, 7)}/></section>
              <div className="space-y-5"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-3 flex items-center justify-between"><div><h3 className="font-bold text-slate-900">Preparation queue</h3><p className="text-xs text-slate-500">Accepted and preparing orders.</p></div><ChefHat size={19} className="text-amber-600"/></div><CompactOrders orders={preparingOrders.slice(0, 5)} empty="No orders are currently in preparation."/></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-3 flex items-center justify-between"><div><h3 className="font-bold text-slate-900">Rider handover queue</h3><p className="text-xs text-slate-500">Ready orders and current rider pickups.</p></div><Truck size={19} className="text-blue-600"/></div><CompactOrders orders={handoverOrders.slice(0, 5)} empty="No orders are waiting for rider handover."/></section></div>
            </div>}
            {tab === "vendor" && <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Vendor profile</h3><div className="mt-5 flex items-center gap-3"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><Store size={25}/></div><div><p className="text-lg font-black capitalize text-slate-900">{data.vendor.name}</p><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusTone(data.vendor.status)}`}>{data.vendor.status}</span></div></div><dl className="mt-5 space-y-4">{[["Location", data.vendor.location || "Not recorded"], ["Vendor owner", data.vendor.owner_name || "Not recorded"], ["Cuisine", data.vendor.cuisine || "Not recorded"], ["Vendor rating", data.vendor.rating == null ? "Not available" : String(data.vendor.rating)]].map(([label, value]) => <div key={label} className="border-b border-slate-100 pb-3"><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 text-sm font-bold text-slate-800">{value}</dd></div>)}</dl></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Vendor operating position</h3><p className="mt-1 text-xs text-slate-500">Live counts calculated from records belonging to this vendor only.</p><div className="mt-5 grid grid-cols-2 gap-3">{[["Orders today", metrics?.ordersToday ?? 0], ["Active orders", metrics?.activeOrders ?? 0], ["Ready for pickup", metrics?.readyForPickup ?? 0], ["Assigned riders", metrics?.assignedRiders ?? 0], ["Available menu", metrics?.availableMenuItems ?? 0], ["Unavailable menu", metrics?.unavailableMenuItems ?? 0]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-4"><p className="text-2xl font-black text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>)}</div></section></div>}
            {tab === "orders" && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4"><h3 className="font-bold text-slate-900">All vendor orders</h3><p className="text-xs text-slate-500">Latest {data.reportSampleSize ?? orders.length} orders loaded for your assigned vendor.</p></div><OrderCards orders={filteredOrders}/></section>}
            {tab === "preparation" && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Kitchen preparation queue</h3><p className="mb-4 text-xs text-slate-500">Read-only view of accepted and preparing orders. Status controls will be connected during the fulfilment walkthrough.</p><OrderCards orders={preparingOrders}/></section>}
            {tab === "handover" && <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Ready and collected orders</h3><p className="mb-4 text-xs text-slate-500">Rider handover visibility for this vendor.</p><OrderCards orders={handoverOrders}/></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Assigned rider roster</h3><p className="mb-4 text-xs text-slate-500">Riders linked to your vendor or visible on its orders.</p><RiderRows riders={riders}/></section></div>}
            {tab === "menu" && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">Menu availability</h3><p className="text-xs text-slate-500">This view reflects the menu item's available flag. It does not represent stock quantity.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{filteredMenu.length} menu items</span></div><MenuTable items={filteredMenu}/></section>}
            {tab === "quality" && <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-start gap-3"><span className="rounded-xl bg-amber-50 p-3 text-amber-700"><ClipboardCheck size={22}/></span><div><h3 className="font-bold text-slate-900">Quality control workspace</h3><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">The dashboard shell is ready, but MKH's approved vendor quality checklist and inspection record source have not yet been connected. This release does not invent quality scores or inspection outcomes. We will connect the agreed checklist during the vendor fulfilment walkthrough.</p><span className="mt-3 inline-flex rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">Awaiting fulfilment specification</span></div></div></section>}
            {tab === "reports" && <div className="grid gap-5 xl:grid-cols-2"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Order status distribution</h3><p className="mb-5 text-xs text-slate-500">Across the {data.reportSampleSize ?? orders.length} most recent orders loaded.</p>{statusCounts.length ? <div className="space-y-4">{statusCounts.map(([status, count]) => <div key={status}><div className="mb-1.5 flex justify-between text-xs"><span className="font-semibold capitalize text-slate-700">{status.replace(/_/g, " ")}</span><span className="font-bold tabular-nums">{count}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#B1811E]" style={{ width: `${Math.max(2, (count / Math.max(1, orders.length)) * 100)}%` }}/></div></div>)}</div> : <EmptyState title="No order history yet" message="Reporting will populate as this vendor receives orders."/>}</section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Daily operating summary</h3><p className="text-xs text-slate-500">Exact counts for the current day, using Lagos local time.</p><div className="mt-5 grid grid-cols-2 gap-3">{[["Orders today", metrics?.ordersToday ?? 0], ["Awaiting acceptance", metrics?.awaitingAcceptance ?? 0], ["Preparing", metrics?.preparing ?? 0], ["Ready for pickup", metrics?.readyForPickup ?? 0], ["Completed today", metrics?.completedToday ?? 0], ["Riders assigned", metrics?.assignedRiders ?? 0]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-4"><p className="text-2xl font-black text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>)}</div></section></div>}
            {tab === "settings" && <section className="grid gap-5 xl:grid-cols-2"><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Your VHA assignment</h3><p className="mt-1 text-xs text-slate-500">Your operational identity is linked to one active vendor assignment.</p><dl className="mt-5 space-y-4">{[["Employee", data.agent?.name], ["Role", "Vendor Hub Agent"], ["Assigned vendor", data.vendor?.name], ["Vendor status", data.vendor?.status], ["Vendor location", data.vendor?.location || "Not recorded"]].map(([label, value]) => <div key={label} className="border-b border-slate-100 pb-3"><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 text-sm font-bold capitalize text-slate-800">{value}</dd></div>)}</dl></article><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Access and workspace controls</h3><div className="mt-4 space-y-3"><div className="rounded-xl bg-emerald-50 p-4"><p className="flex items-center gap-2 text-sm font-bold text-emerald-800"><ShieldCheck size={16}/>Single-vendor access active</p><p className="mt-1 text-xs leading-5 text-emerald-700">The server resolves your assigned vendor from the authenticated VHA employee record. Client-side vendor IDs are not accepted as access scope.</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-sm font-bold text-slate-800">Assignment changes</p><p className="mt-1 text-xs leading-5 text-slate-500">Contact Admin for a vendor reassignment. Role and vendor assignment controls are intentionally not editable in this read-only dashboard release.</p></div></div></article></section>}
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-400"><span>Single-vendor operational visibility · Read-only release</span><span>Last updated {fmtDate(data.refreshedAt)} · Auto-refresh 45 sec</span></div>
          </>}
        </main>
      </div>
    </div>
  );
}

function OrderCards({ orders }: { orders: VhaOrder[] }) {
  if (!orders.length) return <EmptyState title="No matching orders" message="New orders for this assigned vendor will appear here. If this view is filtered, try a different search."/>;
  return <div className="space-y-3">{orders.map((order) => <article key={order.id} className="rounded-xl border border-slate-200 p-4 transition hover:border-slate-300"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black text-slate-900">{order.order_number || `Order ${order.id.slice(0, 8)}`}</p><p className="mt-1 text-xs text-slate-500">Received {fmtDate(order.created_at)}</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ring-1 ring-inset ${statusTone(order.status)}`}>{order.status.replace(/_/g, " ")}</span></div><div className="mt-3 flex flex-wrap gap-2">{(order.order_items ?? []).map((item) => <span key={item.id} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-700">{item.quantity} × {item.name}</span>)}</div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500"><span>{order.rider_name ? `Rider: ${order.rider_name}` : "Rider not assigned yet"}</span>{order.delivered_at && <span>Delivered {fmtDate(order.delivered_at)}</span>}</div></article>)}</div>;
}
function CompactOrders({ orders, empty }: { orders: VhaOrder[]; empty: string }) {
  if (!orders.length) return <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">{empty}</p>;
  return <div className="space-y-2">{orders.map((order) => <div key={order.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{order.order_number || `#${order.id.slice(0, 8)}`}</p><p className="text-[11px] text-slate-500">{fmtDate(order.created_at)} · {order.order_items?.length ?? 0} line items</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold capitalize ${statusTone(order.status)}`}>{order.status.replace(/_/g, " ")}</span></div>)}</div>;
}
function RiderRows({ riders }: { riders: AssignedRider[] }) {
  if (!riders.length) return <EmptyState title="No rider assignments" message="Riders linked to this vendor will appear here."/>;
  return <div className="space-y-3">{riders.map((rider) => <div key={rider.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"><div className="flex min-w-0 items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-xs font-black text-blue-700">{initials(rider.name)}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{rider.name}</p><p className="truncate text-[11px] text-slate-400">{rider.phone || "Phone not recorded"}</p></div></div><div className="text-right"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusTone(rider.operationalStatus)}`}>{rider.operationalStatus}</span><p className="mt-1 text-[10px] text-slate-400">{rider.currentOrder?.orderNumber || rider.status}</p></div></div>)}</div>;
}
function MenuTable({ items }: { items: MenuItem[] }) {
  if (!items.length) return <EmptyState title="No menu items returned" message="No menu items were found for this assigned vendor."/>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="rounded-l-lg px-3 py-3">Menu item</th><th className="px-3 py-3">Price</th><th className="rounded-r-lg px-3 py-3">Availability</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id}><td className="px-3 py-3 font-semibold text-slate-800">{item.name}</td><td className="px-3 py-3 text-slate-600">₦{item.price.toLocaleString("en-NG")}</td><td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${item.available ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{item.available ? "Available" : "Unavailable"}</span></td></tr>)}</tbody></table></div>;
}
