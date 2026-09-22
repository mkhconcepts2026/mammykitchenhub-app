import { supabase } from "@/lib/supabase";
import {
  RiderCurrentOrder,
  RiderOperationalStatus,
} from "@/types/rider";

export interface TerritoryRiderLocation {
  id: string;
  rider_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  accuracy: number;
  updated_at: string;

  profiles?: {
    full_name: string | null;
    status: string | null;
  };

  current_order: RiderCurrentOrder | null;
  operational_status: RiderOperationalStatus;
}

export async function getRiderLocations(): Promise<
  TerritoryRiderLocation[]
> {
  const [
    { data: locationRows, error: locationError },
    { data: orderRows, error: orderError },
  ] = await Promise.all([
    supabase
      .from("rider_locations")
      .select(`
        id,
        rider_id,
        latitude,
        longitude,
        speed,
        heading,
        accuracy,
        updated_at,
        profiles:rider_id (
          full_name,
          status
        )
      `)
      .order("updated_at", { ascending: false }),

    supabase
      .from("orders")
      .select(`
        id,
        order_number,
        status,
        vendor_id,
        rider_id,
        total,
        created_at
      `)
      .in("status", ["assigned", "picked_up"])
      .not("rider_id", "is", null),
  ]);

  if (locationError) {
    throw locationError;
  }

  if (orderError) {
    throw orderError;
  }

  const locations = locationRows ?? [];
  const currentOrders = (orderRows ?? []) as RiderCurrentOrder[];

  return locations.map((location: any) => {
    const currentOrder =
      currentOrders.find(
        (order) => order.rider_id === location.rider_id
      ) ?? null;

    const accountStatus =
      location.profiles?.status ?? null;

    let operationalStatus: RiderOperationalStatus;

    if (
      accountStatus === "inactive" ||
      accountStatus === "suspended"
    ) {
      operationalStatus = "offline";
    } else if (currentOrder?.status === "assigned") {
      operationalStatus = "assigned";
    } else if (currentOrder?.status === "picked_up") {
      operationalStatus = "delivering";
    } else {
      operationalStatus = "available";
    }

    return {
      id: location.id,
      rider_id: location.rider_id,
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      speed: Number(location.speed ?? 0),
      heading: Number(location.heading ?? 0),
      accuracy: Number(location.accuracy ?? 0),
      updated_at: location.updated_at,

      profiles: location.profiles
        ? {
            full_name: location.profiles.full_name ?? null,
            status: location.profiles.status ?? null,
          }
        : undefined,

      current_order: currentOrder,
      operational_status: operationalStatus,
    };
  });
}