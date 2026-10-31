import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireOperationalEmployee } from "@/lib/server/operationalEmployeeContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VHA_ROLES = ["vha", "vendorhubagent"];
const ACTIVE_ORDER_STATUSES = ["pending", "accepted", "preparing", "ready_for_pickup", "assigned", "picked_up"];

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

export async function GET() {
  const result = await requireOperationalEmployee(VHA_ROLES, "Vendor Hub Agent");
  if ("response" in result) return result.response;
  const { employee, profile } = result.context;

  const { data: assignments, error: assignmentError } = await adminClient
    .from("vendor_hub_agent_assignments")
    .select("vendor_id, assigned_at, status, deactivated_at")
    .eq("employee_id", employee.id)
    .eq("status", "active")
    .is("deactivated_at", null)
    .order("assigned_at", { ascending: false })
    .limit(2);

  if (assignmentError) {
    console.error("VHA assignment lookup failed:", assignmentError.message);
    return json({ success: false, message: "Unable to load your current vendor assignment." }, 500);
  }
  if (!assignments?.length) {
    return json({ success: true, assigned: false, message: "No active vendor is assigned to your VHA account." });
  }
  if (assignments.length !== 1) {
    return json({ success: false, assigned: false, message: "Your account has multiple active vendor assignments. Please contact Admin to resolve them." }, 409);
  }

  const { data: vendor, error: vendorError } = await adminClient
    .from("vendors")
    .select("id, name, status, location, owner_name, cuisine, rating")
    .eq("id", assignments[0].vendor_id)
    .maybeSingle();
  if (vendorError || !vendor || String(vendor.status ?? "").toLowerCase() !== "active") {
    return json({ success: false, assigned: false, message: "Your assigned vendor is missing or inactive." }, 409);
  }

  const dayStart = lagosDayStartIso();
  const [ordersResult, todayCountResult, activeCountResult, pendingCountResult, preparingCountResult, readyCountResult, pickedUpCountResult, deliveredCountResult, menuResult, vendorRiderLinksResult] = await Promise.all([
    adminClient.from("orders")
      .select("id, order_number, status, created_at, delivered_at, rider_id, order_items!order_items_order_id_fkey (id, name, quantity)")
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false })
      .limit(200),
    adminClient.from("orders").select("id", { count: "exact", head: true }).eq("vendor_id", vendor.id).gte("created_at", dayStart),
    adminClient.from("orders").select("id", { count: "exact", head: true }).eq("vendor_id", vendor.id).in("status", ACTIVE_ORDER_STATUSES),
    adminClient.from("orders").select("id", { count: "exact", head: true }).eq("vendor_id", vendor.id).eq("status", "pending"),
    adminClient.from("orders").select("id", { count: "exact", head: true }).eq("vendor_id", vendor.id).eq("status", "preparing"),
    adminClient.from("orders").select("id", { count: "exact", head: true }).eq("vendor_id", vendor.id).eq("status", "ready_for_pickup"),
    adminClient.from("orders").select("id", { count: "exact", head: true }).eq("vendor_id", vendor.id).eq("status", "picked_up"),
    adminClient.from("orders").select("id", { count: "exact", head: true }).eq("vendor_id", vendor.id).eq("status", "delivered").gte("delivered_at", dayStart),
    adminClient.from("menu_items").select("id, name, price, available").eq("vendor_id", vendor.id).order("name").limit(500),
    adminClient.from("vendor_riders").select("rider_id").eq("vendor_id", vendor.id),
  ]);

  const coreErrors = [ordersResult.error, todayCountResult.error, activeCountResult.error, pendingCountResult.error, preparingCountResult.error, readyCountResult.error, pickedUpCountResult.error, deliveredCountResult.error];
  if (coreErrors.some(Boolean)) {
    console.error("VHA order metrics failed:", coreErrors.filter(Boolean).map((item: any) => item.message));
    return json({ success: false, message: "Unable to load accurate order intelligence for your assigned vendor." }, 500);
  }
  if (menuResult.error) {
    console.error("VHA menu availability lookup failed:", menuResult.error.message);
    return json({ success: false, message: "Unable to load menu availability for your assigned vendor." }, 500);
  }
  if (vendorRiderLinksResult.error) {
    console.error("VHA rider assignment lookup failed:", vendorRiderLinksResult.error.message);
    return json({ success: false, message: "Unable to load rider coverage for your assigned vendor." }, 500);
  }

  const orderRows = (ordersResult.data ?? []) as any[];
  const riderIds = [...new Set([
    ...orderRows.filter((order: any) => ACTIVE_ORDER_STATUSES.includes(String(order.status ?? "").toLowerCase())).map((order: any) => order.rider_id),
    ...(vendorRiderLinksResult.data ?? []).map((row: any) => row.rider_id),
  ].filter(Boolean))] as string[];
  const { data: riderProfiles, error: riderProfilesError } = riderIds.length
    ? await adminClient.from("profiles").select("id, full_name, phone, status").in("id", riderIds).eq("role", "rider")
    : { data: [] as any[], error: null };
  if (riderProfilesError) {
    console.error("VHA rider profile lookup failed:", riderProfilesError.message);
    return json({ success: false, message: "Unable to resolve rider names for your vendor." }, 500);
  }

  const riderById = new Map<string, any>((riderProfiles ?? []).map((rider: any) => [rider.id, rider]));
  const activeStatuses = new Set(ACTIVE_ORDER_STATUSES);
  const ordersByRider = new Map<string, any>();
  for (const order of orderRows) {
    if (order.rider_id && activeStatuses.has(String(order.status ?? "").toLowerCase()) && !ordersByRider.has(order.rider_id)) {
      ordersByRider.set(order.rider_id, order);
    }
  }
  const assignedRiders = riderIds.map((id) => {
    const rider = riderById.get(id);
    if (!rider) return null;
    const currentOrder = ordersByRider.get(id) ?? null;
    return {
      id: rider.id,
      name: rider.full_name || "Assigned rider",
      phone: rider.phone,
      status: String(rider.status ?? "").toLowerCase() === "active" ? "active" : "inactive",
      operationalStatus: currentOrder?.status === "picked_up" ? "delivering" : currentOrder ? "assigned" : "available",
      currentOrder: currentOrder ? { orderNumber: currentOrder.order_number, status: currentOrder.status } : null,
    };
  }).filter(Boolean);

  const menuItems = (menuResult.data ?? []).map((item: any) => ({
    id: item.id,
    name: item.name,
    price: Number(item.price ?? 0),
    available: item.available === true,
  }));

  const managerName = [employee.first_name, employee.last_name].filter(Boolean).join(" ").trim() || profile.full_name || "Vendor Hub Agent";

  return json({
    success: true,
    assigned: true,
    agent: { name: managerName },
    vendor,
    metrics: {
      ordersToday: Number(todayCountResult.count ?? 0),
      activeOrders: Number(activeCountResult.count ?? 0),
      awaitingAcceptance: Number(pendingCountResult.count ?? 0),
      preparing: Number(preparingCountResult.count ?? 0),
      readyForPickup: Number(readyCountResult.count ?? 0),
      pickedUp: Number(pickedUpCountResult.count ?? 0),
      completedToday: Number(deliveredCountResult.count ?? 0),
      assignedRiders: assignedRiders.length,
      menuItems: menuItems.length,
      availableMenuItems: menuItems.filter((item: any) => item.available).length,
      unavailableMenuItems: menuItems.filter((item: any) => !item.available).length,
    },
    menuItems,
    assignedRiders,
    orders: orderRows.map((order: any) => ({
      ...order,
      rider_name: order.rider_id ? riderById.get(order.rider_id)?.full_name ?? "Assigned rider" : null,
    })),
    reportSampleSize: orderRows.length,
    refreshedAt: new Date().toISOString(),
  });
}
