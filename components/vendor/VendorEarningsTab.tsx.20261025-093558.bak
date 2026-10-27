"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type VendorWallet = {
  available_balance: number;
  pending_balance: number;
  lifetime_earnings: number;
};

export default function VendorEarningsTab() {
    const [
  wallet,
  setWallet
] = useState<VendorWallet | null>(
  null
);

useEffect(() => {

  loadWallet();

}, []);

async function loadWallet() {

  const {
    data,
    error
  } = await supabase
    .from("vendor_wallets")
    .select("*")
    .limit(1)
    .single();

  if(error){

    console.error(error);

    return;
  }

  setWallet(data);

}
  return (
    <div className="p-6">

      <h1 className="text-3xl font-bold mb-6">
        Vendor Earnings
      </h1>

      <div className="grid md:grid-cols-3 gap-6">

        <div className="bg-green-50 border border-green-200 rounded-3xl p-6">
          <p className="text-gray-500">
            Available Balance
          </p>

          <h2 className="text-4xl font-bold text-green-600 mt-2">
            ₦{
  wallet?.available_balance
    ?.toLocaleString() || 0
}
          </h2>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-3xl p-6">
          <p className="text-gray-500">
            Pending Balance
          </p>

          <h2 className="text-4xl font-bold text-yellow-600 mt-2">
            ₦{
  wallet?.pending_balance
    ?.toLocaleString() || 0
}
          </h2>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-3xl p-6">
          <p className="text-gray-500">
            Lifetime Earnings
          </p>

          <h2 className="text-4xl font-bold text-blue-600 mt-2">
            ₦{
  wallet?.lifetime_earnings
    ?.toLocaleString() || 0
}
          </h2>
        </div>

      </div>

      <div className="mt-8">
       <button
  onClick={async () => {

    if (
      !wallet?.available_balance
    ) {
      alert(
        "No funds available"
      );
      return;
    }

    const { error } =
      await supabase
        .from("payout_requests")
        .insert({

          requester_id:
            "2a3ec3df-5133-4776-b18d-12aaad0f401b",

          requester_type:
            "vendor",

          amount:
            wallet.available_balance,

          status:
            "pending"

        });

    if(error){

      console.error(error);

      alert(
        "Unable to create payout request"
      );

      return;
    }

    alert(
      "Payout request submitted"
    );

  }}
  className="
    bg-green-600
    text-white
    px-6
    py-3
    rounded-xl
    font-semibold
  "
>
  Request Payout
</button>
      </div>

    </div>
  );
}