interface ResolutionOperationsProps {
  order?: any;
}

export default function ResolutionOperations({
  order,
}: ResolutionOperationsProps) {
  return (
    <>
<div className="bg-slate-50 rounded-2xl p-6 mt-6">

  <div className="flex items-center justify-between">

    <h3 className="text-2xl font-bold">
      Operational Notes
    </h3>

    <span className="px-3 py-1 rounded-full bg-slate-200 text-slate-700 text-sm font-semibold">
      Internal Notes
    </span>

  </div>

  <p className="text-gray-500 mt-2">
    Record customer conversations, vendor updates, rider issues, escalations, and manager handover notes.
  </p>

  <textarea
    rows={6}
    placeholder="Enter operational notes..."
    className="w-full mt-6 rounded-xl border border-gray-300 p-4 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
  />

  <div className="flex justify-end mt-4">

    <button
      className="px-6 py-3 rounded-xl bg-orange-600 text-white font-semibold hover:bg-orange-700 transition"
    >
      Save Notes
    </button>

  </div>

</div>

<div className="bg-slate-50 rounded-2xl p-6 mt-6">

  <div className="flex items-center justify-between">

    <h3 className="text-2xl font-bold">
      Audit Trail
    </h3>

    <span className="px-3 py-1 rounded-full bg-slate-200 text-slate-700 text-sm font-semibold">
      System Log
    </span>

  </div>

  <div className="mt-6 space-y-5">

    <div className="border-l-4 border-green-500 pl-4">

      <p className="font-semibold">
        Order Created
      </p>

      <p className="text-sm text-gray-500">
        Customer successfully placed the order.
      </p>

      <p className="text-xs text-gray-400 mt-1">
        Today • 09:12 AM
      </p>

    </div>

    <div className="border-l-4 border-blue-500 pl-4">

      <p className="font-semibold">
        Vendor Accepted Order
      </p>

      <p className="text-sm text-gray-500">
        Vendor confirmed preparation has started.
      </p>

      <p className="text-xs text-gray-400 mt-1">
        Today • 09:16 AM
      </p>

    </div>

    <div className="border-l-4 border-orange-500 pl-4">

      <p className="font-semibold">
        Rider Search Initiated
      </p>

      <p className="text-sm text-gray-500">
        Dispatch engine is searching for the nearest available rider.
      </p>

      <p className="text-xs text-gray-400 mt-1">
        Today • 09:19 AM
      </p>

    </div>

  </div>

</div>

<div className="bg-green-50 rounded-2xl border border-green-200 p-6 mt-6">

  <div className="flex items-center justify-between">

    <div>

      <h3 className="text-2xl font-bold">
        Resolution Center
      </h3>

      <p className="text-gray-500 mt-1">
        Record the final operational outcome before closing this case.
      </p>

    </div>

    <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
      Pending Resolution
    </span>

  </div>

  <div className="grid lg:grid-cols-2 gap-6 mt-6">

    <div>

      <label className="text-sm font-medium text-gray-600">
        Resolution Summary
      </label>

      <textarea
        rows={6}
        placeholder="Describe how the issue was resolved..."
        className="w-full mt-2 rounded-xl border border-gray-300 p-4 resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
      />

    </div>

    <div className="space-y-4">

      <div className="bg-white rounded-xl border p-4">

        <p className="text-sm text-gray-500">
          Resolution Type
        </p>

        <select className="w-full mt-2 rounded-xl border border-gray-300 p-3">

          <option>Resolved Successfully</option>

          <option>Customer Cancelled</option>

          <option>Vendor Cancelled</option>

          <option>Refund Issued</option>

          <option>Escalated</option>

        </select>

      </div>

      <div className="bg-white rounded-xl border p-4">

        <p className="text-sm text-gray-500">
          Final Outcome
        </p>

        <p className="font-semibold mt-2">
          Awaiting Manager Decision
        </p>

      </div>

      <button className="w-full rounded-xl bg-green-600 text-white py-3 font-semibold hover:bg-green-700 transition">

        Complete Resolution

      </button>

    </div>

  </div>

</div>

<div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 mt-6">

  <div className="flex items-center justify-between">

    <div>

      <h3 className="text-2xl font-bold">
        Manager Decision Log
      </h3>

      <p className="text-gray-500 mt-1">
        Permanent record of operational decisions made during this order.
      </p>

    </div>

    <span className="px-3 py-1 rounded-full bg-slate-200 text-slate-700 text-sm font-semibold">
      Audit Ready
    </span>

  </div>

  <div className="space-y-5 mt-6">

    <div className="bg-white rounded-xl border p-4">

      <div className="flex justify-between items-center">

        <h4 className="font-semibold">
          Dispatch Strategy
        </h4>

        <span className="text-xs text-gray-500">
          09:22 AM
        </span>

      </div>

      <p className="text-sm text-gray-600 mt-2">
        Continue automated rider assignment before manual intervention.
      </p>

      <p className="text-xs text-orange-600 font-semibold mt-3">
        Decision Owner: Territory Manager
      </p>

    </div>

    <div className="bg-white rounded-xl border p-4">

      <div className="flex justify-between items-center">

        <h4 className="font-semibold">
          Customer Communication
        </h4>

        <span className="text-xs text-gray-500">
          09:24 AM
        </span>

      </div>

      <p className="text-sm text-gray-600 mt-2">
        Customer proactively informed about the rider assignment delay.
      </p>

      <p className="text-xs text-orange-600 font-semibold mt-3">
        Decision Owner: Territory Manager
      </p>

    </div>

  </div>

</div>

<div className="bg-indigo-50 rounded-2xl border border-indigo-200 p-6 mt-6">

  <div className="flex items-center justify-between">

    <div>

      <h3 className="text-2xl font-bold">
        Next Recommended Actions
      </h3>

      <p className="text-gray-500 mt-1">
        Prioritized operational recommendations generated from the current order state.
      </p>

    </div>

    <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-sm font-semibold">
      4 Recommendations
    </span>

  </div>

  <div className="space-y-4 mt-6">

    <div className="bg-white rounded-xl border border-indigo-200 p-4 flex justify-between items-center">

      <div>

        <h4 className="font-semibold">
          Contact Assigned Rider
        </h4>

        <p className="text-sm text-gray-500 mt-1">
          Confirm estimated arrival time at the vendor.
        </p>

      </div>

      <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
        HIGH
      </span>

    </div>

    <div className="bg-white rounded-xl border p-4 flex justify-between items-center">

      <div>

        <h4 className="font-semibold">
          Notify Customer
        </h4>

        <p className="text-sm text-gray-500 mt-1">
          Send an updated delivery estimate.
        </p>

      </div>

      <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">
        MEDIUM
      </span>

    </div>

    <div className="bg-white rounded-xl border p-4 flex justify-between items-center">

      <div>

        <h4 className="font-semibold">
          Monitor Vendor Preparation
        </h4>

        <p className="text-sm text-gray-500 mt-1">
          Confirm food will be ready before rider arrival.
        </p>

      </div>

      <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold">
        LOW
      </span>

    </div>

    <div className="bg-white rounded-xl border p-4 flex justify-between items-center">

      <div>

        <h4 className="font-semibold">
          Review SLA Progress
        </h4>

        <p className="text-sm text-gray-500 mt-1">
          Continue monitoring remaining SLA window.
        </p>

      </div>

      <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
        INFO
      </span>

    </div>

  </div>

</div>

<div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-6 mt-6">

  <div className="flex items-center justify-between">

    <div>

      <h3 className="text-2xl font-bold">
        Order Closure Checklist
      </h3>

      <p className="text-gray-500 mt-1">
        Verify that all operational requirements have been completed before closing this order.
      </p>

    </div>

    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm font-semibold">
      6 Checks
    </span>

  </div>

  <div className="space-y-4 mt-6">

    <label className="flex items-center justify-between bg-white rounded-xl border p-4">

      <span className="font-medium">
        Customer notified of final outcome
      </span>

      <input type="checkbox" className="h-5 w-5" />

    </label>

    <label className="flex items-center justify-between bg-white rounded-xl border p-4">

      <span className="font-medium">
        Vendor communication completed
      </span>

      <input type="checkbox" className="h-5 w-5" />

    </label>

    <label className="flex items-center justify-between bg-white rounded-xl border p-4">

      <span className="font-medium">
        Rider activity verified
      </span>

      <input type="checkbox" className="h-5 w-5" />

    </label>

    <label className="flex items-center justify-between bg-white rounded-xl border p-4">

      <span className="font-medium">
        Resolution documented
      </span>

      <input type="checkbox" className="h-5 w-5" />

    </label>

    <label className="flex items-center justify-between bg-white rounded-xl border p-4">

      <span className="font-medium">
        Audit trail reviewed
      </span>

      <input type="checkbox" className="h-5 w-5" />

    </label>

    <label className="flex items-center justify-between bg-white rounded-xl border p-4">

      <span className="font-medium">
        Ready to close order
      </span>

      <input type="checkbox" className="h-5 w-5" />

    </label>

  </div>

</div>

<div className="bg-violet-50 rounded-2xl border border-violet-200 p-6 mt-6">

  <div className="flex items-center justify-between">

    <div>

      <h3 className="text-2xl font-bold">
        Case Completion Summary
      </h3>

      <p className="text-gray-500 mt-1">
        Final operational overview before this order is archived.
      </p>

    </div>

    <span className="px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-sm font-semibold">
      Ready for Archive
    </span>

  </div>

  <div className="grid lg:grid-cols-2 gap-6 mt-6">

    <div className="space-y-4">

      <div className="bg-white rounded-xl border p-4">

        <p className="text-sm text-gray-500">
          Incident Outcome
        </p>

        <p className="font-semibold mt-2">
          Successfully Resolved
        </p>

      </div>

      <div className="bg-white rounded-xl border p-4">

        <p className="text-sm text-gray-500">
          Total Resolution Time
        </p>

        <p className="font-semibold mt-2">
          31 Minutes
        </p>

      </div>

      <div className="bg-white rounded-xl border p-4">

        <p className="text-sm text-gray-500">
          SLA Result
        </p>

        <p className="font-semibold mt-2 text-green-600">
          Within SLA Target
        </p>

      </div>

    </div>

    <div className="space-y-4">

      <div className="bg-white rounded-xl border p-4">

        <p className="text-sm text-gray-500">
          Final Resolution
        </p>

        <p className="text-sm mt-2">
          Vendor preparation delay resolved through proactive rider coordination and continuous customer communication.
        </p>

      </div>

      <button className="w-full rounded-xl bg-violet-600 text-white py-3 font-semibold hover:bg-violet-700 transition">

        Archive Case

      </button>

    </div>

  </div>

</div>
    </>
  );
}