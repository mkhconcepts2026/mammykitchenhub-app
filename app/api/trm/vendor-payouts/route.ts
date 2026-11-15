import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireOperationalEmployee } from "@/lib/server/operationalEmployeeContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRM_ROLES = ["trm", "territory", "territorymanager", "territoryrelationshipmanager"];

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function resolveTrmVendorScope(employeeId: string) {
  const { data: assignments, error: assignmentError } = await adminClient
    .from("mkh_trm_territory_assignments")
    .select("territory_id, assigned_at, status")
    .eq("employee_id", employeeId)
    .eq("status", "active")
    .order("assigned_at", { ascending: false })
    .limit(2);

  if (assignmentError) throw new Error("Unable to load your active territory assignment.");
  if (!assignments?.length) return { assigned: false as const, vendorIds: [] as string[] };
  if (assignments.length !== 1) throw new Error("Your account has multiple active territory assignments. Please contact Admin.");

  const { data: territory, error: territoryError } = await adminClient
    .from("territories")
    .select("id, is_active")
    .eq("id", assignments[0].territory_id)
    .maybeSingle();

  if (territoryError || !territory || territory.is_active !== true) {
    throw new Error("Your assigned territory is missing or inactive. Please contact Admin.");
  }

  const { data: zones, error: zonesError } = await adminClient
    .from("zones")
    .select("id")
    .eq("territory_id", territory.id)
    .eq("is_active", true);
  if (zonesError) throw new Error("Unable to load active zones in your territory.");

  const zoneIds = [...new Set((zones ?? []).map((row: any) => row.id).filter(Boolean))] as string[];
  if (!zoneIds.length) return { assigned: true as const, vendorIds: [] as string[] };

  const { data: vendorLinks, error: vendorLinksError } = await adminClient
    .from("zone_vendors")
    .select("vendor_id")
    .in("zone_id", zoneIds)
    .eq("status", "active")
    .is("unassigned_at", null);
  if (vendorLinksError) throw new Error("Unable to resolve vendors assigned within your territory.");

  const candidateVendorIds = [...new Set((vendorLinks ?? []).map((row: any) => row.vendor_id).filter(Boolean))] as string[];
  if (!candidateVendorIds.length) return { assigned: true as const, vendorIds: [] as string[] };

  // Fail closed if a vendor has more than one active zone mapping.
  const { data: allActiveLinks, error: allActiveLinksError } = await adminClient
    .from("zone_vendors")
    .select("vendor_id, zone_id")
    .in("vendor_id", candidateVendorIds)
    .eq("status", "active")
    .is("unassigned_at", null);
  if (allActiveLinksError) throw new Error("Unable to validate unique vendor territory assignments.");

  const linksByVendor = new Map<string, any[]>();
  for (const link of allActiveLinks ?? []) {
    const existing = linksByVendor.get(link.vendor_id) ?? [];
    existing.push(link);
    linksByVendor.set(link.vendor_id, existing);
  }

  const vendorIds = candidateVendorIds.filter((id) => {
    const links = linksByVendor.get(id) ?? [];
    return links.length === 1 && zoneIds.includes(links[0].zone_id);
  });

  return { assigned: true as const, vendorIds };
}

export async function GET() {
  const access = await requireOperationalEmployee(TRM_ROLES, "Territory Relationship Manager");
  if ("response" in access) return access.response;

  try {
    const { employee } = access.context;
    const scope = await resolveTrmVendorScope(employee.id);
    if (!scope.assigned) return json({ success: true, assigned: false, payouts: [] });
    if (!scope.vendorIds.length) return json({ success: true, assigned: true, payouts: [] });

    const { data: requests, error: requestsError } = await adminClient
      .from("payout_requests")
      .select("id, requester_id, requester_type, amount, status, requested_at, approved_by, processed_at, status_updated_at, transfer_reference")
      .eq("requester_type", "vendor")
      .in("requester_id", scope.vendorIds)
      .order("requested_at", { ascending: false })
      .limit(300);

    if (requestsError) throw new Error("Unable to load vendor payout requests for your territory.");

    const vendorIds = [...new Set((requests ?? []).map((row: any) => row.requester_id).filter(Boolean))] as string[];
    const { data: vendors, error: vendorsError } = vendorIds.length
      ? await adminClient.from("vendors").select("id, name, owner_name").in("id", vendorIds)
      : { data: [] as any[], error: null };
    if (vendorsError) throw new Error("Unable to resolve vendor names for payout requests.");

    const vendorsById = new Map<string, any>((vendors ?? []).map((row: any) => [String(row.id), row] as [string, any]));
    const payouts = (requests ?? []).map((row: any) => ({
      ...row,
      vendor_name: vendorsById.get(row.requester_id)?.name || vendorsById.get(row.requester_id)?.owner_name || "Vendor",
    }));

    return json({ success: true, assigned: true, payouts, refreshedAt: new Date().toISOString() });
  } catch (error) {
    console.error("TRM vendor payout queue load failed:", error);
    return json({ success: false, message: error instanceof Error ? error.message : "Unable to load vendor payout requests." }, 500);
  }
}

export async function POST(request: NextRequest) {
  const access = await requireOperationalEmployee(TRM_ROLES, "Territory Relationship Manager");
  if ("response" in access) return access.response;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "Request body must be valid JSON." }, 400);
  }

  const payoutRequestId = body?.payout_request_id;
  if (!isUuid(payoutRequestId)) {
    return json({ success: false, message: "A valid payout request ID is required." }, 400);
  }

  try {
    const { employee, profile } = access.context;
    const scope = await resolveTrmVendorScope(employee.id);
    if (!scope.assigned || !scope.vendorIds.length) {
      return json({ success: false, message: "An active territory assignment with assigned vendors is required." }, 403);
    }

    const { data: payout, error: payoutError } = await adminClient
      .from("payout_requests")
      .select("id, requester_id, requester_type, amount, status")
      .eq("id", payoutRequestId)
      .maybeSingle();

    if (payoutError) throw new Error("Unable to load the selected payout request.");
    if (!payout || String(payout.requester_type ?? "").toLowerCase() !== "vendor") {
      return json({ success: false, message: "Vendor payout request was not found." }, 404);
    }
    if (!scope.vendorIds.includes(payout.requester_id)) {
      return json({ success: false, message: "This payout request is outside your assigned territory." }, 403);
    }
    if (String(payout.status ?? "").toLowerCase() !== "pending") {
      return json({ success: false, message: "Only submitted vendor payout requests can be approved. Refresh the queue for the latest status." }, 409);
    }

    // A single conditional update makes approval race-safe. It only changes
    // the workflow status and approver metadata; no wallet or ledger is touched.
    const { data: updated, error: updateError } = await adminClient
      .from("payout_requests")
      .update({
        status: "approved",
        approved_by: profile.id,
        status_updated_at: new Date().toISOString(),
      })
      .eq("id", payoutRequestId)
      .eq("requester_id", payout.requester_id)
      .eq("requester_type", "vendor")
      .eq("status", "pending")
      .select("id, requester_id, amount, status, approved_by, status_updated_at")
      .maybeSingle();

    if (updateError) throw new Error("Unable to approve this vendor payout request.");
    if (!updated) return json({ success: false, message: "This payout request has already changed. Refresh the queue before taking another action." }, 409);

    return json({
      success: true,
      message: "Vendor payout approved by TRM and moved to Finance for processing. No wallet balances were changed and no transfer was initiated.",
      payout: updated,
    });
  } catch (error) {
    console.error("TRM vendor payout approval failed:", error);
    return json({ success: false, message: error instanceof Error ? error.message : "Vendor payout approval failed." }, 500);
  }
}