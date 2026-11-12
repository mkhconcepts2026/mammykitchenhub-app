import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLATFORM_FEE_NGN = 300;
// Current pilot rule: do not quote routes beyond 3 road kilometres.
const PILOT_MAX_ROUTE_KM = 3;
const QUOTE_TTL_MINUTES = 10;

type CartItem = { menu_item_id: string; quantity: number };

type RateCard = {
  rate_version: number;
  min_distance_km: number | string;
  max_distance_km: number | string;
  customer_delivery_fee: number | string;
  active: boolean;
  effective_from: string;
  effective_to: string | null;
};

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function hash(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normaliseAddress(value: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (/\blagos\b/i.test(trimmed) || /\bnigeria\b/i.test(trimmed)) return trimmed;
  return `${trimmed}, Lagos, Nigeria`;
}

function addressFromRecord(record: Record<string, unknown> | null) {
  if (!record) return "";
  const candidates = [
    "business_address", "business_address_line", "business_address_line1",
    "business_location", "store_address", "address", "address_line1",
    "full_address",
  ];
  for (const key of candidates) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length >= 8) return value.trim();
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const objectValue = value as Record<string, unknown>;
      for (const objectKey of ["formatted_address", "formattedAddress", "address", "label"]) {
        const nested = objectValue[objectKey];
        if (typeof nested === "string" && nested.trim().length >= 8) return nested.trim();
      }
    }
  }

  // `vendors.location` is a legacy display/location field. Use it as the origin only
  // when it visibly contains street-level detail; don't geocode a locality label alone.
  const legacyLocation = record.location;
  if (typeof legacyLocation === "string") {
    const candidate = legacyLocation.trim();
    const hasStreetNumber = /\d/.test(candidate);
    const hasStreetType = /\b(street|st|road|rd|avenue|ave|close|crescent|drive|dr|lane|ln|way|estate|plot|place|court|ct)\b/i.test(candidate);
    if (candidate.length >= 12 && hasStreetNumber && hasStreetType) return candidate;
  }
  return "";
}

function addressWithSelectedLocality(address: string, localityContext: string[]) {
  const normalizeForMatch = (value: string) =>
    value.toLocaleLowerCase("en-NG").replace(/[^a-z0-9]+/g, " ").trim();
  const foldedAddress = normalizeForMatch(address);
  const missingContext = localityContext
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => !foldedAddress.includes(normalizeForMatch(value)));
  const fullAddress = missingContext.length ? `${address}, ${missingContext.join(", ")}` : address;
  return normaliseAddress(fullAddress);
}

type GeocodedAddress = {
  latitude: number;
  longitude: number;
  placeId: string;
  formattedAddress: string;
};

async function geocodeAddress(address: string, apiKey: string): Promise<GeocodedAddress | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", normaliseAddress(address));
  url.searchParams.set("region", "ng");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.status !== "OK" || !Array.isArray(payload?.results) || !payload.results.length) {
    return null;
  }

  // Do not quote a partial address match. The customer must correct the address first.
  const first = payload.results[0];
  if (first?.partial_match === true) return null;
  const latitude = Number(first?.geometry?.location?.lat);
  const longitude = Number(first?.geometry?.location?.lng);
  const placeId = typeof first?.place_id === "string" ? first.place_id.trim() : "";
  const formattedAddress = typeof first?.formatted_address === "string" ? first.formatted_address.trim() : "";
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !placeId || !formattedAddress) {
    return null;
  }
  return { latitude, longitude, placeId, formattedAddress };
}

function chooseRate(cards: RateCard[], routeDistanceKm: number) {
  const now = Date.now();
  const effective = cards.filter((card) =>
    card.active === true &&
    new Date(card.effective_from).getTime() <= now &&
    (!card.effective_to || new Date(card.effective_to).getTime() > now)
  );
  if (!effective.length) return null;
  const latestVersion = Math.max(...effective.map((card) => Number(card.rate_version)));
  const latest = effective.filter((card) => Number(card.rate_version) === latestVersion);
  // Business rule boundaries are inclusive at the upper end: 0â€“1 km is â‚¦1,500,
  // over 1â€“2 km is â‚¦1,700, and over 2â€“3 km is â‚¦1,900.
  const selected = latest.find((card) => {
    const min = Number(card.min_distance_km);
    const max = Number(card.max_distance_km);
    return routeDistanceKm <= max && (min === 0 ? routeDistanceKm >= 0 : routeDistanceKm > min);
  });
  if (!selected) return null;
  return {
    version: latestVersion,
    deliveryFee: Number(selected.customer_delivery_fee),
  };
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return fail("Please sign in to calculate delivery.", 401);

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, role, status")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) {
      console.error("Delivery quote profile lookup failed:", profileError.message);
      return fail("We could not verify your customer account.", 500);
    }
    if (!profile || String(profile.role ?? "").toLowerCase() !== "customer" ||
        String(profile.status ?? "").toLowerCase() !== "active") {
      return fail("An active customer account is required.", 403);
    }

    let body: unknown;
    try { body = await request.json(); } catch { return fail("Invalid quote request.", 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return fail("Invalid quote request.", 400);
    const input = body as Record<string, unknown>;
    const deliveryAddress = input.deliveryAddress;
    const deliveryLocalityId = input.deliveryLocalityId;
    const cart = input.cart;
    if (typeof deliveryAddress !== "string" || !deliveryAddress.trim() || deliveryAddress.trim().length > 1000) {
      return fail("Enter the complete street address before calculating the fee.", 400);
    }
    if (typeof deliveryLocalityId !== "string" || !UUID_PATTERN.test(deliveryLocalityId)) {
      return fail("Search for and select your delivery locality from MKH's active locality records.", 400);
    }
    if (!Array.isArray(cart) || cart.length < 1 || cart.length > 50) return fail("Your cart is empty or invalid.", 400);

    const { data: selectedLocality, error: localityError } = await adminClient
      .from("localities")
      .select("id, name, locality_type, is_active, lcda_id")
      .eq("id", deliveryLocalityId)
      .eq("is_active", true)
      .maybeSingle();
    if (localityError) {
      console.error("Delivery quote locality lookup failed:", localityError.message);
      return fail("We could not verify the selected locality against MKH records. Please try again.", 503);
    }
    if (!selectedLocality || typeof selectedLocality.name !== "string" || !selectedLocality.name.trim()) {
      return fail("Choose an active locality from MKH's list, then try again.", 422);
    }
    const selectedLocalityName = selectedLocality.name.trim();
    let selectedLcdaName = "";
    if (typeof (selectedLocality as any).lcda_id === "string") {
      const { data: lcda, error: lcdaError } = await adminClient
        .from("local_council_development_areas")
        .select("id, name")
        .eq("id", (selectedLocality as any).lcda_id)
        .maybeSingle();
      if (lcdaError) {
        console.error("Delivery quote LCDA lookup failed:", lcdaError.message);
        return fail("We could not verify the selected locality's council area. Please try again.", 503);
      }
      selectedLcdaName = typeof lcda?.name === "string" ? lcda.name.trim() : "";
    }
    const destinationAddressForGeocoding = addressWithSelectedLocality(
      deliveryAddress.trim(),
      [selectedLocalityName, selectedLcdaName],
    );

    const seen = new Set<string>();
    const items: CartItem[] = [];
    for (const raw of cart) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("An item in your cart is invalid.", 400);
      const candidate = raw as Record<string, unknown>;
      if (typeof candidate.menu_item_id !== "string" || !UUID_PATTERN.test(candidate.menu_item_id) ||
          !Number.isSafeInteger(candidate.quantity) || Number(candidate.quantity) < 1 || Number(candidate.quantity) > 99) {
        return fail("An item ID or quantity in your cart is invalid.", 400);
      }
      const itemId = candidate.menu_item_id.toLowerCase();
      if (seen.has(itemId)) return fail("Your cart contains a duplicate item. Refresh the cart and try again.", 400);
      seen.add(itemId);
      items.push({ menu_item_id: itemId, quantity: Number(candidate.quantity) });
    }

    const { data: menuItems, error: menuError } = await adminClient
      .from("menu_items")
      .select("id, vendor_id, price")
      .in("id", items.map((item) => item.menu_item_id));
    if (menuError) {
      console.error("Delivery quote menu lookup failed:", menuError.message);
      return fail("We could not verify the current menu prices. Please try again.", 500);
    }
    if (!menuItems || menuItems.length !== items.length) return fail("One or more menu items are no longer available. Refresh your cart.", 409);

    const vendorIds = Array.from(new Set(menuItems.map((item: any) => String(item.vendor_id ?? ""))));
    if (vendorIds.length !== 1 || !vendorIds[0] || !UUID_PATTERN.test(vendorIds[0])) {
      return fail("Please place orders from one vendor at a time.", 400);
    }
    const vendorId = vendorIds[0];
    const menuById = new Map<string, any>(menuItems.map((item: any) => [String(item.id).toLowerCase(), item]));
    let subtotal = 0;
    for (const item of items) {
      const menu = menuById.get(item.menu_item_id);
      const price = Number(menu?.price);
      if (!Number.isFinite(price) || price < 0) return fail("A menu price could not be verified. Refresh your cart.", 409);
      subtotal += price * item.quantity;
    }
    subtotal = Math.round((subtotal + Number.EPSILON) * 100) / 100;

    const { data: vendor, error: vendorError } = await adminClient
      .from("vendors")
      .select("*")
      .eq("id", vendorId)
      .maybeSingle();
    if (vendorError) {
      console.error("Delivery quote vendor lookup failed:", vendorError.message);
      return fail("We could not verify the vendor's registered business address.", 500);
    }
    // MKH ADMIN VERIFIED VENDOR ORIGIN - Stage 1.2
    // A precise, Admin-selected Google Place is the preferred origin; it is distinct from the vendor's KYC application text.
    const { data: verifiedVendorLocation, error: verifiedLocationError } = await (adminClient as any)
      .from("vendor_business_locations")
      .select("business_address,google_place_id,latitude,longitude,locality_id,address_verification_status,locality_match_status")
      .eq("vendor_id", vendorId)
      .maybeSingle();
    if (verifiedLocationError) {
      console.error("Verified vendor location lookup failed:", verifiedLocationError.message);
      return fail("Unable to load the Admin-verified vendor business location. Confirm the vendor-location migration is applied in TEST.", 500);
    }
    // V2 safety gate: never fall back to geocoding a saved-but-pending vendor address.
    // A delivery origin is eligible only when address evidence, MKH locality mapping,
    // Google Place ID and coordinate pair are all present and verified.
    if (verifiedVendorLocation && (
      verifiedVendorLocation.address_verification_status !== "verified" ||
      verifiedVendorLocation.locality_match_status !== "matched" ||
      !verifiedVendorLocation.locality_id ||
      typeof verifiedVendorLocation.google_place_id !== "string" ||
      !verifiedVendorLocation.google_place_id.trim() ||
      !Number.isFinite(Number(verifiedVendorLocation.latitude)) ||
      !Number.isFinite(Number(verifiedVendorLocation.longitude))
    )) {
      return fail("This vendor's saved address is not yet approved as a delivery origin. Admin must finish address verification and MKH locality matching before a quote can be calculated.", 422);
    }
    if (verifiedVendorLocation?.locality_id) {
      const { data: originLocality, error: originLocalityError } = await adminClient
        .from("localities")
        .select("id,is_active")
        .eq("id", verifiedVendorLocation.locality_id)
        .maybeSingle();
      if (originLocalityError) {
        console.error("Verified vendor locality lookup failed:", originLocalityError.message);
        return fail("Unable to verify the vendor's MKH locality.", 500);
      }
      if (!originLocality || originLocality.is_active !== true) {
        return fail("The vendor's verified MKH locality is no longer active. Admin must review the vendor location before delivery can be quoted.", 422);
      }
    }

    let originAddress =
      typeof verifiedVendorLocation?.business_address === "string" && verifiedVendorLocation.business_address.trim().length >= 8
        ? verifiedVendorLocation.business_address.trim()
        : addressFromRecord(vendor as Record<string, unknown> | null);
    if (!originAddress && typeof (vendor as any)?.email === "string" && String((vendor as any).email).trim()) {
      const { data: latestApplication, error: applicationError } = await adminClient
        .from("vendor_applications")
        .select("business_address, status, created_at")
        .ilike("email", String((vendor as any).email).trim())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (applicationError) {
        console.error("Delivery quote approved vendor address lookup failed:", applicationError.message);
        return fail("We could not verify the vendor's registered business address. Please try again.", 503);
      }

      const applicationAddress = typeof latestApplication?.business_address === "string"
        ? latestApplication.business_address.trim()
        : "";
      const applicationStatus = String(latestApplication?.status ?? "").trim().toLowerCase();
      if (applicationStatus === "approved" && applicationAddress.length >= 8) {
        originAddress = applicationAddress;
      }
    }

    if (!originAddress) {
      return fail("This vendor's full street address is missing from its active record and latest approved application. Admin must verify the business address before delivery can be quoted.", 422);
    }

    const apiKey = process.env.GOOGLE_MAPS_ROUTES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return fail("Road-distance pricing is not configured yet. Set GOOGLE_MAPS_ROUTES_API_KEY on the server and restart the local app.", 503);

    let distanceMeters: number;
    let resolvedVendorAddress: string;
    let resolvedDestinationAddress: string;
    try {
      const [originPoint, destinationPoint] = await Promise.all([
        verifiedVendorLocation &&
        typeof verifiedVendorLocation.google_place_id === "string" &&
        verifiedVendorLocation.google_place_id.trim().length > 0 &&
        Number.isFinite(Number(verifiedVendorLocation.latitude)) &&
        Number.isFinite(Number(verifiedVendorLocation.longitude))
          ? Promise.resolve({
              latitude: Number(verifiedVendorLocation.latitude),
              longitude: Number(verifiedVendorLocation.longitude),
              placeId: verifiedVendorLocation.google_place_id.trim(),
              formattedAddress: String(verifiedVendorLocation.business_address ?? originAddress),
            } as GeocodedAddress)
          : geocodeAddress(originAddress, apiKey),
        geocodeAddress(destinationAddressForGeocoding, apiKey),
      ]);
      if (!originPoint) {
        return fail("Google Maps could not resolve the vendor's registered business address precisely enough to calculate delivery. Verify the vendor address first.", 422);
      }
      if (!destinationPoint) {
        return fail("Google Maps could not resolve the delivery address precisely enough. Add a more complete street address and landmark, then try again.", 422);
      }
      resolvedVendorAddress = originPoint.formattedAddress;
      resolvedDestinationAddress = destinationPoint.formattedAddress;

      const routeResponse = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.distanceMeters",
        },
        body: JSON.stringify({
          origin: { placeId: originPoint.placeId },
          destination: { placeId: destinationPoint.placeId },
          travelMode: "DRIVE",
          regionCode: "NG",
          languageCode: "en-NG",
          units: "METRIC",
          computeAlternativeRoutes: false,
        }),
        cache: "no-store",
      });
      const routePayload = await routeResponse.json().catch(() => ({}));
      if (!routeResponse.ok) {
        console.error("Google Routes quote failed with status:", routeResponse.status);
        return fail("We could not calculate a driving route from the vendor's address to your delivery address. Check both addresses and try again.", 502);
      }
      const metres = Number(routePayload?.routes?.[0]?.distanceMeters);
      if (!Number.isFinite(metres) || metres <= 0) return fail("No reliable driving route was found. Please check the delivery address.", 422);
      distanceMeters = Math.round(metres);
    } catch (error) {
      console.error("Delivery route/geocoding provider request failed:", error instanceof Error ? error.message : "unknown error");
      return fail("The address or route service is temporarily unavailable. Please try again.", 502);
    }

    const distanceKm = distanceMeters / 1000;
    if (distanceKm > PILOT_MAX_ROUTE_KM) {
      return fail(`This destination is beyond MKH's current ${PILOT_MAX_ROUTE_KM} km pilot road-route limit. Please use an eligible closer delivery address.`, 422);
    }

    const nowIso = new Date().toISOString();
    const { data: rateCards, error: rateError } = await adminClient
      .from("delivery_distance_rate_cards")
      .select("rate_version, min_distance_km, max_distance_km, customer_delivery_fee, active, effective_from, effective_to")
      .eq("active", true)
      .lte("effective_from", nowIso)
      .order("rate_version", { ascending: false });
    if (rateError) {
      console.error("Delivery quote rate-card lookup failed:", rateError.message);
      return fail("Distance-pricing rules are not available yet. Apply the staged Stage 1 SQL migration in the TEST database, then retry.", 503);
    }
    const rate = chooseRate((rateCards ?? []) as RateCard[], distanceKm);
    if (!rate || !Number.isFinite(rate.deliveryFee)) return fail("No active delivery price exists for this route distance. Order pricing has been paused for review.", 503);

    const canonicalCart = [...items].sort((a, b) => a.menu_item_id.localeCompare(b.menu_item_id));
    // Stage 2 must recompute this from the submitted street address and locality ID.
    // The complete address itself is not stored in delivery_quotes.
    const addressHash = hash(JSON.stringify({
      address: deliveryAddress.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-NG"),
      localityId: selectedLocality.id,
    }));
    const cartHash = hash(JSON.stringify(canonicalCart));
    const expiresAt = new Date(Date.now() + QUOTE_TTL_MINUTES * 60 * 1000).toISOString();
    const { data: savedQuote, error: saveError } = await adminClient
      .from("delivery_quotes")
      .insert({
        customer_id: user.id,
        vendor_id: vendorId,
        destination_locality_id: selectedLocality.id,
        cart_hash: cartHash,
        destination_address_hash: addressHash,
        subtotal_amount: subtotal,
        route_distance_meters: distanceMeters,
        route_distance_km: Number(distanceKm.toFixed(3)),
        rate_version: rate.version,
        customer_delivery_fee: rate.deliveryFee,
        platform_fee: PLATFORM_FEE_NGN,
        status: "quoted",
        expires_at: expiresAt,
      })
      .select("id, expires_at")
      .single();
    if (saveError || !savedQuote) {
      console.error("Delivery quote snapshot insert failed:", saveError?.message);
      return fail("We could not save the delivery quote. No order has been placed. Please try again.", 500);
    }

    return NextResponse.json({
      success: true,
      quote: {
        quoteId: savedQuote.id,
        distanceKm: Number(distanceKm.toFixed(3)),
        resolvedVendorAddress,
        resolvedDestinationAddress,
        localityName: selectedLocalityName,
        deliveryFee: rate.deliveryFee,
        platformFee: PLATFORM_FEE_NGN,
        subtotal,
        total: Math.round((subtotal + rate.deliveryFee + PLATFORM_FEE_NGN + Number.EPSILON) * 100) / 100,
        rateVersion: rate.version,
        expiresAt: savedQuote.expires_at,
      },
      notice: "Price quote only. Order placement remains paused until Stage 2 connects this quote to the existing order-creation functions.",
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    console.error("Delivery quote request failed:", error instanceof Error ? error.message : "unknown error");
    return fail("An unexpected error occurred while calculating delivery. No order has been placed.", 500);
  }
}
