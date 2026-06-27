"use client";

interface RevenueOverviewProps {

  totalRevenue: number;

  platformRevenue: number;

  deliveryRevenue: number;

  pendingPayouts: number;

  processingPayouts: number;

  paidPayouts: number;

}

export default function RevenueOverview({

  totalRevenue,

  platformRevenue,

  deliveryRevenue,

  pendingPayouts,

  processingPayouts,

  paidPayouts

}: RevenueOverviewProps) {

  return (

    <div
      className="
        grid
        grid-cols-1
        md:grid-cols-2
        xl:grid-cols-3
        gap-6
        mb-10
      "
    >

      <div
        className="
          bg-white
          rounded-3xl
          p-6
          shadow-sm
          border
          border-gray-100
        "
      >

        <p className="text-gray-500">
          Total MKH Revenue
        </p>

        <h2 className="text-4xl font-bold mt-3">
          ₦{totalRevenue.toLocaleString()}
        </h2>

      </div>

      <div
        className="
          bg-white
          rounded-3xl
          p-6
          shadow-sm
          border
          border-gray-100
        "
      >

        <p className="text-gray-500">
          Platform Fees
        </p>

        <h2 className="text-4xl font-bold mt-3">
          ₦{platformRevenue.toLocaleString()}
        </h2>

      </div>

      <div
        className="
          bg-white
          rounded-3xl
          p-6
          shadow-sm
          border
          border-gray-100
        "
      >

        <p className="text-gray-500">
          MKH Delivery Share
        </p>

        <h2 className="text-4xl font-bold mt-3">
          ₦{deliveryRevenue.toLocaleString()}
        </h2>

      </div>

      <div
        className="
          bg-white
          rounded-3xl
          p-6
          shadow-sm
          border
          border-gray-100
        "
      >

        <p className="text-gray-500">
          Pending Payouts
        </p>

        <h2 className="text-4xl font-bold mt-3">
          ₦{pendingPayouts.toLocaleString()}
        </h2>

      </div>

      <div
        className="
          bg-white
          rounded-3xl
          p-6
          shadow-sm
          border
          border-gray-100
        "
      >

        <p className="text-gray-500">
          Processing Payouts
        </p>

        <h2 className="text-4xl font-bold mt-3">
          ₦{processingPayouts.toLocaleString()}
        </h2>

      </div>

      <div
        className="
          bg-white
          rounded-3xl
          p-6
          shadow-sm
          border
          border-gray-100
        "
      >

        <p className="text-gray-500">
          Paid Payouts
        </p>

        <h2 className="text-4xl font-bold mt-3">
          ₦{paidPayouts.toLocaleString()}
        </h2>

      </div>

    </div>

  );

}