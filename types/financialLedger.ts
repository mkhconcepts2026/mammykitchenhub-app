export type LedgerEntryType =
  | "vendor_earning"
  | "rider_earning"
  | "platform_revenue"
  | "delivery_revenue"
  | "service_charge"
  | "refund"
  | "adjustment";

export interface FinancialLedgerEntry {
  id: string;

  order_id: string;

  vendor_id?: string | null;

  rider_id?: string | null;

  territory_id?: string | null;

  entry_type: LedgerEntryType;

  amount: number;

  description: string;

  reference: string;

  status:
    | "pending"
    | "completed"
    | "reversed";

  created_at: string;
}