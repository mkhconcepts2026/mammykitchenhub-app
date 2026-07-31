interface VendorOperationsProps {
  order?: any;
}

export default function VendorOperations({
  order,
}: VendorOperationsProps) {
  return (
    <>
<div className="bg-slate-50 rounded-2xl p-6">

  <div className="flex items-center justify-between">

    <h3 className="text-2xl font-bold">
      Vendor Intelligence
    </h3>

    <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
      Operational
    </span>

  </div>

  <div className="grid md:grid-cols-2 gap-6 mt-6">

    <div className="space-y-4">

      <div>
        <p className="text-sm text-gray-500">
          Vendor Name
        </p>

        <h4 className="text-lg font-semibold">
          {order?.vendors?.name ?? "Unknown Vendor"}
        </h4>
      </div>

      <div>
        <p className="text-sm text-gray-500">
          Cuisine
        </p>

        <h4 className="font-medium">
          {order?.vendors?.cuisine ?? "Not Available"}
        </h4>
      </div>

      <div>
        <p className="text-sm text-gray-500">
          Current Order Status
        </p>

        <h4 className="font-medium">
          {order?.status ?? "Pending"}
        </h4>
      </div>

    </div>

    <div className="grid grid-cols-2 gap-4">

      <div className="bg-white rounded-xl border p-4">
        <p className="text-sm text-gray-500">
          Prep Time
        </p>

        <h4 className="text-2xl font-bold mt-2">
          18 min
        </h4>
      </div>

      <div className="bg-white rounded-xl border p-4">
        <p className="text-sm text-gray-500">
          SLA
        </p>

        <h4 className="text-2xl font-bold mt-2 text-green-600">
          On Track
        </h4>
      </div>

      <div className="bg-white rounded-xl border p-4">
        <p className="text-sm text-gray-500">
          Rating
        </p>

        <h4 className="text-2xl font-bold mt-2">
          ⭐ 4.8
        </h4>
      </div>

      <div className="bg-white rounded-xl border p-4">
        <p className="text-sm text-gray-500">
          Active Orders
        </p>

        <h4 className="text-2xl font-bold mt-2">
          7
        </h4>
      </div>

    </div>

  </div>

</div>

<div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-6">

  <div className="flex items-center justify-between">

    <div>

      <h3 className="text-2xl font-bold">
        Vendor Communication Timeline
      </h3>

      <p className="text-gray-500 mt-1">
        Operational communication history with the vendor.
      </p>

    </div>

    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm font-semibold">
      2 Conversations
    </span>

  </div>

  <div className="space-y-5 mt-6">

    <div className="bg-white rounded-xl border p-4">

      <div className="flex justify-between">

        <p className="font-semibold">
          Vendor
        </p>

        <span className="text-xs text-gray-500">
          09:16 AM
        </span>

      </div>

      <p className="text-sm text-gray-600 mt-2">
        Vendor confirmed food preparation has started and estimated completion in 18 minutes.
      </p>

    </div>

    <div className="bg-white rounded-xl border p-4">

      <div className="flex justify-between">

        <p className="font-semibold">
          Operations Team
        </p>

        <span className="text-xs text-gray-500">
          09:21 AM
        </span>

      </div>

      <p className="text-sm text-gray-600 mt-2">
        Operations advised the vendor that rider assignment is currently in progress.
      </p>

    </div>

  </div>

</div>


    </>
  );
}