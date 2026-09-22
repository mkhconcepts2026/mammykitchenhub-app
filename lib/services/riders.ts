import { supabase } from "@/lib/supabase";
import {
  RiderCurrentOrder,
  RiderOperationalStatus,
} from "@/types/rider";

export async function getRiders() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "rider")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function getRiderLocations() {
  const { data, error } = await supabase
    .from("rider_locations")
    .select("*");

  if (error) throw error;

  return data ?? [];
}

export async function getRiderWallets() {
  const { data, error } = await supabase
    .from("rider_wallets")
    .select("*");

  if (error) throw error;

  return data ?? [];
}

export async function getRiderEarnings() {
  const { data, error } = await supabase
    .from("rider_earnings")
    .select("*");

  if (error) throw error;

  return data ?? [];
}

/**
 * Returns the current active order for each rider.
 *
 * Active rider delivery states:
 * assigned
 * picked_up
 *
 * A delivered order is intentionally excluded because
 * it is no longer an active delivery.
 */
export async function getRiderCurrentOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
        id,
        order_number,
        status,
        vendor_id,
        rider_id,
        total,
        created_at
      `
    )
    .in("status", ["assigned", "picked_up"])
    .not("rider_id", "is", null);

  if (error) throw error;

  return (data ?? []) as RiderCurrentOrder[];
}

/**
 * Derives the rider's live operational status.
 *
 * Account status remains separate from operational status.
 *
 * inactive / suspended account
 *        -> offline
 *
 * assigned order
 *        -> assigned
 *
 * picked_up order
 *        -> delivering
 *
 * active account with no active order
 *        -> available
 */
export function getRiderOperationalStatus(
  accountStatus: string | null,
  currentOrder: RiderCurrentOrder | null
): RiderOperationalStatus {
  if (
    accountStatus === "inactive" ||
    accountStatus === "suspended"
  ) {
    return "offline";
  }

  if (currentOrder?.status === "assigned") {
    return "assigned";
  }

  if (currentOrder?.status === "picked_up") {
    return "delivering";
  }

  return "available";
}