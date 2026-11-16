export type RiderAccountStatus =
  | "active"
  | "inactive"
  | "suspended"
  | string;

export type RiderOperationalStatus =
  | "available"
  | "offer_pending"
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

  /** Permanent MKH home-zone assignment. Temporary cross-zone dispatch does not change this. */
  home_zone_id?: string | null;
  home_zone_name?: string | null;
  availability_status?: "available" | "unavailable" | "unassigned" | string;
  gps_status?: "live" | "stale";

  /**
   * Derived from the rider's account status,
   * current order, pending offer and GPS state.
   */
  operational_status: RiderOperationalStatus;
  active_dispatch_offer?: {
    id: string;
    order_id: string;
    offer_status: string;
    expires_at: string;
  } | null;

  available_balance: number | null;
  pending_balance: number | null;
  lifetime_earnings: number | null;

  /** True when this rider is linked to vendors beyond the current TRM scope. */
  wallet_scope_limited?: boolean;

  /**
   * Last known rider GPS/location update.
   */
  updated_at: string | null;

  /**
   * Current active delivery, when applicable.
   */
  current_order: RiderCurrentOrder | null;
}