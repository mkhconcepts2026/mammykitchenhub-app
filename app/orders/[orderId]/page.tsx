"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import CustomerOrderTrackingMap from "@/components/customer/CustomerOrderTrackingMap";
import { ArrowLeft, CheckCircle2, Clock3, MapPin, PackageCheck, RefreshCw, Truck } from "lucide-react";

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  price: number | string;
};

type Point = {
  latitude: number;
  longitude: number;
};

type TrackingData = {
  success: true;
  order: {
    id: string;
    orderNumber: string | null;
    status: string;
    vendorName: string;
    riderName: string | null;
    deliveryAddress: string | null;
    total: number | string;
    createdAt: string;
    acceptedAt: string | null;
    preparingAt: string | null;
    readyAt: string | null;
    pickedUpAt: string | null;
    deliveredAt: string | null;
    cancelledAt: string | null;
  };
  items: OrderItem[];
  destination: (Point & { address: string }) | null;
  riderLocation: (Point & {
    updatedAt: string;
    ageSeconds: number;
    isLive: boolean;
  }) | null;
  route: {
    encodedPolyline: string;
    distanceMeters: number;
    durationSeconds: number;
    etaMinutes: number;
    estimatedArrivalAt: string;
    trafficAware: boolean;
  } | null;
  routeMessage: string | null;
  events: Array<{
    event_type: string;
    title: string | null;
    description: string | null;
    created_at: string;
    actor_type: string | null;
  }>;
  gpsFreshnessSeconds: number;
};

type ApiError = { success: false; message: string };

const STAGES = [
  { key: "pending", label: "Order placed", icon: CheckCircle2 },
  { key: "accepted", label: "Accepted", icon: CheckCircle2 },
  { key: "preparing", label: "Preparing", icon: PackageCheck },
  { key: "ready_for_pickup", label: "Ready for pickup", icon: PackageCheck },
  { key: "picked_up", label: "Picked up", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
] as const;

const STATUS_STAGE: Record<string, number> = {
  pending: 0,
  accepted: 1,
  preparing: 2,
  ready_for_pickup: 3,
  assigned: 3,
  picked_up: 4,
  delivered: 5,
  completed: 5,
};

function formatNaira(value: number | string | null | undefined) {
  return `₦${Number(value ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pending";
  return date.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function humanStatus(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function distanceMeters(a: Point, b: Point) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

export default function CustomerOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const trackingRef = useRef<TrackingData | null>(null);
  const lastRouteAt = useRef(0);
  const lastRouteOrigin = useRef<Point | null>(null);

  const loadTracking = useCallback(async (forceRoute = false) => {
    if (!orderId || inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);

    try {
      const response = await fetch(
        `/api/customer/orders/${encodeURIComponent(orderId)}/tracking?route=${forceRoute ? "1" : "0"}`,
        { cache: "no-store", headers: { Accept: "application/json" } }
      );
      const result = (await response.json().catch(() => null)) as TrackingData | ApiError | null;

      if (!response.ok || !result || result.success !== true) {
        throw new Error(
          result && "message" in result
            ? result.message
            : "We could not load this order. Please try again."
        );
      }

      let next = result as TrackingData;
      const previous = trackingRef.current;

      if (forceRoute) {
        lastRouteAt.current = Date.now();
        lastRouteOrigin.current = next.riderLocation
          ? {
              latitude: next.riderLocation.latitude,
              longitude: next.riderLocation.longitude,
            }
          : null;
      } else {
        const isEligibleForEta =
          next.order.status.toLowerCase() === "picked_up" &&
          Boolean(next.riderLocation?.isLive) &&
          Boolean(next.destination);

        if (isEligibleForEta && next.riderLocation) {
          const currentOrigin = {
            latitude: next.riderLocation.latitude,
            longitude: next.riderLocation.longitude,
          };
          const movedMeters = lastRouteOrigin.current
            ? distanceMeters(lastRouteOrigin.current, currentOrigin)
            : Number.POSITIVE_INFINITY;
          const routeAge = Date.now() - lastRouteAt.current;
          const refreshRoute =
            !previous?.route ||
            !lastRouteOrigin.current ||
            movedMeters >= 80 ||
            routeAge >= 45000;

          if (refreshRoute) {
            const routeResponse = await fetch(
              `/api/customer/orders/${encodeURIComponent(orderId)}/tracking?route=1`,
              { cache: "no-store", headers: { Accept: "application/json" } }
            );
            const routeResult = (await routeResponse.json().catch(() => null)) as TrackingData | ApiError | null;
            if (routeResponse.ok && routeResult && routeResult.success === true) {
              next = routeResult as TrackingData;
              lastRouteAt.current = Date.now();
              lastRouteOrigin.current = next.riderLocation
                ? {
                    latitude: next.riderLocation.latitude,
                    longitude: next.riderLocation.longitude,
                  }
                : null;
            }
          } else if (previous?.route) {
            next = {
              ...next,
              route: previous.route,
              routeMessage: previous.routeMessage,
            };
          }
        } else {
          next = { ...next, route: null };
          lastRouteAt.current = 0;
          lastRouteOrigin.current = null;
        }
      }

      trackingRef.current = next;
      setTracking(next);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "We could not load this order. Please try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
      inFlight.current = false;
    }
  }, [orderId]);

  useEffect(() => {
    void loadTracking(true);
    const interval = window.setInterval(() => {
      void loadTracking(false);
    }, 15000);

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadTracking(false);
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadTracking]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <span className="mx-auto mb-3 block h-8 w-8 animate-spin rounded-full border-4 border-orange-100 border-t-orange-500" />
          <p className="font-semibold text-gray-800">Loading your order…</p>
        </div>
      </main>
    );
  }

  if (!tracking) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">Order unavailable</h1>
          <p className="mt-2 text-sm text-gray-600">{error || "This order could not be found."}</p>
          <Link href="/orders" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-3 font-semibold text-white">
            <ArrowLeft className="h-4 w-4" /> Back to My Orders
          </Link>
        </div>
      </main>
    );
  }

  const order = tracking.order;
  const status = order.status.toLowerCase();
  const isDelivered = status === "delivered" || status === "completed";
  const isCancelled = status === "cancelled";
  const stageIndex = STATUS_STAGE[status] ?? 0;
  const route = tracking.route;
  const isLive = Boolean(tracking.riderLocation?.isLive);
  const canShowMap = Boolean(tracking.destination);
  const onTheWay = status === "picked_up";

  let deliveryMessage = "Your order has been received by the vendor.";
  if (status === "accepted") deliveryMessage = "The vendor has accepted your order.";
  if (status === "preparing") deliveryMessage = "The vendor is preparing your order.";
  if (status === "ready_for_pickup") deliveryMessage = "Your order is ready and waiting for rider pickup.";
  if (status === "assigned") deliveryMessage = "A rider has been assigned to your order.";
  if (onTheWay && route) deliveryMessage = "Your rider is on the way to your delivery address.";
  if (onTheWay && !isLive) deliveryMessage = "Your order has been picked up. Waiting for the rider's next fresh GPS update.";
  if (isDelivered) deliveryMessage = "Your order was successfully delivered.";
  if (isCancelled) deliveryMessage = "This order was cancelled.";

  return (
    <main className="min-h-screen bg-gray-50 pb-12">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/orders" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-orange-600">
            <ArrowLeft className="h-4 w-4" /> Back to My Orders
          </Link>
          <button
            type="button"
            onClick={() => void loadTracking(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh tracking
          </button>
        </div>

        <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
          <div className="bg-[#17191c] px-5 py-6 text-white sm:px-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className={`inline-flex rounded-md px-3 py-1 text-xs font-semibold ${isDelivered ? "bg-emerald-500/20 text-emerald-300" : isCancelled ? "bg-red-500/20 text-red-300" : "bg-teal-500/20 text-teal-300"}`}>
                  {isDelivered ? "Delivered" : isCancelled ? "Cancelled" : onTheWay ? "On the way" : humanStatus(status)}
                </span>
                <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">
                  {route && onTheWay ? `${route.etaMinutes} minute${route.etaMinutes === 1 ? "" : "s"} left` : onTheWay ? "Delivery in progress" : isDelivered ? "Order delivered" : "Order tracking"}
                </h1>
                <p className="mt-2 text-sm text-gray-300">{deliveryMessage}</p>
              </div>
              {route && onTheWay && (
                <div className="min-w-28 rounded-2xl bg-white/10 px-4 py-3 text-center">
                  <p className="text-xs text-gray-300">Estimated arrival</p>
                  <p className="mt-1 text-xl font-bold">
                    {new Date(route.estimatedArrivalAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              )}
            </div>
            {onTheWay && route && (
              <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/15">
                <div className="h-full w-2/3 rounded-full bg-teal-400" />
              </div>
            )}
          </div>

          <div className="space-y-6 p-4 sm:p-7">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Order</p>
                <p className="mt-1 break-all font-bold text-gray-900">{order.orderNumber || order.id}</p>
                <p className="mt-1 text-sm text-gray-500">{order.vendorName}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rider</p>
                <p className="mt-1 font-bold text-gray-900">{order.riderName || (isDelivered ? "Delivery completed" : "Not assigned yet")}</p>
                {tracking.riderLocation && (
                  <p className="mt-1 text-xs text-gray-500">
                    {isLive ? `GPS updated ${tracking.riderLocation.ageSeconds}s ago` : `Last location ${Math.floor(tracking.riderLocation.ageSeconds / 60)} min ago`}
                  </p>
                )}
              </div>
            </div>

            {isDelivered ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
                  <div>
                    <h2 className="font-bold text-emerald-900">Successful delivery</h2>
                    <p className="mt-1 text-sm text-emerald-800">Delivered {formatDateTime(order.deliveredAt)}. This order is now in your History.</p>
                  </div>
                </div>
              </div>
            ) : isCancelled ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
                This order was cancelled on {formatDateTime(order.cancelledAt)}. It is not counted as a successful delivery.
              </div>
            ) : (
              <>
                <section>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-bold text-gray-900">Live delivery map</h2>
                    {onTheWay && (
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isLive ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                        {isLive ? "Live GPS" : "Waiting for fresh GPS"}
                      </span>
                    )}
                  </div>

                  {canShowMap && tracking.destination ? (
                    <>
                      <CustomerOrderTrackingMap
                        destination={tracking.destination}
                        riderLocation={tracking.riderLocation}
                        encodedPolyline={route?.encodedPolyline ?? null}
                      />
                      <div className="mt-3 flex items-start gap-2 text-sm text-gray-600">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                        <span>{tracking.destination.address || order.deliveryAddress || "Confirmed delivery address"}</span>
                      </div>
                      {onTheWay && !route && (
                        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                          {tracking.routeMessage || "The arrival estimate will appear when Google Maps can calculate a route from a fresh rider location."}
                        </p>
                      )}
                      {route && (
                        <p className="mt-3 text-xs text-gray-500">
                          Google Maps traffic-aware road estimate · {(route.distanceMeters / 1000).toFixed(1)} km · refreshed with rider GPS
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
                      A verified map pin was not saved with this order. Your delivery address is: {order.deliveryAddress || "Not available"}. The order status will continue to update, but a reliable live map and ETA cannot be shown for this order.
                    </div>
                  )}
                </section>
              </>
            )}

            <section>
              <h2 className="mb-4 text-lg font-bold text-gray-900">Order progress</h2>
              <ol className="space-y-3">
                {STAGES.map((stage, index) => {
                  const done = index <= stageIndex && !isCancelled;
                  const timestamp = {
                    pending: order.createdAt,
                    accepted: order.acceptedAt,
                    preparing: order.preparingAt,
                    ready_for_pickup: order.readyAt,
                    picked_up: order.pickedUpAt,
                    delivered: order.deliveredAt,
                  }[stage.key];
                  const Icon = stage.icon;

                  return (
                    <li key={stage.key} className="flex items-start gap-3">
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${done ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1 border-b border-gray-100 pb-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className={`text-sm font-semibold ${done ? "text-gray-900" : "text-gray-400"}`}>{stage.label}</span>
                          <span className="text-xs text-gray-500">{timestamp ? formatDateTime(timestamp) : done ? "Completed" : "Pending"}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="border-t border-gray-100 pt-5">
              <div className="mb-3 flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-orange-500" />
                <h2 className="font-bold text-gray-900">Items ordered</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {tracking.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-4 py-3 text-sm">
                    <span className="text-gray-700">{item.quantity} × {item.name}</span>
                    <span className="shrink-0 font-semibold text-gray-900">{formatNaira(item.price)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between border-t border-gray-100 pt-4">
                <span className="font-semibold text-gray-600">Order total</span>
                <span className="text-lg font-extrabold text-gray-900">{formatNaira(order.total)}</span>
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-5">
              <p className="inline-flex items-center gap-2 text-xs text-gray-500">
                <Clock3 className="h-4 w-4" /> Tracking refreshes automatically every 15 seconds while this page is open.
              </p>
              <Link href="/orders" className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700">
                View all orders
              </Link>
            </div>
            {error && (
              <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                Latest refresh: {error}. We'll try again automatically.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
