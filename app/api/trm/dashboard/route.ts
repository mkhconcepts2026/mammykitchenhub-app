import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireOperationalEmployee } from "@/lib/server/operationalEmployeeContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRM_ROLES = [
  "trm",
  "territory",
  "territorymanager",
  "territoryrelationshipmanager",
];

const OPEN_ORDER_STATUSES = new Set([
  "pending",
  "accepted",
  "preparing",
  "ready_for_pickup",
  "assigned",
  "picked_up",
]);

function getLagosDayStartIso(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  // Lagos uses UTC+01:00. Build the local midnight explicitly so the
  // dashboard's "today" figures do not depend on the server's timezone.
  return `${value.year}-${value.month}-${value.day}T00:00:00+01:00`;
}

function employeeName(employee: { first_name: string | null; last_name: string | null }, fallback: string | null) {
  return [employee.first_name, employee.last_name].filter(Boolean).join(" ").trim() || fallback || "Territory Relationship Manager";
}

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });
}

export async function GET(request: Request) {
  const result = await requireOperationalEmployee(TRM_ROLES, "Territory Relationship Manager");
  if ("response" in result) return result.response;

  const { employee, profile } = result.context;
  const manager = { name: employeeName(employee, profile.full_name) };

  const { data: assignments, error: assignmentError } = await adminClient
    .from("mkh_trm_territory_assignments")
    .select("territory_id, assigned_at, status")
    .eq("employee_id", employee.id)
    .eq("status", "active")
    .order("assigned_at", { ascending: false })
    .limit(2);

  if (assignmentError) {
    console.error("TRM territory assignment lookup failed:", assignmentError.message);
    return response({ success: false, message: "Unable to load your territory assignment." }, 500);
  }

  if (!assignments?.length) {
    return response({
      success: true,
      assigned: false,
      manager,
      territory: null,
      metrics: {
        todayOrders: 0,
        todayRevenue: 0,
        activeRiders: 0,
        activeVendors: 0,
        openExceptions: 0,
        averageSLA: 0,
      },
      liveEvents: [],
      message: "No active territory is assigned to your TRM account. Please contact Admin.",
      refreshedAt: new Date().toISOString(),
    });
  }

  if (assignments.length !== 1) {
    return response({
      success: false,
      assigned: false,
      manager,
      message: "Your account has multiple active territory assignments. Please contact Admin to resolve them before using this dashboard.",
    }, 409);
  }

  const territoryId = assignments[0].territory_id;
  const { data: territory, error: territoryError } = await adminClient
    .from("territories")
    .select("id, name, is_active")
    .eq("id", territoryId)
    .maybeSingle();

  if (territoryError || !territory || territory.is_active !== true) {
    console.error("TRM territory lookup failed:", territoryError?.message ?? "Territory missing or inactive");
    return response({ success: false, assigned: false, manager, message: "Your assigned territory is missing or inactive. Please contact Admin." }, 409);
  }

  if (new URL(request.url).searchParams.get("view") === "identity") {
    return response({
      success: true,
      assigned: true,
      manager,
      territory: { id: territory.id, name: territory.name },
    });
  }

  // Resolve vendors only through active zones in this TRM's assigned territory.
  const { data: zones, error: zonesError } = await adminClient
    .from("zones")
    .select("id")
    .eq("territory_id", territory.id)
    .eq("is_active", true);

  if (zonesError) {
    console.error("TRM zone lookup failed:", zonesError.message);
    return response({ success: false, message: "Unable to load zones in your assigned territory." }, 500);
  }

  const zoneIds = [...new Set((zones ?? []).map((zone: any) => zone.id).filter(Boolean))] as string[];
  let vendorIds: string[] = [];

  if (zoneIds.length) {
    const { data: vendorLinks, error: vendorLinksError } = await adminClient
      .from("zone_vendors")
      .select("vendor_id")
      .in("zone_id", zoneIds)
      .eq("status", "active")
      .is("unassigned_at", null);

    if (vendorLinksError) {
      console.error("TRM territory-vendor mapping lookup failed:", vendorLinksError.message);
      return response({ success: false, message: "Unable to resolve vendors assigned within your territory." }, 500);
    }

    vendorIds = [...new Set((vendorLinks ?? []).map((row: any) => row.vendor_id).filter(Boolean))] as string[];
  }

  const { data: vendors, error: vendorsError } = vendorIds.length
    ? await adminClient
        .from("vendors")
        .select("id, name, status, location")
        .in("id", vendorIds)
        .eq("status", "active")
        .order("name")
    : { data: [] as any[], error: null };

  if (vendorsError) {
    console.error("TRM territory vendor lookup failed:", vendorsError.message);
    return response({ success: false, message: "Unable to load active vendors in your territory." }, 500);
  }

  const activeVendorIds = [...new Set((vendors ?? []).map((vendor: any) => vendor.id))] as string[];
  const dayStartIso = getLagosDayStartIso();

  const [
    recentOrdersResult,
    todayOrdersResult,
    deliveredTodayResult,
    vendorRidersResult,
    exceptionRowsResult,
  ] = await Promise.all([
    activeVendorIds.length
      ? adminClient
          .from("orders")
          .select("id, order_number, vendor_id, rider_id, status, total, created_at, accepted_at, delivered_at")
          .in("vendor_id", activeVendorIds)
          .order("created_at", { ascending: false })
          .limit(250)
      : Promise.resolve({ data: [], error: null } as any),
    activeVendorIds.length
      ? adminClient
          .from("orders")
          .select("id", { count: "exact", head: true })
          .in("vendor_id", activeVendorIds)
          .gte("created_at", dayStartIso)
      : Promise.resolve({ count: 0, error: null } as any),
    activeVendorIds.length
      ? adminClient
          .from("orders")
          .select("total, accepted_at, delivered_at")
          .in("vendor_id", activeVendorIds)
          .eq("status", "delivered")
          .gte("delivered_at", dayStartIso)
          .limit(1000)
      : Promise.resolve({ data: [], error: null } as any),
    activeVendorIds.length
      ? adminClient
          .from("vendor_riders")
          .select("rider_id")
          .in("vendor_id", activeVendorIds)
      : Promise.resolve({ data: [], error: null } as any),
    adminClient
      .from("exceptions")
      .select("*")
      .eq("status", "open")
      .limit(1000),
  ]);

  const dataError = recentOrdersResult.error || todayOrdersResult.error || deliveredTodayResult.error;
  if (dataError) {
    console.error("TRM territory metrics query failed:", dataError.message);
    return response({ success: false, message: "Unable to load operational figures for your territory." }, 500);
  }

  const recentOrders = (recentOrdersResult.data ?? []) as any[];
  const deliveredToday = (deliveredTodayResult.data ?? []) as any[];
  const recentOrderIds = [...new Set(recentOrders.map((order: any) => order.id).filter(Boolean))] as string[];

  const vendorRiderIds = [...new Set((vendorRidersResult.data ?? []).map((row: any) => row.rider_id).filter(Boolean))] as string[];
  const orderRiderIds = [...new Set(recentOrders.map((order: any) => order.rider_id).filter(Boolean))] as string[];
  const riderIds = [...new Set([...vendorRiderIds, ...orderRiderIds])];
  const { data: activeRiderProfiles, error: ridersError } = riderIds.length
    ? await adminClient
        .from("profiles")
        .select("id")
        .in("id", riderIds)
        .eq("role", "rider")
        .eq("status", "active")
    : { data: [] as any[], error: null };

  if (ridersError) {
    console.warn("TRM assigned-rider count could not be loaded:", ridersError.message);
  }

  const eventResult = recentOrderIds.length
    ? await adminClient
        .from("order_events")
        .select("id, order_id, event_type, title, description, actor_type, actor_id, created_at")
        .in("order_id", recentOrderIds)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: [], error: null } as any;

  if (eventResult.error) {
    console.warn("TRM territory event feed could not be loaded:", eventResult.error.message);
  }

  const vendorIdSet = new Set(activeVendorIds);
  const orderIdSet = new Set(recentOrderIds);
  const matchingExceptions = (exceptionRowsResult.data ?? []).filter((item: any) =>
    (item.vendor_id && vendorIdSet.has(item.vendor_id)) ||
    (item.order_id && orderIdSet.has(item.order_id)) ||
    item.territory_id === territory.id
  );

  // If the exceptions table has no territory-linked rows, keep the existing
  // operational attention indicator based on aged, still-open territory orders.
  const now = Date.now();
  const agedOpenOrders = recentOrders.filter((order: any) => {
    const status = String(order.status ?? "").toLowerCase();
    const createdAt = new Date(order.created_at).getTime();
    return OPEN_ORDER_STATUSES.has(status) && Number.isFinite(createdAt) && now - createdAt >= 30 * 60 * 1000;
  });

  const slaDurations = deliveredToday
    .map((order: any) => {
      const accepted = order.accepted_at ? new Date(order.accepted_at).getTime() : NaN;
      const delivered = order.delivered_at ? new Date(order.delivered_at).getTime() : NaN;
      return Number.isFinite(accepted) && Number.isFinite(delivered)
        ? (delivered - accepted) / 60000
        : null;
    })
    .filter((minutes: number | null): minutes is number => minutes !== null && minutes >= 0);
  const averageSLA = slaDurations.length
    ? Math.round(slaDurations.reduce((sum: number, minutes: number) => sum + minutes, 0) / slaDurations.length)
    : 0;

  const metrics = {
    todayOrders: Number(todayOrdersResult.count ?? 0),
    todayRevenue: deliveredToday.reduce((sum: number, order: any) => sum + Number(order.total ?? 0), 0),
    activeRiders: activeRiderProfiles?.length ?? 0,
    activeVendors: vendors?.length ?? 0,
    openExceptions: matchingExceptions.length || agedOpenOrders.length,
    averageSLA,
  };

  return response({
    success: true,
    assigned: true,
    manager,
    territory: { id: territory.id, name: territory.name },
    metrics,
    liveEvents: eventResult.data ?? [],
    recentOrders: recentOrders.slice(0, 10),
    refreshedAt: new Date().toISOString(),
  });
}
