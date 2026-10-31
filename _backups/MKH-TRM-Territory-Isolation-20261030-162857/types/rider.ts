export type RiderAccountStatus =
  | "active"
  | "inactive"
  | "suspended"
  | string;

export type RiderOperationalStatus =
  | "available"
  | "assigned"
  | "delivering"
  | "offline";

export interface RiderCurrentOrder {
  id: string;
  order_number: string | null;
  status: string;
  vendor_id: string | null;
  rider_id: string | null;
  total: number;
  created_at: string;
}

export interface RiderRecord {
  id: string;

  full_name: string | null;
  email: string | null;
  phone: string | null;

  /**
   * Account status from profiles.status.
   * This is NOT the rider's live operational status.
   */
  status: RiderAccountStatus;

  /**
   * Derived from the rider's account status
   * and current order state.
   */
  operational_status: RiderOperationalStatus;

  available_balance: number;
  pending_balance: number;
  lifetime_earnings: number;

  /**
   * Last known rider GPS/location update.
   */
  updated_at: string | null;

  /**
   * Current active delivery, when applicable.
   */
  current_order: RiderCurrentOrder | null;
}