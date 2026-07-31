interface ActiveIncidentCenterProps {
  order?: any;
}

export default function ActiveIncidentCenter({
  order,
}: ActiveIncidentCenterProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-6">

      <div className="flex items-center justify-between">

        <div>

          <h3 className="text-2xl font-bold">
            Active Incident Center
          </h3>

          <p className="text-gray-500 mt-1">
            Track all operational incidents affecting this order.
          </p>

        </div>

        <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-semibold">
          1 Open Incident
        </span>

      </div>

      <div className="mt-6 bg-white rounded-xl border border-red-200 p-5">

        <div className="flex justify-between items-start">

          <div>

            <h4 className="text-lg font-semibold">
              Rider Assignment Delay
            </h4>

            <p className="text-sm text-gray-500 mt-2">
              Dispatch has exceeded the expected assignment time.
              Manual intervention may be required.
            </p>

          </div>

          <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">
            Medium Priority
          </span>

        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">

          <div>
            <p className="text-xs uppercase text-gray-500">
              Owner
            </p>

            <p className="font-semibold mt-1">
              Territory Manager
            </p>
          </div>

          <div>
            <p className="text-xs uppercase text-gray-500">
              Status
            </p>

            <p className="font-semibold text-orange-600 mt-1">
              Investigating
            </p>
          </div>

          <div>
            <p className="text-xs uppercase text-gray-500">
              Started
            </p>

            <p className="font-semibold mt-1">
              09:19 AM
            </p>
          </div>

          <div>
            <p className="text-xs uppercase text-gray-500">
              SLA Impact
            </p>

            <p className="font-semibold text-green-600 mt-1">
              Low
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}