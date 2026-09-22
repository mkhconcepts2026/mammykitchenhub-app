import { supabase } from "@/lib/supabase";

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