import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export async function getVendorFinancialSummary(
  vendorId: string
) {
  return await supabase
    .from("financial_ledger")
    .select("amount, entry_type")
    .eq("vendor_id", vendorId);
}

export async function getRiderFinancialSummary(
  riderId: string
) {
  return await supabase
    .from("financial_ledger")
    .select("amount, entry_type")
    .eq("rider_id", riderId);
}

export async function getPlatformRevenue() {
  return await supabase
    .from("financial_ledger")
    .select("amount")
    .eq("entry_type", "platform_revenue");
}

export async function getDeliveryRevenue() {
  return await supabase
    .from("financial_ledger")
    .select("amount")
    .eq("entry_type", "delivery_revenue");
}

export async function getServiceCharges() {
  return await supabase
    .from("financial_ledger")
    .select("amount")
    .eq("entry_type", "service_charge");
}