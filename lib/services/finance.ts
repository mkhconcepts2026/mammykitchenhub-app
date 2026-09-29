import { supabase } from "@/lib/supabase";

export async function getVendorWallets() {
  const { data, error } = await supabase
    .from("vendor_wallets")
    .select(`
      *,
      vendors!vendor_wallets_vendor_id_fkey (
        id,
        name,
        status
      )
    `)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function getFinancialLedger() {
  const { data, error } = await supabase
    .from("financial_ledger")
    .select(`
      *,
      vendors:vendor_id (
        id,
        name,
        status
      ),
      profiles:rider_id (
        id,
        full_name,
        status
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function getRiderWallets() {
  const { data, error } = await supabase
    .from("rider_wallets")
    .select(`
      *,
      profiles!rider_wallets_rider_id_fkey (
        id,
        full_name,
        status
      )
    `)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function getRiderEarnings() {
  const { data, error } = await supabase
    .from("rider_earnings")
    .select(`
      *,
      profiles!rider_earnings_rider_id_fkey (
        id,
        full_name,
        status
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}