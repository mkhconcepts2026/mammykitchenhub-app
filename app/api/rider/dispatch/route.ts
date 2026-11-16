import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, private" } });

async function requireActiveRider() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: json({ success: false, message: "Please sign in again." }, 401) };

  const { data: profile, error } = await adminClient
    .from("profiles")
    .select("id, role, status")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    console.error("Rider dispatch profile lookup failed:", error.message);
    return { error: json({ success: false, message: "Unable to verify your rider account." }, 500) };
  }
  if (!profile || String(profile.role ?? "").toLowerCase() !== "rider" ||
      String(profile.status ?? "").toLowerCase() !== "active") {
    return { error: json({ success: false, message: "An active rider account is required." }, 403) };
  }
  return { userId: user.id };
}

export async function GET() {
  const access = await requireActiveRider();
  if ("error" in access) return access.error;
  const riderId = access.userId;

  try {
    const { data: assignment, error: assignmentError } = await adminClient
      .from("rider_home_zone_assignments")
      .select("home_zone_id, status, availability_status")
      .eq("rider_id", riderId)
      .eq("status", "active")
      .is("unassigned_at", null)
      .maybeSingle();
    if (assignmentError) throw assignmentError;

    let homeZone: any = null;
    if (assignment?.home_zone_id) {
      const { data, error } = await adminClient
        .from("zones")
        .select("id, name, territory_id, territories:territory_id(id, name)")
        .eq("id", assignment.home_zone_id)
        .maybeSingle();
      if (error) throw error;
      homeZone = data;
    }

    const nowIso = new Date().toISOString();
    const { data: staleOffers, error: staleOffersError } = await adminClient
      .from("rider_dispatch_offers")
      .select("id")
      .eq("rider_id", riderId)
      .eq("offer_status", "offered")
      .lte("expires_at", nowIso);
    if (staleOffersError) throw staleOffersError;
    for (const stale of staleOffers ?? []) {
      const expired = await adminClient.rpc("mkh_rider_respond_to_dispatch_offer", {
        p_rider_id: riderId,
        p_offer_id: stale.id,
        p_action: "decline",
      });
      if (expired.error) {
        console.error("Expired rider pickup offer cleanup failed:", expired.error.message);
      }
    }

    const { data: offers, error: offersError } = await adminClient
      .from("rider_dispatch_offers")
      .select("id, order_id, vendor_id, home_zone_id, vendor_zone_id, dispatch_mode, distance_meters, offer_status, offered_at, expires_at, authorization_reason")
      .eq("rider_id", riderId)
      .eq("offer_status", "offered")
      .gt("expires_at", new Date().toISOString())
      .order("offered_at", { ascending: false });
    if (offersError) throw offersError;

    const orderIds = [...new Set((offers ?? []).map((row: any) => row.order_id).filter(Boolean))];
    const vendorIds = [...new Set((offers ?? []).map((row: any) => row.vendor_id).filter(Boolean))];
    const ordersResult = orderIds.length
      ? await adminClient.from("orders")
          .select("id, order_number, user_id, vendor_id, status, total, food_amount, delivery_fee, rider_amount, created_at, delivery_address, customer_phone, customer_notes, payment_method, payment_status")
          .in("id", orderIds)
      : { data: [], error: null };
    if (ordersResult.error) throw ordersResult.error;

    const orders = ordersResult.data ?? [];
    const customerIds = [...new Set(orders.map((row: any) => row.user_id).filter(Boolean))];
    const [vendorsResult, customersResult, itemsResult] = await Promise.all([
      vendorIds.length
        ? adminClient.from("vendors").select("id, name, location, phone").in("id", vendorIds)
        : Promise.resolve({ data: [], error: null } as any),
      customerIds.length
        ? adminClient.from("profiles").select("id, full_name, phone").in("id", customerIds)
        : Promise.resolve({ data: [], error: null } as any),
      orderIds.length
        ? adminClient.from("order_items").select("id, order_id, name, quantity, price").in("order_id", orderIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);
    if (vendorsResult.error || customersResult.error || itemsResult.error) {
      throw vendorsResult.error || customersResult.error || itemsResult.error;
    }

    const orderById = new Map(orders.map((row: any) => [row.id, row]));
    const vendorById = new Map((vendorsResult.data ?? []).map((row: any) => [row.id, row]));
    const customerById = new Map((customersResult.data ?? []).map((row: any) => [row.id, row]));
    const itemsByOrder = new Map<string, any[]>();
    for (const item of itemsResult.data ?? []) {
      itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) ?? []), item]);
    }

    const dispatchOffers = (offers ?? [])
      .map((offer: any) => {
        const order: any = orderById.get(offer.order_id);
        if (!order || order.status !== "ready_for_pickup" || order.rider_id) return null;
        return {
          id: offer.id,
          order_id: offer.order_id,
          dispatch_mode: offer.dispatch_mode,
          distance_meters: offer.distance_meters,
          offered_at: offer.offered_at,
          expires_at: offer.expires_at,
          authorization_reason: offer.authorization_reason,
          vendor_zone_id: offer.vendor_zone_id,
          home_zone_id: offer.home_zone_id,
          order: {
            ...order,
            vendor: vendorById.get(order.vendor_id) ?? null,
            customer: customerById.get(order.user_id) ?? null,
            order_items: itemsByOrder.get(order.id) ?? [],
          },
        };
      })
      .filter(Boolean);

    const { data: location, error: locationError } = await adminClient
      .from("rider_locations")
      .select("updated_at")
      .eq("rider_id", riderId)
      .maybeSingle();
    if (locationError) throw locationError;
    const gpsAge = location?.updated_at
      ? Math.max(0, Math.floor((Date.now() - Date.parse(location.updated_at)) / 1000))
      : null;

    return json({
      success: true,
      homeZone: homeZone ? {
        id: homeZone.id,
        name: homeZone.name,
        territory_id: homeZone.territory_id,
        territory_name: homeZone.territories?.name ?? null,
      } : null,
      availabilityStatus: assignment?.availability_status ?? null,
      gpsStatus: gpsAge !== null && gpsAge <= 60 ? "live" : "stale",
      gpsAgeSeconds: gpsAge,
      offers: dispatchOffers,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Rider dispatch inbox failed:", error);
    return json({ success: false, message: "Unable to load your pickup offers. Please refresh." }, 500);
  }
}

export async function POST(request: Request) {
  const access = await requireActiveRider();
  if ("error" in access) return access.error;
  const riderId = access.userId;

  let body: any;
  try { body = await request.json(); }
  catch { return json({ success: false, message: "A valid rider action is required." }, 400); }

  const action = String(body?.action ?? "");
  try {
    if (action === "availability") {
      const status = String(body?.status ?? "");
      if (status !== "available" && status !== "unavailable") {
        return json({ success: false, message: "Select Available or Unavailable." }, 400);
      }
      if (status === "available") {
        const { data: staleOffers, error: staleError } = await adminClient
          .from("rider_dispatch_offers")
          .select("id")
          .eq("rider_id", riderId)
          .eq("offer_status", "offered")
          .lte("expires_at", new Date().toISOString());
        if (staleError) throw staleError;
        for (const stale of staleOffers ?? []) {
          const expired = await adminClient.rpc("mkh_rider_respond_to_dispatch_offer", {
            p_rider_id: riderId,
            p_offer_id: stale.id,
            p_action: "decline",
          });
          if (expired.error) console.error("Expired offer cleanup before Available failed:", expired.error.message);
        }
      }
      const { data, error } = await adminClient.rpc("mkh_rider_set_dispatch_availability", {
        p_rider_id: riderId,
        p_availability_status: status,
      });
      if (error) return json({ success: false, message: error.message }, 409);
      if (data?.success === false) return json({ success: false, message: data.message || "Availability could not be updated." }, 409);
      let createdOffers = 0;
      if (status === "available") {
        const refresh = await adminClient.rpc("mkh_refresh_rider_dispatch_queue", { p_rider_id: riderId });
        if (refresh.error) {
          console.error("Rider dispatch queue refresh failed:", refresh.error.message);
        } else {
          createdOffers = Number(refresh.data ?? 0);
        }
      }
      return json({ success: true, result: data, createdOffers });
    }

    if (action === "respond") {
      const offerId = String(body?.offerId ?? "");
      const response = String(body?.response ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(offerId) || !["accept", "decline"].includes(response)) {
        return json({ success: false, message: "A valid pickup offer and response are required." }, 400);
      }
      const { data, error } = await adminClient.rpc("mkh_rider_respond_to_dispatch_offer", {
        p_rider_id: riderId,
        p_offer_id: offerId,
        p_action: response,
      });
      if (error) return json({ success: false, message: error.message }, 409);
      if (data?.success === false) return json({ success: false, message: data.message || "This pickup offer is no longer available." }, 409);
      return json({ success: true, result: data });
    }

    if (action === "refresh") {
      const { data, error } = await adminClient.rpc("mkh_refresh_rider_dispatch_queue", { p_rider_id: riderId });
      if (error) return json({ success: false, message: error.message }, 409);
      return json({ success: true, createdOffers: Number(data ?? 0) });
    }

    return json({ success: false, message: "Unknown rider dispatch action." }, 400);
  } catch (error) {
    console.error("Rider dispatch action failed:", error);
    return json({ success: false, message: "Unable to complete the rider dispatch action." }, 500);
  }
}
