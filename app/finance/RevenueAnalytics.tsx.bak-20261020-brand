"use client";

interface RevenueAnalyticsProps {

  todayRevenue: number;

  weekRevenue: number;

  monthRevenue: number;

  averageOrderValue: number;

  highestRevenueDay: string;

  highestRevenueAmount: number;

}

export default function RevenueAnalytics({

  todayRevenue,

  weekRevenue,

  monthRevenue,

  averageOrderValue,

  highestRevenueDay,

  highestRevenueAmount

}: RevenueAnalyticsProps) {

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
        Revenue Analytics
      </h2>

      <div
        className="
          grid
          grid-cols-1
          md:grid-cols-3
          gap-6
        "
      >

        <div
          className="
            bg-orange-50
            rounded-2xl
            p-6
          "
        >

          <p className="text-gray-500">
            Today's Revenue
          </p>

          <h3 className="text-3xl font-bold mt-2">
            ₦{todayRevenue.toLocaleString()}
          </h3>

        </div>

        <div
          className="
            bg-blue-50
            rounded-2xl
            p-6
          "
        >

          <p className="text-gray-500">
            This Week
          </p>

          <h3 className="text-3xl font-bold mt-2">
            ₦{weekRevenue.toLocaleString()}
          </h3>

        </div>

        <div
          className="
            bg-green-50
            rounded-2xl
            p-6
          "
        >

          <p className="text-gray-500">
            This Month
          </p>

          <h3 className="text-3xl font-bold mt-2">
            ₦{monthRevenue.toLocaleString()}
          </h3>

        </div>

      </div>

      <div
        className="
          mt-8
          grid
          grid-cols-1
          lg:grid-cols-2
          gap-6
        "
      >

        <div
          className="
            bg-gray-50
            rounded-2xl
            p-6
          "
        >

          <p className="text-gray-500">
            Average Order Value
          </p>

          <h3 className="text-3xl font-bold mt-2">
            ₦{averageOrderValue.toLocaleString()}
          </h3>

        </div>

        <div
          className="
            bg-gray-50
            rounded-2xl
            p-6
          "
        >

          <p className="text-gray-500">
            Best Revenue Day
          </p>

          <h3 className="text-3xl font-bold mt-2">
            {highestRevenueDay || "-"}
          </h3>

          <p
            className="
              text-orange-600
              font-semibold
              mt-2
            "
          >
            ₦{highestRevenueAmount.toLocaleString()}
          </p>

        </div>

      </div>

    </div>

  );

}