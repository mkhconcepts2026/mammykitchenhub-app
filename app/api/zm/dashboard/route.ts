import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireOperationalEmployee } from "@/lib/server/operationalEmployeeContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ZM_ROLES = ["zm", "zonemanager", "zonalmanager"];
const OPEN_ORDER_STATUSES = ["pending", "accepted", "preparing", "ready_for_pickup", "assigned", "picked_up"];

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });
}

function lagosDayStartIso() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T00:00:00+01:00`;
}

function fullName(row: any, fallback: string) {
  return [row?.first_name, row?.last_name].filter(Boolean).join(" ").trim() || row?.full_name || fallback;
}

export async function GET() {
  const result = await requireOperationalEmployee(ZM_ROLES, "Zone Manager");
  if ("response" in result) return result.response;
  const { employee, profile } = result.context;

  // The signed-in employee, not a client-supplied ID, determines the zone scope.
  const { data: assignments, error: assignmentError } = await adminClient
    .from("zonal_manager_zones")
    .select("zone_id, assigned_at, status, unassigned_at")
    .eq("employee_id", employee.id)
    .eq("status", "active")
    .is("unassigned_at", null)
    .order("assigned_at", { ascending: false })
    .limit(2);

  if (assignmentError) {
    console.error("ZM assignment lookup failed:", assignmentError.message);
    return json({ success: false, message: "Unable to load your current zone assignment." }, 500);
  }
  if (!assignments?.length) {
    return json({ success: true, assigned: false, message: "No active zone is assigned to your ZM account." });
  }
  if (assignments.length !== 1) {
    return json({ success: false, assigned: false, message: "Your account has multiple active zone assignments. Please contact Admin to resolve them." }, 409);
  }

  const { data: zone, error: zoneError } = await adminClient
    .from("zones")
    .select("id, name, code, territory_id, is_active")
    .eq("id", assignments[0].zone_id)
    .maybeSingle();
  if (zoneError || !zone || zone.is_active !== true) {
    return json({ success: false, assigned: false, message: "Your assigned zone is missing or inactive." }, 409);
  }

  const { data: territory, error: territoryError } = await adminClient
    .from("territories")
    .select("id, name, is_active")
    .eq("id", zone.territory_id)
    .maybeSingle();
  if (territoryError || !territory || territory.is_active === false) {
    return json({ success: false, message: "Unable to verify the parent territory for your zone." }, 409);
  }

  const { data: vendorLinks, error: vendorLinksError } = await adminClient
    .from("zone_vendors")
    .select("vendor_id")
    .eq("zone_id", zone.id)
    .eq("status", "active")
    .is("unassigned_at", null);
  if (vendorLinksError) {
    console.error("ZM zone vendors lookup failed:", vendorLinksError.message);
    return json({ success: false, message: "Unable to load vendors in your zone." }, 500);
  }

  const candidateVendorIds = [...new Set((vendorLinks ?? []).map((row: any) => row.vendor_id).filter(Boolean))] as string[];
  // Fail closed when a vendor has more than one current zone assignment.
  // A duplicate mapping must be resolved by Admin before either ZM gets access.
  const { data: allCurrentVendorLinks, error: allCurrentVendorLinksError } = candidateVendorIds.length
    ? await adminClient.from("zone_vendors").select("vendor_id, zone_id").in("vendor_id", candidateVendorIds).eq("status", "active").is("unassigned_at", null)
    : { data: [], error: null } as any;
  if (allCurrentVendorLinksError) {
    console.error("ZM unique vendor mapping validation failed:", allCurrentVendorLinksError.message);
    return json({ success: false, message: "Unable to verify unique vendor-zone assignments." }, 500);
  }
  const linksByVendor = new Map<string, any[]>();
  for (const link of allCurrentVendorLinks ?? []) {
    const rows = linksByVendor.get(link.vendor_id) ?? [];
    rows.push(link);
    linksByVendor.set(link.vendor_id, rows);
  }
  const conflictedVendorCount = candidateVendorIds.filter((id) => (linksByVendor.get(id) ?? []).length !== 1).length;
  const vendorIds = candidateVendorIds.filter((id) => {
    const rows = linksByVendor.get(id) ?? [];
    return rows.length === 1 && rows[0].zone_id === zone.id;
  });

  const [vendorsResult, trmAssignmentsResult] = await Promise.all([
    vendorIds.length
      ? adminClient.from("vendors").select("id, name, status, location, cuisine, rating").in("id", vendorIds).order("name")
      : Promise.resolve({ data: [], error: null } as any),
    adminClient.from("mkh_trm_territory_assignments")
      .select("employee_id, assigned_at")
      .eq("territory_id", zone.territory_id)
      .eq("status", "active")
      .order("assigned_at", { ascending: false })
      .limit(2),
  ]);
  if (vendorsResult.error || trmAssignmentsResult.error) {
    console.error("ZM relationships lookup failed:", vendorsResult.error?.message, trmAssignmentsResult.error?.message);
    return json({ success: false, message: "Unable to load your zone relationships." }, 500);
  }
  if ((trmAssignmentsResult.data ?? []).length > 1) {
    return json({ success: false, message: "Multiple active TRM assignments were found for this territory. Please ask Admin to resolve the duplicate mapping." }, 409);
  }

  const vendors = (vendorsResult.data ?? []) as any[];
  const dayStart = lagosDayStartIso();

  const [ordersResult, activeTerritoryOrdersResult, totalCountResult, todayCountResult, openCountResult, pickupCountResult, deliveredCountResult, vendorRidersResult, trmEmployeeResult] = await Promise.all([
    vendorIds.length
      ? adminClient.from("orders")
          .select("id, order_number, vendor_id, rider_id, status, created_at, accepted_at, delivered_at")
          .in("vendor_id", vendorIds)
          .order("created_at", { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [], error: null } as any),
    vendorIds.length
      ? adminClient.from("orders").select("id, order_number, vendor_id, rider_id, status, created_at").in("vendor_id", vendorIds).in("status", OPEN_ORDER_STATUSES).not("rider_id", "is", null).order("created_at", { ascending: false }).limit(1000)
      : Promise.resolve({ data: [], error: null } as any),
    vendorIds.length
      ? adminClient.from("orders").select("id", { count: "exact", head: true }).in("vendor_id", vendorIds)
      : Promise.resolve({ count: 0, error: null } as any),
    vendorIds.length
      ? adminClient.from("orders").select("id", { count: "exact", head: true }).in("vendor_id", vendorIds).gte("created_at", dayStart)
      : Promise.resolve({ count: 0, error: null } as any),
    vendorIds.length
      ? adminClient.from("orders").select("id", { count: "exact", head: true }).in("vendor_id", vendorIds).in("status", OPEN_ORDER_STATUSES)
      : Promise.resolve({ count: 0, error: null } as any),
    vendorIds.length
      ? adminClient.from("orders").select("id", { count: "exact", head: true }).in("vendor_id", vendorIds).eq("status", "ready_for_pickup")
      : Promise.resolve({ count: 0, error: null } as any),
    vendorIds.length
      ? adminClient.from("orders").select("id", { count: "exact", head: true }).in("vendor_id", vendorIds).eq("status", "delivered").gte("delivered_at", dayStart)
      : Promise.resolve({ count: 0, error: null } as any),
    vendorIds.length
      ? adminClient.from("vendor_riders").select("vendor_id, rider_id").in("vendor_id", vendorIds)
      : Promise.resolve({ data: [], error: null } as any),
    (trmAssignmentsResult.data ?? []).length
      ? adminClient.from("employees").select("id, first_name, last_name").eq("id", trmAssignmentsResult.data![0].employee_id).maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
  ]);

  const requiredErrors = [ordersResult.error, activeTerritoryOrdersResult.error, totalCountResult.error, todayCountResult.error, openCountResult.error, pickupCountResult.error, deliveredCountResult.error];
  if (requiredErrors.some(Boolean)) {
    console.error("ZM order metrics failed:", requiredErrors.filter(Boolean).map((item: any) => item.message));
    return json({ success: false, message: "Unable to load accurate order figures for your zone." }, 500);
  }
  if (vendorRidersResult.error) {
    console.error("ZM vendor rider links failed:", vendorRidersResult.error.message);
    return json({ success: false, message: "Unable to load rider coverage for your zone." }, 500);
  }
  if (trmEmployeeResult.error) {
    return json({ success: false, message: "Unable to resolve the TRM assigned to your territory." }, 500);
  }

  const vendorRiderLinks = vendorRidersResult.data ?? [];
  const orderRows = (ordersResult.data ?? []) as any[];
  const activeTerritoryOrders = (activeTerritoryOrdersResult.data ?? []) as any[];
  const assignedRiderIds = [...new Set([
    ...vendorRiderLinks.map((row: any) => row.rider_id),
    ...activeTerritoryOrders.map((row: any) => row.rider_id),
  ].filter(Boolean))] as string[];

  // A rider may serve vendors in several zones. Do not expose a shared rider's
  // location unless that rider is currently handling an order in this zone.
  const [riderProfilesResult, allRiderVendorLinksResult] = await Promise.all([
    assignedRiderIds.length
      ? adminClient.from("profiles").select("id, full_name, phone, status, role").in("id", assignedRiderIds).eq("role", "rider")
      : Promise.resolve({ data: [], error: null } as any),
    assignedRiderIds.length
      ? adminClient.from("vendor_riders").select("vendor_id, rider_id").in("rider_id", assignedRiderIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);
  if (allRiderVendorLinksResult.error) {
    console.error("ZM rider territory validation failed:", allRiderVendorLinksResult.error.message);
    return json({ success: false, message: "Unable to verify rider territory boundaries." }, 500);
  }
  const allVendorIdsByRider = new Map<string, Set<string>>();
  for (const link of allRiderVendorLinksResult.data ?? []) {
    if (!link.rider_id || !link.vendor_id) continue;
    const ids = allVendorIdsByRider.get(link.rider_id) ?? new Set<string>();
    ids.add(link.vendor_id);
    allVendorIdsByRider.set(link.rider_id, ids);
  }
  const exclusiveRiderIds = assignedRiderIds.filter((id) => {
    const linkedIds = allVendorIdsByRider.get(id);
    return Boolean(linkedIds && linkedIds.size > 0 && [...linkedIds].every((vendorId) => vendorIds.includes(vendorId)));
  });
  const currentZoneOrderRiderIds = [...new Set(activeTerritoryOrders.map((row: any) => row.rider_id).filter(Boolean))] as string[];
  const trackableRiderIds = [...new Set([...exclusiveRiderIds, ...currentZoneOrderRiderIds])];
  const riderLocationsResult = trackableRiderIds.length
    ? await adminClient.from("rider_locations").select("rider_id, latitude, longitude, accuracy, speed, heading, updated_at").in("rider_id", trackableRiderIds).order("updated_at", { ascending: false })
    : { data: [], error: null } as any;
  if (riderProfilesResult.error || riderLocationsResult.error) {
    console.error("ZM rider intelligence failed:", riderProfilesResult.error?.message, riderLocationsResult.error?.message);
    return json({ success: false, message: "Unable to load rider coverage and location information for your zone." }, 500);
  }

  const vendorById = new Map(vendors.map((vendor: any) => [vendor.id, vendor]));
  const riderById = new Map<string, any>((riderProfilesResult.data ?? []).map((rider: any) => [rider.id, rider]));
  const latestLocationByRider = new Map<string, any>();
  for (const location of riderLocationsResult.data ?? []) {
    if (!latestLocationByRider.has(location.rider_id)) latestLocationByRider.set(location.rider_id, location);
  }
  const vendorNamesByRider = new Map<string, Set<string>>();
  for (const link of vendorRiderLinks) {
    const name = vendorById.get(link.vendor_id)?.name;
    if (!link.rider_id || !name) continue;
    const names = vendorNamesByRider.get(link.rider_id) ?? new Set<string>();
    names.add(name);
    vendorNamesByRider.set(link.rider_id, names);
  }
  const activeOrdersByRider = new Map<string, any>();
  for (const order of activeTerritoryOrders) {
    if (!order.rider_id || !OPEN_ORDER_STATUSES.includes(String(order.status ?? "").toLowerCase())) continue;
    if (!activeOrdersByRider.has(order.rider_id)) activeOrdersByRider.set(order.rider_id, order);
  }
  const now = Date.now();
  const riders = assignedRiderIds.map((id) => {
    const rider = riderById.get(id);
    if (!rider) return null;
    const location = latestLocationByRider.get(id) ?? null;
    const ageMinutes = location?.updated_at ? Math.max(0, Math.round((now - new Date(location.updated_at).getTime()) / 60000)) : null;
    const currentOrder = activeOrdersByRider.get(id) ?? null;
    const accountActive = String(rider.status ?? "").toLowerCase() === "active";
    const operationalStatus = !accountActive ? "inactive" : currentOrder?.status === "picked_up" ? "delivering" : currentOrder ? "assigned" : "available";
    return {
      id: rider.id,
      name: rider.full_name || "Rider",
      phone: rider.phone,
      status: rider.status,
      operationalStatus,
      vendorNames: [...(vendorNamesByRider.get(id) ?? new Set<string>())],
      currentOrder: currentOrder ? { id: currentOrder.id, order_number: currentOrder.order_number, status: currentOrder.status } : null,
      location: location ? {
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        accuracy: Number(location.accuracy ?? 0),
        speed: Number(location.speed ?? 0),
        heading: Number(location.heading ?? 0),
        updatedAt: location.updated_at,
        ageMinutes,
        fresh: ageMinutes !== null && ageMinutes <= 5,
      } : null,
    };
  }).filter(Boolean);

  const vendorOrderCounts = new Map<string, number>();
  for (const order of orderRows) vendorOrderCounts.set(order.vendor_id, (vendorOrderCounts.get(order.vendor_id) ?? 0) + 1);
  const enrichedOrders = orderRows.map((order: any) => ({
    ...order,
    vendor_name: vendorById.get(order.vendor_id)?.name ?? "Vendor",
    rider_name: order.rider_id ? riderById.get(order.rider_id)?.full_name ?? "Assigned rider" : null,
  }));

  const recentOpenOrders = orderRows.filter((order: any) => OPEN_ORDER_STATUSES.includes(String(order.status ?? "").toLowerCase()));
  const agedOrders = recentOpenOrders.filter((order: any) => {
    const createdAt = new Date(order.created_at).getTime();
    return Number.isFinite(createdAt) && now - createdAt >= 30 * 60 * 1000;
  });
  const deliveredWithSla = orderRows.filter((order: any) => {
    if (String(order.status ?? "").toLowerCase() !== "delivered" || !order.accepted_at || !order.delivered_at) return false;
    const minutes = (new Date(order.delivered_at).getTime() - new Date(order.accepted_at).getTime()) / 60000;
    return Number.isFinite(minutes) && minutes >= 0;
  });
  const averageSlaMinutes = deliveredWithSla.length
    ? Math.round(deliveredWithSla.reduce((sum: number, order: any) => sum + (new Date(order.delivered_at).getTime() - new Date(order.accepted_at).getTime()) / 60000, 0) / deliveredWithSla.length)
    : null;

  const trmEmployee = trmEmployeeResult.data;
  const managerName = fullName(employee, profile.full_name || "Zone Manager");
  return json({
    success: true,
    assigned: true,
    manager: { name: managerName },
    zone,
    territory: { id: territory.id, name: territory.name },
    trm: trmEmployee ? { name: fullName(trmEmployee, "Territory Relationship Manager") } : null,
    metrics: {
      totalOrders: Number(totalCountResult.count ?? 0),
      activeVendors: vendors.filter((vendor: any) => String(vendor.status ?? "").toLowerCase() === "active").length,
      assignedRiders: riders.length,
      activeRiders: riders.filter((rider: any) => String(rider.status ?? "").toLowerCase() === "active").length,
      gpsFresh: riders.filter((rider: any) => rider.location?.fresh).length,
      todayOrders: Number(todayCountResult.count ?? 0),
      openOrders: Number(openCountResult.count ?? 0),
      waitingForPickup: Number(pickupCountResult.count ?? 0),
      deliveredToday: Number(deliveredCountResult.count ?? 0),
      potentialDelays: agedOrders.length,
      averageSlaMinutes,
      unresolvedVendorZoneMappings: conflictedVendorCount,
    },
    vendors: vendors.map((vendor: any) => ({ ...vendor, recentOrderCount: vendorOrderCounts.get(vendor.id) ?? 0 })),
    riders,
    orders: enrichedOrders,
    reportSampleSize: orderRows.length,
    refreshedAt: new Date().toISOString(),
  });
}
