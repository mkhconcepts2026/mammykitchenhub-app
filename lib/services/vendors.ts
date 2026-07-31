import { supabase } from "@/lib/supabase";

export async function getVendors() {
  const { data, error } = await supabase
    .from("vendors")
    .select("*");

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getVendorWallets() {
  const { data, error } = await supabase
    .from("vendor_wallets")
    .select("*");

  if (error) {
    throw error;
  }

  return data ?? [];
}