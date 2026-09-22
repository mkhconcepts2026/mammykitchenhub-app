export type SettlementStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export interface Settlement {

  id: string;

  order_id: string;

  vendor_id: string;

  rider_id: string;

  territory_id?: string | null;

  order_total: number;

  vendor_amount: number;

  rider_amount: number;

  mkh_platform_amount: number;

  mkh_delivery_amount: number;

  service_charge: number;

  status: SettlementStatus;

  settled_at?: string | null;

  created_at: string;

}

export interface SettlementBreakdown {

  vendor_commission_percentage: number;

  rider_delivery_percentage: number;

  mkh_delivery_percentage: number;

  platform_fee: number;

  service_charge: number;

}