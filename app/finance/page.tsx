"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function FinancePage() {

  const supabase =
    createClient();

  const [stats, setStats] =
    useState({

      totalRevenue: 0,

      platformRevenue: 0,

      deliveryRevenue: 0,

      pendingPayouts: 0,

      processingPayouts: 0,

      paidPayouts: 0

    });

    const [
  payoutRequests,
  setPayoutRequests
] = useState<any[]>([]);

const [
  vendorsMap,
  setVendorsMap
] = useState<
  Record<string,string>
>({});

async function loadFinanceStats() {

const {
  data: payouts
} =
await supabase
  .from(
    "payout_requests"
  )
  .select("*")
  .order(
    "requested_at",
    {
      ascending: false
    }
  );

setPayoutRequests(
  payouts || []
);

const {
  data: vendors
} =
await supabase
  .from("vendors")
  .select(`
    id,
    name
  `);

const map:
  Record<string,string> = {};

(vendors || []).forEach(
  (vendor) => {

    map[
      vendor.id
    ] =
    vendor.name;

  }
);

setVendorsMap(
  map
);

  const {
    data: orders
  } =
  await supabase
    .from("orders")
    .select(`
      mkh_amount,
      platform_fee,
      delivery_fee
    `);

  const {
    data: pendingPayouts
  } =
  await supabase
    .from("payout_requests")
    .select("amount")
    .eq(
      "status",
      "pending"
    );

  const {
    data: processingPayouts
  } =
  await supabase
    .from("payout_requests")
    .select("amount")
    .eq(
      "status",
      "processing"
    );

  const {
    data: paidPayouts
  } =
  await supabase
    .from("payout_requests")
    .select("amount")
    .eq(
      "status",
      "paid"
    );

  const totalRevenue =
    (orders || []).reduce(

      (sum, order) =>

        sum +
        Number(
          order.mkh_amount || 0
        ),

      0

    );

  const platformRevenue =
    (orders || []).reduce(

      (sum, order) =>

        sum +
        Number(
          order.platform_fee || 0
        ),

      0

    );

 const deliveryRevenue =
  (orders || []).reduce(

    (sum, order) =>

      sum +

      (
        Number(
          order.mkh_amount || 0
        )

        -

        Number(
          order.platform_fee || 0
        )
      ),

    0

  );

  const pendingAmount =
    (pendingPayouts || []).reduce(

      (sum, payout) =>

        sum +
        Number(
          payout.amount || 0
        ),

      0

    );

  const processingAmount =
    (processingPayouts || []).reduce(

      (sum, payout) =>

        sum +
        Number(
          payout.amount || 0
        ),

      0

    );

  const paidAmount =
    (paidPayouts || []).reduce(

      (sum, payout) =>

        sum +
        Number(
          payout.amount || 0
        ),

      0

    );

  setStats({

    totalRevenue,

    platformRevenue,

    deliveryRevenue,

    pendingPayouts:
      pendingAmount,

    processingPayouts:
      processingAmount,

    paidPayouts:
      paidAmount

  });

}

useEffect(() => {

  loadFinanceStats();

}, []);

async function markProcessing(
  request: any
) {

  const confirmed =
    confirm(
      `Move ₦${Number(
        request.amount
      ).toLocaleString()} to Processing?`
    );

  if (!confirmed) {

    return;

  }

  const {
    error
  } =
  await supabase
    .from(
      "payout_requests"
    )
    .update({

      status:
        "processing"

    })
    .eq(
      "id",
      request.id
    );

  if (error) {

    alert(
      error.message
    );

    return;

  }

  loadFinanceStats();

}

async function markPaid(
  request: any
) {

  const confirmed =
    confirm(
      `Mark ₦${Number(
        request.amount
      ).toLocaleString()} as Paid?`
    );

  if (!confirmed) {

    return;

  }

  const {
    error
  } =
  await supabase
    .from(
      "payout_requests"
    )
    .update({

      status:
        "paid",

      processed_at:
        new Date()
          .toISOString()

    })
    .eq(
      "id",
      request.id
    );

  if (error) {

    alert(
      error.message
    );

    return;

  }

  loadFinanceStats();

}

  return (

    <main
      className="
        min-h-screen
        bg-slate-50
        p-8
      "
    >

      <div
        className="
          max-w-7xl
          mx-auto
        "
      >

       <div
  className="
    flex
    flex-col
    lg:flex-row
    lg:items-center
    gap-6
    mb-10
  "
>

 <Image
  src="/logo.png"
  alt="MKH Logo"
  width={180}
  height={52}
  priority
  style={{
    width: "180px",
    height: "auto"
  }}
/>

  <div>

    <h1
      className="
        text-5xl
        font-bold
        tracking-tight
      "
    >
      Finance & Accounts
    </h1>

    <p
      className="
        text-gray-500
        mt-2
        text-lg
      "
    >
      Manage MKH revenue, settlements and payouts
    </p>

  </div>

</div>
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
      ₦{stats.totalRevenue.toLocaleString()}
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
      ₦{stats.platformRevenue.toLocaleString()}
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
      ₦{stats.deliveryRevenue.toLocaleString()}
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
      ₦{stats.pendingPayouts.toLocaleString()}
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
      ₦{stats.processingPayouts.toLocaleString()}   
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
      ₦{stats.paidPayouts.toLocaleString()}
    </h2>

   </div>

</div>

<div
  className="
    bg-white
    rounded-3xl
    p-8
    shadow-sm
    border
    border-gray-100
  "
>

  <h2
    className="
      text-3xl
      font-bold
      mb-6
    "
  >
    Settlement Queue
  </h2>

  {payoutRequests.length === 0 ? (

    <p className="text-gray-500">
      No payout requests found.
    </p>

  ) : (

    <div className="space-y-4">

      {payoutRequests.map(
        (request) => (

          <div
            key={request.id}
            className="
              flex
              justify-between
              items-center
              border-b
              pb-4
            "
          >

            <div>

  <p className="font-semibold">
    ₦{
      Number(
        request.amount
      ).toLocaleString()
    }
  </p>

  <p
    className="
      text-xs
      text-gray-400
      mt-1
    "
  >
    Requested{" "}
    {
      new Date(
        request.requested_at
      ).toLocaleDateString(
        "en-NG",
        {
          day: "numeric",
          month: "short",
          year: "numeric"
        }
      )
    }
  </p>

  <span
    className={`
      inline-block
      mt-2
      px-3
      py-1
      rounded-full
      text-xs
      font-semibold

      ${
        request.status === "pending"
          ? "bg-yellow-100 text-yellow-700"

          : request.status === "processing"
          ? "bg-blue-100 text-blue-700"

          : request.status === "paid"
          ? "bg-green-100 text-green-700"

          : "bg-gray-100 text-gray-700"
      }
    `}
  >
    {request.status.toUpperCase()}
  </span>

</div>

           <div
  className="
    flex
    items-center
    gap-3
  "
>

  <span
    className="
      px-4
      py-2
      rounded-xl
      bg-gray-100
      text-sm
      font-medium
    "
  >
    {
      vendorsMap[
        request.requester_id
      ] || "Unknown Vendor"
    }
  </span>

  {request.status === "pending" && (

    <button
      onClick={() =>
        markProcessing(
          request
        )
      }
      className="
        bg-blue-600
        text-white
        px-4
        py-2
        rounded-xl
        text-sm
        font-semibold
      "
    >
      Mark Processing
    </button>

  )}

{request.status === "processing" && (

  <button
    onClick={() =>
      markPaid(
        request
      )
    }
    className="
      bg-green-600
      text-white
      px-4
      py-2
      rounded-xl
      text-sm
      font-semibold
    "
  >
    Mark Paid
  </button>

)}

</div>

          </div>

        )

      )}

    </div>

  )}

</div>

      </div>

    </main>

  );

}