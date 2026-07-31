interface RiderOperationsProps {
  order?: any;
}

export default function RiderOperations({
  order,
}: RiderOperationsProps) {
  return (
    <>
<div className="bg-slate-50 rounded-2xl p-6">

  <div className="flex items-center justify-between">

    <h3 className="text-2xl font-bold">
      Live Operations Timeline
    </h3>

    <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-sm font-semibold">
      Real-Time
    </span>

  </div>

  <div className="mt-8 space-y-5">

    <div className="flex gap-4">

      <div className="flex flex-col items-center">
        <div className="w-4 h-4 rounded-full bg-green-500"></div>
        <div className="w-1 h-14 bg-green-300"></div>
      </div>

      <div className="flex-1">

        <div className="flex justify-between">

          <h4 className="font-bold">
            Order Placed
          </h4>

          <span className="text-xs text-gray-500">
            09:12 AM
          </span>

        </div>

        <p className="text-sm text-gray-500 mt-1">
          Customer successfully submitted the order.
        </p>

        <p className="text-xs text-green-600 font-semibold mt-2">
          Completed • Customer
        </p>

      </div>

    </div>

    <div className="flex gap-4">

      <div className="flex flex-col items-center">
        <div className="w-4 h-4 rounded-full bg-green-500"></div>
        <div className="w-1 h-14 bg-green-300"></div>
      </div>

      <div className="flex-1">

        <div className="flex justify-between">

          <h4 className="font-bold">
            Vendor Accepted
          </h4>

          <span className="text-xs text-gray-500">
            09:15 AM
          </span>

        </div>

        <p className="text-sm text-gray-500 mt-1">
          Vendor acknowledged the order and began food preparation.
        </p>

        <p className="text-xs text-green-600 font-semibold mt-2">
          Completed • Vendor
        </p>

      </div>

    </div>

    <div className="flex gap-4">

      <div className="flex flex-col items-center">
        <div className="w-4 h-4 rounded-full bg-yellow-500 animate-pulse"></div>
        <div className="w-1 h-14 bg-yellow-300"></div>
      </div>

      <div className="flex-1">

        <div className="flex justify-between">

          <h4 className="font-bold">
            Rider Assignment
          </h4>

          <span className="text-xs text-orange-600 font-semibold">
            In Progress
          </span>

        </div>

        <p className="text-sm text-gray-500 mt-1">
          Dispatch engine is assigning the nearest available rider.
        </p>

        <p className="text-xs text-orange-600 font-semibold mt-2">
          Dispatch Engine
        </p>

      </div>

    </div>

    <div className="flex gap-4 opacity-50">

      <div className="flex flex-col items-center">
        <div className="w-4 h-4 rounded-full bg-gray-400"></div>
        <div className="w-1 h-14 bg-gray-300"></div>
      </div>

      <div className="flex-1">

        <h4 className="font-bold">
          Rider Pickup
        </h4>

        <p className="text-sm text-gray-500 mt-1">
          Awaiting rider arrival at the vendor.
        </p>

      </div>

    </div>

    <div className="flex gap-4 opacity-50">

      <div className="w-4 h-4 rounded-full bg-gray-400 mt-1"></div>

      <div>

        <h4 className="font-bold">
          Delivery Completed
        </h4>

        <p className="text-sm text-gray-500 mt-1">
          Customer successfully receives the order.
        </p>

      </div>

    </div>

  </div>

</div>

<div className="bg-sky-50 rounded-2xl border border-sky-200 p-6">

  <div className="flex items-center justify-between">

    <div>

      <h3 className="text-2xl font-bold">
        Rider Communication Timeline
      </h3>

      <p className="text-gray-500 mt-1">
        Complete communication history between Operations and the assigned rider.
      </p>

    </div>

    <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-sm font-semibold">
      2 Conversations
    </span>

  </div>

  <div className="space-y-5 mt-6">

    <div className="bg-white rounded-xl border p-4">

      <div className="flex justify-between">

        <p className="font-semibold">
          Dispatch Engine
        </p>

        <span className="text-xs text-gray-500">
          09:20 AM
        </span>

      </div>

      <p className="text-sm text-gray-600 mt-2">
        Rider assignment notification was sent to the nearest available rider.
      </p>

    </div>

    <div className="bg-white rounded-xl border p-4">

      <div className="flex justify-between">

        <p className="font-semibold">
          Operations Team
        </p>

        <span className="text-xs text-gray-500">
          09:24 AM
        </span>

      </div>

      <p className="text-sm text-gray-600 mt-2">
        Rider was reminded to proceed directly to the vendor after accepting the assignment.
      </p>

    </div>

  </div>

</div>
    </>
  );
}