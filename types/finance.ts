export interface VendorWallet {
  id: string;
  vendor_id: string;
  available_balance: number;
  pending_balance: number;
  accrued_balance: number;
  lifetime_earnings: number;
  updated_at: string;

  vendor?: {
    id: string;
    name: string;
    status: string;
  };
}

export interface RiderWallet {
  id: string;
  rider_id: string;
  available_balance: number;
  pending_balance: number;
  lifetime_earnings: number;
  updated_at: string;

  rider?: {
    id: string;
    full_name: string;
    status: string;
  };
}

export interface VendorTransaction {
  id: string;
  vendor_id: string;
  order_id: string;
  gross_amount: number;
  mkh_commission: number;
  net_amount: number;
  status: string;
  settlement_date: string | null;
  paid_at: string | null;
  created_at: string;

  vendor?: {
    name: string;
  };
}

export interface RiderEarning {
  id: string;
  rider_id: string;
  order_id: string;
  vendor_id: string;
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;

  rider?: {
    full_name: string;
  };
}