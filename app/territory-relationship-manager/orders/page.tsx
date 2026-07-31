"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import EnterpriseOrderSidebar from "@/components/territory-manager/EnterpriseOrderSidebar";
import EnterpriseIntelligencePanel from "@/components/territory-manager/EnterpriseIntelligencePanel";
export default function TerritoryRelationshipManagerOrdersPage() {

  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
const [loading, setLoading] = useState(true);
const selectedOrderRef = useRef<any>(null);

useEffect(() => {
  selectedOrderRef.current = selectedOrder;
}, [selectedOrder]);


async function loadOrders() {
  setLoading(true);

  const { data, error } = await supabase
    .from("orders")
    .select(`
      *,
      vendors (
        id,
        name,
        cuisine,
        location,
        status
      ),
      rider:profiles!orders_rider_id_fkey (
        id,
        full_name,
        phone
      ),
      profiles!orders_user_id_fkey (
        id,
        full_name,
        email,
        phone
      )
    `)
    .order("created_at", {
      ascending: false,
    });

 if (error) {
  console.error("Orders:", error);
} else {
  const latestOrders = data || [];

setOrders(latestOrders);

if (selectedOrderRef.current) {
  const updatedOrder = latestOrders.find(
    (order) => order.id === selectedOrderRef.current.id
  );

  if (updatedOrder) {
    selectedOrderRef.current = updatedOrder;
    setSelectedOrder(updatedOrder);
  }
}
}

setLoading(false);

}

async function refreshWorkspace() {
  await loadOrders();
}

useEffect(() => {
  loadOrders();
}, []);

useEffect(() => {
  const ordersChannel = supabase
    .channel("orders-realtime")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
      },
      () => {
        console.log("ORDER EVENT RECEIVED: orders");
        refreshWorkspace();
      }
    )
    .subscribe();

  const orderEventsChannel = supabase
    .channel("order-events-realtime")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "order_events",
      },
      () => {
        console.log("ORDER EVENT RECEIVED: order_events");
        refreshWorkspace();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(ordersChannel);
    supabase.removeChannel(orderEventsChannel);
  };
}, []);

  return (
  
    <div className="space-y-8">

      {/* Header */}

      <section className="relative overflow-hidden rounded-3xl bg-[#0F172A] border border-slate-700 p-8 shadow-2xl">

  {/* Background Glow */}

  <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#D4AF37]/20 blur-3xl" />

  <div className="absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />

  {/* Hero Content */}

  <div className="relative">

    <p className="text-sm font-bold uppercase tracking-[0.35em] text-[#F97316]">
      TERRITORY RELATIONSHIP MANAGER
    </p>

    <h1 className="mt-3 text-4xl font-black text-white">
      Orders Operations Center
    </h1>

    <p className="mt-4 max-w-3xl text-slate-300 leading-7">
      Monitor every customer order across your territory, supervise
      operational performance, investigate exceptions and launch the
      Order Intelligence Workspace for detailed management.
    </p>

  </div>

</section>

     {/* Orders KPI Strip */}

<section className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">

  {[
    {
      title: "Live Orders",
      value: "--",
      color: "border-orange-500",
      bg: "bg-orange-50",
      icon: "📦",
    },
    {
      title: "Preparing",
      value: "--",
      color: "border-blue-500",
      bg: "bg-blue-50",
      icon: "👨‍🍳",
    },
    {
      title: "Ready Pickup",
      value: "--",
      color: "border-emerald-500",
      bg: "bg-emerald-50",
      icon: "🛍",
    },
    {
      title: "Out For Delivery",
      value: "--",
      color: "border-purple-500",
      bg: "bg-purple-50",
      icon: "🏍",
    },
    {
      title: "Exceptions",
      value: "--",
      color: "border-red-500",
      bg: "bg-red-50",
      icon: "🚨",
    },
    {
      title: "Avg SLA",
      value: "-- mins",
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

{/* Orders Queue */}

<div className="space-y-6">

<section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
  
  {/* Header */}

  <div className="flex items-center justify-between border-b border-slate-200 px-8 py-6">

    <div>

      <h2 className="text-2xl font-bold text-slate-900">
        Orders Queue
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Monitor and manage every customer order across your territory.
      </p>

    </div>

    <div className="flex gap-3">

      <input
        placeholder="Search orders..."
        className="rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500"
      />

      <select className="rounded-xl border border-slate-300 px-4 py-2 text-sm">

        <option>All Status</option>
        <option>Pending</option>
        <option>Preparing</option>
        <option>Ready</option>
        <option>Out for Delivery</option>
        <option>Completed</option>

      </select>

    </div>

  </div>

 {/* Orders Table */}

<div className="overflow-x-auto">

  <table className="min-w-full">

    <thead className="bg-slate-50">

      <tr className="text-left text-sm font-semibold text-slate-600">

        <th className="px-6 py-4">Order ID</th>
        <th className="px-6 py-4">Customer</th>
        <th className="px-6 py-4">Vendor</th>
        <th className="px-6 py-4">Amount</th>
        <th className="px-6 py-4">Status</th>
        <th className="px-6 py-4">SLA</th>
        <th className="px-6 py-4">Action</th>

      </tr>

    </thead>

    <tbody>

     {orders.map((order) => {
  const created = new Date(order.created_at);
  const minutesOpen = Math.floor(
    (Date.now() - created.getTime()) / 1000 / 60
  );

  return (

        <tr
          key={order.id}
          className="border-t border-slate-200 hover:bg-orange-50 transition-colors"
        >

          <td className="px-6 py-5 font-semibold">
            {order.order_number || order.id.slice(0, 8)}
          </td>

          <td className="px-6 py-5">
            {order.profiles?.full_name || "Unknown Customer"}
          </td>

          <td className="px-6 py-5">
            {order.vendors?.name || "Unknown Vendor"}
          </td>

          <td className="px-6 py-5 font-semibold">
            ₦{Number(order.total).toLocaleString()}
          </td>

          <td className="px-6 py-5">

            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">

              {order.status}

            </span>

          </td>

          <td className="px-6 py-5">

            {minutesOpen} mins

          </td>

          <td className="px-6 py-5">

          <button
  onClick={() => {
    setSelectedOrder(order);

    requestAnimationFrame(() => {
      document
        .getElementById("order-workspace")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    });
  }}
  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
>
  Open
</button>

          </td>

        </tr>

        );
})}

    </tbody>

  </table>

</div>

</section>

<div id="order-workspace" className="space-y-6">

  <EnterpriseIntelligencePanel
    order={selectedOrder}
  />

  <EnterpriseOrderSidebar
    order={selectedOrder}
  />

</div>

</div>


</div>
);
}