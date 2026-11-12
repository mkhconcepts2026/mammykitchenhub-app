import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireOperationalEmployee } from "@/lib/server/operationalEmployeeContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRM_ROLES = ["trm", "territory", "territorymanager", "territoryrelationshipmanager"];
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

function nameOf(employee: any, fallback: string | null) {
  return [employee?.first_name, employee?.last_name].filter(Boolean).join(" ").trim() || fallback || "Territory Relationship Manager";
}

async function resolveTerritoryScope(employeeId: string) {
  const { data: assignments, error: assignmentError } = await adminClient
    .from("mkh_trm_territory_assignments")
    .select("territory_id, assigned_at, status")
    .eq("employee_id", employeeId)
    .eq("status", "active")
    .order("assigned_at", { ascending: false })
    .limit(2);

  if (assignmentError) throw new Error("Unable to load your territory assignment.");
  if (!assignments?.length) return { assigned: false as const };
  if (assignments.length !== 1) throw new Error("Your account has multiple active territory assignments. Please contact Admin.");

  const territoryId = assignments[0].territory_id;
  const { data: territory, error: territoryError } = await adminClient
    .from("territories")
    .select("id, name, is_active")
    .eq("id", territoryId)
    .maybeSingle();

  if (territoryError || !territory || territory.is_active !== true) {
    throw new Error("Your assigned territory is missing or inactive. Please contact Admin.");
  }

  const { data: zones, error: zonesError } = await adminClient
    .from("zones")
    .select("id, name")
    .eq("territory_id", territory.id)
    .eq("is_active", true);

  if (zonesError) throw new Error("Unable to load zones in your assigned territory.");
  const zoneIds = [...new Set((zones ?? []).map((row: any) => row.id).filter(Boolean))] as string[];

  let vendorIds: string[] = [];
  if (zoneIds.length) {
    const { data: vendorLinks, error: vendorLinksError } = await adminClient
      .from("zone_vendors")
      .select("vendor_id")
      .in("zone_id", zoneIds)
      .eq("status", "active")
      .is("unassigned_at", null);
    if (vendorLinksError) throw new Error("Unable to resolve vendors assigned within your territory.");
    const candidateVendorIds = [...new Set((vendorLinks ?? []).map((row: any) => row.vendor_id).filter(Boolean))] as string[];
    if (candidateVendorIds.length) {
      // Fail closed on duplicate active zone/vendor links. A vendor with more
      // than one current zone mapping is not exposed to either TRM until Admin
      // resolves the duplicate assignment.
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
      vendorIds = candidateVendorIds.filter((id) => {
        const links = linksByVendor.get(id) ?? [];
        return links.length === 1 && zoneIds.includes(links[0].zone_id);
      });
    }
  }

  const { data: vendors, error: vendorsError } = vendorIds.length
    ? await adminClient.from("vendors").select("id, name, cuisine, email, phone, owner_name, status, rating, location").in("id", vendorIds).order("name")
    : { data: [] as any[], error: null };
  if (vendorsError) throw new Error("Unable to load vendors assigned within your territory.");

  // Orders are constrained by vendor IDs resolved from this TRM's active
  // territory -> active zones -> active zone/vendor links. No client-supplied
  // territory, vendor or rider IDs are trusted.
  const { data: scopeOrders, error: scopeOrdersError } = vendorIds.length
    ? await adminClient.from("orders").select("id, vendor_id, rider_id, status, created_at, accepted_at, delivered_at, total, order_number").in("vendor_id", vendorIds).order("created_at", { ascending: false }).limit(1000)
    : { data: [] as any[], error: null };
  if (scopeOrdersError) throw new Error("Unable to resolve orders for your assigned territory.");

  let vendorRiderRows: any[] = [];
  if (vendorIds.length) {
    const { data, error } = await adminClient.from("vendor_riders").select("vendor_id, rider_id").in("vendor_id", vendorIds);
    if (error) throw new Error("Unable to resolve riders assigned to your territory vendors.");
    vendorRiderRows = data ?? [];
  }

  const riderIds = [...new Set([
    ...vendorRiderRows.map((row: any) => row.rider_id),
    ...(scopeOrders ?? []).map((row: any) => row.rider_id),
  ].filter(Boolean))] as string[];

  // Rider profiles may legitimately be linked to vendors in more than one
  // territory. Their global wallet is not territory-segregated, so expose a
  // wallet balance to this TRM only when every known vendor link for that rider
  // belongs to this territory. Riders with only an order link (and no vendor
  // assignment row) are treated as non-exclusive and their wallet is masked.
  let exclusiveRiderIds: string[] = [];
  if (riderIds.length) {
    const { data: allRiderVendorLinks, error: allRiderVendorLinksError } = await adminClient
      .from("vendor_riders")
      .select("vendor_id, rider_id")
      .in("rider_id", riderIds);
    if (allRiderVendorLinksError) throw new Error("Unable to validate rider territory boundaries.");

    const vendorIdsByRider = new Map<string, Set<string>>();
    for (const link of allRiderVendorLinks ?? []) {
      if (!link.rider_id || !link.vendor_id) continue;
      const linkedVendors = vendorIdsByRider.get(link.rider_id) ?? new Set<string>();
      linkedVendors.add(link.vendor_id);
      vendorIdsByRider.set(link.rider_id, linkedVendors);
    }
    exclusiveRiderIds = riderIds.filter((riderId) => {
      const linkedVendors = vendorIdsByRider.get(riderId);
      return Boolean(
        linkedVendors &&
        linkedVendors.size > 0 &&
        [...linkedVendors].every((vendorId) => vendorIds.includes(vendorId))
      );
    });
  }

  const { data: riders, error: ridersError } = riderIds.length
    ? await adminClient.from("profiles").select("id, full_name, email, phone, status, role").in("id", riderIds).eq("role", "rider").order("created_at", { ascending: false })
    : { data: [] as any[], error: null };
  if (ridersError) throw new Error("Unable to load riders assigned to your territory.");

  return {
    assigned: true as const,
    territory,
    zones: zones ?? [],
    zoneIds,
    vendorIds,
    vendors: vendors ?? [],
    scopeOrders: scopeOrders ?? [],
    riderIds: [...new Set((riders ?? []).map((rider: any) => rider.id))] as string[],
    exclusiveRiderIds,
    riders: riders ?? [],
  };
}

async function loadOrderRows(vendorIds: string[], limit = 500) {
  if (!vendorIds.length) return [];
  const { data, error } = await adminClient
    .from("orders")
    .select(`
      *,
      vendors (id, name, cuisine, location, status),
      rider:profiles!orders_rider_id_fkey (id, full_name, phone),
      riders:profiles!orders_rider_id_fkey (id, full_name, phone),
      profiles!orders_user_id_fkey (id, full_name, email, phone)
    `)
    .in("vendor_id", vendorIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Unable to load orders for your assigned territory.");
  return data ?? [];
}

async function loadScopedExceptions(territoryId: string, vendorIds: string[], orderIds: string[]) {
  // The exceptions table has evolved across MKH test builds. Read the open
  // exception rows server-side, then return only rows linked to this territory,
  // its resolved vendor IDs or its resolved order IDs. No global exception row
  // is returned to the browser.
  const { data, error } = await adminClient
    .from("exceptions")
    .select("*")
    .eq("status", "open")
    .limit(1000);
  if (error) throw new Error("Unable to load territory exceptions.");

  const vendorSet = new Set(vendorIds);
  const orderSet = new Set(orderIds);
  return (data ?? []).filter((row: any) =>
    row.territory_id === territoryId ||
    (row.vendor_id && vendorSet.has(row.vendor_id)) ||
    (row.order_id && orderSet.has(row.order_id))
  );
}

export async function GET(request: Request) {
  const access = await requireOperationalEmployee(TRM_ROLES, "Territory Relationship Manager");
  if ("response" in access) return access.response;

  const { employee, profile } = access.context;
  const manager = { name: nameOf(employee, profile.full_name) };
  const section = new URL(request.url).searchParams.get("section") || "overview";
  const supported = new Set(["identity", "overview", "orders", "live", "vendors", "riders", "map", "finance"]);
  if (!supported.has(section)) return json({ success: false, message: "Unknown TRM workspace section." }, 400);

  try {
    const scope = await resolveTerritoryScope(employee.id);
    if (!scope.assigned) {
      return json({
        success: true,
        assigned: false,
        manager,
        territory: null,
        message: "No active territory is assigned to your TRM account. Please contact Admin.",
        metrics: { todayOrders: 0, todayRevenue: 0, activeRiders: 0, activeVendors: 0, openExceptions: 0, averageSLA: null },
        orders: [], vendors: [], riders: [], locations: [], liveEvents: [],
      });
    }

    const { territory, vendorIds, vendors, riderIds, exclusiveRiderIds, riders, scopeOrders } = scope;
    const activeVendors = vendors.filter((vendor: any) => String(vendor.status ?? "").toLowerCase() === "active");
    const identity = { success: true, assigned: true, manager, territory: { id: territory.id, name: territory.name } };
    if (section === "identity") return json(identity);

    const dayStart = lagosDayStartIso();

    if (section === "overview") {
      const orderIds = scopeOrders.slice(0, 250).map((row: any) => row.id).filter(Boolean);
      const [todayOrdersResult, deliveredTodayResult, exceptions, eventResult] = await Promise.all([
        vendorIds.length
          ? adminClient.from("orders").select("id", { count: "exact", head: true }).in("vendor_id", vendorIds).gte("created_at", dayStart)
          : Promise.resolve({ count: 0, error: null } as any),
        vendorIds.length
          ? adminClient.from("orders").select("total, accepted_at, delivered_at").in("vendor_id", vendorIds).eq("status", "delivered").gte("delivered_at", dayStart).limit(1000)
          : Promise.resolve({ data: [], error: null } as any),
        loadScopedExceptions(territory.id, vendorIds, orderIds),
        orderIds.length
          ? adminClient.from("order_events").select("id, order_id, event_type, title, description, actor_type, actor_id, created_at").in("order_id", orderIds).order("created_at", { ascending: false }).limit(10)
          : Promise.resolve({ data: [], error: null } as any),
      ]);
      if (todayOrdersResult.error || deliveredTodayResult.error || eventResult.error) throw new Error("Unable to load territory executive metrics.");

      const delivered = deliveredTodayResult.data ?? [];
      const durations = delivered.map((row: any) => {
        const accepted = row.accepted_at ? new Date(row.accepted_at).getTime() : NaN;
        const deliveredAt = row.delivered_at ? new Date(row.delivered_at).getTime() : NaN;
        return Number.isFinite(accepted) && Number.isFinite(deliveredAt) && deliveredAt >= accepted ? (deliveredAt - accepted) / 60000 : null;
      }).filter((value: number | null): value is number => value !== null);
      const riderActiveCount = riders.filter((rider: any) => String(rider.status ?? "").toLowerCase() === "active").length;
      const agedOpenOrders = scopeOrders.filter((order: any) => ACTIVE_ORDER_STATUSES.includes(String(order.status ?? "").toLowerCase()) && Date.now() - new Date(order.created_at).getTime() >= 30 * 60 * 1000);

      return json({
        ...identity,
        metrics: {
          todayOrders: Number(todayOrdersResult.count ?? 0),
          todayRevenue: delivered.reduce((sum: number, row: any) => sum + Number(row.total ?? 0), 0),
          activeRiders: riderActiveCount,
          activeVendors: activeVendors.length,
          openExceptions: exceptions.length || agedOpenOrders.length,
          averageSLA: durations.length ? Math.round(durations.reduce((sum: number, value: number) => sum + value, 0) / durations.length) : null,
        },
        liveEvents: eventResult.data ?? [],
        refreshedAt: new Date().toISOString(),
      });
    }

    if (section === "orders") {
      const orderRows = await loadOrderRows(vendorIds, 500);
      return json({ ...identity, orders: orderRows, refreshedAt: new Date().toISOString() });
    }

    if (section === "live") {
      const orderRows = await loadOrderRows(vendorIds, 250);
      const orderIds = orderRows.map((row: any) => row.id).filter(Boolean);
      const eventResult = orderIds.length
        ? await adminClient.from("order_events").select("id, order_id, event_type, title, description, created_at").in("order_id", orderIds).order("created_at", { ascending: false }).limit(30)
        : { data: [], error: null } as any;
      if (eventResult.error) throw new Error("Unable to load the territory activity feed.");
      const ordersById = new Map(orderRows.map((row: any) => [row.id, row]));
      const territoryEvents = (eventResult.data ?? []).map((event: any) => {
        const order: any = ordersById.get(event.order_id);
        return {
          ...event,
          orders: order ? { order_number: order.order_number, vendors: { name: order.vendors?.name ?? "Vendor" } } : null,
        };
      });
      const activeDeliveries = orderRows.filter((row: any) => String(row.status).toLowerCase() === "picked_up").length;
      const readyOrders = orderRows.filter((row: any) => String(row.status).toLowerCase() === "ready_for_pickup").length;
      return json({
        ...identity,
        orders: orderRows,
        territoryEvents,
        snapshot: { ridersOnline: riders.filter((rider: any) => String(rider.status ?? "").toLowerCase() === "active").length, activeDeliveries, readyOrders, operationalHealth: "Healthy" },
        refreshedAt: new Date().toISOString(),
      });
    }

    if (section === "vendors") {
      const [{ data: walletRows, error: walletError }, { data: transactionRows, error: transactionError }] = await Promise.all([
        vendorIds.length ? adminClient.from("vendor_wallets").select("*").in("vendor_id", vendorIds) : Promise.resolve({ data: [], error: null } as any),
        vendorIds.length ? adminClient.from("vendor_transactions").select("*").in("vendor_id", vendorIds).order("created_at", { ascending: false }).limit(1000) : Promise.resolve({ data: [], error: null } as any),
      ]);
      if (walletError || transactionError) throw new Error("Unable to load territory vendor financial summaries.");
      const vendorRows = vendors.map((vendor: any) => {
        const wallet = (walletRows ?? []).find((row: any) => row.vendor_id === vendor.id);
        return {
          ...vendor,
          available_balance: Number(wallet?.available_balance ?? 0),
          pending_balance: Number(wallet?.accrued_balance ?? wallet?.pending_balance ?? 0),
          lifetime_earnings: Number(wallet?.lifetime_earnings ?? 0),
          transactions: (transactionRows ?? []).filter((row: any) => row.vendor_id === vendor.id),
        };
      });
      return json({ ...identity, vendors: vendorRows, pendingApplications: null, refreshedAt: new Date().toISOString() });
    }

    if (section === "riders" || section === "map") {
      const [{ data: walletRows, error: walletError }, { data: currentOrderRows, error: currentOrderError }] = await Promise.all([
        exclusiveRiderIds.length ? adminClient.from("rider_wallets").select("*").in("rider_id", exclusiveRiderIds) : Promise.resolve({ data: [], error: null } as any),
        vendorIds.length ? adminClient.from("orders").select("id, order_number, status, vendor_id, rider_id, total, created_at").in("vendor_id", vendorIds).in("status", ["assigned", "picked_up"]).not("rider_id", "is", null).limit(1000) : Promise.resolve({ data: [], error: null } as any),
      ]);
      if (walletError || currentOrderError) throw new Error("Unable to load territory rider information.");
      const currentOrders = currentOrderRows ?? [];
      // Shared riders are only location-tracked in this TRM view while they
      // are actively handling an order from this territory. Exclusive riders
      // may appear on the territory map based on their vendor assignment.
      const activeTerritoryOrderRiderIds = currentOrders.map((row: any) => row.rider_id).filter(Boolean) as string[];
      const trackableRiderIds = [...new Set([...exclusiveRiderIds, ...activeTerritoryOrderRiderIds])];
      const { data: locationRows, error: locationError } = trackableRiderIds.length
        ? await adminClient.from("rider_locations").select("id, rider_id, latitude, longitude, speed, heading, accuracy, updated_at, profiles:rider_id (full_name, status)").in("rider_id", trackableRiderIds).order("updated_at", { ascending: false }).limit(1000)
        : { data: [], error: null } as any;
      if (locationError) throw new Error("Unable to load territory rider locations.");
      const walletByRider = new Map((walletRows ?? []).map((row: any) => [row.rider_id, row]));
      const orderByRider = new Map<string, any>();
      for (const order of currentOrders) if (order.rider_id && !orderByRider.has(order.rider_id)) orderByRider.set(order.rider_id, order);
      const riderData = riders.map((rider: any) => {
        const wallet: any = walletByRider.get(rider.id);
        const currentOrder = orderByRider.get(rider.id) ?? null;
        const status = String(rider.status ?? "").toLowerCase();
        const operationalStatus = status !== "active" ? "offline" : currentOrder?.status === "assigned" ? "assigned" : currentOrder?.status === "picked_up" ? "delivering" : "available";
        const location = (locationRows ?? []).find((row: any) => row.rider_id === rider.id);
        return {
          ...rider,
          operational_status: operationalStatus,
          available_balance: wallet ? Number(wallet.available_balance ?? 0) : null,
          pending_balance: wallet ? Number(wallet.pending_balance ?? 0) : null,
          lifetime_earnings: wallet ? Number(wallet.lifetime_earnings ?? 0) : null,
          wallet_scope_limited: !exclusiveRiderIds.includes(rider.id),
          updated_at: location?.updated_at ?? null,
          current_order: currentOrder,
        };
      });
      if (section === "riders") return json({ ...identity, riders: riderData, refreshedAt: new Date().toISOString() });
      const locationData = (locationRows ?? []).map((location: any) => {
        const currentOrder = orderByRider.get(location.rider_id) ?? null;
        const rider = riders.find((row: any) => row.id === location.rider_id);
        const accountStatus = rider?.status ?? location.profiles?.status ?? null;
        const operationalStatus = String(accountStatus ?? "").toLowerCase() !== "active" ? "offline" : currentOrder?.status === "assigned" ? "assigned" : currentOrder?.status === "picked_up" ? "delivering" : "available";
        return {
          ...location,
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
          speed: Number(location.speed ?? 0),
          heading: Number(location.heading ?? 0),
          accuracy: Number(location.accuracy ?? 0),
          current_order: currentOrder,
          operational_status: operationalStatus,
        };
      });
      return json({ ...identity, riders: locationData, refreshedAt: new Date().toISOString() });
    }

    if (section === "finance") {
      const scopedOrderIds = [...new Set(scopeOrders.map((row: any) => row.id).filter(Boolean))] as string[];
      const queries: PromiseLike<any>[] = [];
      queries.push(vendorIds.length ? adminClient.from("vendor_wallets").select("*").in("vendor_id", vendorIds).order("updated_at", { ascending: false }) : Promise.resolve({ data: [], error: null }));
      // Rider wallets are account-wide, not territory-ledger balances. Only
      // include wallets for riders whose known vendor links are exclusively
      // inside this TRM's territory; shared riders are deliberately omitted.
      queries.push(exclusiveRiderIds.length ? adminClient.from("rider_wallets").select("*, profiles!rider_wallets_rider_id_fkey (id, full_name, status)").in("rider_id", exclusiveRiderIds).order("updated_at", { ascending: false }) : Promise.resolve({ data: [], error: null }));
      // Earnings are scoped by this territory's own orders, never by rider ID.
      queries.push(scopedOrderIds.length ? adminClient.from("rider_earnings").select("*, profiles!rider_earnings_rider_id_fkey (id, full_name, status)").in("order_id", scopedOrderIds).order("created_at", { ascending: false }).limit(1000) : Promise.resolve({ data: [], error: null }));
      const ledgerSelect = "*, vendors:vendor_id (id, name, status), profiles:rider_id (id, full_name, status)";
      if (vendorIds.length) queries.push(adminClient.from("financial_ledger").select(ledgerSelect).in("vendor_id", vendorIds).order("created_at", { ascending: false }).limit(1000));
      if (scopedOrderIds.length) queries.push(adminClient.from("financial_ledger").select(ledgerSelect).in("order_id", scopedOrderIds).order("created_at", { ascending: false }).limit(1000));
      queries.push(adminClient.from("financial_ledger").select(ledgerSelect).eq("territory_id", territory.id).order("created_at", { ascending: false }).limit(1000));
      const results = await Promise.all(queries);
      if (results.some((result: any) => result.error)) throw new Error("Unable to load territory financial records.");
      const [vendorWallets, riderWallets, riderEarnings, ...ledgerParts] = results.map((result: any) => result.data ?? []);
      const financialLedger = [...new Map(ledgerParts.flat().map((row: any) => [row.id, row])).values()];
      return json({
        ...identity,
        vendorWallets,
        riderWallets,
        riderEarnings,
        financialLedger,
        walletScopeLimitedRiderCount: riderIds.filter((id) => !exclusiveRiderIds.includes(id)).length,
        refreshedAt: new Date().toISOString(),
      });
    }

    return json({ success: false, message: "Unsupported workspace section." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load territory workspace.";
    const status = /multiple active territory assignments|missing or inactive|No active territory/i.test(message) ? 409 : 500;
    console.error("TRM workspace request failed:", message);
    return json({ success: false, message }, status);
  }
}
