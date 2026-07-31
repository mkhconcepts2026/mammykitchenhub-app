"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface OrderEvent {
  id: string;
  order_id: string;
  event_type: string;
  title: string;
  description: string;
  actor_type: string;
  actor_id: string;
  created_at: string;
}

export default function TerritoryRelationshipManagerDashboard() {

  const [stats, setStats] = useState({
  todayOrders: 0,
  todayRevenue: 0,
  activeRiders: 0,
  activeVendors: 0,
  openExceptions: 0,
  averageSLA: 0,
});
const [liveEvents, setLiveEvents] = useState<OrderEvent[]>([]);

async function loadExecutiveStats() {
  try {
    // Today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Today's Orders
    const { count: todayOrders } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .gte("created_at", today.toISOString());

    // Active Riders
    const { count: activeRiders } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "rider")
      .eq("status", "active");

    // Active Vendors
    const { count: activeVendors } = await supabase
      .from("vendors")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    // Open Exceptions
    const { count: openExceptions } = await supabase
      .from("exceptions")
      .select("*", { count: "exact", head: true })
      .eq("status", "open");

    // Today's Revenue
    const { data: revenueRows } = await supabase
      .from("orders")
      .select("total")
      .eq("status", "delivered")
      .gte("created_at", today.toISOString());

    const todayRevenue =
      revenueRows?.reduce(
        (sum, row) => sum + Number(row.total || 0),
        0
      ) ?? 0;

    // Calculate Average SLA (Accepted → Delivered)

const { data: deliveredOrders } = await supabase
  .from("orders")
  .select("accepted_at, delivered_at")
  .not("accepted_at", "is", null)
  .not("delivered_at", "is", null);

let averageSLA = 0;

if (deliveredOrders && deliveredOrders.length > 0) {
  const totalMinutes = deliveredOrders.reduce((sum, order) => {
    const accepted = new Date(order.accepted_at).getTime();
    const delivered = new Date(order.delivered_at).getTime();

    return sum + (delivered - accepted) / 60000;
  }, 0);

  averageSLA = Math.round(totalMinutes / deliveredOrders.length);
}

    setStats({
      todayOrders: todayOrders ?? 0,
      todayRevenue,
      activeRiders: activeRiders ?? 0,
      activeVendors: activeVendors ?? 0,
      openExceptions: openExceptions ?? 0,
      averageSLA,
    });

console.log({
  todayOrders,
  todayRevenue,
  activeRiders,
  activeVendors,
  openExceptions,
  averageSLA,
});

  } catch (error) {
    console.error("Executive Dashboard Error:", error);
  }
}

async function loadLiveEvents() {
  try {
    const { data, error } = await supabase
      .from("order_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error(error);
      return;
    }

    console.log("LIVE EVENTS FROM SUPABASE:", data);

setLiveEvents(data || []);
  } catch (error) {
    console.error("Live Events Error:", error);
  }
}

  useEffect(() => {
  loadExecutiveStats();
  loadLiveEvents();

  const channel = supabase
    .channel("trm-live-operations")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "order_events",
      },
      (payload) => {
        console.log("REALTIME EVENT:", payload);

        const newEvent = payload.new as OrderEvent;

        setLiveEvents((current) => [
          newEvent,
          ...current,
        ].slice(0, 10));
      }
    )
    .subscribe((status) => {
      console.log("Realtime Status:", status);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}, []);


  return (
    <div className="space-y-8">

     <section className="relative overflow-hidden rounded-3xl bg-[#F97316] shadow-2xl">

  {/* Brand Glow */}

  <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#D4AF37]/20 blur-3xl" />

  <div className="absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />

 <div className="relative flex items-center justify-between px-10 py-8">

    {/* Left */}

    <div className="max-w-3xl">

      <p className="text-sm font-bold uppercase tracking-[0.35em] text-[#0F172A]">

        MAMMY KITCHEN HUB

      </p>

      <h1 className="mt-3 text-4xl font-black leading-tight text-white">

        Territory Relationship
        <br />
        Manager Operations Center

      </h1>

     <p className="mt-4 max-w-2xl text-base leading-7 text-orange-100">

        Monitor operations, strengthen vendor relationships,
        coordinate riders, supervise territory performance,
        manage exceptions and make executive decisions from
        one unified command center.

      </p>

    </div>

    {/* Right */}

    <div className="hidden xl:block">

      <div className="rounded-3xl bg-white p-8 shadow-xl">

        <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#64748B]">

          SYSTEM STATUS

        </p>

        <div className="mt-5 flex items-center gap-3">

          <div className="h-4 w-4 rounded-full bg-[#16A34A] animate-pulse" />

          <span className="text-3xl font-black text-[#0F172A]">

            ONLINE

          </span>

        </div>

        <p className="mt-4 text-sm text-[#64748B]">

          All MKH operational services are running normally.

        </p>

      </div>

    </div>

  </div>

</section>

  {/* Executive KPI Strip */}

<section className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">

  {[
    {
  title: "Today's Orders",
  value: stats.todayOrders,
  color: "border-orange-500",
  bg: "bg-orange-50",
  icon: "📦",
},
    {
      title: "Revenue Today",
      value: `₦${stats.todayRevenue.toLocaleString()}`,
      color: "border-[#D4AF37]",
      bg: "bg-amber-50",
      icon: "💰",
    },
    {
      title: "Active Riders",
      value: stats.activeRiders,
      color: "border-emerald-500",
      bg: "bg-emerald-50",
      icon: "🏍",
    },
    {
      title: "Active Vendors",
      value: stats.activeRiders,
      color: "border-blue-500",
      bg: "bg-blue-50",
      icon: "🏪",
    },
    {
      title: "Open Exceptions",
      value: stats.openExceptions,
      color: "border-red-500",
      bg: "bg-red-50",
      icon: "🚨",
    },
    {
      title: "Average SLA",
      value: `${stats.averageSLA} mins`,
      color: "border-slate-500",
      bg: "bg-slate-100",
      icon: "⏱",
    },
  ].map((card) => (

    <div
      key={card.title}
      className={`rounded-2xl border-l-4 ${card.color} ${card.bg} p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}
    >

      <div className="flex items-center justify-between">

        <div>

          <p className="text-sm font-semibold text-slate-500">

            {card.title}

          </p>

          <h2 className="mt-3 text-3xl font-black text-slate-900">

            {card.value}

          </h2>

          <p className="mt-3 text-xs font-medium text-slate-400">

            Waiting for live data...

          </p>

        </div>

        <div className="text-4xl">

          {card.icon}

        </div>

      </div>

    </div>

  ))}

</section>

{/* Executive Quick Actions */}

<section className="mt-8">

  <div className="mb-5 flex items-center justify-between">

    <div>

      <h2 className="text-2xl font-bold text-[#0F172A]">

        Executive Quick Actions

      </h2>

      <p className="text-sm text-slate-500">

        Frequently used operational tools.

      </p>

    </div>

  </div>

  <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-6">

    {[
      {
        icon: "🚨",
        title: "Dispatch",
        subtitle: "Operations",
        color: "bg-red-50 border-red-200",
      },
      {
        icon: "🏍",
        title: "Riders",
        subtitle: "Management",
        color: "bg-emerald-50 border-emerald-200",
      },
      {
        icon: "🏪",
        title: "Vendors",
        subtitle: "Center",
        color: "bg-orange-50 border-orange-200",
      },
      {
        icon: "📦",
        title: "Orders",
        subtitle: "Queue",
        color: "bg-blue-50 border-blue-200",
      },
      {
        icon: "💰",
        title: "Finance",
        subtitle: "Control",
        color: "bg-amber-50 border-amber-200",
      },
      {
        icon: "🗺",
        title: "Territory",
        subtitle: "Map",
        color: "bg-slate-100 border-slate-300",
      },
    ].map((action) => (

      <button
        key={action.title}
        className={`rounded-2xl border ${action.color} p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}
      >

        <div className="text-4xl">

          {action.icon}

        </div>

        <h3 className="mt-5 text-lg font-bold text-[#0F172A]">

          {action.title}

        </h3>

        <p className="text-sm text-slate-500">

          {action.subtitle}

        </p>

      </button>

    ))}

  </div>

</section>

{/* Live Operations Feed */}

<section className="mt-10 rounded-3xl border border-slate-200 bg-white shadow-sm">

  {/* Header */}

  <div className="flex items-center justify-between border-b border-slate-200 px-8 py-6">

    <div>

      <h2 className="text-2xl font-bold text-[#0F172A]">

        Live Operations Feed

      </h2>

      <p className="mt-1 text-sm text-slate-500">

        Real-time operational activities across your territory.

      </p>

    </div>

    <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2">

      <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />

      <span className="text-sm font-semibold text-emerald-700">

        LIVE

      </span>

    </div>

  </div>

  {/* Feed */}

  <div className="divide-y divide-slate-100">

    {liveEvents.map((event) => (

      <div
        key={event.id}
        className="flex items-center justify-between px-8 py-5 transition-colors hover:bg-slate-50"
      >

        <div className="flex items-center gap-5">

         <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl">

  {{
    accepted: "✅",
    preparing: "🍳",
    ready_for_pickup: "📦",
    picked_up: "🏍",
    delivered: "🎉",
    cancelled: "❌",
  }[event.event_type] ?? "📍"}

</div>

          <div>

            <h3 className="font-semibold text-[#0F172A]">

              {event.title}

            </h3>

            <p className="text-sm text-slate-500">

              {event.description}

            </p>

          </div>

        </div>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">

          {new Date(event.created_at).toLocaleTimeString([], {
  hour: "2-digit",
  minute: "2-digit",
})}

        </span>

      </div>

    ))}

  </div>

</section>

    </div>
  );
}