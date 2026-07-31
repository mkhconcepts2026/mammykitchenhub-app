import { supabase } from "@/lib/supabase";

export async function getOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      *,
      vendors (
        id,
        name,
        cuisine,
        location,
        status
      ),
      rider:profiles!orders_rider_id_fkey (
        id,
        full_name,
        phone
      ),
      profiles!orders_user_id_fkey (
        id,
        full_name,
        email,
        phone
      )
    `)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function assignRider(
  orderId: string,
  riderId: string
) {
  const { error } = await supabase
    .from("orders")
    .update({
      rider_id: riderId,
      status: "assigned",
    })
    .eq("id", orderId);

  if (error) {
    throw error;
  }

  return true;
}