export type VendorTransactionStatus =
  | "pending"
  | "completed"
  | "failed"
  | "reversed"
  | string;

export interface VendorTransaction {
  id: string;

  vendor_id: string;

  order_id: string | null;

  amount: number;

  type: string | null;

  status: VendorTransactionStatus | null;

  description: string | null;

  reference: string | null;

  created_at: string | null;
}

export interface VendorRecord {
  id: string;

  name: string;

  cuisine: string | null;

  email: string | null;

  phone: string | null;

  owner_name: string | null;

  status: string | null;

  rating: number;

  available_balance: number;

  pending_balance: number;

  lifetime_earnings: number;

  /**
   * Recent financial transactions for this vendor.
   */
  transactions: VendorTransaction[];
}