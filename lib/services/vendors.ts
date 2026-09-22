import { supabase } from "@/lib/supabase";
import { VendorTransaction } from "@/types/vendor";

export async function getVendors() {
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function getVendorWallets() {
  const { data, error } = await supabase
    .from("vendor_wallets")
    .select("*");

  if (error) throw error;

  return data ?? [];
}

export async function getVendorApplications() {
  const { data, error } = await supabase
    .from("vendor_applications")
    .select("*");

  if (error) throw error;

  return data ?? [];
}

export async function getVendorTransactions(
  vendorId?: string
): Promise<VendorTransaction[]> {
  let query = supabase
    .from("vendor_transactions")
    .select("*")
    .order("created_at", { ascending: false });

  if (vendorId) {
    query = query.eq("vendor_id", vendorId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []) as VendorTransaction[];
}