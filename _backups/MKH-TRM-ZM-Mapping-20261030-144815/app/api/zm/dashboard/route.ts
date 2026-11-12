import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireOperationalEmployee } from "@/lib/server/operationalEmployeeContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ZM_ROLES = ["zm", "zonemanager", "zonalmanager"];

export async function GET() {
  const result = await requireOperationalEmployee(ZM_ROLES, "Zone Manager");
  if ("response" in result) return result.response;
  const { employee, profile } = result.context;

  const { data: assignments, error: assignmentError } = await adminClient
    .from("zonal_manager_zones")
    .select("zone_id, assigned_at, status, unassigned_at")
    .eq("employee_id", employee.id)
    .eq("status", "active")
    .is("unassigned_at", null)
    .order("assigned_at", { ascending: false });

  if (assignmentError) {
    console.error("ZM assignment lookup failed:", assignmentError.message);
    return NextResponse.json(
      { success: false, message: "Unable to load your current zone assignment." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!assignments?.length) {
    return NextResponse.json(
      { success: true, assigned: false, message: "No active zone is assigned to your ZM account." },
      { headers: { "Cache-Control": "no-store, private" } }
    );
  }

  if (assignments.length !== 1) {
    return NextResponse.json(
      { success: false, assigned: false, message: "Your account has multiple active zone assignments. Please contact Admin to resolve the assignment before using this dashboard." },
      { status: 409, headers: { "Cache-Control": "no-store" } }
    );
  }

  const zoneId = assignments[0].zone_id;
  const { data: zone, error: zoneError } = await adminClient
    .from("zones")
    .select("id, name, code, territory_id, is_active")
    .eq("id", zoneId)
    .maybeSingle();

  if (zoneError || !zone || zone.is_active !== true) {
    return NextResponse.json(
      { success: false, assigned: false, message: "Your assigned zone is missing or inactive." },
      { status: 409, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { data: territory, error: territoryError } = await adminClient
    .from("territories")
    .select("id, name")
    .eq("id", zone.territory_id)
    .maybeSingle();

  if (territoryError) {
    return NextResponse.json(
      { success: false, message: "Unable to load your territory details." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { data: vendorLinks, error: vendorLinksError } = await adminClient
    .from("zone_vendors")
    .select("vendor_id")
    .eq("zone_id", zone.id)
    .eq("status", "active")
    .is("unassigned_at", null);

  if (vendorLinksError) {
    console.error("ZM zone vendors lookup failed:", vendorLinksError.message);
    return NextResponse.json(
      { success: false, message: "Unable to load vendors in your zone." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const vendorIds = [...new Set((vendorLinks ?? []).map((row: any) => row.vendor_id).filter(Boolean))] as string[];
  const [{ data: vendors, error: vendorsError }, { data: trmAssignments, error: trmError }] = await Promise.all([
    vendorIds.length
      ? adminClient.from("vendors").select("id, name, status, location").in("id", vendorIds).order("name")
      : Promise.resolve({ data: [], error: null } as any),
    adminClient.from("mkh_trm_territory_assignments")
      .select("employee_id, assigned_at")
      .eq("territory_id", zone.territory_id)
      .eq("status", "active")
      .order("assigned_at", { ascending: false }),
  ]);

  if (vendorsError || trmError) {
    return NextResponse.json(
      { success: false, message: "Unable to load zone relationships." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const [{ data: orders, error: ordersError }, trmEmployeesResult] = await Promise.all([
    vendorIds.length
      ? adminClient.from("orders")
          .select("id, order_number, vendor_id, rider_id, status, created_at, delivered_at")
          .in("vendor_id", vendorIds)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [], error: null } as any),
    trmAssignments?.length
      ? adminClient.from("employees").select("id, first_name, last_name").eq("id", trmAssignments[0].employee_id).maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
  ]);

  if (ordersError) {
    console.error("ZM orders lookup failed:", ordersError.message);
    return NextResponse.json(
      { success: false, message: "Unable to load orders for your zone." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (trmEmployeesResult?.error) {
    console.error("ZM TRM lookup failed:", trmEmployeesResult.error.message);
    return NextResponse.json(
      { success: false, message: "Unable to resolve the TRM assigned to your territory." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const orderRows = orders ?? [];
  const riderIds = [...new Set(orderRows.map((order: any) => order.rider_id).filter(Boolean))] as string[];
  const { data: riders } = riderIds.length
    ? await adminClient.from("profiles").select("id, full_name").in("id", riderIds)
    : { data: [] as any[] };
  const riderNameById = new Map((riders ?? []).map((rider: any) => [rider.id, rider.full_name]));
  const vendorById = new Map((vendors ?? []).map((vendor: any) => [vendor.id, vendor]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const enrichedOrders = orderRows.map((order: any) => ({
    ...order,
    vendor_name: vendorById.get(order.vendor_id)?.name ?? "Vendor",
    rider_name: order.rider_id ? riderNameById.get(order.rider_id) ?? "Assigned rider" : null,
  }));

  const openStatuses = new Set(["pending", "accepted", "preparing", "ready_for_pickup", "assigned", "picked_up"]);
  const metrics = {
    activeVendors: (vendors ?? []).filter((vendor: any) => String(vendor.status ?? "").toLowerCase() === "active").length,
    openOrders: orderRows.filter((order: any) => openStatuses.has(String(order.status ?? "").toLowerCase())).length,
    waitingForPickup: orderRows.filter((order: any) => String(order.status ?? "").toLowerCase() === "ready_for_pickup").length,
    deliveredToday: orderRows.filter((order: any) => String(order.status ?? "").toLowerCase() === "delivered" && order.delivered_at && new Date(order.delivered_at).getTime() >= today.getTime()).length,
  };

  const trmEmployee = trmEmployeesResult?.data;
  return NextResponse.json(
    {
      success: true,
      assigned: true,
      manager: {
        name: [employee.first_name, employee.last_name].filter(Boolean).join(" ") || profile.full_name || "Zone Manager",
      },
      zone,
      territory,
      trm: trmEmployee ? { name: [trmEmployee.first_name, trmEmployee.last_name].filter(Boolean).join(" ") } : null,
      metrics,
      vendors: vendors ?? [],
      orders: enrichedOrders,
      refreshedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store, private" } }
  );
}
