"use client";

type VendorOrdersTabProps = {
  orders: any[];
  loadingOrders: boolean;
  updateOrderStatus: (orderId: string, status: string) => Promise<void>;
};

export default function VendorOrdersTab({
  orders,
  loadingOrders,
  updateOrderStatus,
}: VendorOrdersTabProps) {
  return (
  <div className="bg-white rounded-3xl p-8">

    <div className="flex justify-between mb-6">

      <h2 className="text-2xl font-bold">
        Orders
      </h2>

      <span className="text-gray-500">
        {orders.length} Orders
      </span>

    </div>

    {loadingOrders && (

      <p>Loading orders...</p>

    )}

    {!loadingOrders && orders.length === 0 && (

      <p className="text-gray-500">
        No orders yet.
      </p>

    )}

    {!loadingOrders &&
      orders.map((order) => (

        <div
          key={order.id}
          className="
            border
            rounded-xl
            p-4
            mb-4
          "
        >

          <div className="flex justify-between">

            <div>

              <h3 className="font-bold">
                Order #{order.id.slice(0,8)}
              </h3>

             <p className="text-sm text-blue-600">
  Customer:
  {" "}
  {(Array.isArray(order.profiles) ? order.profiles[0] : order.profiles)?.full_name || "Unknown Customer"}
</p>

<p className="text-sm text-green-600">
  📞 {(Array.isArray(order.profiles) ? order.profiles[0] : order.profiles)?.phone || "No phone"}
</p>
<p className="text-sm text-gray-600">
  📍 {order.delivery_address || "No address"}
</p>

{
  order.customer_notes && (
    <p className="text-sm text-orange-700">
      📝 {order.customer_notes}
    </p>
  )
}

            </div>

           <span
  className={`
    px-3
    py-1
    rounded-full
    text-sm
    font-medium
    capitalize

    ${
      order.status === "pending"
        ? "bg-yellow-100 text-yellow-700"
        : order.status === "accepted"
        ? "bg-blue-100 text-blue-700"
        : order.status === "preparing"
        ? "bg-purple-100 text-purple-700"
        : order.status === "ready_for_pickup"
        ? "bg-orange-100 text-orange-700"
        : order.status === "picked_up"
        ? "bg-indigo-100 text-indigo-700"
        : "bg-green-100 text-green-700"
    }
  `}
>
  {order.status.replaceAll("_"," ")}
</span>

          </div>

         <div className="mt-3 flex justify-between items-center">
<p className="text-sm text-gray-500">
  {new Date(order.created_at).toLocaleString()}
</p>
  <p className="font-semibold">
    ₦{Number(order.total).toLocaleString()}
  </p>

{order.status === "pending" && (

  <button
    onClick={() =>
      updateOrderStatus(
        order.id,
        "accepted"
      )
    }
    className="
      rounded-lg
      bg-blue-600
      px-4
      py-2
      text-sm
      font-semibold
      text-white
      hover:bg-blue-700
    "
  >
    Accept Order
  </button>

)}

{order.status === "accepted" && (

  <button
    onClick={() =>
      updateOrderStatus(
        order.id,
        "preparing"
      )
    }
    className="
      rounded-lg
      bg-orange-500
      px-4
      py-2
      text-sm
      font-semibold
      text-white
      hover:bg-orange-600
    "
  >
    Start Preparing
  </button>

)}

{order.status === "preparing" && (

  <button
    onClick={() =>
      updateOrderStatus(
        order.id,
        "ready_for_pickup"
      )
    }
    className="
      rounded-lg
      bg-purple-600
      px-4
      py-2
      text-sm
      font-semibold
      text-white
      hover:bg-purple-700
    "
  >
    Ready for Pickup
  </button>

)}

{order.status === "ready_for_pickup" && (

  <span
    className="
      inline-flex
      items-center
      rounded-lg
      bg-orange-100
      px-4
      py-2
      text-sm
      font-bold
      text-orange-700
    "
  >
    Waiting for Rider
  </span>

)}

{order.status === "assigned" && (

  <span
    className="
      inline-flex
      items-center
      rounded-lg
      bg-blue-100
      px-4
      py-2
      text-sm
      font-bold
      text-blue-700
    "
  >
    ✓ Rider Assigned
  </span>

)}

{order.status === "picked_up" && (

  <span
    className="
      inline-flex
      items-center
      rounded-lg
      bg-indigo-100
      px-4
      py-2
      text-sm
      font-bold
      text-indigo-700
    "
  >
    ✓ Picked Up by Rider
  </span>

)}

{order.status === "delivered" && (

  <span
    className="
      inline-flex
      items-center
      rounded-lg
      bg-emerald-100
      px-4
      py-2
      text-sm
      font-bold
      text-emerald-700
    "
  >
    ✓ Delivered
  </span>

)}

{order.status === "cancelled" && (

  <span
    className="
      inline-flex
      items-center
      rounded-lg
      bg-red-100
      px-4
      py-2
      text-sm
      font-bold
      text-red-700
    "
  >
    Cancelled
  </span>

)}

</div>
        </div>

      ))
    }

  </div>
  );
}
