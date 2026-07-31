import { supabase } from "@/lib/supabase";

export async function getRiders() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "rider");

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getRiderLocations() {
  const { data, error } = await supabase
    .from("rider_locations")
    .select("*");

  if (error) {
    throw error;
  }

  return data ?? [];
}