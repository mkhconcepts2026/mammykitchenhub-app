interface RightOperationsPanelProps {
  order?: any;
}

export default function RightOperationsPanel({
  order,
}: RightOperationsPanelProps) {
  return (
    <div className="space-y-6">

      {/* Operational Status */}

      <div className="bg-white rounded-2xl border p-6 shadow-sm">

        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">
            Operational Status
          </h3>

          <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
            Healthy
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">

          <div>
            <p className="text-xs uppercase text-gray-500">
              SLA Health
            </p>

            <p className="font-bold text-green-600 mt-1">
              98%
            </p>
          </div>

          <div>
            <p className="text-xs uppercase text-gray-500">
              ETA Confidence
            </p>

            <p className="font-bold mt-1">
              High
            </p>
          </div>

          <div>
            <p className="text-xs uppercase text-gray-500">
              Risk Level
            </p>

            <p className="font-bold text-orange-600 mt-1">
              Medium
            </p>
          </div>

          <div>
            <p className="text-xs uppercase text-gray-500">
              Territory Load
            </p>

            <p className="font-bold mt-1">
              Moderate
            </p>
          </div>

        </div>

           </div>

      {/* ==========================================
          RIDER INTELLIGENCE
      ========================================== */}

      <div className="bg-white rounded-2xl border p-6 shadow-sm">

        <div className="flex items-center justify-between">

          <h3 className="text-xl font-bold">
            Rider Intelligence
          </h3>

          <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
            Live
          </span>

        </div>

        <div className="space-y-5 mt-6">

          <div className="flex justify-between">

            <span className="text-gray-500">
              Assigned Rider
            </span>

            <span className="font-semibold">
              {order?.rider_name ?? "Awaiting Assignment"}
            </span>

          </div>

          <div className="flex justify-between">

            <span className="text-gray-500">
              Current Status
            </span>

            <span className="font-semibold text-green-600">
              Active
            </span>

          </div>

          <div className="flex justify-between">

            <span className="text-gray-500">
              Acceptance Rate
            </span>

            <span className="font-semibold">
              97%
            </span>

          </div>

          <div className="flex justify-between">

            <span className="text-gray-500">
              Distance to Vendor
            </span>

            <span className="font-semibold">
              1.8 km
            </span>

          </div>

          <div className="flex justify-between">

            <span className="text-gray-500">
              Estimated Arrival
            </span>

            <span className="font-semibold">
              4 mins
            </span>

          </div>

        </div>

           </div>

      {/* ==========================================
          FINANCIAL INTELLIGENCE
      ========================================== */}

      <div className="bg-white rounded-2xl border p-6 shadow-sm">

        <div className="flex items-center justify-between">

          <h3 className="text-xl font-bold">
            Financial Intelligence
          </h3>

          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
            Revenue
          </span>

        </div>

        <div className="space-y-5 mt-6">

          <div className="flex justify-between">

            <span className="text-gray-500">
              Order Value
            </span>

            <span className="font-semibold">
              ₦12,500
            </span>

          </div>

          <div className="flex justify-between">

            <span className="text-gray-500">
              Delivery Fee
            </span>

            <span className="font-semibold">
              ₦1,500
            </span>

          </div>

          <div className="flex justify-between">

            <span className="text-gray-500">
              Vendor Earnings
            </span>

            <span className="font-semibold">
              ₦10,000
            </span>

          </div>

          <div className="flex justify-between">

            <span className="text-gray-500">
              MKH Commission
            </span>

            <span className="font-semibold text-green-600">
              ₦1,000
            </span>

          </div>

          <div className="flex justify-between">

            <span className="text-gray-500">
              Estimated Profit
            </span>

            <span className="font-semibold text-emerald-600">
              ₦2,500
            </span>

          </div>

        </div>

            </div>

      {/* ==========================================
          AI INTELLIGENCE
      ========================================== */}

      <div className="bg-white rounded-2xl border p-6 shadow-sm">

        <div className="flex items-center justify-between">

          <h3 className="text-xl font-bold">
            AI Intelligence
          </h3>

          <span className="px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold">
            Live AI
          </span>

        </div>

        <div className="space-y-4 mt-6">

          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">

            <h4 className="font-semibold text-violet-700">
              Predicted Outcome
            </h4>

            <p className="text-sm text-gray-600 mt-2">
              This order is expected to complete successfully within SLA.
            </p>

          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">

            <h4 className="font-semibold text-amber-700">
              Risk Assessment
            </h4>

            <p className="text-sm text-gray-600 mt-2">
              Moderate risk of rider delay due to current territory demand.
            </p>

          </div>

          <div className="rounded-xl border border-green-200 bg-green-50 p-4">

            <h4 className="font-semibold text-green-700">
              Recommended Action
            </h4>

            <p className="text-sm text-gray-600 mt-2">
              Continue monitoring. No manager intervention is required at this time.
            </p>

          </div>

        </div>

            </div>

      {/* ==========================================
          AUTOMATION CENTER
      ========================================== */}

      <div className="bg-white rounded-2xl border p-6 shadow-sm">

        <div className="flex items-center justify-between">

          <h3 className="text-xl font-bold">
            Automation Center
          </h3>

          <span className="px-3 py-1 rounded-full bg-cyan-100 text-cyan-700 text-xs font-semibold">
            Ready
          </span>

        </div>

        <div className="space-y-3 mt-6">

          <button
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left hover:bg-gray-50 transition"
          >
            <div className="font-semibold">
              Auto Assign Backup Rider
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Trigger automatic reassignment if delivery is at risk.
            </div>
          </button>

          <button
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left hover:bg-gray-50 transition"
          >
            <div className="font-semibold">
              Notify Vendor
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Send an operational update to the vendor.
            </div>
          </button>

          <button
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left hover:bg-gray-50 transition"
          >
            <div className="font-semibold">
              Escalate Incident
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Forward this order to the Operations Resolution team.
            </div>
          </button>

          <button
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left hover:bg-gray-50 transition"
          >
            <div className="font-semibold">
              Contact Customer
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Send a proactive delay notification.
            </div>
          </button>

        </div>

            </div>

      {/* ==========================================
          EXECUTIVE MISSION CONTROL
      ========================================== */}

      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-lg">

        <div className="flex items-center justify-between">

          <h3 className="text-xl font-bold">
            Executive Mission Control
          </h3>

          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
            Stable
          </span>

        </div>

        <div className="space-y-5 mt-6">

          <div className="flex justify-between items-center">
            <span className="text-slate-300">
              Overall Operational Health
            </span>

            <span className="font-bold text-emerald-300">
              Excellent
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-300">
              Active Priority Incidents
            </span>

            <span className="font-bold">
              1
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-300">
              Orders Meeting SLA
            </span>

            <span className="font-bold text-emerald-300">
              98%
            </span>
          </div>

          <div className="rounded-xl bg-slate-800 p-4 border border-slate-700">

            <p className="text-sm text-slate-300">
              Executive Summary
            </p>

            <p className="mt-2 text-sm leading-6">
              Territory operations are stable. Current orders are progressing
              within acceptable SLA thresholds. Continue monitoring rider
              performance while maintaining proactive communication with vendors.
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}