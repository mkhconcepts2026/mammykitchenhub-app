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

              <p className="text-sm text-gray-500">
                {request.status}
              </p>

            </div>

            <span
              className="
                px-4
                py-2
                rounded-xl
                bg-gray-100
                text-sm
              "
            >
              {request.requester_type}
            </span>

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