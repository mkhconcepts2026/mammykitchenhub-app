import { supabase } from "@/lib/supabase";

export async function getRiderLocations() {
  const { data, error } = await supabase
    .from("rider_locations")
    .select(`
      *,
      profiles:rider_id (
        full_name,
        status
      )
    `)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}