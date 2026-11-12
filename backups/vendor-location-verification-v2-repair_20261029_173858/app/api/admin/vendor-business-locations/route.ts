import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireMkhAdmin } from "@/lib/server/mkhAdminAuthorization";
import { getGooglePlaceDetails } from "@/lib/server/googlePlaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status, headers: { "Cache-Control": "no-store" } });
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NIPOST_CODE_PATTERN = /^[A-Z]{2}-(0[1-9]|[1-9][0-9])-[A-Z0-9]{3}-[A-Z]{2}-(0[1-9]|[1-9][0-9])$/i;

type NIPOSTResult = { status: "validated" | "invalid" | "unavailable"; message: string };

async function validateNipostL1(postcodeInput: string): Promise<NIPOSTResult> {
  const postcode = postcodeInput.trim().toUpperCase();
  if (!NIPOST_CODE_PATTERN.test(postcode)) {
    throw new Error("Enter a validly formatted NIPOST Digital Postcode (for example, FC-01-A01-KP-27).");
  }
  const apiKey = process.env.NIPOST_API_KEY || process.env.NIPOST_POSTCODE_API_KEY;
  if (!apiKey) throw new Error("NIPOST_API_KEY is not configured on the server. Add it to .env.local and restart the app.");

  // NIPOST L1 is used only to confirm whether the postcode exists. It does not
  // verify the street address or provide coordinates. The secret stays server-side.
  const url = new URL("https://api.postcode.gov.ng/v1/lookup");
  url.searchParams.set("code", postcode);
  url.searchParams.set("level", "1");
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers: { "X-API-Key": apiKey, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return { status: "unavailable", message: "NIPOST could not be reached. Address saved pending; postcode validation remains unavailable." };
  }
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Do not log or return credentials/provider bodies. Preserve the address as pending.
    console.error("NIPOST L1 lookup returned HTTP", response.status);
    return { status: "unavailable", message: "NIPOST did not return a usable L1 result. Address saved pending; postcode validation remains unavailable." };
  }
  const valid = payload?.data?.valid ?? payload?.valid;
  if (typeof valid !== "boolean") {
    console.error("NIPOST L1 response did not include a boolean validity field.");
    return { status: "unavailable", message: "NIPOST returned an unrecognised response. Address saved pending; postcode validation remains unavailable." };
  }
  return valid
    ? { status: "validated", message: "NIPOST L1 confirmed that the postcode is valid. The exact street address and coordinates remain unverified." }
    : { status: "invalid", message: "NIPOST L1 did not validate this postcode. The address is saved pending and is not a delivery origin." };
}

export async function GET() {
  const auth = await requireMkhAdmin();
  if (!auth.ok) return fail(auth.message, auth.status);

  try {
    const [vendorsResult, locationsResult, applicationsResult] = await Promise.all([
      adminClient.from("vendors").select("id,name,email,status,location").order("name", { ascending: true }),
      (adminClient as any).from("vendor_business_locations").select(
        "vendor_id,business_address,google_place_id,latitude,longitude,locality_id,locality_name_snapshot,lcda_name_snapshot,lga_name_snapshot,verified_by,verified_at,created_at,updated_at,address_verification_status,verification_source,locality_match_status,nipost_postcode,nipost_validation_status,recorded_by",
      ).order("updated_at", { ascending: false }),
      adminClient.from("vendor_applications").select("email,business_address,status,created_at").eq("status", "approved").order("created_at", { ascending: false }),
    ]);
    if (vendorsResult.error) {
      console.error("Vendor location editor vendor list error:", vendorsResult.error.message);
      return fail("Unable to load vendors.", 500);
    }
    if (locationsResult.error) {
      console.error("Vendor location editor saved locations error:", locationsResult.error.message);
      return fail("Unable to load saved vendor locations. Apply the approved V2 migration in TEST before enabling this code.", 500);
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
      if (email && address && !applicationAddressByEmail.has(email)) applicationAddressByEmail.set(email, address);
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
    console.error("Vendor business location GET failed:", error instanceof Error ? error.message : "unknown error");
    return fail("Unable to load vendor business locations.", 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireMkhAdmin();
  if (!auth.ok) return fail(auth.message, auth.status);

  let body: any;
  try { body = await request.json(); } catch { return fail("Invalid request body."); }

  const vendorId = typeof body?.vendorId === "string" ? body.vendorId.trim() : "";
  const source = body?.source === "nipost_l1" ? "nipost_l1" : body?.source === "google_maps" ? "google_maps" : "";
  const placeId = typeof body?.placeId === "string" ? body.placeId.trim() : "";
  const localityId = typeof body?.localityId === "string" ? body.localityId.trim() : "";
  const businessAddressInput = typeof body?.businessAddress === "string" ? body.businessAddress.trim() : "";
  const postcodeInput = typeof body?.nipostPostcode === "string" ? body.nipostPostcode.trim().toUpperCase() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  if (!UUID_PATTERN.test(vendorId)) return fail("Choose a valid vendor.");
  if (!source) return fail("Choose Google Maps verification or the NIPOST L1 fallback.");
  if (localityId && !UUID_PATTERN.test(localityId)) return fail("Choose a valid MKH locality, or leave locality matching pending.");
  if (reason.length < 10 || reason.length > 500) return fail("Enter a change reason between 10 and 500 characters.");
  if (body?.confirmed !== true) return fail("Confirm the address evidence and any selected MKH locality.");
  if (businessAddressInput.length < 8 || businessAddressInput.length > 1000) return fail("Enter a complete business address between 8 and 1,000 characters.");

  try {
    const { data: vendor, error: vendorError } = await adminClient.from("vendors").select("id,name,status").eq("id", vendorId).maybeSingle();
    if (vendorError || !vendor) return fail("Vendor record could not be verified.", 404);
    if (String(vendor.status ?? "").trim().toLowerCase() !== "active") return fail("Only active vendors can have a business location recorded.", 409);

    let businessAddress = businessAddressInput;
    let savedPlaceId: string | null = null;
    let latitude: number | null = null;
    let longitude: number | null = null;
    let addressStatus: "verified" | "pending" = "pending";
    let verificationSource: "google_maps" | "nipost_l1" = "nipost_l1";
    let nipostStatus: "not_checked" | "validated" | "invalid" | "unavailable" = "not_checked";
    let nipostMessage = "";

    if (source === "google_maps") {
      if (!placeId || placeId.length > 512) return fail("Select a resolved Google Maps business address.");
      const place = await getGooglePlaceDetails(placeId);
      businessAddress = place.formattedAddress;
      savedPlaceId = place.placeId;
      latitude = place.latitude;
      longitude = place.longitude;
      addressStatus = "verified";
      verificationSource = "google_maps";
    } else {
      if (!postcodeInput) return fail("Enter the vendor's NIPOST Digital Postcode.");
      const nipost = await validateNipostL1(postcodeInput);
      nipostStatus = nipost.status;
      nipostMessage = nipost.message;
    }

    let canonicalLocality: any = null;
    let lcdaName: string | null = null;
    let lgaName: string | null = null;
    if (localityId) {
      const { data, error } = await adminClient.from("localities")
        .select("id,name,locality_type,lga_id,lcda_id,is_active")
        .eq("id", localityId).eq("is_active", true).maybeSingle();
      if (error || !data) return fail("The selected MKH locality is no longer active. Search and select it again, or leave locality matching pending.", 409);
      canonicalLocality = data;
      if (data.lcda_id) {
        const { data: lcda, error: lcdaError } = await adminClient.from("local_council_development_areas").select("name").eq("id", data.lcda_id).maybeSingle();
        if (lcdaError) return fail("Unable to confirm the selected locality's LCDA.", 503);
        lcdaName = lcda?.name ?? null;
      }
      if (data.lga_id) {
        const { data: lga, error: lgaError } = await adminClient.from("local_governments").select("name").eq("id", data.lga_id).maybeSingle();
        if (lgaError) return fail("Unable to confirm the selected locality's LGA.", 503);
        lgaName = lga?.name ?? null;
      }
    }

    const { data: saved, error: saveError } = await (adminClient as any).rpc("mkh_admin_save_vendor_business_location_v2", {
      p_vendor_id: vendorId,
      p_business_address: businessAddress,
      p_google_place_id: savedPlaceId,
      p_latitude: latitude,
      p_longitude: longitude,
      p_locality_id: canonicalLocality?.id ?? null,
      p_locality_name_snapshot: canonicalLocality?.name ?? null,
      p_lcda_name_snapshot: lcdaName,
      p_lga_name_snapshot: lgaName,
      p_verified_by: auth.userId,
      p_change_reason: reason,
      p_address_verification_status: addressStatus,
      p_verification_source: verificationSource,
      p_locality_match_status: canonicalLocality ? "matched" : "pending",
      p_nipost_postcode: source === "nipost_l1" ? postcodeInput : null,
      p_nipost_validation_status: nipostStatus,
    });
    if (saveError || !saved) {
      console.error("Vendor business location V2 save failed:", saveError?.message);
      return fail("The vendor location could not be saved. Confirm that the approved V2 migration is applied in TEST.", 500);
    }

    return NextResponse.json({
      success: true,
      vendorName: vendor.name,
      location: saved,
      message: source === "nipost_l1" ? nipostMessage : (canonicalLocality ? "Google Maps address verified and MKH locality matched." : "Google Maps address verified; MKH locality matching remains pending. This row is not yet a delivery origin."),
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    console.error("Vendor business location save request failed:", error instanceof Error ? error.message : "unknown error");
    return fail(error instanceof Error ? error.message : "Unable to save vendor location.", 422);
  }
}
