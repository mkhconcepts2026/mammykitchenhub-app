import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { getGooglePlacesApiKey, getGooglePlaceDetails, validSessionToken } from "@/lib/server/googlePlaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestCounts = new Map<string, { startedAt: number; count: number }>();

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status, headers: { "Cache-Control": "no-store" } });
}

function sameSiteRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!host) return false;
  try { return new URL(origin).host.toLowerCase() === host.toLowerCase(); }
  catch { return false; }
}

function withinRequestLimit(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = forwarded || request.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const current = requestCounts.get(key);
  if (!current || now - current.startedAt >= 60_000) {
    requestCounts.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= 45) return false;
  current.count += 1;
  return true;
}

function safeSearch(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 100).replace(/[%_,]/g, " ") : "";
}

async function getLocalities(search: string) {
  if (search.length < 2) throw new Error("Enter at least 2 characters to search MKH localities.");
  const { data, error } = await adminClient
    .from("localities")
    .select("id,name,locality_type,lga_id,lcda_id,is_active")
    .eq("is_active", true)
    .ilike("name", `%${search}%`)
    .order("name", { ascending: true })
    .limit(60);
  if (error) {
    console.error("Vendor onboarding MKH locality search failed:", error.message);
    throw new Error("Unable to search active MKH localities right now.");
  }
  const rows = data ?? [];
  const lgaIds = Array.from(new Set(rows.map((row: any) => row.lga_id).filter(Boolean)));
  const lcdaIds = Array.from(new Set(rows.map((row: any) => row.lcda_id).filter(Boolean)));
  const [lgas, lcdas] = await Promise.all([
    lgaIds.length ? adminClient.from("local_governments").select("id,name").in("id", lgaIds) : Promise.resolve({ data: [], error: null } as any),
    lcdaIds.length ? adminClient.from("local_council_development_areas").select("id,name").in("id", lcdaIds) : Promise.resolve({ data: [], error: null } as any),
  ]);
  if (lgas.error || lcdas.error) {
    console.error("Vendor onboarding locality labels failed:", lgas.error?.message, lcdas.error?.message);
    throw new Error("Unable to load MKH locality area labels.");
  }
  const lgaNames = new Map((lgas.data ?? []).map((row: any) => [String(row.id), String(row.name)]));
  const lcdaNames = new Map((lcdas.data ?? []).map((row: any) => [String(row.id), String(row.name)]));
  return rows.map((row: any) => ({
    id: String(row.id),
    name: String(row.name),
    localityType: row.locality_type ? String(row.locality_type) : null,
    lgaName: row.lga_id ? lgaNames.get(String(row.lga_id)) ?? "" : "",
    lcdaName: row.lcda_id ? lcdaNames.get(String(row.lcda_id)) ?? "" : "",
  }));
}

export async function POST(request: Request) {
  if (!sameSiteRequest(request)) return fail("This location request must come from the MKH onboarding page.", 403);
  if (!withinRequestLimit(request)) return fail("Too many location searches. Please wait a minute and try again.", 429);

  let body: any;
  try { body = await request.json(); }
  catch { return fail("Invalid location request body."); }

  const action = typeof body?.action === "string" ? body.action : "";
  const sessionToken = validSessionToken(body?.sessionToken);

  try {
    if (action === "autocomplete") {
      const input = typeof body?.input === "string" ? body.input.trim() : "";
      if (input.length < 3 || input.length > 250) return fail("Enter at least 3 characters of the business address.");
      const apiKey = getGooglePlacesApiKey();
      if (!apiKey) return fail("Google Maps Places is not configured on the server.", 503);
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
        console.error("Vendor onboarding Google Places autocomplete returned HTTP", response.status);
        return fail("Google Maps could not complete the address search. Refine the address and try again.", 502);
      }
      const payload = await response.json();
      const suggestions = (Array.isArray(payload?.suggestions) ? payload.suggestions : [])
        .map((row: any) => row?.placePrediction)
        .filter((row: any) => typeof row?.placeId === "string" && typeof row?.text?.text === "string")
        .slice(0, 6)
        .map((row: any) => ({
          placeId: String(row.placeId),
          label: String(row.text.text),
          mainText: String(row.structuredFormat?.mainText?.text ?? row.text.text),
          secondaryText: String(row.structuredFormat?.secondaryText?.text ?? ""),
        }));
      return NextResponse.json({ success: true, suggestions }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "resolve") {
      const placeId = typeof body?.placeId === "string" ? body.placeId.trim() : "";
      if (!placeId || placeId.length > 512) return fail("Select a Google Maps result first.");
      const place = await getGooglePlaceDetails(placeId, sessionToken);
      return NextResponse.json({ success: true, place }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "localities") {
      const search = safeSearch(body?.search);
      const localities = await getLocalities(search);
      return NextResponse.json({ success: true, localities }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "validate") {
      const placeId = typeof body?.placeId === "string" ? body.placeId.trim() : "";
      const localityId = typeof body?.localityId === "string" ? body.localityId.trim() : "";
      if (!placeId || placeId.length > 512) return fail("Select a resolved Google Maps address first.");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(localityId)) return fail("Select a valid MKH locality.");

      const [place, localityResult] = await Promise.all([
        getGooglePlaceDetails(placeId),
        adminClient.from("localities")
          .select("id,name,locality_type,lga_id,lcda_id,is_active")
          .eq("id", localityId)
          .eq("is_active", true)
          .maybeSingle(),
      ]);
      if (localityResult.error) {
        console.error("Vendor onboarding locality validation failed:", localityResult.error.message);
        return fail("Unable to re-check the selected MKH locality.", 503);
      }
      if (!localityResult.data) return fail("That MKH locality is no longer active. Search and select an active locality again.", 409);

      const row = localityResult.data as any;
      const [lcdaResult, lgaResult] = await Promise.all([
        row.lcda_id ? adminClient.from("local_council_development_areas").select("name").eq("id", row.lcda_id).maybeSingle() : Promise.resolve({ data: null, error: null } as any),
        row.lga_id ? adminClient.from("local_governments").select("name").eq("id", row.lga_id).maybeSingle() : Promise.resolve({ data: null, error: null } as any),
      ]);
      if (lcdaResult.error || lgaResult.error) return fail("Unable to confirm the selected MKH locality area.", 503);

      return NextResponse.json({
        success: true,
        place,
        locality: {
          id: String(row.id),
          name: String(row.name),
          localityType: row.locality_type ? String(row.locality_type) : null,
          lcdaName: lcdaResult.data?.name ? String(lcdaResult.data.name) : "",
          lgaName: lgaResult.data?.name ? String(lgaResult.data.name) : "",
          isActive: row.is_active === true,
        },
      }, { headers: { "Cache-Control": "no-store" } });
    }

    return fail("Unsupported vendor location action.");
  } catch (error) {
    console.error("Vendor onboarding location request failed:", error instanceof Error ? error.message : "unknown error");
    return fail(error instanceof Error ? error.message : "Unable to process the business location.", 422);
  }
}