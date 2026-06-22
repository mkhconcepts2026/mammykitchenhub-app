"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
type Order = {
  id: string;
  status: string;
  total: number;
  delivery_address: string | null;
  created_at: string;
  vendor_id: string;
  rider_id: string | null;

  vendors?: {
  id: string;
  name: string;
};

  rider?: {
    full_name: string;
    phone: string;
  };

  profiles?: {
    full_name: string;
    email: string;
    phone: string;
  };

  customer_notes?: string;
};

type Rider = {
  id: string;
  full_name: string;
  phone: string;

  currentStatus?: string;

  assignedOrders?: number;

  completedOrders?: number;

  revenue?: number;

  score?: number;

  activeOrder?: any;

};

type Vendor = {
  id: string;
  name: string;
  cuisine: string;
  location: string;
  status: string;
  rating: number;
   totalOrders?: number;
  totalRevenue?: number;
  pendingOrders?: number;
  deliveredOrders?: number;
  performanceScore?: number;

};
export default function ManagerDashboardV3() {
    const [activeTab, setActiveTab] =
  useState("overview");

const [orders, setOrders] =
  useState<Order[]>([]);

const [riders, setRiders] =
  useState<Rider[]>([]);

const [vendors, setVendors] =
  useState<Vendor[]>([]);

const [
  payoutRequests,
  setPayoutRequests
] = useState<any[]>([]);

const [
  vendorsMap,
  setVendorsMap
] = useState<any>({});

const [showAssignModal, setShowAssignModal] =
  useState(false);

const [showOrderModal, setShowOrderModal] =
  useState(false);

const [stats, setStats] =
  useState({
    vendors: 0,
    riders: 0,
    ready: 0,
    assigned: 0,
    pickedUp: 0,
    delivered: 0 
  });
const [kpis, setKpis] =
  useState({
    revenue: 0,
    averageOrder: 0,
    completionRate: 0
  });

  const [
  pendingPayouts,
  setPendingPayouts
] = useState(0);

const [
  approvedPayouts,
  setApprovedPayouts
] = useState(0);

const [
  rejectedPayouts,
  setRejectedPayouts
] = useState(0);

  const [exceptions, setExceptions] =
  useState<Order[]>([]);

  const [searchTerm, setSearchTerm] =
  useState("");

const [statusFilter, setStatusFilter] =
  useState("all");

  const [selectedOrder, setSelectedOrder] =
  useState<any>(null);

const [
  selectedVendorFilter,
  setSelectedVendorFilter
] = useState("");

const [
  selectedRiderFilter,
  setSelectedRiderFilter
] = useState("");

const [
  selectedRider,
  setSelectedRider
] = useState<any>(null);

const [totalVendorExposure, setTotalVendorExposure] =
  useState(0);

const [totalRiderExposure, setTotalRiderExposure] =
  useState(0);

const [
  showRiderModal,
  setShowRiderModal
] = useState(false);

const operationsQueueRef =
  useRef<HTMLDivElement>(null);

 async function approvePayout(
  request: any
) {

  try {

    const confirmed =
      confirm(
        `Approve ₦${Number(
          request.amount
        ).toLocaleString()} payout?`
      );

    if(!confirmed){
      return;
    }

    const {
      data: wallet
    } =
    await supabase
      .from(
        "vendor_wallets"
      )
      .select("*")
      .eq(
        "vendor_id",
        request.requester_id
      )
      .single();

    if(!wallet){

      alert(
        "Vendor wallet not found"
      );

      return;

    }

    const newBalance =
      Number(
        wallet.available_balance
      ) -
      Number(
        request.amount
      );

    if(newBalance < 0){

      alert(
        "Insufficient balance"
      );

      return;

    }

    const {
      data: walletUpdate,
      error: walletError
    } =
    await supabase
      .from("vendor_wallets")
      .update({
        available_balance:
          newBalance
      })
      .eq(
        "vendor_id",
        request.requester_id
      )
      .select();

    console.log(
      "WALLET UPDATE:",
      walletUpdate
    );

    console.log(
      "WALLET ERROR:",
      walletError
    );

    const {
      data: payoutUpdate,
      error: payoutError
    } =
    await supabase
      .from("payout_requests")
      .update({

        status:
          "approved",

        processed_at:
          new Date()
            .toISOString()

      })
      .eq(
        "id",
        request.id
      )
      .select();

    console.log(
      "PAYOUT UPDATE:",
      payoutUpdate
    );

    console.log(
      "PAYOUT ERROR:",
      payoutError
    );

    alert(
      "Payout approved"
    );

    loadDashboard();

  }

  catch(error){

    console.error(
      error
    );

  }

}

async function rejectPayout(
  request: any
) {

  alert(
    "Reject payout: " +
    request.id
  );

}

  async function loadDashboard() {

const {
  data: ordersData
} =
await supabase
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
  .order(
    "created_at",
    {
      ascending: false
    }
  );
  const {
  data: vendorWallets
} =
await supabase
  .from("vendor_wallets")
  .select("*");

const {
  data: riderWallets
} =
await supabase
  .from("rider_wallets")
  .select("*");

 const {
  data: payoutRequests
} =
await supabase
  .from("payout_requests")
  .select("*")
  .eq(
    "status",
    "pending"
  );
  

const {
  data: exceptionsData
} =
await supabase
  .from("exceptions")
  .select("*");

  const {
    data: ridersData
  } =
  await supabase
    .from("profiles")
    .select("*")
    .eq(
      "role",
      "rider"
    );

console.log(
  "PAYOUT REQUESTS:",
  payoutRequests
);

setPayoutRequests(
  payoutRequests || []
);

  const {
  data: vendorsData
} =
await supabase
  .from("vendors")
  .select("*");

  const map: any = {};

vendorsData?.forEach(
  (vendor) => {

    map[vendor.id] =
      vendor.name;

  }
);

setVendorsMap(
  map
);

const vendorsWithStats =
  (vendorsData || []).map(
    (vendor) => {

      const vendorOrders =
        (ordersData || []).filter(
          (order) =>
            order.vendor_id ===
            vendor.id
        );

      const totalOrders =
        vendorOrders.length;

      const totalRevenue =
        vendorOrders.reduce(
          (sum, order) =>
            sum +
            Number(order.total || 0),
          0
        );

      const pendingOrders =
        vendorOrders.filter(
          (order) =>
            order.status === "pending"
        ).length;

      const deliveredOrders =
        vendorOrders.filter(
          (order) =>
            order.status === "delivered"
        ).length;
const performanceScore =
  totalOrders === 0
    ? 0
    : Math.round(
        (deliveredOrders /
          totalOrders) *
          100
      );

      return {

        ...vendor,

        totalOrders,

        totalRevenue,

        pendingOrders,

        deliveredOrders,

        performanceScore

      };

    }
  );

  setOrders(
    ordersData || []
  );

 const ridersWithStatus =
  (ridersData || []).map(
    (rider) => {

      const riderOrders =
        ordersData?.filter(
          (order) =>
            order.rider_id === rider.id
        ) || [];

        const activeOrder =
  riderOrders.find(
    (order) =>
      order.status !== "delivered"
  );

      const riderOrder =
        riderOrders.find(
          (order) =>
            order.status !== "delivered"
        );

      let currentStatus =
        "Available";

      if (
        riderOrder?.status ===
        "assigned"
      ) {

        currentStatus =
          "Assigned";

      }

      if (
        riderOrder?.status ===
        "picked_up"
      ) {

        currentStatus =
          "Picked Up";

      }

      const assignedOrders =
        riderOrders.filter(
          (order) =>
            order.status === "assigned" ||
            order.status === "picked_up"
        ).length;

      const completedOrders =
        riderOrders.filter(
          (order) =>
            order.status === "delivered"
        ).length;

      const revenue =
  riderOrders
    .filter(
      (order) =>
        order.status === "delivered"
    )
    .reduce(
      (sum, order) =>
        sum +
        Math.round(
          Number(order.total) * 0.1
        ),
      0
    );

      const score =
        Math.min(
          100,
          completedOrders * 10
        );

      return {

        ...rider,

        currentStatus,

        assignedOrders,

        completedOrders,

        revenue,

        score,

        activeOrder

      };

    }
  );

setRiders(
  ridersWithStatus
);

  setVendors(
  vendorsWithStats
);

  const ready =
    ordersData?.filter(
      o =>
        o.status ===
        "ready_for_pickup"
    ).length || 0;

  const assigned =
    ordersData?.filter(
      o =>
        o.status ===
        "assigned"
    ).length || 0;

  const pickedUp =
    ordersData?.filter(
      o =>
        o.status ===
        "picked_up"
    ).length || 0;

  const delivered =
    ordersData?.filter(
      o =>
        o.status ===
        "delivered"
    ).length || 0;

    const totalVendorExposure =
  vendorWallets?.reduce(
    (sum, wallet) =>
      sum +
      Number(
        wallet.available_balance || 0
      ),
    0
  ) || 0;

const totalRiderExposure =
  riderWallets?.reduce(
    (sum, wallet) =>
      sum +
      Number(
        wallet.available_balance || 0
      ),
    0
  ) || 0;

const pendingPayoutCount =
  payoutRequests?.filter(
    p => p.status === "pending"
  ).length || 0;

const approvedPayoutCount =
  payoutRequests?.filter(
    p => p.status === "approved"
  ).length || 0;

const rejectedPayoutCount =
  payoutRequests?.filter(
    p => p.status === "rejected"
  ).length || 0;

setTotalVendorExposure(
  totalVendorExposure
);

setTotalRiderExposure(
  totalRiderExposure
);

setPendingPayouts(
  pendingPayoutCount
);

setApprovedPayouts(
  approvedPayoutCount
);

setRejectedPayouts(
  rejectedPayoutCount
);

console.log(
  "PAYOUT REQUESTS:",
  payoutRequests
);

  setStats({

    vendors:
      vendorsData?.length || 0,

    riders:
      ridersData?.length || 0,

    ready,

    assigned,

    pickedUp,

    delivered

  });
const totalRevenue =
  ordersData
    ?.filter(
      o =>
        o.status ===
        "delivered"
    )
    .reduce(
      (sum, order) =>
        sum +
        Number(order.total),
      0
    ) || 0;

const averageOrder =
  ordersData?.length
    ? Math.round(
        totalRevenue /
        ordersData.length
      )
    : 0;

const completionRate =
  ordersData?.length
    ? Math.round(
        (delivered /
          ordersData.length) *
          100
      )
    : 0;

setKpis({

  revenue:
    totalRevenue,

  averageOrder,

  completionRate

});

const handledOrderIds =
  exceptionsData?.map(
    (exception) =>
      exception.order_id
  ) || [];

const exceptionOrders =
  ordersData?.filter((order) => {

    if (
      handledOrderIds.includes(
        order.id
      )
    ) {
      return false;
    }

    const created =
      new Date(
        order.created_at
      ).getTime();

    const now =
      Date.now();

    const minutesOpen =
      (now - created) /
      1000 /
      60;

    if (
      order.status ===
        "pending" &&
      minutesOpen > 20
    ) {
      return true;
    }

    if (
      order.status ===
        "preparing" &&
      minutesOpen > 30
    ) {
      return true;
    }

    if (
      order.status ===
        "ready_for_pickup" &&
      minutesOpen > 20
    ) {
      return true;
    }

    if (
      order.status ===
        "assigned" &&
      minutesOpen > 30
    ) {
      return true;
    }

    return false;

  }) || [];

setExceptions(
  exceptionOrders
);

}

async function assignRider(
  orderId: string,
  riderId: string
) {

  const { error } =
    await supabase
      .from("orders")
      .update({

        rider_id:
          riderId,

        status:
          "assigned"

      })
      .eq(
        "id",
        orderId
      );

  if(error){

    alert(
      error.message
    );

    return;

  }

  setShowAssignModal(
    false
  );

  setSelectedOrder(
    null
  );

  await loadDashboard();

}

useEffect(() => {

  loadDashboard();

  const channel =
    supabase
      .channel(
        "manager-v3-live"
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders"
        },
        () => {

          loadDashboard();

        }
      )
      .subscribe();

  return () => {

    supabase.removeChannel(
      channel
    );

  };

}, []);
return (

  <main className="
    min-h-screen
    bg-gray-100
    p-8
  ">

    <div className="
      max-w-7xl
      mx-auto
    ">

      <div className="
        flex
        justify-between
        items-center
        mb-10
      ">

        <div>

          <h1 className="
            text-5xl
            font-bold
          ">
            Manager Dashboard V3
          </h1>

          <p className="
            text-gray-500
            mt-2
          ">
            Operations Control Center
          </p>

        </div>

      </div>

      <div className="
        grid
        grid-cols-1
        md:grid-cols-2
        xl:grid-cols-3
        gap-6
        mb-10
      ">

        <div className="
          bg-white
          rounded-3xl
          p-6
          shadow-sm
        ">
          <p className="text-gray-500">
            Total Vendors
          </p>

          <h2 className="
            text-5xl
            font-bold
            mt-2
          ">
            {stats.vendors}
          </h2>
        </div>

        <div className="
          bg-white
          rounded-3xl
          p-6
          shadow-sm
        ">
          <p className="text-gray-500">
            Active Riders
          </p>

          <h2 className="
            text-5xl
            font-bold
            mt-2
          ">
            {stats.riders}
          </h2>
        </div>

        <div className="
          bg-white
          rounded-3xl
          p-6
          shadow-sm
        ">
          <p className="text-gray-500">
            Ready Orders
          </p>

          <h2 className="
            text-5xl
            font-bold
            text-orange-500
            mt-2
          ">
            {stats.ready}
          </h2>
        </div>

        <div className="
          bg-white
          rounded-3xl
          p-6
          shadow-sm
        ">
          <p className="text-gray-500">
            Assigned Orders
          </p>

          <h2 className="
            text-5xl
            font-bold
            text-blue-500
            mt-2
          ">
            {stats.assigned}
          </h2>
        </div>

        <div className="
          bg-white
          rounded-3xl
          p-6
          shadow-sm
        ">
          <p className="text-gray-500">
            Picked Up
          </p>

          <h2 className="
            text-5xl
            font-bold
            text-purple-500
            mt-2
          ">
            {stats.pickedUp}
          </h2>
        </div>

        <div className="
          bg-white
          rounded-3xl
          p-6
          shadow-sm
        ">
          <p className="text-gray-500">
            Delivered
          </p>

          <h2 className="
            text-5xl
            font-bold
            text-green-500
            mt-2
          ">
            {stats.delivered}
          </h2>
        </div>

      </div>
      
      <div className="
  grid
  grid-cols-1
  md:grid-cols-3
  gap-6
  mb-10
">

  <div className="
    bg-green-50
    border
    border-green-200
    rounded-3xl
    p-6
  ">
    <p className="text-gray-500">
      Total Revenue
    </p>

    <h2 className="
      text-4xl
      font-bold
      text-green-600
      mt-2
    ">
      ₦{kpis.revenue.toLocaleString()}
    </h2>
  </div>

  <div className="
    bg-blue-50
    border
    border-blue-200
    rounded-3xl
    p-6
  ">
    <p className="text-gray-500">
      Average Order Value
    </p>

    <h2 className="
      text-4xl
      font-bold
      text-blue-600
      mt-2
    ">
      ₦{kpis.averageOrder.toLocaleString()}
    </h2>
  </div>

  <div className="
    bg-purple-50
    border
    border-purple-200
    rounded-3xl
    p-6
  ">
    <p className="text-gray-500">
      Completion Rate
    </p>

    <h2 className="
      text-4xl
      font-bold
      text-purple-600
      mt-2
    ">
      {kpis.completionRate}%
    </h2>
    
  </div>
  
<div
  className="
    grid
    grid-cols-1
    md:grid-cols-2
    gap-6
    mb-8
  "
>

  <div
    className="
      bg-yellow-50
      border
      border-yellow-200
      rounded-3xl
      p-6
    "
  >
    <p className="text-gray-500">
      Vendor Wallet Exposure
    </p>

    <h2
      className="
        text-4xl
        font-bold
        text-yellow-600
        mt-2
      "
    >
      ₦{totalVendorExposure.toLocaleString()}
    </h2>

  </div>

  <div
    className="
      bg-red-50
      border
      border-red-200
      rounded-3xl
      p-6
    "
  >
    <p className="text-gray-500">
      Rider Wallet Exposure
    </p>

    <h2
      className="
        text-4xl
        font-bold
        text-red-600
        mt-2
      "
    >
      ₦{totalRiderExposure.toLocaleString()}
    </h2>

  </div>

</div>

  <div
  className="
    bg-gradient-to-r
    from-orange-50
    to-blue-50
    border
    border-orange-200
    rounded-3xl
    p-6
    mb-8
  "
>

  <h2
  className="
    text-xl
    font-bold
    mb-4
  "
>
  🔔 Live Operations Alerts
</h2>

<div
  className="
    grid
    md:grid-cols-2
    gap-4
  "
>

  <div
    className="
      bg-red-50
      border
      border-red-200
      rounded-xl
      p-4
      font-medium
      text-red-700
    "
  >
    🔴 {stats.ready} orders waiting for rider assignment
  </div>

  <div
    className="
      bg-blue-50
      border
      border-blue-200
      rounded-xl
      p-4
      font-medium
      text-blue-700
    "
  >
    🔵 {stats.assigned} riders currently delivering
  </div>

  <div
    className="
      bg-purple-50
      border
      border-purple-200
      rounded-xl
      p-4
      font-medium
      text-purple-700
    "
  >
    🟣 {stats.pickedUp} orders picked up
  </div>

  <div
    className="
      bg-green-50
      border
      border-green-200
      rounded-xl
      p-4
      font-medium
      text-green-700
    "
  >
    🟢 {stats.delivered} completed deliveries
  </div>

</div>

</div>

</div>
<div
  className="
    bg-red-50
    border
    border-red-200
    rounded-3xl
    p-6
    mb-8
  "
>

  <h2
    className="
      text-2xl
      font-bold
      text-red-700
      mb-4
    "
  >
    ⚠ Exception Management
  </h2>

  {exceptions.length === 0 ? (

    <p className="text-green-600">
      No operational issues detected.
    </p>

  ) : (

    <div className="space-y-3">

      {exceptions.map((order) => (

       <div
  key={order.id}
  className="
    bg-white
    rounded-xl
    p-4
    border
  "
>

  <p className="font-semibold">
    #{order.id.slice(0,8)}
  </p>

  <p className="text-sm text-gray-600">
    Status: {order.status}
  </p>

  {order.status === "pending" && (

    <>
      <p className="text-sm text-red-600 font-medium">
        Vendor has not accepted this order.
      </p>

      <p className="text-sm text-gray-500">
        Recommended Action:
        Contact vendor immediately.
      </p>
    </>

  )}

  {order.status === "preparing" && (

    <>
      <p className="text-sm text-red-600 font-medium">
        Food preparation is taking too long.
      </p>

      <p className="text-sm text-gray-500">
        Recommended Action:
        Check vendor kitchen status.
      </p>
    </>

  )}

  {order.status === "ready_for_pickup" && (

    <>
      <p className="text-sm text-red-600 font-medium">
        Order is waiting for rider assignment.
      </p>

      <p className="text-sm text-gray-500">
        Recommended Action:
        Assign a rider immediately.
      </p>
    </>

  )}

  {order.status === "assigned" && (

    <>
      <p className="text-sm text-red-600 font-medium">
        Rider has not picked up this order.
      </p>

      <p className="text-sm text-gray-500">
        Recommended Action:
        Contact rider for update.
      </p>
    </>

  )}

  <div
    className="
      mt-4
      flex
      flex-wrap
      gap-2
    "
  >

    <button
      onClick={() => {

        setSelectedOrder(order);

        setShowOrderModal(true);

      }}
      className="
        bg-blue-500
        text-white
        px-4
        py-2
        rounded-lg
        text-sm
      "
    >
      👁 View Order
    </button>

    {order.status === "ready_for_pickup" && (

      <button
        onClick={() => {

          setSelectedOrder(order);

          setShowAssignModal(true);

        }}
        className="
          bg-orange-500
          text-white
          px-4
          py-2
          rounded-lg
          text-sm
        "
      >
        🔄 Assign Rider
      </button>

    )}

  </div>

</div>

      ))}

    </div>

  )}

</div>
<div
  className="
    bg-white
    rounded-3xl
    p-6
    shadow-sm
    mb-8
  "
>

  <h2
    className="
      text-2xl
      font-bold
      mb-6
    "
  >
    🚴 Live Rider Dispatch Board
  </h2>

  <div className="overflow-x-auto">

    <table className="w-full">

      <thead>

        <tr className="border-b">

         <th className="text-left py-3">
  Rider
</th>

<th className="text-left py-3">
  Phone
</th>

<th className="text-left py-3">
  Status
</th>

<th className="text-left py-3">
  Actions
</th>

<th className="text-left py-3">
  Current Order
</th>

        </tr>

      </thead>

      <tbody>

        {riders.map((rider) => (

          <tr
            key={rider.id}
            className="border-b"
          >

            <td className="py-4">
              {rider.full_name}
            </td>

            <td className="py-4">
              {rider.phone}
            </td>

      <td className="py-4">

  {rider.currentStatus ===
  "Available" && (

    <span
      className="
        bg-green-100
        text-green-700
        px-3
        py-1
        rounded-full
        text-sm
      "
    >
      🟢 Available
    </span>

  )}

  {rider.currentStatus ===
  "Assigned" && (

    <span
      className="
        bg-blue-100
        text-blue-700
        px-3
        py-1
        rounded-full
        text-sm
      "
    >
      🔵 Assigned
    </span>

  )}

  {rider.currentStatus ===
  "Picked Up" && (

    <span
      className="
        bg-purple-100
        text-purple-700
        px-3
        py-1
        rounded-full
        text-sm
      "
    >
      🟣 Picked Up
    </span>

  )}

</td>
<td className="py-4">

  {orders.find(
    (order) =>
      order.rider_id === rider.id &&
      order.status !== "delivered"
  ) ? (

    <span className="font-medium">
      #
      {
        orders
          .find(
            (order) =>
              order.rider_id === rider.id &&
              order.status !== "delivered"
          )
          ?.id.slice(0,8)
      }
    </span>

  ) : (

    <span className="text-gray-400">
      No Active Order
    </span>

  )}

</td>

          </tr>

        ))}

      </tbody>

    </table>

  </div>

</div>

<div
  className="
    bg-white
    rounded-3xl
    p-6
    shadow-sm
  "
>

  <h2
    className="
      text-2xl
      font-bold
      mb-6
    "
  >
    🚴 Rider Performance Center
  </h2>

  <div className="overflow-x-auto">

    <table className="w-full">

      <thead>

        <tr className="border-b">

          <th className="text-left py-3">
            Rider
          </th>

          <th className="text-left py-3">
            Assigned
          </th>

          <th className="text-left py-3">
            Completed
          </th>

          <th className="text-left py-3">
            Earnings
          </th>

          <th className="text-left py-3">
            Score
          </th>

          <th className="text-left py-3">
            Status
          </th>

        </tr>

      </thead>

      <tbody>

        {riders.map((rider) => (

          <tr
            key={rider.id}
            className="border-b"
          >

            <td className="py-4 font-medium">
              {rider.full_name}
            </td>

            <td className="py-4">
              {rider.assignedOrders}
            </td>

            <td className="py-4">
              {rider.completedOrders}
            </td>

            <td className="py-4 font-medium text-green-600">
  ₦
  {Number(
    rider.revenue || 0
  ).toLocaleString()}
</td>

            <td className="py-4">
              {rider.score}
            </td>

            <td className="py-4">

              <span
                className="
                  bg-green-100
                  text-green-700
                  px-3
                  py-1
                  rounded-full
                  text-sm
                "
              >
                {rider.currentStatus}
              </span>

            </td>

            <td className="py-4">

  <div className="flex gap-2">

    <button
      onClick={() => {

        setSelectedRiderFilter(
          rider.id
        );

        operationsQueueRef.current
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });

      }}
      className="
        bg-blue-500
        text-white
        px-3
        py-1
        rounded-lg
        text-sm
      "
    >
      View Deliveries
    </button>

    <button
  onClick={() => {

    setSelectedRider(
      rider
    );

    setShowRiderModal(
      true
    );

  }}
  className="
    bg-green-500
    text-white
    px-3
    py-1
    rounded-lg
    text-sm
  "
>
  Contact Rider
</button>

  </div>

</td>

          </tr>

        ))}

      </tbody>

    </table>

  </div>

</div>

<div
  className="
    bg-white
    rounded-3xl
    p-6
    shadow-sm
    mt-8
  "
>

  <h2
    className="
      text-2xl
      font-bold
      mb-6
    "
  >
    🏪 Vendor Performance Center
  </h2>

  <div
    className="
      overflow-x-auto
    "
  >

    <table
      className="
        w-full
      "
    >

      <thead>

        <tr
          className="
            border-b
          "
        >

<th className="text-left py-3">
  Vendor
</th>

<th className="text-left py-3">
  Orders
</th>

<th className="text-left py-3">
  Revenue
</th>

<th className="text-left py-3">
  Pending
</th>

<th className="text-left py-3">
  Delivered
</th>

<th className="text-left py-3">
  Score
</th>

<th className="text-left py-3">
  Rating
</th>

<th className="text-left py-3">
  Status
</th>

<th className="text-left py-3">
  Actions
</th>

        </tr>

      </thead>

      <tbody>

        {vendors.map((vendor) => (

          <tr
  key={vendor.id}
  className="border-b"
>

  <td className="py-4 font-medium">
    {vendor.name}
  </td>

  <td className="py-4">
    {vendor.totalOrders || 0}
  </td>

  <td className="py-4">
    ₦
    {Number(
      vendor.totalRevenue || 0
    ).toLocaleString()}
  </td>

  <td className="py-4">
    {vendor.pendingOrders || 0}
  </td>

 <td className="py-4">
  {vendor.deliveredOrders || 0}
</td>

<td className="py-4">

  {vendor.performanceScore! >= 80 && (

    <span
      className="
        bg-green-100
        text-green-700
        px-3
        py-1
        rounded-full
        text-sm
        font-semibold
      "
    >
      🟢 {vendor.performanceScore}
    </span>

  )}

  {vendor.performanceScore! >= 50 &&
   vendor.performanceScore! < 80 && (

    <span
      className="
        bg-yellow-100
        text-yellow-700
        px-3
        py-1
        rounded-full
        text-sm
        font-semibold
      "
    >
      🟡 {vendor.performanceScore}
    </span>

  )}

  {vendor.performanceScore! < 50 && (

    <span
      className="
        bg-red-100
        text-red-700
        px-3
        py-1
        rounded-full
        text-sm
        font-semibold
      "
    >
      🔴 {vendor.performanceScore}
    </span>

  )}

</td>

<td className="py-4">
  ⭐ {vendor.rating}
</td>

  <td className="py-4">

  <span
    className={`
      px-3
      py-1
      rounded-full
      text-sm
      ${
        vendor.status === "active"
          ? "bg-green-100 text-green-700"
          : "bg-red-100 text-red-700"
      }
    `}
  >
    {vendor.status}
  </span>

</td>

<td className="py-4">

  <div className="flex gap-2">

   <button
  onClick={() => {

    setSelectedVendorFilter(
      vendor.id
    );

   operationsQueueRef.current
  ?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  }}
  className="
    bg-blue-500
    text-white
    px-3
    py-1
    rounded-lg
    text-sm
  "
>
  View Orders
</button>

    <button
      className="
        bg-orange-500
        text-white
        px-3
        py-1
        rounded-lg
        text-sm
      "
    >
      Contact
    </button>

  </div>

</td>

</tr>

        ))}

      </tbody>

    </table>

  </div>

</div>
<div
  className="
    bg-white
    rounded-3xl
    p-6
    shadow-sm
    mb-6
  "
>

  <h2
    className="
      text-2xl
      font-bold
      mb-6
    "
  >

  <div
  className="
    bg-yellow-50
    border
    border-yellow-200
    rounded-3xl
    p-6
    mb-8
  "
>
  <h2
    className="
      text-xl
      font-bold
      mb-4
    "
  >
    💰 Pending Payout Requests
  </h2>

  {payoutRequests.length === 0 ? (

    <p>
      No pending payouts
    </p>

  ) : (

    <div className="space-y-4">

      {payoutRequests.map(
        (request) => (

          <div
            key={request.id}
            className="
              bg-white
              rounded-xl
              p-4
              border
              flex
              justify-between
              items-center
            "
          >

            <div>

              <p className="font-semibold">
                ₦{
                  Number(
                    request.amount
                  ).toLocaleString()
                }
              </p>

              <p className="text-sm text-gray-500">
                {
  vendorsMap[
    request.requester_id
  ] || "Unknown Vendor"
}
              </p>

            </div>

            <div className="flex gap-2">

              <button
                onClick={() =>
                  approvePayout(
                    request
                  )
                }
                className="
                  bg-green-600
                  text-white
                  px-4
                  py-2
                  rounded-lg
                "
              >
                Approve
              </button>

              <button
                onClick={() =>
                  rejectPayout(
                    request
                  )
                }
                className="
                  bg-red-600
                  text-white
                  px-4
                  py-2
                  rounded-lg
                "
              >
                Reject
              </button>

            </div>

          </div>

        )
      )}

    </div>

  )}

</div>

    🚨 Exception Management Center
  </h2>

  <div
    className="
      grid
      grid-cols-1
      md:grid-cols-4
      gap-4
      mb-6
    "
  >

    <div
      className="
        bg-red-50
        border
        border-red-200
        rounded-2xl
        p-4
      "
    >
      <p className="text-gray-500">
        Active Exceptions
      </p>

      <h3
        className="
          text-3xl
          font-bold
          text-red-600
        "
      >
        {exceptions.length}
      </h3>
    </div>

  </div>

  {exceptions.length === 0 ? (

    <div
      className="
        text-green-600
        bg-green-50
        border
        border-green-200
        rounded-2xl
        p-4
      "
    >
      ✅ No active operational exceptions.
    </div>

  ) : (

    <div className="space-y-3">

      {exceptions
        .slice(0,5)
        .map((order) => (

          <div
            key={order.id}
            className="
              border
              border-red-200
              bg-red-50
              rounded-2xl
              p-4
              flex
              justify-between
              items-center
            "
          >

            <div>

              <p className="font-semibold">
                #{order.id.slice(0,8)}
              </p>

              <p className="text-sm text-gray-500">
                {order.vendors?.name}
              </p>
<button
  onClick={() => {

    setSelectedOrder(
      order
    );

    setShowOrderModal(
      true
    );

  }}
  className="
    bg-blue-500
    text-white
    px-4
    py-2
    rounded-xl
    text-sm
  "
>
  Open
</button>
<button
  onClick={async () => {

    const { error } =
      await supabase
        .from("exceptions")
        .insert({

          order_id:
            order.id,

          exception_type:
            "Operational Exception",

          severity:
            "resolved",

          status:
            "resolved",

          resolved_at:
            new Date()
              .toISOString()

        });

    if(error){

      console.log(
  "SUPABASE ERROR:",
  error
);

      alert(
        "Unable to resolve exception"
      );

      return;

    }

    alert(
      "Exception resolved"
    );
await loadDashboard();
  }}
  className="
    bg-green-500
    text-white
    px-4
    py-2
    rounded-xl
    text-sm
  "
>
  Resolve
</button>
<button
  onClick={async () => {

    const { error } =
      await supabase
        .from("exceptions")
        .insert({

          order_id:
            order.id,

          exception_type:
            "Escalated Exception",

          severity:
            "critical",

          status:
            "open",

          escalated:
            true,

          escalated_at:
            new Date()
              .toISOString()

        });

    if(error){

      console.log(
  "SUPABASE ERROR:",
  error
);

      alert(
        "Unable to escalate exception"
      );

      return;

    }

    alert(
      "Exception escalated to Admin"
    );
await loadDashboard();
  }}
  className="
    bg-orange-500
    text-white
    px-4
    py-2
    rounded-xl
    text-sm
  "
>
  Escalate
</button>
            </div>

            <div
              className="
                text-red-600
                font-medium
              "
            >
              {order.status}

{order.status === "assigned" && (
  <div
    className="
      text-xs
      text-red-700
      font-bold
    "
  >
    CRITICAL
  </div>
)}

{order.status === "ready_for_pickup" && (
  <div
    className="
      text-xs
      text-orange-600
      font-bold
    "
  >
    WARNING
  </div>
)}

{order.status === "pending" && (
  <div
    className="
      text-xs
      text-yellow-600
      font-bold
    "
  >
    WATCH
  </div>
)}
            </div>

          </div>

        ))}

    </div>

  )}

</div>
<div
  ref={operationsQueueRef}
  className="
    bg-white
    rounded-3xl
    p-6
    shadow-sm
  "
>

  <h2
    className="
      text-2xl
      font-bold
      mb-6
    "
  >
    Operations Queue
  </h2>
<div
  className="
    flex
    flex-col
    md:flex-row
    gap-4
    mb-6
  "
>

  <input
    type="text"
    placeholder="
      Search Order ID,
      Vendor,
      Rider...
    "
    value={searchTerm}
    onChange={(e) =>
      setSearchTerm(
        e.target.value
      )
    }
    className="
      border
      rounded-xl
      px-4
      py-3
      flex-1
    "
  />

  <select
    value={statusFilter}
    onChange={(e) =>
      setStatusFilter(
        e.target.value
      )
    }
    className="
      border
      rounded-xl
      px-4
      py-3
    "
  >

    <option value="all">
      All Orders
    </option>

    <option value="pending">
      Pending
    </option>

    <option value="preparing">
      Preparing
    </option>

    <option value="ready_for_pickup">
      Ready For Pickup
    </option>

    <option value="assigned">
      Assigned
    </option>

    <option value="picked_up">
      Picked Up
    </option>

    <option value="delivered">
      Delivered
    </option>

  </select>
{selectedVendorFilter && (

  <button
    onClick={() =>
      setSelectedVendorFilter("")
    }
    className="
      bg-gray-200
      hover:bg-gray-300
      px-4
      py-3
      rounded-xl
      font-medium
    "
  >
    Clear Vendor Filter
  </button>

)}
</div>
  <div className="overflow-x-auto">

    <table className="w-full">

      <thead>

        <tr className="border-b">

          <th className="text-left py-4">
            Order
          </th>

          <th className="text-left py-4">
            Vendor
          </th>

          <th className="text-left py-4">
            Status
          </th>

          <th className="text-left py-4">
            Amount
          </th>

          <th className="text-left py-4">
            Action
          </th>

        </tr>

      </thead>

      <tbody>

        {orders
  .filter((order) => {

    const matchesStatus =
      statusFilter === "all"
        ? true
        : order.status === statusFilter;

  const matchesSearch =

  order.id
    .toLowerCase()
    .includes(
      searchTerm.toLowerCase()
    ) ||

  order.vendors?.name
    ?.toLowerCase()
    .includes(
      searchTerm.toLowerCase()
    ) ||

  order.rider?.full_name
    ?.toLowerCase()
    .includes(
      searchTerm.toLowerCase()
    );

const matchesVendor =

  selectedVendorFilter === ""
    ? true
    : order.vendors?.id ===
      selectedVendorFilter;
const matchesRider =

  selectedRiderFilter === ""
    ? true
    : order.rider_id ===
      selectedRiderFilter;

return (
  matchesStatus &&
  matchesSearch &&
  matchesVendor &&
  matchesRider
);



  })
  .map(
          (order) => (

            <tr
              key={order.id}
              className="border-b"
            >

              <td className="py-4">

                #
                {order.id.slice(0,8)}

              </td>

              <td className="py-4">

                {
                  order.vendors?.name
                }

              </td>

<td className="py-4">

  {order.status === "pending" && (

    <span
      className="
        bg-gray-100
        text-gray-700
        px-3
        py-1
        rounded-full
        text-sm
        font-medium
      "
    >
      Pending
    </span>

  )}

  {order.status === "accepted" && (

    <span
      className="
        bg-blue-100
        text-blue-700
        px-3
        py-1
        rounded-full
        text-sm
        font-medium
      "
    >
      Accepted
    </span>

  )}

  {order.status === "ready_for_pickup" && (

    <span
      className="
        bg-orange-100
        text-orange-700
        px-3
        py-1
        rounded-full
        text-sm
        font-medium
      "
    >
      Ready For Pickup
    </span>

  )}

  {order.status === "assigned" && (

    <span
      className="
        bg-indigo-100
        text-indigo-700
        px-3
        py-1
        rounded-full
        text-sm
        font-medium
      "
    >
      Assigned
    </span>

  )}

  {order.status === "picked_up" && (

    <span
      className="
        bg-purple-100
        text-purple-700
        px-3
        py-1
        rounded-full
        text-sm
        font-medium
      "
    >
      Picked Up
    </span>

  )}

  {order.status === "delivered" && (

    <span
      className="
        bg-green-100
        text-green-700
        px-3
        py-1
        rounded-full
        text-sm
        font-medium
      "
    >
      Delivered
    </span>

  )}

</td>

<td className="py-4">

                ₦
                {Number(
                  order.total
                ).toLocaleString()}

              </td>

             <td className="py-4">

  {order.status === "ready_for_pickup" ? (

    <button
      onClick={() => {

        setSelectedOrder(order);

        setShowAssignModal(true);

      }}
      className="
        bg-orange-500
        text-white
        px-4
        py-2
        rounded-xl
      "
    >
      Assign Rider
    </button>

  ) : (

   <button
  onClick={() => {

    setSelectedOrder(order);

    setShowOrderModal(true);

  }}
  className="
    bg-blue-500
    text-white
    px-4
    py-2
    rounded-xl
  "
>
  View
</button>

  )}

</td>

            </tr>

          )
        )}

      </tbody>

    </table>

  </div>

</div>
    </div>

    {showAssignModal && (

      <div
        className="
          fixed
          inset-0
          bg-black/50
          flex
          items-center
          justify-center
          z-50
        "
      >

        <div
          className="
            bg-white
            rounded-3xl
            p-8
            w-full
            max-w-lg
          "
        >

          <h2
            className="
              text-3xl
              font-bold
              mb-6
            "
          >
            Assign Rider
          </h2>

          <div className="space-y-4">

            {riders.map((rider) => (

              <div
                key={rider.id}
                className="
                  border
                  rounded-2xl
                  p-4
                  flex
                  justify-between
                  items-center
                "
              >

                <div>

                  <h3 className="font-bold">
                    {rider.full_name}
                  </h3>

                  <p className="text-sm text-gray-500">
                    {rider.phone || "No Phone"}
                  </p>

                </div>

                <button
                  onClick={() =>
                    assignRider(
                      selectedOrder.id,
                      rider.id
                    )
                  }
                  className="
                    bg-orange-500
                    text-white
                    px-4
                    py-2
                    rounded-xl
                  "
                >
                  Assign
                </button>

              </div>

            ))}

          </div>

          <button
            onClick={() => {

              setShowAssignModal(false);

              setSelectedOrder(null);

            }}
            className="
              mt-6
              w-full
              bg-gray-200
              py-3
              rounded-xl
            "
          >
            Close
          </button>

        </div>

      </div>

    )}



{showOrderModal && selectedOrder && (

  <div
    className="
      fixed
      inset-0
      bg-black/50
      flex
      items-center
      justify-center
      z-50
    "
  >

   <div
  className="
    bg-white
    rounded-3xl
    p-8
    w-full
    max-w-2xl
    max-h-[80vh]
    overflow-y-auto
  "
>

      <div
        className="
          flex
          justify-between
          items-center
          mb-6
        "
      >

        <h2
          className="
            text-3xl
            font-bold
          "
        >
          Order Details
        </h2>

        <button
          onClick={() =>
            setShowOrderModal(false)
          }
          className="
            bg-gray-200
            px-4
            py-2
            rounded-xl
          "
        >
          Close
        </button>

      </div>

      <div className="space-y-4">

        <div>
          <p className="text-gray-500">
            Order ID
          </p>

          <p className="font-semibold">
            #{selectedOrder.id}
          </p>
        </div>

        <div>
          <p className="text-gray-500">
            Vendor
          </p>

          <p className="font-semibold">
            {selectedOrder.vendors?.name}
          </p>
        </div>

        <div>
          <p className="text-gray-500">
            Status
          </p>

          <p className="font-semibold capitalize">
            {selectedOrder.status}
          </p>
        </div>

        <div>
          <p className="text-gray-500">
            Delivery Address
          </p>

          <p className="font-semibold">
            {selectedOrder.delivery_address}
          </p>
        </div>

       <div>
  <p className="text-gray-500">
    Order Value
  </p>

  <p className="font-semibold">
    ₦{Number(
      selectedOrder.total
    ).toLocaleString()}
  </p>
</div>
<div
  className="
    mt-6
    border
    border-green-200
    rounded-2xl
    p-5
    bg-green-50
  "
>

  <h3
    className="
      font-bold
      text-lg
      mb-4
    "
  >
    Customer Information
  </h3>

  <div className="space-y-3">

    <div>
      <p className="text-gray-500">
        Customer Name
      </p>

      <p className="font-semibold">
        {selectedOrder.profiles?.full_name ||
          "Unknown Customer"}
      </p>
    </div>

    <div>
      <p className="text-gray-500">
        Phone Number
      </p>

      <p className="font-semibold">
        {selectedOrder.profiles?.phone ||
          "No phone available"}
      </p>
    </div>

    <div>
      <p className="text-gray-500">
        Email Address
      </p>

      <p className="font-semibold">
        {selectedOrder.profiles?.email ||
          "No email available"}
      </p>
    </div>

    <div>
      <p className="text-gray-500">
        Delivery Notes
      </p>

      <p className="font-semibold">
        {selectedOrder.customer_notes ||
          "No delivery notes"}
      </p>
    </div>

  </div>

</div>
<div
  className="
    mt-8
    border
    rounded-2xl
    p-5
    bg-gray-50
  "
>

  <h3
    className="
      font-bold
      text-lg
      mb-4
    "
  >
    Delivery Timeline
  </h3>

  <div className="space-y-3">

    <div>
      {[
        "pending",
        "preparing",
        "ready_for_pickup",
        "assigned",
        "picked_up",
        "delivered"
      ]
      .slice(
        0,
        [
          "pending",
          "preparing",
          "ready_for_pickup",
          "assigned",
          "picked_up",
          "delivered"
        ].indexOf(
          selectedOrder.status
        ) + 1
      )
      .map((step) => (

        <div
          key={step}
          className="
            flex
            items-center
            gap-3
            mb-2
          "
        >

          <div
            className="
              w-6
              h-6
              rounded-full
              bg-green-500
              text-white
              flex
              items-center
              justify-center
              text-xs
            "
          >
            ✓
          </div>

          <span className="capitalize">
            {step.replaceAll(
              "_",
              " "
            )}
          </span>

        </div>

      ))}
    </div>

  </div>

</div>

<div className="pt-6">

  {selectedOrder.status === "ready_for_pickup" && (

    <button
      onClick={() => {

        setShowOrderModal(false);

        setSelectedOrder(selectedOrder);

        setShowAssignModal(true);

      }}
      className="
        w-full
        bg-orange-500
        text-white
        py-3
        rounded-xl
        font-semibold
      "
    >
      Assign Rider
    </button>

  )}

{(
  selectedOrder.status === "assigned" ||
  selectedOrder.status === "picked_up" ||
  selectedOrder.status === "delivered"
) && (

 <div className="
  bg-blue-50
  border
  border-blue-200
  rounded-xl
  p-4
">

  <p className="font-semibold text-lg">
    Assigned Rider
  </p>

  <p className="font-medium mt-2">
    {selectedOrder.rider?.full_name ||
      "No rider assigned"}
  </p>

  <p className="text-sm text-gray-500">
    {selectedOrder.rider?.phone}
  </p>

  <div className="
    mt-4
    pt-4
    border-t
  ">

    <p className="text-sm text-gray-500">
      Current Activity
    </p>

    <p className="font-semibold text-blue-600">

      {selectedOrder.status === "assigned" &&
        "Rider Assigned"}

      {selectedOrder.status === "picked_up" &&
        "Order Collected"}

      {selectedOrder.status === "delivered" &&
        "Delivery Completed"}

    </p>

    <p className="text-sm text-gray-500 mt-3">
      Delivery Status
    </p>

    <p className="font-semibold">

      {selectedOrder.status === "assigned" &&
        "Waiting For Pickup"}

      {selectedOrder.status === "picked_up" &&
        "In Transit"}

      {selectedOrder.status === "delivered" &&
        "Delivered Successfully"}

    </p>

    <p className="text-sm text-gray-500 mt-3">
      Current Order
    </p>

    <p className="font-semibold">
      #{selectedOrder.id.slice(0,8)}
    </p>

  </div>

  <div className="
    mt-5
    pt-5
    border-t
    grid
    grid-cols-2
    gap-3
  ">

    <a
      href={`tel:${selectedOrder.profiles?.phone || ""}`}
      className="
        bg-green-500
        text-white
        text-center
        py-3
        rounded-xl
        font-semibold
      "
    >
      📞 Call Customer
    </a>

    <a
      href={`tel:${selectedOrder.rider?.phone || ""}`}
      className="
        bg-blue-500
        text-white
        text-center
        py-3
        rounded-xl
        font-semibold
      "
    >
      📞 Call Rider
    </a>

    <a
      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        selectedOrder.delivery_address || ""
      )}`}
      target="_blank"
      rel="noopener noreferrer"
      className="
        bg-orange-500
        text-white
        text-center
        py-3
        rounded-xl
        font-semibold
      "
    >
      🗺 Open Maps
    </a>

    <button
      onClick={() => {

        setShowOrderModal(false);

        setSelectedOrder(selectedOrder);

        setShowAssignModal(true);

      }}
      className="
        bg-purple-500
        text-white
        py-3
        rounded-xl
        font-semibold
      "
    >
      🔄 Reassign Rider
    </button>

  </div>

</div>

)}

  {selectedOrder.status === "picked_up" && (

    <div className="
      bg-purple-50
      border
      border-purple-200
      rounded-xl
      p-4
    ">

      <p className="font-semibold">
        Delivery In Progress
      </p>

      <p>
        Rider has picked up this order.
      </p>

    </div>

  )}

  {selectedOrder.status === "delivered" && (

    <div className="
      bg-green-50
      border
      border-green-200
      rounded-xl
      p-4
    ">

      <p className="font-semibold">
        Delivery Completed
      </p>

      <p>
        This order has been successfully delivered.
      </p>

    </div>

  )}

</div>

</div>

</div>

</div>

)}

{showRiderModal && selectedRider && (

  <div
    className="
      fixed
      inset-0
      bg-black/50
      flex
      items-center
      justify-center
      z-50
    "
  >

    <div
  className="
    bg-white
    rounded-3xl
    p-8
    w-full
    max-w-2xl
    max-h-[85vh]
    overflow-y-auto
  "
>

      <div
        className="
          flex
          justify-between
          items-center
          mb-6
        "
      >

        <h2
          className="
            text-3xl
            font-bold
          "
        >
          Rider Command Center
        </h2>

        <button
          onClick={() =>
            setShowRiderModal(false)
          }
          className="
            bg-gray-200
            px-4
            py-2
            rounded-xl
          "
        >
          Close
        </button>

      </div>

      <div className="space-y-4">

        <div>

          <p className="text-gray-500">
            Rider Name
          </p>

          <p className="font-semibold">
            {selectedRider.full_name}
          </p>

        </div>

        <div>

          <p className="text-gray-500">
            Phone Number
          </p>

          <p className="font-semibold">
            {selectedRider.phone || "No Phone"}
          </p>

        </div>

        <div>

          <p className="text-gray-500">
            Current Status
          </p>

          <p className="font-semibold">
            {selectedRider.currentStatus}
          </p>

        </div>

        <div>

          <p className="text-gray-500">
            Assigned Orders
          </p>

          <p className="font-semibold">
            {selectedRider.assignedOrders}
          </p>

        </div>

        <div>

          <p className="text-gray-500">
            Completed Deliveries
          </p>

          <p className="font-semibold">
            {selectedRider.completedOrders}
          </p>

        </div>

        <div>

          <p className="text-gray-500">
            Total Earnings
          </p>

          <p className="font-semibold text-green-600">
            ₦
            {Number(
              selectedRider.revenue || 0
            ).toLocaleString()}
          </p>

        </div>

        <div>

          <p className="text-gray-500">
            Performance Score
          </p>

          <p className="font-semibold">
            {selectedRider.score}/100
          </p>

        </div>

<div>

 <p className="text-gray-500">
    Current Active Order
  </p>

 <p className="font-semibold">

    {selectedRider.activeOrder
      ? `#${selectedRider.activeOrder.id.slice(0,8)}`
      : "No Active Order"}

  </p>

</div>

<p className="text-gray-500">
    Rider Health
  </p>
  
  <div className="mt-2">


    {selectedRider.score >= 80 && (

      <span
        className="
          bg-green-100
          text-green-700
          px-3
          py-1
          rounded-full
          text-sm
          font-medium
        "
      >
        🟢 Healthy
      </span>

    )}

    {selectedRider.score >= 50 &&
      selectedRider.score < 80 && (

      <span
        className="
          bg-yellow-100
          text-yellow-700
          px-3
          py-1
          rounded-full
          text-sm
          font-medium
        "
      >
        🟡 Watch
      </span>

    )}

    {selectedRider.score < 50 && (

      <span
        className="
          bg-red-100
          text-red-700
          px-3
          py-1
          rounded-full
          text-sm
          font-medium
        "
      >
        🔴 Attention
      </span>

    )}

  </div>

  <div>

 <div
  className="
    border-t
    pt-6
    mt-6
  "
>

  <h3
    className="
      font-bold
      text-lg
      mb-4
    "
  >
    Rider Actions
  </h3>

<div
  className="
    border-t
    pt-6
    mt-6
  "
>

  <h3
    className="
      font-bold
      text-lg
      mb-4
    "
  >
    Recent Deliveries
  </h3>

  <div className="space-y-3">

    {orders
      .filter(
        (order) =>
          order.rider_id ===
          selectedRider.id
      )
      .slice(0,5)
      .map((order) => (

        <div
          key={order.id}
          className="
            flex
            justify-between
            items-center
            border
            rounded-xl
            p-3
          "
        >

          <div>

            <p className="font-medium">
              #{order.id.slice(0,8)}
            </p>

            <p
              className="
                text-sm
                text-gray-500
              "
            >
              {order.vendors?.name}
            </p>

          </div>

          <span
            className="
              text-sm
              font-medium
            "
          >
            {order.status}
          </span>

        </div>

      ))}

  </div>

</div>

  <div
    className="
      flex
      flex-wrap
      gap-3
    "
  >

    <button
      onClick={() => {

        setSelectedRiderFilter(
          selectedRider.id
        );

        setShowRiderModal(
          false
        );

        operationsQueueRef.current
          ?.scrollIntoView({
            behavior: "smooth"
          });

      }}
      className="
        bg-blue-500
        text-white
        px-4
        py-2
        rounded-xl
      "
    >
      View Deliveries
    </button>

    <button
      className="
        bg-green-500
        text-white
        px-4
        py-2
        rounded-xl
      "
    >
      Call Rider
    </button>

    <button
      className="
        bg-yellow-500
        text-white
        px-4
        py-2
        rounded-xl
      "
    >
      Flag Rider
    </button>

    <button
      className="
        bg-red-500
        text-white
        px-4
        py-2
        rounded-xl
      "
    >
      Suspend Rider
    </button>

  </div>

</div>


</div>

      </div>

    </div>

  </div>

)}
</main>

);

}

