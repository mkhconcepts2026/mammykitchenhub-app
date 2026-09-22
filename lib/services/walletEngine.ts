import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

/* ----------------------------------
   Vendor Wallet
----------------------------------- */

export async function getVendorWallet(
  vendorId: string
) {
  return await supabase
    .from("vendor_wallets")
    .select("*")
    .eq("vendor_id", vendorId)
    .single();
}

export async function updateVendorWallet(
  vendorId: string,
  values: {
    available_balance?: number;
    accrued_balance?: number;
    lifetime_earnings?: number;
  }
) {
  return await supabase
    .from("vendor_wallets")
    .update(values)
    .eq("vendor_id", vendorId)
    .select()
    .single();
}

/* ----------------------------------
   Rider Wallet
----------------------------------- */

export async function getRiderWallet(
  riderId: string
) {
  return await supabase
    .from("rider_wallets")
    .select("*")
    .eq("rider_id", riderId)
    .single();
}

export async function updateRiderWallet(
  riderId: string,
  values: {
    available_balance?: number;
    pending_balance?: number;
    lifetime_earnings?: number;
  }
) {

  console.log("Updating Rider Wallet");
  console.log("Rider ID:", riderId);
  console.log("Values:", values);

  const result = await supabase
  .from("rider_wallets")
  .update(values)
  .eq("rider_id", riderId)
  .select();

console.log("=== RIDER WALLET UPDATE ===");
console.log("Error:", result.error);
console.log("Data:", result.data);
console.log("Count:", result.data?.length);
console.log("===========================");

return result;
}