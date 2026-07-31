interface CustomerOperationsProps {
  order?: any;
}

export default function CustomerOperations({
  order,
}: CustomerOperationsProps) {
  return (
    <>
<div className="bg-slate-50 rounded-2xl p-6">

  <div className="flex items-center justify-between">

    <h3 className="text-2xl font-bold">
      Customer Intelligence
    </h3>

    <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
      Active Customer
    </span>

  </div>

  <div className="grid md:grid-cols-2 gap-6 mt-6">

    <div className="space-y-4">

      <div>
        <p className="text-sm text-gray-500">
          Customer Name
        </p>

        <h4 className="text-lg font-semibold">
          {order?.profiles?.full_name ?? "Unknown Customer"}
        </h4>
      </div>

      <div>
        <p className="text-sm text-gray-500">
          Phone Number
        </p>

        <h4 className="font-medium">
          {order?.profiles?.phone ?? "Not Available"}
        </h4>
      </div>

      <div>
        <p className="text-sm text-gray-500">
          Delivery Address
        </p>

        <p className="font-medium">
          {order?.delivery_address ?? "No Address"}
        </p>
      </div>

    </div>

    <div className="grid grid-cols-2 gap-4">

      <div className="bg-white rounded-xl border p-4">
        <p className="text-sm text-gray-500">
          Orders
        </p>

        <h4 className="text-2xl font-bold mt-2">
          24
        </h4>
      </div>

      <div className="bg-white rounded-xl border p-4">
        <p className="text-sm text-gray-500">
          Lifetime Spend
        </p>

        <h4 className="text-2xl font-bold mt-2">
          ₦182,000
        </h4>
      </div>

      <div className="bg-white rounded-xl border p-4">
        <p className="text-sm text-gray-500">
          Complaints
        </p>

        <h4 className="text-2xl font-bold mt-2">
          1
        </h4>
      </div>

      <div className="bg-white rounded-xl border p-4">
        <p className="text-sm text-gray-500">
          Loyalty
        </p>

        <h4 className="text-lg font-bold mt-2 text-green-600">
          Gold
        </h4>
      </div>

    </div>

  </div>

</div>

<div className="bg-cyan-50 rounded-2xl border border-cyan-200 p-6">

  <div className="flex items-center justify-between">

    <div>

      <h3 className="text-2xl font-bold">
        Customer Communication Timeline
      </h3>

      <p className="text-gray-500 mt-1">
        Complete history of communications with the customer.
      </p>

    </div>

    <span className="px-3 py-1 rounded-full bg-cyan-100 text-cyan-700 text-sm font-semibold">
      3 Conversations
    </span>

  </div>

  <div className="space-y-5 mt-6">

    <div className="bg-white rounded-xl border p-4">

      <div className="flex justify-between">

        <p className="font-semibold">
          Operations Team
        </p>

        <span className="text-xs text-gray-500">
          09:22 AM
        </span>

      </div>

      <p className="text-sm text-gray-600 mt-2">
        Customer was informed that rider assignment is in progress.
      </p>

    </div>

    <div className="bg-white rounded-xl border p-4">

      <div className="flex justify-between">

        <p className="font-semibold">
          Customer
        </p>

        <span className="text-xs text-gray-500">
          09:24 AM
        </span>

      </div>

      <p className="text-sm text-gray-600 mt-2">
        Customer acknowledged the update and confirmed availability.
      </p>

    </div>

    <div className="bg-white rounded-xl border p-4">

      <div className="flex justify-between">

        <p className="font-semibold">
          Automated Notification
        </p>

        <span className="text-xs text-gray-500">
          09:27 AM
        </span>

      </div>

      <p className="text-sm text-gray-600 mt-2">
        Estimated delivery time was automatically updated.
      </p>

    </div>

  </div>

</div>


    </>

  );
}