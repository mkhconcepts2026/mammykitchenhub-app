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
const ACCEPTED_DELIVERY_PLACE_TYPES = new Set([
  "street_address",
  "premise",
  "subpremise",
]);

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


type StreetTarget = {
  streetTokens: string[];
  houseNumber: string | null;
};

type GeocodedAddress = {
  latitude: number;
  longitude: number;
  placeId: string | null;
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
    const matchedNumber = readAddressComponent(components, "street_number").toLowerCase();
    if (matchedNumber && matchedNumber !== target.houseNumber) return false;
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
    if (candidate?.partial_match === true) return false;
    if (!streetTarget) return true;
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
): Promise<GeocodedAddress | null> {
  const body: Record<string, unknown> = {
    textQuery: normaliseAddress(address),
    languageCode: "en",
    regionCode: "NG",
  };

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

function isNigeriaCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= 4 &&
    latitude <= 14.5 &&
    longitude >= 2 &&
    longitude <= 15.5
  );
}

async function geocodePlaceId(
  placeId: string,
  apiKey: string,
): Promise<GeocodedAddress | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("region", "ng");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));

  if (
    !response.ok ||
    payload?.status !== "OK" ||
    !Array.isArray(payload?.results) ||
    !payload.results.length
  ) {
    console.error("Google Place ID verification failed:", {
      httpStatus: response.status,
      providerStatus: payload?.status ?? "UNKNOWN",
      resultCount: Array.isArray(payload?.results)
        ? payload.results.length
        : 0,
    });
    return null;
  }

  const result = payload.results[0];
  const resultTypes = Array.isArray(result?.types)
    ? result.types.map((type: unknown) => String(type).toLowerCase())
    : [];
  const components = Array.isArray(result?.address_components)
    ? result.address_components
    : [];
  const hasComponent = (expected: string) => components.some((component: any) =>
    Array.isArray(component?.types) && component.types.includes(expected)
  );
  const countryComponent = components.find((component: any) =>
    Array.isArray(component?.types) && component.types.includes("country")
  );
  const countryCode = String(countryComponent?.short_name ?? "").toUpperCase();
  const countryName = String(countryComponent?.long_name ?? "").trim().toLowerCase();
  const locationType = String(result?.geometry?.location_type ?? "").toUpperCase();
  const addressText = typeof result?.formatted_address === "string"
    ? result.formatted_address.trim()
    : "";
  const hasStreetNumber = hasComponent("street_number") ||
    /^\s*(?:no\.?\s*)?\d+[a-z]?\b/i.test(addressText);
  const hasStreetRoute = hasComponent("route");
  const hasSubpremise = resultTypes.includes("subpremise") || hasComponent("subpremise");
  const hasAddressType = resultTypes.some((type: string) => ACCEPTED_DELIVERY_PLACE_TYPES.has(type));
  const hasStreetPrecision = locationType === "ROOFTOP" || locationType === "RANGE_INTERPOLATED";

  if (
    result?.partial_match === true ||
    !hasAddressType ||
    !hasStreetRoute ||
    (!hasStreetNumber && !hasSubpremise) ||
    (countryCode !== "NG" && countryName !== "nigeria") ||
    !hasStreetPrecision
  ) {
    console.warn("Google Place ID did not resolve to a complete Nigerian street address:", {
      resultTypes,
      countryCode: countryCode || null,
      hasStreetRoute,
      hasStreetNumber,
      hasSubpremise,
      locationType: locationType || null,
      partialMatch: result?.partial_match === true,
    });
    return null;
  }

  const latitude = Number(result?.geometry?.location?.lat);
  const longitude = Number(result?.geometry?.location?.lng);
  const resolvedPlaceId =
    typeof result?.place_id === "string" ? result.place_id.trim() : "";
  const formattedAddress =
    typeof result?.formatted_address === "string"
      ? result.formatted_address.trim()
      : "";

  if (
    !isNigeriaCoordinate(latitude, longitude) ||
    !resolvedPlaceId ||
    !formattedAddress
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
    placeId: resolvedPlaceId,
    formattedAddress,
  };
}

async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number,
  apiKey: string,
): Promise<GeocodedAddress | null> {
  if (!isNigeriaCoordinate(latitude, longitude)) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${latitude},${longitude}`);
  url.searchParams.set("region", "ng");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Google reverse geocoding failed:", {
      httpStatus: response.status,
      providerStatus: payload?.status ?? "UNKNOWN",
    });
    return {
      latitude,
      longitude,
      placeId: null,
      formattedAddress: `Google Maps pin (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`,
    };
  }

  const results = Array.isArray(payload?.results) ? payload.results : [];
  const countryResult = results.find((result: any) =>
    Array.isArray(result?.address_components) &&
    result.address_components.some((component: any) =>
      Array.isArray(component?.types) && component.types.includes("country")
    )
  );
  const countryComponent = countryResult?.address_components?.find((component: any) =>
    Array.isArray(component?.types) && component.types.includes("country")
  );
  const countryCode = String(countryComponent?.short_name ?? "").toUpperCase();
  const countryName = String(countryComponent?.long_name ?? "").trim().toLowerCase();
  if (countryComponent && countryCode !== "NG" && countryName !== "nigeria") {
    return null;
  }

  const best =
    results.find((result: any) =>
      Array.isArray(result?.types) &&
      result.types.some((type: string) =>
        ["street_address", "premise", "subpremise", "route"].includes(type)
      )
    ) ?? results[0];

  const formattedAddress =
    typeof best?.formatted_address === "string"
      ? best.formatted_address.trim()
      : "";

  const placeId =
    typeof best?.place_id === "string" ? best.place_id.trim() : null;

  // Keep the exact user-selected pin coordinates for routing.
  // Reverse geocoding supplies the human-readable address, not a replacement point.
  return {
    latitude,
    longitude,
    placeId,
    formattedAddress:
      formattedAddress ||
      `Google Maps pin (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`,
  };
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
      console.error("Grouped delivery quote profile lookup failed:", profileError.message);
      return fail("We could not verify your customer account.", 500);
    }
    if (!profile || String(profile.role ?? "").toLowerCase() !== "customer" ||
        String(profile.status ?? "").toLowerCase() !== "active") {
      return fail("An active customer account is required.", 403);
    }

    let rawBody: unknown;
    try { rawBody = await request.json(); } catch { return fail("Invalid grouped quote request.", 400); }
    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      return fail("Invalid grouped quote request.", 400);
    }
    const input = rawBody as Record<string, unknown>;
    const deliveryAddress = input.deliveryAddress;
    const cart = input.cart;
    if (typeof deliveryAddress !== "string" || !deliveryAddress.trim() || deliveryAddress.trim().length > 1000) {
      return fail("Enter the complete street address before calculating delivery.", 400);
    }
    if (!Array.isArray(cart) || cart.length < 2 || cart.length > 50) {
      return fail("Your multi-vendor basket must contain between 2 and 50 items.", 400);
    }

    const googleDestinationValue = input.googleDestination;
    if (!googleDestinationValue || typeof googleDestinationValue !== "object" || Array.isArray(googleDestinationValue)) {
      return fail("Select a Google Maps address or confirm the exact delivery point using the map pin.", 400);
    }
    const googleDestination = googleDestinationValue as Record<string, unknown>;
    const destinationCaptureMethod = String(googleDestination.captureMethod ?? "");
    const destinationPlaceId = typeof googleDestination.placeId === "string" ? googleDestination.placeId.trim() : "";
    const destinationLatitude = googleDestination.latitude;
    const destinationLongitude = googleDestination.longitude;

    if (destinationCaptureMethod !== "google_place" && destinationCaptureMethod !== "map_pin") {
      return fail("The Google Maps destination capture method is invalid.", 400);
    }
    if (destinationCaptureMethod === "google_place" && (!destinationPlaceId || destinationPlaceId.length > 512)) {
      return fail("Select a valid Google Maps place before calculating delivery.", 400);
    }
    if (destinationCaptureMethod === "map_pin" &&
        (typeof destinationLatitude !== "number" || typeof destinationLongitude !== "number" ||
         !isNigeriaCoordinate(destinationLatitude, destinationLongitude))) {
      return fail("The selected map pin must be within Nigeria. Move it to your delivery location and try again.", 422);
    }

    const seen = new Set<string>();
    const items: CartItem[] = [];
    for (const raw of cart) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return fail("An item in your basket is invalid.", 400);
      }
      const candidate = raw as Record<string, unknown>;
      if (typeof candidate.menu_item_id !== "string" || !UUID_PATTERN.test(candidate.menu_item_id) ||
          !Number.isSafeInteger(candidate.quantity) || Number(candidate.quantity) < 1 || Number(candidate.quantity) > 99) {
        return fail("An item ID or quantity in your basket is invalid.", 400);
      }
      const itemId = candidate.menu_item_id.toLowerCase();
      if (seen.has(itemId)) return fail("Your basket contains a duplicate item. Refresh the basket and try again.", 400);
      seen.add(itemId);
      items.push({ menu_item_id: itemId, quantity: Number(candidate.quantity) });
    }

    const { data: menuItems, error: menuError } = await adminClient
      .from("menu_items")
      .select("id, vendor_id, price, available")
      .in("id", items.map((item) => item.menu_item_id));
    if (menuError) {
      console.error("Grouped delivery quote menu lookup failed:", menuError.message);
      return fail("We could not verify the current menu items. Please try again.", 500);
    }
    if (!menuItems || menuItems.length !== items.length) {
      return fail("One or more menu items are no longer available. Refresh your basket.", 409);
    }

    const menuById = new Map<string, any>(menuItems.map((item: any) => [String(item.id).toLowerCase(), item]));
    const groups = new Map<string, CartItem[]>();
    for (const item of items) {
      const menu = menuById.get(item.menu_item_id);
      if (!menu || menu.available !== true) return fail("A selected menu item is no longer available.", 409);
      const vendorId = String(menu.vendor_id ?? "").toLowerCase();
      if (!UUID_PATTERN.test(vendorId)) return fail("A menu item has an invalid vendor assignment.", 409);
      const group = groups.get(vendorId) ?? [];
      group.push(item);
      groups.set(vendorId, group);
    }

    const vendorIds = [...groups.keys()].sort((a, b) => a.localeCompare(b));
    if (vendorIds.length < 2) return fail("This basket contains only one vendor. Use the standard delivery quote.", 400);
    if (vendorIds.length > 10) return fail("A single checkout can contain up to 10 vendors. Please split the basket and try again.", 400);

    const geocodingApiKey = process.env.GOOGLE_MAPS_GEOCODING_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    const routesApiKey = process.env.GOOGLE_MAPS_ROUTES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (!geocodingApiKey) return fail("Address resolution is not configured. Please contact MKH support.", 503);
    if (!routesApiKey) return fail("Road-distance pricing is not configured. Please contact MKH support.", 503);

    let destinationPoint: GeocodedAddress | null = null;
    try {
      destinationPoint = destinationCaptureMethod === "google_place"
        ? await geocodePlaceId(destinationPlaceId, geocodingApiKey)
        : await reverseGeocodeCoordinates(destinationLatitude as number, destinationLongitude as number, geocodingApiKey);
    } catch (error) {
      console.error("Grouped customer destination resolution failed:", error instanceof Error ? error.message : "unknown error");
    }
    if (!destinationPoint) {
      return fail("Google could not confirm this delivery destination. Select a full street address or pin the exact entrance.", 422);
    }

    const nowIso = new Date().toISOString();
    const { data: rateCards, error: rateError } = await adminClient
      .from("delivery_distance_rate_cards")
      .select("rate_version, min_distance_km, max_distance_km, customer_delivery_fee, rider_payout, active, effective_from, effective_to")
      .eq("active", true)
      .lte("effective_from", nowIso)
      .order("rate_version", { ascending: false });
    if (rateError) {
      console.error("Grouped quote rate-card lookup failed:", rateError.message);
      return fail("MKH distance-pricing rules are not available. Please contact MKH support.", 503);
    }

    const destinationAddressHash = hash(JSON.stringify({
      address: deliveryAddress.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-NG"),
    }));
    const expiresAt = new Date(Date.now() + QUOTE_TTL_MINUTES * 60 * 1000).toISOString();
    const quoteRows: Record<string, unknown>[] = [];
    const responseQuotes: Array<Record<string, unknown>> = [];
    let foodSubtotal = 0;
    let deliveryTotal = 0;

    for (let index = 0; index < vendorIds.length; index += 1) {
      const vendorId = vendorIds[index];
      const vendorItems = groups.get(vendorId) ?? [];
      const menuSubtotal = vendorItems.reduce((sum, item) => {
        const menu = menuById.get(item.menu_item_id);
        return sum + Number(menu.price) * item.quantity;
      }, 0);
      const subtotal = Math.round((menuSubtotal + Number.EPSILON) * 100) / 100;
      if (!Number.isFinite(subtotal) || subtotal <= 0) {
        return fail("A vendor basket subtotal could not be verified.", 409);
      }

      const { data: vendor, error: vendorError } = await adminClient
        .from("vendors")
        .select("*")
        .eq("id", vendorId)
        .eq("status", "active")
        .maybeSingle();
      if (vendorError) {
        console.error("Grouped quote vendor lookup failed:", vendorError.message);
        return fail("We could not verify one of the selected vendors.", 500);
      }
      if (!vendor) return fail("One of the selected vendors is no longer active.", 409);

      const { data: verifiedVendorLocation, error: verifiedLocationError } = await (adminClient as any)
        .from("vendor_business_locations")
        .select("business_address,google_place_id,latitude,longitude,locality_id,address_verification_status,locality_match_status")
        .eq("vendor_id", vendorId)
        .maybeSingle();
      if (verifiedLocationError) {
        console.error("Grouped quote verified location lookup failed:", verifiedLocationError.message);
        return fail("Unable to load an Admin-verified vendor business location. Please contact MKH support.", 500);
      }

      if (verifiedVendorLocation && (
        verifiedVendorLocation.address_verification_status !== "verified" ||
        verifiedVendorLocation.locality_match_status !== "matched" ||
        !verifiedVendorLocation.locality_id ||
        typeof verifiedVendorLocation.google_place_id !== "string" ||
        !verifiedVendorLocation.google_place_id.trim() ||
        verifiedVendorLocation.latitude === null || typeof verifiedVendorLocation.latitude === "undefined" ||
        !Number.isFinite(Number(verifiedVendorLocation.latitude)) || Number(verifiedVendorLocation.latitude) < -90 || Number(verifiedVendorLocation.latitude) > 90 ||
        verifiedVendorLocation.longitude === null || typeof verifiedVendorLocation.longitude === "undefined" ||
        !Number.isFinite(Number(verifiedVendorLocation.longitude)) || Number(verifiedVendorLocation.longitude) < -180 || Number(verifiedVendorLocation.longitude) > 180
      )) {
        return fail(`Vendor ${String(vendor.name ?? "selected vendor")} does not yet have an approved Google delivery origin. Admin must complete its business-address verification first.`, 422);
      }

      if (verifiedVendorLocation?.locality_id) {
        const { data: originLocality, error: originLocalityError } = await adminClient
          .from("localities")
          .select("id,is_active")
          .eq("id", verifiedVendorLocation.locality_id)
          .maybeSingle();
        if (originLocalityError) {
          console.error("Grouped quote MKH locality lookup failed:", originLocalityError.message);
          return fail("Unable to verify a vendor's MKH locality.", 500);
        }
        if (!originLocality || originLocality.is_active !== true) {
          return fail(`Vendor ${String(vendor.name ?? "selected vendor")} has an inactive MKH locality and cannot be quoted.`, 422);
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
          console.error("Grouped quote approved vendor address lookup failed:", applicationError.message);
          return fail("We could not verify one vendor's registered street address.", 503);
        }
        const applicationAddress = typeof latestApplication?.business_address === "string"
          ? latestApplication.business_address.trim()
          : "";
        if (String(latestApplication?.status ?? "").toLowerCase() === "approved" && applicationAddress.length >= 8) {
          originAddress = applicationAddress;
        }
      }
      if (!originAddress) {
        return fail(`Vendor ${String(vendor.name ?? "selected vendor")} is missing its verified street address. Admin must verify it before checkout.`, 422);
      }

      let originPoint: GeocodedAddress | null = null;
      try {
        originPoint =
          verifiedVendorLocation &&
          typeof verifiedVendorLocation.google_place_id === "string" &&
          verifiedVendorLocation.google_place_id.trim() &&
          Number.isFinite(Number(verifiedVendorLocation.latitude)) &&
          Number.isFinite(Number(verifiedVendorLocation.longitude))
            ? {
                latitude: Number(verifiedVendorLocation.latitude),
                longitude: Number(verifiedVendorLocation.longitude),
                placeId: verifiedVendorLocation.google_place_id.trim(),
                formattedAddress: String(verifiedVendorLocation.business_address ?? originAddress),
              }
            : await geocodeAddress(originAddress, geocodingApiKey, null);
      } catch (error) {
        console.error("Grouped vendor origin resolution failed:", vendorId, error instanceof Error ? error.message : "unknown error");
      }
      if (!originPoint) {
        return fail(`Google Maps could not resolve ${String(vendor.name ?? "a vendor")}'s verified address. Please contact MKH support.`, 422);
      }

      const routeResponse = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": routesApiKey,
          "X-Goog-FieldMask": "routes.distanceMeters",
        },
        body: JSON.stringify({
          origin: originPoint.placeId
            ? { placeId: originPoint.placeId }
            : { location: { latLng: { latitude: originPoint.latitude, longitude: originPoint.longitude } } },
          destination: destinationCaptureMethod === "map_pin"
            ? { location: { latLng: { latitude: destinationPoint.latitude, longitude: destinationPoint.longitude } } }
            : { placeId: destinationPoint.placeId },
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
        console.error("Google Routes grouped quote failed:", vendorId, routeResponse.status);
        return fail(`Google Routes could not calculate delivery from ${String(vendor.name ?? "one vendor")} to your address.`, 502);
      }
      const metres = Number(routePayload?.routes?.[0]?.distanceMeters);
      if (!Number.isFinite(metres) || metres <= 0) {
        return fail(`No reliable driving route was found from ${String(vendor.name ?? "one vendor")} to your delivery address.`, 422);
      }

      const distanceMeters = Math.round(metres);
      const distanceKm = distanceMeters / 1000;
      if (distanceKm > PILOT_MAX_ROUTE_KM) {
        return fail(`${String(vendor.name ?? "A vendor")} is beyond MKH's current ${PILOT_MAX_ROUTE_KM} km pilot road-route limit for this address.`, 422);
      }

      const rate = chooseRate((rateCards ?? []) as RateCard[], distanceKm);
      if (!rate || !Number.isFinite(rate.deliveryFee)) {
        return fail(`No active delivery price exists for the route from ${String(vendor.name ?? "a vendor")}.`, 503);
      }

      const platformFee = index === 0 ? PLATFORM_FEE_NGN : 0;
      const canonicalVendorCart = [...vendorItems].sort((a, b) => a.menu_item_id.localeCompare(b.menu_item_id));
      const cartHash = hash(JSON.stringify(canonicalVendorCart));
      foodSubtotal += subtotal;
      deliveryTotal += rate.deliveryFee;

      quoteRows.push({
        customer_id: user.id,
        vendor_id: vendorId,
        cart_hash: cartHash,
        destination_address_hash: destinationAddressHash,
        subtotal_amount: subtotal,
        route_distance_meters: distanceMeters,
        route_distance_km: Number(distanceKm.toFixed(3)),
        rate_version: rate.version,
        customer_delivery_fee: rate.deliveryFee,
        rider_payout: rate.riderPayout,
        fixed_beneficiary_shares: rate.fixedBeneficiaryShares,
        distance_surcharge: rate.distanceSurcharge,
        destination_google_place_id: destinationPoint.placeId,
        destination_google_formatted_address: destinationPoint.formattedAddress,
        destination_latitude: destinationPoint.latitude,
        destination_longitude: destinationPoint.longitude,
        destination_capture_method: destinationCaptureMethod,
        platform_fee: platformFee,
        status: "quoted",
        expires_at: expiresAt,
      });

      responseQuotes.push({
        vendorId,
        vendorName: String(vendor.name ?? "Vendor"),
        cartHash,
        subtotal,
        distanceKm: Number(distanceKm.toFixed(3)),
        deliveryFee: Number(rate.deliveryFee),
        platformFee,
        riderPayout: Number(rate.riderPayout),
        fixedBeneficiaryShares: Number(rate.fixedBeneficiaryShares),
        distanceSurcharge: Number(rate.distanceSurcharge),
        resolvedVendorAddress: originPoint.formattedAddress,
        resolvedDestinationAddress: destinationPoint.formattedAddress,
        rateVersion: rate.version,
      });
    }

    // One service fee is allocated deterministically to the first vendor quote
    // (vendor ID sort order); every other vendor quote has a zero service fee.
    // All delivery quote rows are inserted together so a partial quote set is
    // never returned to the browser.
    const { data: savedQuotes, error: saveError } = await adminClient
      .from("delivery_quotes")
      .insert(quoteRows)
      .select("id, vendor_id, expires_at");
    if (saveError || !savedQuotes || savedQuotes.length !== quoteRows.length) {
      console.error("Grouped delivery quote insert failed:", saveError?.message);
      return fail("We could not save all vendor delivery quotes. No order has been placed. Please try again.", 500);
    }

    const savedByVendor = new Map(savedQuotes.map((quote: any) => [String(quote.vendor_id), quote]));
    const quotes = responseQuotes.map((quote) => {
      const saved = savedByVendor.get(String(quote.vendorId)) as any;
      return {
        ...quote,
        quoteId: saved?.id,
        expiresAt: saved?.expires_at,
        total: Number(quote.subtotal) + Number(quote.deliveryFee) + Number(quote.platformFee),
      };
    });
    if (quotes.some((quote) => !quote.quoteId || !quote.expiresAt)) {
      console.error("Grouped quote insert returned incomplete vendor quote IDs.");
      return fail("We could not confirm all vendor delivery quotes. Please calculate delivery again.", 500);
    }

    const serviceFee = PLATFORM_FEE_NGN;
    const total = Math.round((foodSubtotal + deliveryTotal + serviceFee + Number.EPSILON) * 100) / 100;
    return NextResponse.json({
      success: true,
      quotes,
      foodSubtotal: Math.round((foodSubtotal + Number.EPSILON) * 100) / 100,
      deliveryTotal: Math.round((deliveryTotal + Number.EPSILON) * 100) / 100,
      serviceFee,
      total,
      vendorCount: vendorIds.length,
      destinationAddressHash,
      cartHash: hash(JSON.stringify([...items].sort((a, b) => a.menu_item_id.localeCompare(b.menu_item_id)))),
    }, {
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (error) {
    console.error("Grouped delivery quote request failed:", error instanceof Error ? error.message : "unknown error");
    return fail("An unexpected error occurred while calculating the grouped delivery routes. No order has been placed.", 500);
  }
}
