export type GooglePlaceDetails = {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  countryCode: string;
  localityText: string;
  adminAreaText: string;
};

export function getGooglePlacesApiKey(): string | null {
  const key = process.env.GOOGLE_MAPS_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  return typeof key === "string" && key.trim() ? key.trim() : null;
}

export function validSessionToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const token = value.trim();
  return /^[A-Za-z0-9_-]{1,36}$/.test(token) ? token : null;
}

export async function getGooglePlaceDetails(
  placeIdInput: string,
  sessionToken?: string | null,
): Promise<GooglePlaceDetails> {
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) throw new Error("Google Places server key is missing. Set GOOGLE_MAPS_PLACES_API_KEY in the server environment and restart the app.");

  const placeId = placeIdInput.trim();
  if (!placeId || placeId.length > 512) throw new Error("A valid Google place ID is required.");

  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  url.searchParams.set("languageCode", "en");
  url.searchParams.set("regionCode", "NG");
  if (sessionToken) url.searchParams.set("sessionToken", sessionToken);

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "id,displayName,formattedAddress,location,addressComponents,types",
    },
  });

  if (!response.ok) {
    const providerText = await response.text().catch(() => "");
    let providerStatus = "UNKNOWN";
    let providerMessage = "Google Places returned an unspecified error.";
    try {
      const providerPayload = JSON.parse(providerText);
      providerStatus = String(providerPayload?.error?.status ?? providerPayload?.error?.code ?? providerStatus);
      providerMessage = String(providerPayload?.error?.message ?? providerMessage);
    } catch {
      if (providerText) providerMessage = providerText.slice(0, 240);
    }
    console.error("Google Places details request failed:", response.status, providerStatus, providerMessage.slice(0, 300));
    throw new Error(`Google Place details failed (${response.status}): ${providerStatus} - ${providerMessage.slice(0, 220)}`);
  }

  const place = await response.json();
  const latitude = Number(place?.location?.latitude);
  const longitude = Number(place?.location?.longitude);
  const resolvedPlaceId = String(place?.id ?? placeId).trim();
  const formattedAddress = String(place?.formattedAddress ?? "").trim();
  const displayName = String(place?.displayName?.text ?? "").trim();
  const components = Array.isArray(place?.addressComponents) ? place.addressComponents : [];

  const country = components.find((component: any) =>
    Array.isArray(component?.types) && component.types.includes("country"),
  );
  const countryCode = String(country?.shortText ?? "").toUpperCase();
  const localityComponent = components.find((component: any) =>
    Array.isArray(component?.types) && component.types.some((type: string) =>
      ["sublocality_level_1", "sublocality", "neighborhood", "locality", "administrative_area_level_3"].includes(type),
    ),
  );
  const adminAreaComponent = components.find((component: any) =>
    Array.isArray(component?.types) && component.types.some((type: string) =>
      ["administrative_area_level_2", "administrative_area_level_1"].includes(type),
    ),
  );

  if (
    !resolvedPlaceId ||
    !formattedAddress ||
    !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    !Number.isFinite(longitude) || longitude < -180 || longitude > 180
  ) {
    throw new Error("Google Maps returned an incomplete address or location.");
  }

  if (countryCode !== "NG") {
    throw new Error("Select a Google Maps result located in Nigeria.");
  }

  return {
    placeId: resolvedPlaceId,
    displayName: displayName || formattedAddress,
    formattedAddress,
    latitude,
    longitude,
    countryCode,
    localityText: String(localityComponent?.longText ?? localityComponent?.shortText ?? "").trim(),
    adminAreaText: String(adminAreaComponent?.longText ?? adminAreaComponent?.shortText ?? "").trim(),
  };
}
