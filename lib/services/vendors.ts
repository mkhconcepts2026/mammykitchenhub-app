import { supabase } from "@/lib/supabase";

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

export async function getVendorTransactions() {
  const { data, error } = await supabase
    .from("vendor_transactions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}