import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireMkhAdmin } from "@/lib/server/mkhAdminAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  const auth = await requireMkhAdmin();
  if (!auth.ok) return fail(auth.message, auth.status);

  try {
    const [localitiesResult, territoriesResult, mappingsResult] = await Promise.all([
      adminClient.from("localities")
        .select("id,name,locality_type,lga_id,lcda_id,is_active")
        .eq("is_active", true)
        .order("name")
        .limit(1000),
      adminClient.from("territories")
        .select("id,name,lga_id,is_active")
        .eq("is_active", true)
        .order("name"),
      (adminClient as any).from("territory_localities")
        .select("id,locality_id,territory_id,assigned_at")
        .eq("status", "active")
        .order("assigned_at", { ascending: false }),
    ]);

    const queryError = localitiesResult.error || territoriesResult.error || mappingsResult.error;
    if (queryError) {
      console.error("MKH territory coverage load failed:", queryError.message);
      return fail("Unable to load MKH locality and territory records.", 500);
    }

    const localities = localitiesResult.data ?? [];
    const territories = territoriesResult.data ?? [];
    const mappings = mappingsResult.data ?? [];
    const lgaIds = Array.from(new Set([
      ...localities.map((row: any) => row.lga_id),
      ...territories.map((row: any) => row.lga_id),
    ].filter(Boolean)));
    const lcdaIds = Array.from(new Set(localities.map((row: any) => row.lcda_id).filter(Boolean)));

    const [lgasResult, lcdasResult] = await Promise.all([
      lgaIds.length
        ? adminClient.from("local_governments").select("id,name").in("id", lgaIds)
        : Promise.resolve({ data: [], error: null } as any),
      lcdaIds.length
        ? adminClient.from("local_council_development_areas").select("id,name").in("id", lcdaIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);
    if (lgasResult.error || lcdasResult.error) {
      console.error("MKH territory coverage labels failed:", lgasResult.error?.message, lcdasResult.error?.message);
      return fail("Unable to load MKH LGA/LCDA labels.", 500);
    }

    const lgaNames = new Map<string, string>((lgasResult.data ?? []).map((row: any) => [String(row.id), String(row.name)] as [string, string]));
    const lcdaNames = new Map<string, string>((lcdasResult.data ?? []).map((row: any) => [String(row.id), String(row.name)] as [string, string]));
    const localityById = new Map<string, any>(localities.map((row: any) => [String(row.id), row] as [string, any]));
    const territoryById = new Map<string, any>(territories.map((row: any) => [String(row.id), row] as [string, any]));

    return NextResponse.json({
      success: true,
      localities: localities.map((row: any) => ({
        id: String(row.id),
        name: String(row.name),
        localityType: row.locality_type ? String(row.locality_type) : "",
        lgaId: row.lga_id ? String(row.lga_id) : null,
        lgaName: row.lga_id ? lgaNames.get(String(row.lga_id)) ?? "" : "",
        lcdaId: row.lcda_id ? String(row.lcda_id) : null,
        lcdaName: row.lcda_id ? lcdaNames.get(String(row.lcda_id)) ?? "" : "",
      })),
      territories: territories.map((row: any) => ({
        id: String(row.id),
        name: String(row.name),
        lgaId: row.lga_id ? String(row.lga_id) : null,
        lgaName: row.lga_id ? lgaNames.get(String(row.lga_id)) ?? "" : "",
      })),
      mappings: mappings.flatMap((row: any) => {
        const locality: any = localityById.get(String(row.locality_id));
        const territory: any = territoryById.get(String(row.territory_id));
        // Stale links to inactive/missing records are not offered as active coverage.
        if (!locality || !territory) return [];
        return [{
          id: String(row.id),
          localityId: String(row.locality_id),
          localityName: String(locality.name),
          localityType: locality.locality_type ? String(locality.locality_type) : "",
          territoryId: String(row.territory_id),
          territoryName: String(territory.name),
          lgaName: locality.lga_id ? lgaNames.get(String(locality.lga_id)) ?? "" : "",
          assignedAt: row.assigned_at ?? null,
        }];
      }),
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    console.error("MKH territory coverage GET failed:", error instanceof Error ? error.message : "unknown error");
    return fail("Unable to load MKH territory coverage.", 500);
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

  const action = body?.action === "unassign" ? "unassign" : body?.action === "assign" ? "assign" : "";
  const localityId = typeof body?.localityId === "string" ? body.localityId.trim() : "";
  const territoryId = typeof body?.territoryId === "string" ? body.territoryId.trim() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  if (!action) return fail("Choose whether to map or remove the MKH locality coverage link.");
  if (!UUID_PATTERN.test(localityId) || !UUID_PATTERN.test(territoryId)) return fail("Choose a valid MKH locality and territory.");
  if (reason.length < 10 || reason.length > 500) return fail("Enter a reason between 10 and 500 characters.");

  try {
    const { data, error } = await (adminClient as any).rpc("mkh_admin_set_territory_locality", {
      p_locality_id: localityId,
      p_territory_id: territoryId,
      p_action: action,
      p_changed_by: auth.userId,
      p_change_reason: reason,
    });
    if (error) {
      console.error("MKH territory locality mapping update rejected:", error.message);
      return fail(error.message || "The MKH locality coverage change was rejected.", 422);
    }

    return NextResponse.json({
      success: true,
      result: data,
      message: data?.unchanged
        ? action === "assign" ? "This MKH locality is already mapped to that territory." : "This MKH locality is not currently mapped to that territory."
        : action === "assign" ? "MKH locality-to-territory coverage saved and audited." : "MKH locality-to-territory coverage removed; its history was retained.",
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    console.error("MKH territory locality mapping POST failed:", error instanceof Error ? error.message : "unknown error");
    return fail("Unable to save the MKH locality coverage change.", 500);
  }
}
