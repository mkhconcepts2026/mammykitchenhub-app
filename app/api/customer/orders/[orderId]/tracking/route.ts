import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LIVE_GPS_SECONDS = 60;
const LAST_KNOWN_GPS_SECONDS = 15 * 60;

function fail(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status, headers: { "Cache-Control": "no-store, private" } }
  );
}

function validNigeriaCoordinates(latitude: unknown, longitude: unknown) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 4 &&
    lat <= 14.5 &&
    lng >= 2 &&
    lng <= 15.5
  );
}

function parseDurationSeconds(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d+(?:\.\d+)?)s$/.exec(value.trim());
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params;
    if (!UUID_PATTERN.test(orderId)) {
      return fail("Invalid order reference.", 400);
    }

    // Verify the customer's session before using the privileged read client.
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return fail("Please sign in to view this order.", 401);
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("CUSTOMER TRACKING PROFILE CHECK FAILED:", profileError.message);
      return fail("We could not verify your customer account.", 500);
    }

    if (
      !profile ||
      String(profile.role ?? "").toLowerCase() !== "customer" ||
      String(profile.status ?? "").toLowerCase() !== "active"
    ) {
      return fail("An active customer account is required.", 403);
    }

    // Ownership is part of the database query: another customer's order ID
    // can never be used to retrieve its rider's location.
    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select(
        "id, user_id, status, vendor_id, rider_id, delivery_quote_id, delivery_address, total, created_at, accepted_at, preparing_at, ready_at, picked_up_at, delivered_at, cancelled_at, order_number"
      )
      .eq("id", orderId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (orderError) {
      console.error("CUSTOMER TRACKING ORDER LOOKUP FAILED:", orderError.message);
      return fail("We could not load this order.", 500);
    }
    if (!order) return fail("Order not found.", 404);

    const [
      { data: vendor },
      { data: rider },
      { data: quote },
      { data: items, error: itemsError },
      { data: events, error: eventsError },
    ] = await Promise.all([
      order.vendor_id
        ? adminClient.from("vendors").select("name").eq("id", order.vendor_id).maybeSingle()
        : Promise.resolve({ data: null }),
      order.rider_id
        ? adminClient.from("profiles").select("full_name").eq("id", order.rider_id).maybeSingle()
        : Promise.resolve({ data: null }),
      order.delivery_quote_id
        ? adminClient
            .from("delivery_quotes")
            .select(
              "destination_latitude, destination_longitude, destination_google_formatted_address"
            )
            .eq("id", order.delivery_quote_id)
            .eq("customer_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      adminClient
        .from("order_items")
        .select("id, name, quantity, price")
        .eq("order_id", order.id),
      adminClient
        .from("order_events")
        .select("event_type, title, description, created_at, actor_type")
        .eq("order_id", order.id)
        .order("created_at", { ascending: true })
        .limit(30),
    ]);

    if (itemsError) {
      console.error("CUSTOMER TRACKING ITEMS LOOKUP FAILED:", itemsError.message);
      return fail("We could not load the items for this order.", 500);
    }
    if (eventsError) {
      console.error("CUSTOMER TRACKING EVENTS LOOKUP FAILED:", eventsError.message);
    }

    const destinationAvailable =
      quote &&
      validNigeriaCoordinates(quote.destination_latitude, quote.destination_longitude);

    const destination = destinationAvailable
      ? {
          latitude: Number(quote.destination_latitude),
          longitude: Number(quote.destination_longitude),
          address:
            quote.destination_google_formatted_address ||
            order.delivery_address ||
            "Your delivery address",
        }
      : null;

    let riderLocation: {
      latitude: number;
      longitude: number;
      updatedAt: string;
      ageSeconds: number;
      isLive: boolean;
    } | null = null;

    if (
      order.rider_id &&
      !["delivered", "completed", "cancelled"].includes(
        String(order.status ?? "").toLowerCase()
      )
    ) {
      const { data: location, error: locationError } = await adminClient
        .from("rider_locations")
        .select("latitude, longitude, updated_at")
        .eq("rider_id", order.rider_id)
        .maybeSingle();

      if (locationError) {
        console.error("CUSTOMER TRACKING RIDER LOCATION LOOKUP FAILED:", locationError.message);
      } else if (
        location &&
        validNigeriaCoordinates(location.latitude, location.longitude) &&
        location.updated_at
      ) {
        const ageSeconds = Math.max(
          0,
          Math.round((Date.now() - Date.parse(location.updated_at)) / 1000)
        );

        // A short-lived last-known marker may be shown as stale, but the map
        // and ETA are marked live only while the GPS save is within 60 seconds.
        if (Number.isFinite(ageSeconds) && ageSeconds <= LAST_KNOWN_GPS_SECONDS) {
          riderLocation = {
            latitude: Number(location.latitude),
            longitude: Number(location.longitude),
            updatedAt: location.updated_at,
            ageSeconds,
            isLive: ageSeconds <= LIVE_GPS_SECONDS,
          };
        }
      }
    }

    const status = String(order.status ?? "").toLowerCase();
    const canEstimateArrival =
      status === "picked_up" &&
      Boolean(destination) &&
      Boolean(riderLocation?.isLive);

    let route: {
      encodedPolyline: string;
      distanceMeters: number;
      durationSeconds: number;
      etaMinutes: number;
      estimatedArrivalAt: string;
      trafficAware: boolean;
    } | null = null;
    let routeMessage: string | null = null;

    const url = new URL(request.url);
    const includeRoute = url.searchParams.get("route") === "1";

    if (includeRoute && canEstimateArrival && riderLocation && destination) {
      const apiKey =
        process.env.GOOGLE_MAPS_ROUTES_API_KEY ||
        process.env.GOOGLE_MAPS_API_KEY;

      if (!apiKey) {
        routeMessage = "Live route estimates are not configured at the moment.";
      } else {
        try {
          const routeResponse = await fetch(
            "https://routes.googleapis.com/directions/v2:computeRoutes",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": apiKey,
                "X-Goog-FieldMask":
                  "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
              },
              cache: "no-store",
              body: JSON.stringify({
                origin: {
                  location: {
                    latLng: {
                      latitude: riderLocation.latitude,
                      longitude: riderLocation.longitude,
                    },
                  },
                },
                destination: {
                  location: {
                    latLng: {
                      latitude: destination.latitude,
                      longitude: destination.longitude,
                    },
                  },
                },
                travelMode: "DRIVE",
                routingPreference: "TRAFFIC_AWARE",
                computeAlternativeRoutes: false,
                polylineQuality: "OVERVIEW",
                languageCode: "en-NG",
                units: "METRIC",
              }),
            }
          );

          const routePayload = await routeResponse.json().catch(() => ({}));
          const firstRoute = Array.isArray(routePayload?.routes)
            ? routePayload.routes[0]
            : null;
          const durationSeconds = parseDurationSeconds(firstRoute?.duration);
          const distanceMeters = Number(firstRoute?.distanceMeters);
          const encodedPolyline = firstRoute?.polyline?.encodedPolyline;

          if (
            routeResponse.ok &&
            firstRoute &&
            durationSeconds !== null &&
            Number.isFinite(distanceMeters) &&
            distanceMeters > 0 &&
            typeof encodedPolyline === "string" &&
            encodedPolyline.length > 0
          ) {
            route = {
              encodedPolyline,
              distanceMeters,
              durationSeconds,
              etaMinutes: Math.max(1, Math.ceil(durationSeconds / 60)),
              estimatedArrivalAt: new Date(
                Date.now() + durationSeconds * 1000
              ).toISOString(),
              trafficAware: true,
            };
          } else {
            routeMessage = "Google Maps could not calculate a reliable arrival estimate yet.";
            console.warn("MKH CUSTOMER LIVE ROUTE UNAVAILABLE:", {
              httpStatus: routeResponse.status,
              hasRoute: Boolean(firstRoute),
            });
          }
        } catch (error) {
          routeMessage = "The live route estimate is temporarily unavailable.";
          console.error(
            "MKH CUSTOMER LIVE ROUTE REQUEST FAILED:",
            error instanceof Error ? error.message : "unknown error"
          );
        }
      }
    } else if (status === "picked_up" && !riderLocation?.isLive) {
      routeMessage = "Waiting for the rider's next fresh GPS update. The arrival estimate will appear when live location is available.";
    } else if (status === "picked_up" && !destination) {
      routeMessage = "A map destination was not saved for this order, so a reliable route estimate is unavailable.";
    } else if (status !== "picked_up") {
      routeMessage = "Live rider route and arrival estimate will appear after the order is picked up.";
    }

    return NextResponse.json(
      {
        success: true,
        order: {
          id: order.id,
          orderNumber: order.order_number,
          status: order.status,
          vendorName: vendor?.name ?? "MKH Vendor",
          riderName: rider?.full_name ?? null,
          deliveryAddress: order.delivery_address,
          total: order.total,
          createdAt: order.created_at,
          acceptedAt: order.accepted_at,
          preparingAt: order.preparing_at,
          readyAt: order.ready_at,
          pickedUpAt: order.picked_up_at,
          deliveredAt: order.delivered_at,
          cancelledAt: order.cancelled_at,
        },
        items: items ?? [],
        destination,
        riderLocation,
        route,
        routeMessage,
        events: events ?? [],
        gpsFreshnessSeconds: LIVE_GPS_SECONDS,
      },
      { headers: { "Cache-Control": "no-store, private" } }
    );
  } catch (error) {
    console.error(
      "CUSTOMER ORDER TRACKING ERROR:",
      error instanceof Error ? error.message : "unknown error"
    );
    return fail("An unexpected error occurred while loading this order.", 500);
  }
}
