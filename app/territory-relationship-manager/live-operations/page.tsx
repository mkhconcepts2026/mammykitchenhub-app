"use client";

import { useEffect, useState } from "react";

import type { RealtimeChannel } from "@supabase/supabase-js";

import { getOrders } from "@/lib/services/orders";

import { supabase } from "@/lib/supabase";

import TerritoryActivityFeed from "@/components/territory-manager/TerritoryActivityFeed";

export default function LiveOperationsPage() {

  const [orders, setOrders] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  const [snapshot, setSnapshot] = useState({
  ridersOnline: 0,
  activeDeliveries: 0,
  readyOrders: 0,
  operationalHealth: "Healthy",
});

const [alerts, setAlerts] = useState<any[]>([]);

const [territoryEvents, setTerritoryEvents] = useState<any[]>([]);

const [channel, setChannel] =
  useState<RealtimeChannel | null>(null);
  useEffect(() => {

    async function loadOrders() {

      try {

        const data = await getOrders();

        setOrders(data);

const { data: events, error: eventsError } =
  await supabase
    .from("order_events")
    .select(`
      id,
      title,
      created_at,
      orders(
        order_number,
        vendors(name)
      )
    `)
    .order("created_at", {
      ascending: false,
    })
    .limit(20);

if (eventsError) {
  console.error(eventsError);
} else {
  console.log(events);

setTerritoryEvents(events ?? []);
}

        const now = Date.now();

const generatedAlerts = data
  .filter((order: any) =>
    [
      "pending",
      "accepted",
      "preparing",
      "ready_for_pickup",
    ].includes(order.status)
  )
  .flatMap((order: any) => {
  const created = new Date(order.created_at).getTime();
  const waitingMinutes = Math.floor((now - created) / 60000);

  const alerts = [];

 let severity = "NORMAL";
let colour = "bg-emerald-100 text-emerald-700";

if (waitingMinutes >= 30) {

  severity = "CRITICAL";
  colour = "bg-red-100 text-red-700";

} else if (waitingMinutes >= 15) {

  severity = "ATTENTION";
  colour = "bg-amber-100 text-amber-700";

}

alerts.push({

  severity,

  colour,

  vendor: order.vendors?.name ?? "Unknown Vendor",

  stage: order.status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase()),

  waiting: `${waitingMinutes} mins`,

  action:
    order.status === "pending"
      ? "Monitor Vendor"
      : order.status === "accepted"
      ? "Monitor Kitchen"
      : order.status === "preparing"
      ? "Follow Up"
      : order.status === "ready_for_pickup"
      ? "Assign Rider"
      : "Monitor",

});

return alerts;

});

setAlerts(generatedAlerts);

const { count: ridersOnline } = await supabase
  .from("profiles")
  .select("*", { count: "exact", head: true })
  .eq("role", "rider")
  .eq("status", "active");
const activeDeliveries = data.filter(
  (order: any) => order.status === "picked_up"
).length;

const readyOrders = data.filter(
  (order: any) => order.status === "ready_for_pickup"
).length;

setSnapshot({
  ridersOnline: ridersOnline ?? 0,
  activeDeliveries,
  readyOrders,
  operationalHealth: "Healthy",
});

      } catch (error) {

        console.error(error);

      } finally {

        setLoading(false);

      }

    }


    loadOrders();

const realtimeChannel =
  supabase
    .channel("territory-live-feed")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "order_events",
      },
      () => {
        loadOrders();
      }
    )
    .subscribe();

setChannel(realtimeChannel);

const ordersChannel =
  supabase
    .channel("territory-orders-live")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
      },
      () => {
        loadOrders();
      }
    )
    .subscribe();

 return () => {

  realtimeChannel.unsubscribe();

  ordersChannel.unsubscribe();

};

}, []);


  return (
    <div className="space-y-8">

      {/* Page Header */}

      <section className="rounded-3xl bg-[#0F172A] px-10 py-8 text-white shadow-xl">

        <div className="flex items-center justify-between">

          <div>

            <p className="text-sm uppercase tracking-[0.35em] text-orange-400">

              MAMMY KITCHEN HUB

            </p>

            <h1 className="mt-3 text-4xl font-black">

              Live Operations Center

            </h1>

            <p className="mt-4 max-w-3xl text-slate-300">

              Monitor live rider activities, dispatch operations,
              ready orders, delivery progress and critical operational
              events across your territory.

            </p>

          </div>

          <div className="rounded-2xl bg-white px-6 py-5 text-[#0F172A] shadow-lg">

            <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500">

              STATUS

            </p>

            <div className="mt-3 flex items-center gap-3">

              <div className="h-4 w-4 rounded-full bg-green-500 animate-pulse" />

              <span className="text-2xl font-black">

                LIVE

              </span>

            </div>

          </div>

        </div>

      </section>

  {/* Operational Status */}

<section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">

  {[
    {
      title: "Operations Status",
      value: "ONLINE",
      icon: "🟢",
      bg: "bg-emerald-50",
      border: "border-emerald-500",
    },
    {
      title: "Dispatch Health",
      value: "NORMAL",
      icon: "🛵",
      bg: "bg-blue-50",
      border: "border-blue-500",
    },
    {
      title: "Kitchen Activity",
      value: "ACTIVE",
      icon: "🍳",
      bg: "bg-orange-50",
      border: "border-orange-500",
    },
    {
      title: "Territory Health",
      value: "STABLE",
      icon: "🗺️",
      bg: "bg-purple-50",
      border: "border-purple-500",
    },
  ].map((card) => (

    <div
      key={card.title}
      className={`rounded-3xl border-l-4 ${card.border} ${card.bg} p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}
    >

      <div className="flex items-center justify-between">

        <div>

          <p className="text-sm font-semibold text-slate-500">

            {card.title}

          </p>

          <h2 className="mt-3 text-3xl font-black text-[#0F172A]">

            {card.value}

          </h2>

        </div>

        <div className="text-4xl">

          {card.icon}

        </div>

      </div>

    </div>

  ))}



</section>
{/* Live Operations Workspace */}

<section className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-3">

  {/* Main Operations Panel */}

  <div className="xl:col-span-2 rounded-3xl border border-slate-200 bg-white shadow-sm">

    <div className="flex items-center justify-between border-b border-slate-200 px-8 py-6">

      <div>

        <h2 className="text-2xl font-bold text-[#0F172A]">
          Operational Alerts
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Critical operational events across your territory.
        </p>

      </div>

      <span className="rounded-full bg-red-100 px-4 py-2 text-sm font-semibold text-red-700">
        Monitoring
      </span>

    </div>

   <div className="overflow-x-auto">

  <table className="w-full">

    <thead className="bg-slate-50">

<tr>

<th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
Severity
</th>

<th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
Vendor
</th>

<th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
Current Stage
</th>

<th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
Waiting
</th>

<th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
Recommended Action
</th>

</tr>

</thead>

    <tbody>

  {alerts.length === 0 ? (

    <tr>

      <td
        colSpan={4}
        className="px-6 py-12 text-center text-slate-500"
      >

        No operational alerts.

      </td>

    </tr>

  ) : (

    alerts.map((item, index) => (

        <tr
          key={index}
          className="border-t border-slate-100 hover:bg-slate-50"
        >

         <td className="px-6 py-5">

  <span
    className={`rounded-full px-3 py-1 text-xs font-bold ${item.colour}`}
  >
    {item.severity}
  </span>

</td>

<td className="px-6 py-5 font-medium text-[#0F172A]">

  {item.vendor}

</td>

<td className="px-6 py-5">

  <span
    className={`rounded-full px-3 py-1 text-xs font-semibold
      ${
        item.stage === "Pending"
          ? "bg-slate-100 text-slate-700"
          : item.stage === "Accepted"
          ? "bg-blue-100 text-blue-700"
          : item.stage === "Preparing"
          ? "bg-orange-100 text-orange-700"
          : item.stage === "Ready For Pickup"
          ? "bg-purple-100 text-purple-700"
          : "bg-emerald-100 text-emerald-700"
      }`}
  >

    {item.stage}

  </span>

</td>

<td className="px-6 py-5">

  {item.waiting}

</td>

<td className="px-6 py-5">

  <span
    className={`rounded-full px-3 py-1 text-xs font-semibold
      ${
        item.action === "Assign Rider"
          ? "bg-blue-100 text-blue-700"
          : item.action === "Contact Vendor"
          ? "bg-red-100 text-red-700"
          : item.action === "Follow Up"
          ? "bg-amber-100 text-amber-700"
          : item.action === "Monitor Kitchen"
          ? "bg-purple-100 text-purple-700"
          : "bg-slate-100 text-slate-700"
      }`}
  >

    {item.action}

  </span>

</td>

        </tr>

  ))

  )}

</tbody>

  </table>

</div>

  </div>

  {/* Operations Sidebar */}

  <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">

    <div className="border-b border-slate-200 px-6 py-5">

      <h2 className="text-xl font-bold text-[#0F172A]">
        Territory Snapshot
      </h2>

    </div>

    <div className="space-y-5 p-6">

      <div className="flex justify-between">
        <span className="text-slate-500">Riders Online</span>
        <span className="font-bold">{snapshot.ridersOnline}</span>
      </div>

      <div className="flex justify-between">
        <span className="text-slate-500">Active Deliveries</span>
        <span className="font-bold">{snapshot.activeDeliveries}</span>
      </div>

      <div className="flex justify-between">
        <span className="text-slate-500">Ready Orders</span>
        <span className="font-bold">{snapshot.readyOrders}</span>
      </div>

      <div className="flex justify-between">
        <span className="text-slate-500">Operational Health</span>
        <span className="font-bold text-emerald-600">
          Healthy
        </span>
      </div>

    </div>

  </div>

</section>

{/* Live Delivery Monitor */}

<section className="mt-8 rounded-3xl border border-slate-200 bg-white shadow-sm">

  <div className="flex items-center justify-between border-b border-slate-200 px-8 py-6">

    <div>

      <h2 className="text-2xl font-bold text-[#0F172A]">

        Live Delivery Monitor

      </h2>

      <p className="mt-1 text-sm text-slate-500">

        Orders currently on the road with riders.

      </p>

    </div>

    <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700">

      Live

    </span>

  </div>

  <div className="overflow-x-auto">

    <table className="w-full">

      <thead className="bg-slate-50">

        <tr>

          <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
            Order
          </th>

          <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
            Vendor
          </th>

          <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
            Customer
          </th>

          <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
            Rider
          </th>

          <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
            Status
          </th>

        </tr>

      </thead>

      <tbody>

        {orders.filter((order: any) => order.status === "picked_up").length === 0 ? (

          <tr>

            <td
              colSpan={5}
              className="px-6 py-12 text-center text-slate-500"
            >

              No active deliveries.

            </td>

          </tr>

        ) : (

          orders
            .filter((order: any) => order.status === "picked_up")
            .map((order: any) => (

              <tr
                key={order.id}
                className="border-t border-slate-100 hover:bg-slate-50"
              >

                <td className="px-6 py-5 font-medium">

                  #{order.id.slice(0, 8)}

                </td>

                <td className="px-6 py-5">

                  {order.vendors?.name ?? "-"}

                </td>

                <td className="px-6 py-5">

                  {order.profiles?.full_name ?? "-"}

                </td>

                <td className="px-6 py-5">

                  {order.riders?.full_name ?? "Unassigned"}

                </td>

                <td className="px-6 py-5">

                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">

                    Out for Delivery

                  </span>

                </td>

              </tr>

            ))

        )}

      </tbody>

    </table>

  </div>

</section>

{/* Territory Activity Feed */}

<TerritoryActivityFeed
  events={territoryEvents.map((event: any) => ({
    id: event.id,
    orderNumber:
      event.orders?.order_number ?? "N/A",
    vendor:
      event.orders?.vendors?.name ??
      "Unknown Vendor",
    event: event.title,
    timestamp: event.created_at,
  }))}
/>

    </div>
  );
}