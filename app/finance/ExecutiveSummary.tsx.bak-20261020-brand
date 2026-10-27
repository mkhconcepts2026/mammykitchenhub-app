"use client";

interface ExecutiveSummaryProps {

  totalOrders: number;

  averageRevenue: number;

  pendingRequests: number;

  completedPayouts: number;

}

export default function ExecutiveSummary({

  totalOrders,

  averageRevenue,

  pendingRequests,

  completedPayouts

}: ExecutiveSummaryProps) {

  return (

    <div
      className="
        bg-white
        rounded-3xl
        p-8
        shadow-sm
        border
        border-gray-100
        mb-8
      "
    >

      <h2
        className="
          text-3xl
          font-bold
          mb-6
        "
      >
        Executive Summary
      </h2>

      <div
        className="
          grid
          grid-cols-1
          md:grid-cols-2
          xl:grid-cols-4
          gap-6
        "
      >

        <div>

          <p className="text-gray-500">
            Total Orders
          </p>

          <h3 className="text-3xl font-bold mt-2">
            {totalOrders}
          </h3>

        </div>

        <div>

          <p className="text-gray-500">
            Average MKH Revenue
          </p>

          <h3 className="text-3xl font-bold mt-2">
            ₦{averageRevenue.toLocaleString()}
          </h3>

        </div>

        <div>

          <p className="text-gray-500">
            Pending Requests
          </p>

          <h3 className="text-3xl font-bold mt-2">
            {pendingRequests}
          </h3>

        </div>

        <div>

          <p className="text-gray-500">
            Completed Payouts
          </p>

          <h3 className="text-3xl font-bold mt-2">
            {completedPayouts}
          </h3>

        </div>

      </div>

    </div>

  );

}