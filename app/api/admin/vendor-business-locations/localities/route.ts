import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireMkhAdmin } from "@/lib/server/mkhAdminAuthorization";

export const dynamic = "force-dynamic";

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const auth = await requireMkhAdmin();
  if (!auth.ok) return fail(auth.message, auth.status);

  const url = new URL(request.url);
  const search = String(url.searchParams.get("search") ?? "").trim().slice(0, 100);
  const selectedId = String(url.searchParams.get("selectedId") ?? "").trim();

  try {
    let query = adminClient
      .from("localities")
      .select("id,name,locality_type,lga_id,lcda_id,latitude,longitude,geocoding_status,is_active")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .limit(80);

    if (search.length >= 2) query = query.ilike("name", `%${search.replace(/[%_,]/g, " ")}%`);
    const { data, error } = await query;
    if (error) {
      console.error("Vendor location locality search failed:", error.message);
      return fail("Unable to search MKH localities.", 500);
    }

    let localities = [...(data ?? [])] as any[];
    if (selectedId && !localities.some((row) => row.id === selectedId)) {
      const { data: selected, error: selectedError } = await adminClient
        .from("localities")
        .select("id,name,locality_type,lga_id,lcda_id,latitude,longitude,geocoding_status,is_active")
        .eq("id", selectedId)
        .eq("is_active", true)
        .maybeSingle();
      if (selectedError) return fail("Unable to load the current MKH locality.", 500);
      if (selected) localities = [selected, ...localities];
    }

    const lgaIds = Array.from(new Set(localities.map((row) => row.lga_id).filter(Boolean)));
    const lcdaIds = Array.from(new Set(localities.map((row) => row.lcda_id).filter(Boolean)));
    const [lgasResult, lcdasResult] = await Promise.all([
      lgaIds.length
        ? adminClient.from("local_governments").select("id,name").in("id", lgaIds)
        : Promise.resolve({ data: [], error: null } as any),
      lcdaIds.length
        ? adminClient.from("local_council_development_areas").select("id,name").in("id", lcdaIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (lgasResult.error || lcdasResult.error) {
      console.error("Vendor locality LGA/LCDA lookup failed:", lgasResult.error?.message, lcdasResult.error?.message);
      return fail("Unable to load locality LGA/LCDA labels.", 500);
    }

    const lgaNames = new Map((lgasResult.data ?? []).map((row: any) => [String(row.id), String(row.name)]));
    const lcdaNames = new Map((lcdasResult.data ?? []).map((row: any) => [String(row.id), String(row.name)]));
    const result = localities.map((row) => ({
      id: row.id,
      name: row.name,
      localityType: row.locality_type,
      lgaId: row.lga_id,
      lgaName: row.lga_id ? lgaNames.get(String(row.lga_id)) ?? "" : "",
      lcdaId: row.lcda_id,
      lcdaName: row.lcda_id ? lcdaNames.get(String(row.lcda_id)) ?? "" : "",
      latitude: row.latitude,
      longitude: row.longitude,
      geocodingStatus: row.geocoding_status,
    }));

    return NextResponse.json({ success: true, localities: result }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    console.error("Vendor locality lookup failed:", error);
    return fail("Unable to search MKH localities.", 500);
  }
}
