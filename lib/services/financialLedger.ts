import { createClient } from "@/lib/supabase/client";
import {
  FinancialLedgerEntry,
  LedgerEntryType,
} from "@/types/financialLedger";

const supabase = createClient();

export async function createLedgerEntry(
  entry: Omit<
    FinancialLedgerEntry,
    "id" | "created_at"
  >
) {
  return await supabase
    .from("financial_ledger")
    .insert(entry)
    .select()
    .single();
}

export async function getOrderLedger(
  orderId: string
) {
  return await supabase
    .from("financial_ledger")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", {
      ascending: true,
    });
}

export async function getVendorLedger(
  vendorId: string
) {
  return await supabase
    .from("financial_ledger")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("created_at", {
      ascending: false,
    });
}

export async function getRiderLedger(
  riderId: string
) {
  return await supabase
    .from("financial_ledger")
    .select("*")
    .eq("rider_id", riderId)
    .order("created_at", {
      ascending: false,
    });
}

export async function getLedgerByType(
  type: LedgerEntryType
) {
  return await supabase
    .from("financial_ledger")
    .select("*")
    .eq("entry_type", type)
    .order("created_at", {
      ascending: false,
    });
}