import { NextResponse } from "next/server";
import { requireMkhAdmin } from "@/lib/server/mkhAdminAuthorization";
import { getGooglePlacesApiKey, getGooglePlaceDetails, validSessionToken } from "@/lib/server/googlePlaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status, headers: { "Cache-Control": "no-store" } });
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

  const action = String(body?.action ?? "");
  const sessionToken = validSessionToken(body?.sessionToken);
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) return fail("Google Maps key is not configured on the server.", 503);

  try {
    if (action === "autocomplete") {
      const input = typeof body?.input === "string" ? body.input.trim() : "";
      if (input.length < 3 || input.length > 250) return fail("Enter at least 3 characters of the vendor's business address.");

      const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text",
        },
        body: JSON.stringify({ input, includedRegionCodes: ["ng"], languageCode: "en", regionCode: "NG", ...(sessionToken ? { sessionToken } : {}) }),
      });

      if (!response.ok) {
        const providerText = await response.text().catch(() => "");
        console.error("Google Places autocomplete failed:", response.status, providerText.slice(0, 300));
        return fail("Google address search failed. Confirm Places API (New) is enabled and allowed by this server key.", 502);
      }

      const payload = await response.json();
      const suggestions = (Array.isArray(payload?.suggestions) ? payload.suggestions : [])
        .map((row: any) => row?.placePrediction)
        .filter((place: any) => typeof place?.placeId === "string" && typeof place?.text?.text === "string")
        .map((place: any) => ({
          placeId: String(place.placeId),
          label: String(place.text.text),
          mainText: String(place.structuredFormat?.mainText?.text ?? place.text.text),
          secondaryText: String(place.structuredFormat?.secondaryText?.text ?? ""),
        }));

      return NextResponse.json({ success: true, suggestions }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "resolve") {
      const placeId = typeof body?.placeId === "string" ? body.placeId.trim() : "";
      if (!placeId) return fail("Select a Google Maps result first.");
      const place = await getGooglePlaceDetails(placeId, sessionToken);
      return NextResponse.json({ success: true, place }, { headers: { "Cache-Control": "no-store" } });
    }

    return fail("Unsupported Google Places action.");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Google Places request failed.", 422);
  }
}
