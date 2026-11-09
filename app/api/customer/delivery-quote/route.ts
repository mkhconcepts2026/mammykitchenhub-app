import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLATFORM_FEE_NGN = 300;
const FIXED_BENEFICIARY_SHARES_NGN = 700;
// Current pilot rule: do not quote routes beyond 3 road kilometres.
const PILOT_MAX_ROUTE_KM = 3;
const QUOTE_TTL_MINUTES = 10;

type CartItem = { menu_item_id: string; quantity: number };

type RateCard = {
  rate_version: number;
  min_distance_km: number | string;
  max_distance_km: number | string;
  customer_delivery_fee: number | string;
  rider_payout: number | string;
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
    .filter((value) => {
      const parentheticalAlias = value.match(/\(([^)]+)\)/)?.[1]?.trim();
      const aliases = [value, parentheticalAlias || ""]
        .map(normalizeForMatch)
        .filter(Boolean);
      return !aliases.some((alias) => foldedAddress.includes(alias));
    });
  const fullAddress = missingContext.length ? `${address}, ${missingContext.join(", ")}` : address;
  return normaliseAddress(fullAddress);
}

type StreetTarget = {
  streetTokens: string[];
  houseNumber: string | null;
};

type GeocodedAddress = {
  latitude: number;
  longitude: number;
  placeId: string;
  formattedAddress: string;
};

const STREET_TYPE_PATTERN = /\b(street|st\.?|road|rd\.?|avenue|ave\.?|close|crescent|drive|dr\.?|lane|ln\.?|way|boulevard|blvd\.?|terrace|ter\.?|court|ct\.?|place|pl\.?)\b/i;
const STREET_NAME_STOP_WORDS = new Set([
  "street", "st", "road", "rd", "avenue", "ave", "close", "crescent",
  "drive", "dr", "lane", "ln", "way", "boulevard", "blvd", "terrace", "ter",
  "court", "ct", "place", "pl", "estate", "mende", "maryland",
  "kosofe", "lagos", "nigeria", "no",
]);

function normalizedWords(value: string): string[] {
  return value
    .toLocaleLowerCase("en-NG")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function extractStreetTarget(address: string): StreetTarget | null {
  const streetTypeMatch = STREET_TYPE_PATTERN.exec(address);
  if (!streetTypeMatch || typeof streetTypeMatch.index !== "number") return null;

  // The road name is the text before the street-type word. Ignore a leading
  // house number, then require the actual road-name tokens to be matched by Google.
  const beforeStreetType = address.slice(0, streetTypeMatch.index);
  const houseNumberMatch = /^\s*(?:no\.?\s*)?(\d+[a-z]?)\b/i.exec(address);
  const roadName = beforeStreetType.replace(/^\s*(?:no\.?\s*)?\d+[a-z]?\s*/i, " ");
  const streetTokens = normalizedWords(roadName).filter(
    (token) => token.length > 1 && !STREET_NAME_STOP_WORDS.has(token) && !/^\d+$/.test(token),
  );

  if (!streetTokens.length) return null;
  return {
    streetTokens,
    houseNumber: houseNumberMatch ? houseNumberMatch[1].toLowerCase() : null,
  };
}

function readAddressComponent(
  components: any[],
  componentType: string,
): string {
  const component = components.find(
    (entry) => Array.isArray(entry?.types) && entry.types.includes(componentType),
  );
  const value = component?.long_name ?? component?.longText ?? component?.short_name ?? component?.shortText;
  return typeof value === "string" ? value.trim() : "";
}

function candidateMatchesStreet(
  candidate: {
    formattedAddress?: unknown;
    components?: any[];
    types?: unknown;
    locationType?: unknown;
  },
  target: StreetTarget,
): boolean {
  const components = Array.isArray(candidate.components) ? candidate.components : [];
  const routeName = readAddressComponent(components, "route");
  const formattedAddress = typeof candidate.formattedAddress === "string" ? candidate.formattedAddress : "";
  const routeSearchText = routeName || formattedAddress;
  const candidateWords = new Set(normalizedWords(routeSearchText));
  if (!target.streetTokens.every((token) => candidateWords.has(token))) return false;

  const types = Array.isArray(candidate.types) ? candidate.types : [];
  const isStreetLevel = types.some((type) =>
    ["street_address", "premise", "subpremise", "route"].includes(String(type)),
  ) || Boolean(routeName);
  if (!isStreetLevel) return false;

  // An approximate area/estate centroid is not an acceptable substitute for a
  // named street. Route geometry-centres and interpolated/rooftop street points remain usable.
  if (String(candidate.locationType ?? "").toUpperCase() === "APPROXIMATE") return false;

  if (target.houseNumber) {
    // A street-name match alone is not enough for a numbered delivery address.
    // Require Google to return the same house number before using this Place ID.
    const matchedNumber = readAddressComponent(components, "street_number").toLowerCase();
    if (!matchedNumber || matchedNumber !== target.houseNumber) return false;
  }
  return true;
}

async function geocodeAddress(
  address: string,
  apiKey: string,
  streetTarget: StreetTarget | null,
): Promise<GeocodedAddress | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", normaliseAddress(address));
  url.searchParams.set("region", "ng");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.status !== "OK" || !Array.isArray(payload?.results) || !payload.results.length) {
    console.error("MKH Geocoding API did not resolve the street address:", {
      httpStatus: response.status,
      providerStatus: typeof payload?.status === "string" ? payload.status : "UNKNOWN",
      providerMessage: typeof payload?.error_message === "string" ? payload.error_message.slice(0, 240) : null,
      resultsCount: Array.isArray(payload?.results) ? payload.results.length : 0,
    });
    return null;
  }

  const matched = payload.results.find((candidate: any) => {
    // For vendor origins (no customer street target), keep rejecting partial results.
    // For customer destinations, a partial flag may be caused by added locality context;
    // accept only when the actual route and numbered address components independently match.
    if (!streetTarget) return candidate?.partial_match !== true;
    return candidateMatchesStreet({
      formattedAddress: candidate?.formatted_address,
      components: candidate?.address_components,
      types: candidate?.types,
      locationType: candidate?.geometry?.location_type,
    }, streetTarget);
  });

  if (!matched) {
    console.warn("MKH Geocoding candidates did not match the requested street:", {
      requestedStreetTokens: streetTarget?.streetTokens ?? [],
      candidates: payload.results.slice(0, 3).map((candidate: any) => ({
        route: readAddressComponent(Array.isArray(candidate?.address_components) ? candidate.address_components : [], "route"),
        types: Array.isArray(candidate?.types) ? candidate.types : [],
        locationType: candidate?.geometry?.location_type ?? null,
        partialMatch: candidate?.partial_match === true,
      })),
    });
    return null;
  }

  const latitude = Number(matched?.geometry?.location?.lat);
  const longitude = Number(matched?.geometry?.location?.lng);
  const placeId = typeof matched?.place_id === "string" ? matched.place_id.trim() : "";
  const formattedAddress = typeof matched?.formatted_address === "string" ? matched.formatted_address.trim() : "";
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !placeId || !formattedAddress) {
    return null;
  }
  return { latitude, longitude, placeId, formattedAddress };
}

async function searchPlacesAddress(
  address: string,
  apiKey: string,
  streetTarget: StreetTarget,
  localityCenter: { latitude: number; longitude: number } | null,
): Promise<GeocodedAddress | null> {
  const body: Record<string, unknown> = {
    textQuery: normaliseAddress(address),
    languageCode: "en",
    regionCode: "NG",
  };
  if (localityCenter) {
    body.locationBias = {
      circle: {
        center: localityCenter,
        radius: 5000,
      },
    };
  }

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.formattedAddress,places.location,places.addressComponents,places.types",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("MKH Places Text Search could not resolve the requested street:", {
      httpStatus: response.status,
      providerMessage: typeof payload?.error?.message === "string" ? payload.error.message.slice(0, 240) : null,
    });
    return null;
  }

  const places = Array.isArray(payload?.places) ? payload.places : [];
  const matched = places.find((place: any) => candidateMatchesStreet({
    formattedAddress: place?.formattedAddress,
    components: place?.addressComponents,
    types: place?.types,
  }, streetTarget));
  if (!matched) {
    console.warn("MKH Places Text Search candidates did not match the requested street:", {
      requestedStreetTokens: streetTarget.streetTokens,
      candidates: places.slice(0, 3).map((place: any) => ({
        route: readAddressComponent(Array.isArray(place?.addressComponents) ? place.addressComponents : [], "route"),
        types: Array.isArray(place?.types) ? place.types : [],
      })),
    });
    return null;
  }

  const latitude = Number(matched?.location?.latitude);
  const longitude = Number(matched?.location?.longitude);
  const placeId = typeof matched?.id === "string" ? matched.id.trim() : "";
  const formattedAddress = typeof matched?.formattedAddress === "string" ? matched.formattedAddress.trim() : "";
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
  const deliveryFee = Number(selected.customer_delivery_fee);
  const riderPayout = Number(selected.rider_payout);
  const distanceSurcharge = deliveryFee - riderPayout - FIXED_BENEFICIARY_SHARES_NGN;
  if (!Number.isFinite(deliveryFee) || !Number.isFinite(riderPayout) ||
      riderPayout < 800 || distanceSurcharge < 0) return null;
  return {
    version: latestVersion,
    deliveryFee,
    riderPayout,
    fixedBeneficiaryShares: FIXED_BENEFICIARY_SHARES_NGN,
    distanceSurcharge,
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
    const streetTarget = extractStreetTarget(deliveryAddress.trim());
    if (!streetTarget) {
      return fail("Enter a house number and street name, including its street type, plus the estate or landmark. An estate name alone (for example, Arowojobe Estate) is not precise enough for a road-distance quote.", 400);
    }
    if (typeof deliveryLocalityId !== "string" || !UUID_PATTERN.test(deliveryLocalityId)) {
      return fail("Search for and select your delivery locality from MKH's active locality records.", 400);
    }
    if (!Array.isArray(cart) || cart.length < 1 || cart.length > 50) return fail("Your cart is empty or invalid.", 400);

    const { data: selectedLocality, error: localityError } = await adminClient
      .from("localities")
      .select("id, name, locality_type, is_active, latitude, longitude, lga_id, lcda_id")
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

    // MKH owns the administrative assignment. Google receives this context only
    // to improve street-level resolution; Google's administrative labels are not
    // used as MKH's source of truth.
    let selectedLgaName = "";
    if (typeof (selectedLocality as any).lga_id === "string") {
      const { data: lga, error: lgaError } = await adminClient
        .from("local_governments")
        .select("id, name")
        .eq("id", (selectedLocality as any).lga_id)
        .maybeSingle();
      if (lgaError) {
        console.error("Delivery quote LGA lookup failed:", lgaError.message);
        return fail("We could not verify the selected locality's local government. Please try again.", 503);
      }
      selectedLgaName = typeof lga?.name === "string" ? lga.name.trim() : "";
    }

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

    const localityDisambiguator = selectedLocalityName.match(/\(([^)]+)\)/)?.[1]?.trim() || selectedLocalityName;
    const destinationAddressForGeocoding = addressWithSelectedLocality(
      deliveryAddress.trim(),
      [localityDisambiguator, selectedLcdaName, selectedLgaName],
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
      (verifiedVendorLocation.latitude === null || typeof verifiedVendorLocation.latitude === "undefined" || !Number.isFinite(Number(verifiedVendorLocation.latitude)) || Number(verifiedVendorLocation.latitude) < -90 || Number(verifiedVendorLocation.latitude) > 90) ||
      (verifiedVendorLocation.longitude === null || typeof verifiedVendorLocation.longitude === "undefined" || !Number.isFinite(Number(verifiedVendorLocation.longitude)) || Number(verifiedVendorLocation.longitude) < -180 || Number(verifiedVendorLocation.longitude) > 180)
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

    // Keep Geocoding and Routes credentials separate: a Routes-only key cannot call Geocoding API.
    const geocodingApiKey = process.env.GOOGLE_MAPS_GEOCODING_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    const placesApiKey = process.env.GOOGLE_MAPS_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || geocodingApiKey;
    const routesApiKey = process.env.GOOGLE_MAPS_ROUTES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (!geocodingApiKey) return fail("Address resolution is not configured. Set GOOGLE_MAPS_GEOCODING_API_KEY on the server and restart the app.", 503);
    if (!placesApiKey) return fail("Street search is not configured. Set GOOGLE_MAPS_PLACES_API_KEY on the server and restart the app.", 503);
    if (!routesApiKey) return fail("Road-distance pricing is not configured yet. Set GOOGLE_MAPS_ROUTES_API_KEY on the server and restart the app.", 503);

    let distanceMeters: number;
    let resolvedVendorAddress: string;
    let resolvedDestinationAddress: string;
    try {
      const localityLatitude = Number((selectedLocality as any).latitude);
      const localityLongitude = Number((selectedLocality as any).longitude);
      const localityCenter = Number.isFinite(localityLatitude) && localityLatitude >= -90 && localityLatitude <= 90 &&
        Number.isFinite(localityLongitude) && localityLongitude >= -180 && localityLongitude <= 180
        ? { latitude: localityLatitude, longitude: localityLongitude }
        : null;

      const resolveCustomerDestination = async (): Promise<GeocodedAddress | null> => {
        // First try Geocoding. Accept a candidate only when Google's route/address
        // components contain the actual street name supplied by the customer.
        const geocoded = await geocodeAddress(destinationAddressForGeocoding, geocodingApiKey, streetTarget);
        if (geocoded) return geocoded;

        // Then use Places Text Search with a soft bias around the selected MKH locality.
        // This can find named roads/streets that the Geocoding endpoint misses.
        return searchPlacesAddress(destinationAddressForGeocoding, placesApiKey, streetTarget, localityCenter);
      };

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
          : geocodeAddress(originAddress, geocodingApiKey, null),
        resolveCustomerDestination(),
      ]);
      if (!originPoint) {
        return fail("Google Maps could not resolve the vendor's registered business address precisely enough to calculate delivery. Verify the vendor address first.", 422);
      }
      if (!destinationPoint) {
        return fail("Google Maps could not verify the street name you entered inside the selected MKH locality. No delivery quote was created. Check the street spelling, or have the street/estate location verified on Google Maps before retrying. MKH will not substitute a different Arowojobe or Mende address.", 422);
      }
      resolvedVendorAddress = originPoint.formattedAddress;
      // Keep the customer's street text and MKH's administrative assignment in the
      // checkout display. Google's formatted administrative labels are not authoritative.
      resolvedDestinationAddress = addressWithSelectedLocality(
        deliveryAddress.trim(),
        [selectedLocalityName, selectedLcdaName, selectedLgaName],
      );

      const routeResponse = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": routesApiKey,
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
      .select("rate_version, min_distance_km, max_distance_km, customer_delivery_fee, rider_payout, active, effective_from, effective_to")
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
    // Checkout revalidates this hash against the saved quote; the full address remains on the order, not the quote.
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
        rider_payout: rate.riderPayout,
        fixed_beneficiary_shares: rate.fixedBeneficiaryShares,
        distance_surcharge: rate.distanceSurcharge,
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
        // These are MKH administrative labels, kept separate from Google's
        // formatted street address so Google cannot override MKH's assignments.
        localityName: selectedLocalityName,
        lcdaName: selectedLcdaName || null,
        lgaName: selectedLgaName || null,
        administrativeLabel: [selectedLocalityName, selectedLcdaName, selectedLgaName, "Lagos", "Nigeria"]
          .filter(Boolean)
          .join(", "),
        deliveryFee: rate.deliveryFee,
        riderPayout: rate.riderPayout,
        fixedBeneficiaryShares: rate.fixedBeneficiaryShares,
        distanceSurcharge: rate.distanceSurcharge,
        platformFee: PLATFORM_FEE_NGN,
        subtotal,
        total: Math.round((subtotal + rate.deliveryFee + PLATFORM_FEE_NGN + Number.EPSILON) * 100) / 100,
        rateVersion: rate.version,
        expiresAt: savedQuote.expires_at,
      },
      notice: "Delivery price and rider payout are captured from the verified road route and active MKH rate card. Checkout revalidates the saved quote, cart and delivery address before creating the order.",
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    console.error("Delivery quote request failed:", error instanceof Error ? error.message : "unknown error");
    return fail("An unexpected error occurred while calculating delivery. No order has been placed.", 500);
  }
}