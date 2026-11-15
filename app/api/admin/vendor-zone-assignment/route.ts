import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireMkhAdmin } from "@/lib/server/mkhAdminAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const auth = await requireMkhAdmin();
  if (!auth.ok) return fail(auth.message, auth.status);

  const vendorId = new URL(request.url).searchParams.get("vendorId")?.trim() ?? "";
  if (!UUID.test(vendorId)) return fail("Choose a valid vendor.");

  try {
    const [vendorRes, locationRes, assignmentsRes] = await Promise.all([
      adminClient.from("vendors").select("id,name,status").eq("id", vendorId).maybeSingle(),
      (adminClient as any).from("vendor_business_locations")
        .select("locality_id,address_verification_status,locality_match_status")
        .eq("vendor_id", vendorId).maybeSingle(),
      (adminClient as any).from("zone_vendors")
        .select("id,zone_id,assigned_at").eq("vendor_id", vendorId).eq("status", "active")
        .order("assigned_at", { ascending: false }),
    ]);
    if (vendorRes.error || locationRes.error || assignmentsRes.error) {
      console.error("Vendor-zone eligibility lookup failed:", vendorRes.error?.message, locationRes.error?.message, assignmentsRes.error?.message);
      return fail("Unable to load vendor eligibility and current assignments.", 500);
    }
    if (!vendorRes.data) return fail("Vendor record was not found.", 404);

    const location = locationRes.data;
    const assignments = assignmentsRes.data ?? [];
    const multipleActiveAssignments = assignments.length > 1;
    let locality: any = null;
    if (location?.locality_id) {
      const { data, error } = await adminClient.from("localities")
        .select("id,name,locality_type,lga_id,is_active")
        .eq("id", location.locality_id).maybeSingle();
      if (error) return fail("Unable to confirm the vendor's MKH locality.", 500);
      locality = data;
    }

    let territoryIds: string[] = [];
    if (locality?.is_active === true) {
      const { data, error } = await (adminClient as any).from("territory_localities")
        .select("territory_id").eq("locality_id", locality.id).eq("status", "active");
      if (error) return fail("Unable to load MKH locality-to-territory links.", 500);
      territoryIds = Array.from(new Set((data ?? []).map((row: any) => String(row.territory_id))));
    }

    const [territoryRes, zonesRes, currentZoneRes] = await Promise.all([
      territoryIds.length
        ? adminClient.from("territories").select("id,name,lga_id,is_active")
            .in("id", territoryIds).eq("is_active", true).order("name")
        : Promise.resolve({ data: [], error: null } as any),
      territoryIds.length
        ? adminClient.from("zones").select("id,name,code,territory_id,is_active")
            .in("territory_id", territoryIds).eq("is_active", true).order("name")
        : Promise.resolve({ data: [], error: null } as any),
      assignments[0]
        ? adminClient.from("zones").select("id,name,code,territory_id,is_active")
            .eq("id", assignments[0].zone_id).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
    ]);
    if (territoryRes.error || zonesRes.error || currentZoneRes.error) {
      console.error("Vendor-zone options lookup failed:", territoryRes.error?.message, zonesRes.error?.message, currentZoneRes.error?.message);
      return fail("Unable to load MKH territory and zone options.", 500);
    }

    const territories = (territoryRes.data ?? []).filter((row: any) => String(row.lga_id) === String(locality?.lga_id));
    const currentZone = currentZoneRes.data;
    const territoryIdsToLabel = Array.from(new Set([
      ...territories.map((row: any) => String(row.id)),
      ...(currentZone?.territory_id ? [String(currentZone.territory_id)] : []),
    ]));
    const { data: allTerritories, error: labelsError } = territoryIdsToLabel.length
      ? await adminClient.from("territories").select("id,name").in("id", territoryIdsToLabel)
      : { data: [], error: null } as any;
    if (labelsError) return fail("Unable to load the current territory label.", 500);
    const territoryNames = new Map<string, string>((allTerritories ?? []).map((row: any) => [String(row.id), String(row.name)] as [string, string]));

    const lgaIds = Array.from(new Set([
      locality?.lga_id,
      ...territories.map((row: any) => row.lga_id),
    ].filter(Boolean)));
    const { data: lgas, error: lgaError } = lgaIds.length
      ? await adminClient.from("local_governments").select("id,name").in("id", lgaIds)
      : { data: [], error: null } as any;
    if (lgaError) return fail("Unable to load the MKH LGA labels.", 500);
    const lgaNames = new Map<string, string>((lgas ?? []).map((row: any) => [String(row.id), String(row.name)] as [string, string]));

    const currentAssignment = assignments[0] ? {
      id: String(assignments[0].id),
      zoneId: String(assignments[0].zone_id),
      zoneName: currentZone?.name ?? "",
      territoryId: currentZone?.territory_id ? String(currentZone.territory_id) : null,
      territoryName: currentZone?.territory_id ? territoryNames.get(String(currentZone.territory_id)) ?? "" : "",
      assignedAt: assignments[0].assigned_at ?? null,
    } : null;

    const localitySummary = location && locality ? {
      id: String(locality.id),
      name: String(locality.name),
      localityType: locality.locality_type ?? "",
      lgaId: locality.lga_id ? String(locality.lga_id) : null,
      lgaName: locality.lga_id ? lgaNames.get(String(locality.lga_id)) ?? "" : "",
      addressVerificationStatus: location.address_verification_status ?? null,
      localityMatchStatus: location.locality_match_status ?? null,
    } : null;

    let message = "";
    if (String(vendorRes.data.status ?? "").toLowerCase() !== "active") message = "Only active vendors can be assigned to a zone.";
    else if (!location) message = "This vendor has no Admin-verified business-location record.";
    else if (location.address_verification_status !== "verified" || location.locality_match_status !== "matched" || !location.locality_id) {
      message = "Complete Admin address verification and MKH locality matching before assigning a zone.";
    } else if (!locality || locality.is_active !== true) message = "The vendor's verified MKH locality is missing or inactive.";
    else if (!territories.length) message = "This locality has no active MKH territory-coverage link. Map it to the correct territory first.";
    else if (multipleActiveAssignments) message = "This vendor has multiple active zone assignments. Resolve those records before making a change.";

    return NextResponse.json({
      success: true,
      eligible: !message,
      message,
      locality: localitySummary,
      territories: territories.map((row: any) => ({
        id: String(row.id),
        name: String(row.name),
        lgaId: row.lga_id ? String(row.lga_id) : null,
        lgaName: row.lga_id ? lgaNames.get(String(row.lga_id)) ?? "" : "",
      })),
      zones: (zonesRes.data ?? []).map((row: any) => ({
        id: String(row.id),
        name: String(row.name),
        code: row.code ?? "",
        territoryId: String(row.territory_id),
      })),
      currentAssignment,
      multipleActiveAssignments,
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    console.error("Vendor-zone eligibility GET failed:", error instanceof Error ? error.message : "unknown error");
    return fail("Unable to load vendor zone-assignment eligibility.", 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireMkhAdmin();
  if (!auth.ok) return fail(auth.message, auth.status);

  let body: any;
  try { body = await request.json(); } catch { return fail("Invalid request body."); }

  const vendorId = typeof body?.vendorId === "string" ? body.vendorId.trim() : "";
  const zoneId = typeof body?.zoneId === "string" ? body.zoneId.trim() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!UUID.test(vendorId) || !UUID.test(zoneId)) return fail("Choose a valid vendor and MKH zone.");
  if (reason.length < 10 || reason.length > 500) return fail("Enter an assignment reason between 10 and 500 characters.");

  try {
    const { data, error } = await (adminClient as any).rpc("mkh_admin_assign_vendor_to_zone", {
      p_vendor_id: vendorId,
      p_zone_id: zoneId,
      p_assigned_by: auth.userId,
      p_change_reason: reason,
    });
    if (error) {
      console.error("Vendor-zone assignment rejected:", error.message);
      return fail(error.message || "The vendor zone assignment was rejected.", 422);
    }
    return NextResponse.json({
      success: true,
      result: data,
      message: data?.unchanged
        ? "This vendor is already assigned to that zone. No new assignment was created."
        : "Vendor zone assignment saved. Previous assignment history was retained and an audit record was written.",
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    console.error("Vendor-zone assignment POST failed:", error instanceof Error ? error.message : "unknown error");
    return fail("Unable to save the vendor's zone assignment.", 500);
  }
}
