import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return fail("Please sign in to search delivery localities.", 401);

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, role, status")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) {
      console.error("Delivery locality profile lookup failed:", profileError.message);
      return fail("We could not verify your customer account.", 500);
    }
    if (!profile || String(profile.role ?? "").toLowerCase() !== "customer" ||
        String(profile.status ?? "").toLowerCase() !== "active") {
      return fail("An active customer account is required.", 403);
    }

    const url = new URL(request.url);
    const rawQuery = (url.searchParams.get("q") ?? "").trim().replace(/\s+/g, " ");
    if (rawQuery.length < 2) return fail("Enter at least two characters to search MKH localities.", 400);
    if (rawQuery.length > 100) return fail("Locality search is too long.", 400);

    // Remove PostgREST wildcard controls: the search should match user text, not turn into an unrestricted pattern.
    const query = rawQuery.replace(/[%_*]/g, " ").replace(/\s+/g, " ").trim();
    if (query.length < 2) return fail("Enter a more specific locality name.", 400);

    const { data, error } = await adminClient
      .from("localities")
      .select("id, name, locality_type, geocoding_status, lcda_id")
      .eq("is_active", true)
      .ilike("name", `%${query}%`)
      .order("name", { ascending: true })
      .limit(30);

    if (error) {
      console.error("Delivery locality search failed:", error.message);
      return fail("We could not search MKH locality records. Please try again.", 503);
    }

    const lcdaIds = Array.from(new Set((data ?? [])
      .map((row: any) => row.lcda_id)
      .filter((id: unknown): id is string => typeof id === "string" && id.length > 0)));
    let lcdaRows: Array<{ id: string; name: string }> = [];
    if (lcdaIds.length) {
      const { data: lcdas, error: lcdaError } = await adminClient
        .from("local_council_development_areas")
        .select("id, name")
        .in("id", lcdaIds);
      if (lcdaError) {
        console.error("Delivery locality LCDA enrichment failed:", lcdaError.message);
        return fail("We could not load the locality area labels. Please try again.", 503);
      }
      lcdaRows = (lcdas ?? []) as Array<{ id: string; name: string }>;
    }
    const lcdaNames = new Map(lcdaRows.map((row) => [row.id, row.name]));

    return NextResponse.json({
      success: true,
      localities: (data ?? []).map((row: any) => ({
        id: row.id,
        name: row.name,
        localityType: row.locality_type ?? null,
        lcdaName: typeof row.lcda_id === "string" ? lcdaNames.get(row.lcda_id) ?? null : null,
        geocodingStatus: row.geocoding_status ?? null,
      })),
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    console.error("Delivery locality search failed:", error instanceof Error ? error.message : "unknown error");
    return fail("An unexpected error occurred while searching localities.", 500);
  }
}
