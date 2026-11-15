import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireMkhAdmin } from "@/lib/server/mkhAdminAuthorization";
import { getGooglePlaceDetails } from "@/lib/server/googlePlaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  const auth = await requireMkhAdmin();
  if (!auth.ok) return fail(auth.message, auth.status);

  try {
    const [vendorsResult, locationsResult, applicationsResult] = await Promise.all([
      adminClient
        .from("vendors")
        .select("id,name,email,status,location")
        .order("name", { ascending: true }),
      (adminClient as any)
        .from("vendor_business_locations")
        .select("vendor_id,business_address,google_place_id,latitude,longitude,locality_id,locality_name_snapshot,lcda_name_snapshot,lga_name_snapshot,verified_by,verified_at,created_at,updated_at")
        .order("updated_at", { ascending: false }),
      adminClient
        .from("vendor_applications")
        .select("email,business_address,status,created_at")
        .eq("status", "approved")
        .order("created_at", { ascending: false }),
    ]);

    if (vendorsResult.error) {
      console.error("Vendor location editor vendor list error:", vendorsResult.error.message);
      return fail("Unable to load vendors.", 500);
    }
    if (locationsResult.error) {
      console.error("Vendor location editor saved locations error:", locationsResult.error.message);
      return fail("Unable to load saved vendor locations. Confirm the vendor-location migration has been applied in TEST.", 500);
    }
    if (applicationsResult.error) {
      console.error("Vendor location editor application address error:", applicationsResult.error.message);
      return fail("Unable to load approved application addresses.", 500);
    }

    const locationByVendor = new Map<string, any>();
    for (const row of locationsResult.data ?? []) locationByVendor.set(String(row.vendor_id), row);

    const applicationAddressByEmail = new Map<string, string>();
    for (const row of applicationsResult.data ?? []) {
      const email = String(row.email ?? "").trim().toLowerCase();
      const address = String(row.business_address ?? "").trim();
      if (email && address && !applicationAddressByEmail.has(email)) {
        applicationAddressByEmail.set(email, address);
      }
    }

    const vendors = (vendorsResult.data ?? [])
      .filter((vendor: any) => String(vendor.status ?? "").trim().toLowerCase() === "active")
      .map((vendor: any) => {
        const email = String(vendor.email ?? "").trim().toLowerCase();
        return {
          id: vendor.id,
          name: vendor.name ?? "Unnamed vendor",
          email: vendor.email ?? "",
          status: vendor.status ?? "",
          legacyLocation: String(vendor.location ?? "").trim(),
          applicationBusinessAddress: applicationAddressByEmail.get(email) ?? "",
          verifiedLocation: locationByVendor.get(String(vendor.id)) ?? null,
        };
      });

    return NextResponse.json({ success: true, vendors }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    console.error("Vendor business location GET failed:", error);
    return fail("Unable to load vendor business locations.", 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireMkhAdmin();
  if (!auth.ok) return fail(auth.message, auth.status);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request body.");
  }

  const vendorId = typeof body?.vendorId === "string" ? body.vendorId.trim() : "";
  const placeId = typeof body?.placeId === "string" ? body.placeId.trim() : "";
  const localityId = typeof body?.localityId === "string" ? body.localityId.trim() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(vendorId) || !uuidPattern.test(localityId)) return fail("Choose a valid vendor and MKH locality.");
  if (!placeId || placeId.length > 512) return fail("Select a verified Google Maps address suggestion.");
  if (reason.length < 10 || reason.length > 500) return fail("Enter an address-verification reason of at least 10 characters.");
  if (body?.confirmed !== true) return fail("Confirm that the Google Maps result and MKH locality match this vendor's actual business location.");

  try {
    const [{ data: vendor, error: vendorError }, { data: locality, error: localityError }] = await Promise.all([
      adminClient.from("vendors").select("id,name,status").eq("id", vendorId).maybeSingle(),
      adminClient.from("localities").select("id,name,locality_type,lga_id,lcda_id,is_active").eq("id", localityId).eq("is_active", true).maybeSingle(),
    ]);

    if (vendorError || !vendor) return fail("Vendor record could not be verified.", 404);
    if (String(vendor.status ?? "").trim().toLowerCase() !== "active") return fail("Only active vendors can have a delivery origin verified.", 409);
    if (localityError || !locality) return fail("The selected MKH locality is no longer active. Search and select it again.", 409);

    const place = await getGooglePlaceDetails(placeId);

    let lcdaName: string | null = null;
    let lgaName: string | null = null;
    if (locality.lcda_id) {
      const { data } = await adminClient.from("local_council_development_areas").select("name").eq("id", locality.lcda_id).maybeSingle();
      lcdaName = data?.name ?? null;
    }
    if (locality.lga_id) {
      const { data } = await adminClient.from("local_governments").select("name").eq("id", locality.lga_id).maybeSingle();
      lgaName = data?.name ?? null;
    }

    const { data: saved, error: saveError } = await (adminClient as any).rpc("mkh_admin_save_vendor_business_location", {
      p_vendor_id: vendorId,
      p_business_address: place.formattedAddress,
      p_google_place_id: place.placeId,
      p_latitude: place.latitude,
      p_longitude: place.longitude,
      p_locality_id: localityId,
      p_locality_name_snapshot: String(locality.name ?? "").trim(),
      p_lcda_name_snapshot: lcdaName,
      p_lga_name_snapshot: lgaName,
      p_verified_by: auth.userId,
      p_change_reason: reason,
    });

    if (saveError || !saved) {
      console.error("Vendor business location save failed:", saveError?.message);
      return fail("The verified vendor location could not be saved. Check that the TEST migration is applied and retry.", 500);
    }

    return NextResponse.json({ success: true, vendorName: vendor.name, location: saved }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Vendor business location save request failed:", error instanceof Error ? error.message : "unknown error");
    return fail(error instanceof Error ? error.message : "Unable to verify and save the vendor address.", 422);
  }
}
