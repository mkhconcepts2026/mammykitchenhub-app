import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EARTH_RADIUS_KM = 6371.0088;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });
}

function haversineKm(
  originLatitude: number,
  originLongitude: number,
  destinationLatitude: number,
  destinationLongitude: number
) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(destinationLatitude - originLatitude);
  const longitudeDelta = toRadians(destinationLongitude - originLongitude);
  const originLat = toRadians(originLatitude);
  const destinationLat = toRadians(destinationLatitude);

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLat) *
      Math.cos(destinationLat) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, a)));
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return json({ success: false, message: "Please sign in to find nearby vendors." }, 401);
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    String(profile.role ?? "").toLowerCase() !== "customer" ||
    String(profile.status ?? "").toLowerCase() !== "active"
  ) {
    return json({ success: false, message: "An active customer account is required." }, 403);
  }

  let body: { latitude?: unknown; longitude?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "A valid location request is required." }, 400);
  }

  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return json({ success: false, message: "The device location is invalid. Please try again." }, 400);
  }

  const { data: activeVendors, error: vendorsError } = await adminClient
    .from("vendors")
    .select("id")
    .eq("status", "active");

  if (vendorsError) {
    console.error("Nearby vendor lookup failed:", vendorsError.message);
    return json({ success: false, message: "Unable to load active MKH vendors right now." }, 500);
  }

  const activeVendorIds = (activeVendors ?? []).map((vendor) => vendor.id).filter(Boolean);
  if (!activeVendorIds.length) {
    return json({ success: true, vendors: [], measuredBy: "straight_line" });
  }

  // Only Admin-verified Google business locations with a successful MKH
  // locality match qualify for nearby discovery. Raw vendor coordinates remain
  // server-side and are not returned to the customer's browser.
  const { data: locations, error: locationsError } = await adminClient
    .from("vendor_business_locations")
    .select("vendor_id, latitude, longitude")
    .in("vendor_id", activeVendorIds)
    .eq("address_verification_status", "verified")
    .eq("locality_match_status", "matched")
    .not("locality_id", "is", null)
    .not("google_place_id", "is", null)
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  if (locationsError) {
    console.error("Verified vendor coordinates could not be loaded:", locationsError.message);
    return json({ success: false, message: "Verified vendor locations are temporarily unavailable." }, 500);
  }

  const nearestByVendor = new Map<string, number>();
  for (const location of locations ?? []) {
    const vendorId = String(location.vendor_id ?? "");
    const vendorLatitude = Number(location.latitude);
    const vendorLongitude = Number(location.longitude);

    if (
      !vendorId ||
      !activeVendorIds.includes(vendorId) ||
      !Number.isFinite(vendorLatitude) ||
      !Number.isFinite(vendorLongitude) ||
      vendorLatitude < -90 ||
      vendorLatitude > 90 ||
      vendorLongitude < -180 ||
      vendorLongitude > 180
    ) {
      continue;
    }

    const distanceKm = haversineKm(latitude, longitude, vendorLatitude, vendorLongitude);
    const previous = nearestByVendor.get(vendorId);
    if (previous === undefined || distanceKm < previous) {
      nearestByVendor.set(vendorId, distanceKm);
    }
  }

  const vendors = [...nearestByVendor.entries()]
    .map(([vendorId, distanceKm]) => ({
      vendor_id: vendorId,
      distance_km: Number(distanceKm.toFixed(2)),
    }))
    .sort((a, b) => a.distance_km - b.distance_km);

  return json({
    success: true,
    vendors,
    measuredBy: "straight_line",
    note: "Approximate discovery distance only. Google Routes determines road distance, delivery eligibility and fees at checkout.",
  });
}
