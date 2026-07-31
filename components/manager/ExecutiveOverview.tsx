"use client";

type Props = {
  revenue: number;
  averageOrder: number;
  completionRate: number;
  vendorExposure: number;
  riderExposure: number;
  readyOrders: number;
  assignedOrders: number;
  pickedUpOrders: number;
  deliveredOrders: number;
};

export default function ExecutiveOverview({
  revenue,
  averageOrder,
  completionRate,
  vendorExposure,
  riderExposure,
  readyOrders,
  assignedOrders,
  pickedUpOrders,
  deliveredOrders,
}: Props) {
  return (
    <div className="space-y-8">

      {/* KPI Cards */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        <div className="bg-green-50 border border-green-200 rounded-3xl p-6">
          <p className="text-gray-500">Total Revenue</p>

          <h2 className="text-4xl font-bold text-green-600 mt-2">
            ₦{revenue.toLocaleString()}
          </h2>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-3xl p-6">
          <p className="text-gray-500">Average Order Value</p>

          <h2 className="text-4xl font-bold text-blue-600 mt-2">
            ₦{averageOrder.toLocaleString()}
          </h2>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-3xl p-6">
          <p className="text-gray-500">Completion Rate</p>

          <h2 className="text-4xl font-bold text-purple-600 mt-2">
            {completionRate}%
          </h2>
        </div>

      </div>

      {/* Wallet Exposure */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div className="bg-yellow-50 border border-yellow-200 rounded-3xl p-6">
          <p className="text-gray-500">Vendor Wallet Exposure</p>

          <h2 className="text-4xl font-bold text-yellow-600 mt-2">
            ₦{vendorExposure.toLocaleString()}
          </h2>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-3xl p-6">
          <p className="text-gray-500">Rider Wallet Exposure</p>

          <h2 className="text-4xl font-bold text-red-600 mt-2">
            ₦{riderExposure.toLocaleString()}
          </h2>
        </div>

      </div>

      {/* Live Operations */}

      <div className="bg-gradient-to-r from-orange-50 to-blue-50 border border-orange-200 rounded-3xl p-6">

        <h2 className="text-xl font-bold mb-5">
          🔔 Live Operations Alerts
        </h2>

        <div className="grid md:grid-cols-2 gap-4">

          <div className="bg-red-50 border border-red-200 rounded-xl p-4 font-medium text-red-700">
            🔴 {readyOrders} Orders waiting for rider assignment
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 font-medium text-blue-700">
            🔵 {assignedOrders} Riders currently delivering
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 font-medium text-purple-700">
            🟣 {pickedUpOrders} Orders picked up
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4 font-medium text-green-700">
            🟢 {deliveredOrders} Completed deliveries
          </div>

        </div>

      </div>

    </div>
  );
}