"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import RiderWalletSummary from "@/components/rider/RiderWalletSummary";
import RiderPayoutCentre from "@/components/rider/RiderPayoutCentre";

import {
  Bike,
  Wallet,
  Clock,
  LogOut,
  Bell,
  Store,
  MapPin,
} from "lucide-react";

type RiderPage =
  | "active"
  | "earnings";

function getGoogleMapsUrl(address: string | null | undefined, vendorLocation?: string) {
  const parts = [address?.trim(), vendorLocation?.trim(), "Lagos, Nigeria"]
    .filter((part): part is string => Boolean(part));
  const uniqueParts = [...new Set(parts)];
  const query = uniqueParts.join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

type Order = {
  id: string;
  status: string;
  total: number;
  food_amount: number;
  delivery_fee: number;
  platform_fee: number;
  vendor_amount: number;
  rider_amount: number;
  mkh_amount: number;
  created_at: string;
  vendor_id: string;
  rider_id: string | null;
  delivery_address: string | null;
  customer_notes?: string | null;
  delivery_otp?: string | null;
  otp_verified?: boolean;
  dispatch_offer_id?: string;
  dispatch_distance_meters?: number | null;
  dispatch_expires_at?: string;

  vendors?: {
    name: string;
    location: string;
  };

  profiles?: {
    full_name: string;
    email: string;
    phone: string | null;
  } | null;

  order_items?: {
    id: string;
    name: string;
    quantity: number;
    price: number;
  }[];
};

export default function RiderDashboardPage() {
  const [riderFirstName, setRiderFirstName] = useState("Rider");

  useEffect(() => {
    let cancelled = false;

    const loadRiderFirstName = async () => {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) return;

        const { data: riderProfile, error: profileError } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", authData.user.id)
          .maybeSingle();

        const profileName = !profileError && typeof riderProfile?.full_name === "string"
          ? riderProfile.full_name
          : "";
        const metadataName = typeof authData.user.user_metadata?.full_name === "string"
          ? authData.user.user_metadata.full_name
          : typeof authData.user.user_metadata?.name === "string"
            ? authData.user.user_metadata.name
            : "";
        const fullName = (profileName || metadataName).trim();
        const firstName = fullName.split(/\s+/)[0];

        if (!cancelled && firstName) {
          setRiderFirstName(firstName);
        }
      } catch (error) {
        console.error("RIDER GREETING LOAD ERROR:", error);
      }
    };

    void loadRiderFirstName();
    return () => {
      cancelled = true;
    };
  }, []);
  const router = useRouter();
  const supabase = createClient();

  const [currentPage, setCurrentPage] =
    useState<RiderPage>("active");

  const [loading, setLoading] =
    useState(true);

  const [availableOrders, setAvailableOrders] =
    useState<Order[]>([]);
  const [dispatchHomeZone, setDispatchHomeZone] = useState<string | null>(null);
  const [dispatchAvailability, setDispatchAvailability] = useState("unassigned");
  const [dispatchGpsFresh, setDispatchGpsFresh] = useState(false);
  const [dispatchError, setDispatchError] = useState("");
  const [savingDispatch, setSavingDispatch] = useState(false);

  const [myOrders, setMyOrders] =
    useState<Order[]>([]);

  const [completedOrders, setCompletedOrders] =
    useState<Order[]>([]);

  const [otpInputs, setOtpInputs] =
    useState<Record<string, string>>({});


async function loadDashboard() {
  try {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }


    const orderFields = `
      id,
      user_id,
      vendor_id,
      rider_id,
      status,
      total,
      food_amount,
      delivery_fee,
      platform_fee,
      mkh_amount,
      vendor_amount,
      rider_amount,
      created_at,
      delivery_address,
      customer_notes,
      payment_status,
      otp_verified,
      picked_up_at,
      delivered_at,
      order_items!order_items_order_id_fkey(
        id,
        name,
        quantity,
        price
      ),
      vendors:vendors!orders_vendor_id_fkey(
        name,
        location
      ),
      profiles:profiles!orders_user_id_fkey(
        full_name,
        email,
        phone
      )
    `;

    /* DISPATCH OFFERS
       Only offers reserved for this authenticated rider are returned.
       The previous global unassigned-order queue is intentionally removed.
    */
    const { data: dispatchState, error: dispatchStateError } = await supabase.rpc(
      "mkh_rider_get_my_dispatch_state"
    );

    if (dispatchStateError) {
      console.error("RIDER DISPATCH STATE ERROR:", dispatchStateError);
      setAvailableOrders([]);
      setDispatchError(dispatchStateError.message || "Dispatch offers are temporarily unavailable.");
      setDispatchHomeZone(null);
      setDispatchAvailability("unassigned");
      setDispatchGpsFresh(false);
    } else {
      setDispatchError("");
      setDispatchHomeZone(dispatchState?.home_zone_name ?? null);
      setDispatchAvailability(dispatchState?.availability_status ?? "unassigned");
      setDispatchGpsFresh(Boolean(dispatchState?.gps_fresh));
      setAvailableOrders(
        (dispatchState?.offers ?? []).map((offer: any) => ({
          ...offer.order,
          dispatch_offer_id: offer.id,
          dispatch_distance_meters: offer.distance_meters ?? null,
          dispatch_expires_at: offer.expires_at,
        }))
      );
    }

    /* RIDER ACTIVE JOBS */

    const {
      data: active,
      error: activeError,
    } = await supabase
      .from("orders")
      .select(orderFields)
      .eq("rider_id", user.id)
      .neq("status", "delivered")
      .order("created_at", {
        ascending: false,
      });

    if (activeError) {
      console.error("ACTIVE ORDERS ERROR:", activeError);
    }

setMyOrders(
  (active || []).map((order) => ({
    ...order,
    vendors: Array.isArray(order.vendors)
      ? order.vendors[0] ?? undefined
      : order.vendors,
    profiles: Array.isArray(order.profiles)
      ? order.profiles[0] ?? null
      : order.profiles,
  }))
);

    /* COMPLETED DELIVERIES */

    const {
      data: completed,
      error: completedError,
    } = await supabase
      .from("orders")
      .select(`
        id,
        user_id,
        vendor_id,
        rider_id,
        status,
        total,
        food_amount,
        delivery_fee,
        platform_fee,
        mkh_amount,
        vendor_amount,
        rider_amount,
        created_at,
        delivery_address,
        customer_notes,
        payment_status,
        otp_verified,
        picked_up_at,
        delivered_at,
        vendors:vendors!orders_vendor_id_fkey(
          name,
          location
        )
      `)
      .eq("rider_id", user.id)
      .eq("status", "delivered")
      .order("delivered_at", {
        ascending: false,
      });

    if (completedError) {
      console.error("COMPLETED ORDERS ERROR:", completedError);
    }

    setCompletedOrders(
  (completed || []).map((order) => ({
    ...order,
    vendors: Array.isArray(order.vendors)
      ? order.vendors[0] ?? undefined
      : order.vendors,
  }))
);
  } catch (err) {
    console.error("RIDER DASHBOARD ERROR:", err);
  } finally {
    setLoading(false);
  }
}


  const gpsRequestInProgress = useRef(false);
  const isLoggingOut = useRef(false);
  const logoutInProgress = useRef(false);
  const gpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function checkCurrentLocation() {
    if (isLoggingOut.current || gpsRequestInProgress.current || !navigator.geolocation) {
      return;
    }

    gpsRequestInProgress.current = true;

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
              enableHighAccuracy: true,
              maximumAge: 10000,
              timeout: 10000,
            }
          );
        }
      );

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (isLoggingOut.current || authError || !user) {
        return;
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (isLoggingOut.current || profileError || profile?.role !== "rider") {
        return;
      }

      const {
        latitude,
        longitude,
        accuracy,
        heading,
        speed,
      } = position.coords;

      const { error } = await supabase
        .from("rider_locations")
        .upsert(
          {
            rider_id: user.id,
            latitude,
            longitude,
            accuracy: accuracy ?? 0,
            heading: heading ?? 0,
            speed: speed ?? 0,
            location: `POINT(${longitude} ${latitude})`,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "rider_id",
          }
        );

      if (error) {
        console.error("LOCATION ERROR:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
      }
    } catch (error) {
      console.error("GPS UPDATE ERROR:", error);
    } finally {
      gpsRequestInProgress.current = false;
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboard();
    checkCurrentLocation();

    const interval = setInterval(() => {
      checkCurrentLocation();
    }, 15000);
    gpsIntervalRef.current = interval;

    const channel = supabase
      .channel("rider-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          loadDashboard();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_events",
          filter: "event_type=eq.rider_dispatch_offer",
        },
        () => {
          loadDashboard();
        }
      )
      .subscribe();

    return () => {
      isLoggingOut.current = true;
      clearInterval(interval);
      gpsIntervalRef.current = null;

      supabase.removeChannel(channel);
    };
  }, []);

  /* ----------------------------------
   ACCEPT DELIVERY
----------------------------------- */


async function respondToDispatchOffer(offerId: string, action: "accept" | "decline") {
  if (!offerId) return;

  setSavingDispatch(true);
  try {
    const { data, error } = await supabase.rpc(
      "mkh_rider_respond_to_my_dispatch_offer",
      { p_offer_id: offerId, p_action: action }
    );

    if (error) {
      console.error("DISPATCH OFFER RESPONSE ERROR:", error);
      alert(error.message || "Unable to respond to this pickup offer.");
      return;
    }

    if (!data?.success) {
      alert(data?.message || "The pickup offer could not be updated.");
      return;
    }

    await loadDashboard();
    alert(action === "accept"
      ? "Pickup accepted. The delivery is now in your active orders."
      : "Pickup declined. The next eligible designated rider will be considered.");
  } catch (error) {
    console.error("DISPATCH OFFER RESPONSE ERROR:", error);
    alert("Unable to respond to this pickup offer.");
  } finally {
    setSavingDispatch(false);
  }
}

async function updateDispatchAvailability() {
  if (!dispatchHomeZone) {
    alert("A permanent home zone must be assigned by MKH Admin/Operations before you can become dispatch-available.");
    return;
  }

  const nextStatus = dispatchAvailability === "available" ? "unavailable" : "available";
  setSavingDispatch(true);
  try {
    const { data, error } = await supabase.rpc(
      "mkh_rider_set_my_dispatch_availability",
      { p_availability_status: nextStatus }
    );

    if (error) {
      alert(error.message || "Unable to update rider availability.");
      return;
    }

    if (!data?.success) {
      alert(data?.message || "Availability could not be updated. Check that GPS is fresh and no active order or offer is assigned.");
      return;
    }

    await loadDashboard();
  } catch (error) {
    console.error("RIDER AVAILABILITY ERROR:", error);
    alert("Unable to update rider availability.");
  } finally {
    setSavingDispatch(false);
  }
}


  /* ----------------------------------
     UPDATE RIDER DELIVERY STATUS
  ----------------------------------- */

  async function updateStatus(
    orderId: string,
    status: string
  ) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("Rider session not found.");
        return;
      }

      /* ----------------------------------
         PICKUP
      ----------------------------------- */

   
      if (status === "picked_up") {
        const { data, error } = await supabase.rpc(
          "pick_up_delivery_order",
          { p_order_id: orderId }
        );

        if (error) {
          console.error("PICKUP ERROR:", error);
          alert(error.message || "Unable to record pickup.");
          return;
        }

        if (!data?.success) {
          alert(data?.message || "Pickup could not be recorded.");
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { error: eventError } = await supabase
            .from("order_events")
            .insert({
              order_id: orderId,
              event_type: "picked_up",
              title: "Rider Picked Up Order",
              description: "Order picked up by rider.",
              actor_type: "rider",
              actor_id: user.id,
            });

          if (eventError) {
            console.error("PICKUP EVENT ERROR:", eventError);
          }
        }

        await loadDashboard();
        return;
      }


      /* ----------------------------------
         DELIVERY
         ----------------------------------- */

      
      if (status === "delivered") {
        const { data, error } = await supabase.rpc(
          "complete_my_delivery",
          { p_order_id: orderId }
        );

        if (error) {
          console.error("DELIVERY COMPLETION ERROR:", error);
          alert(error.message || "Unable to complete delivery.");
          return;
        }

        if (!data?.success) {
          alert(data?.message || "Delivery completion failed.");
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { error: eventError } = await supabase
            .from("order_events")
            .insert({
              order_id: orderId,
              event_type: "delivered",
              title: "Order Delivered",
              description:
                "Delivery completed after customer OTP verification.",
              actor_type: "rider",
              actor_id: user.id,
            });

          if (eventError) {
            console.error("DELIVERY EVENT ERROR:", eventError);
          }
        }

        alert("Delivery completed successfully.");
        await loadDashboard();
        return;
      }


      console.warn(
        "Unsupported rider status:",
        status
      );
    } catch (err) {
      console.error(
        "UPDATE STATUS ERROR:",
        err
      );
    }
  }

  /* ----------------------------------
     VERIFY CUSTOMER OTP
  ----------------------------------- */

 
async function verifyOtp(orderId: string) {
  const enteredOtp = (otpInputs[orderId] || "").trim();

  if (!/^\d{4}$/.test(enteredOtp)) {
    alert("Enter the customer's four-digit OTP.");
    return;
  }

  try {
    const { data, error } = await supabase.rpc(
      "verify_my_delivery_otp",
      {
        p_order_id: orderId,
        p_otp: enteredOtp,
      }
    );

    if (error) {
      console.error("OTP VERIFICATION ERROR:", error);
      alert(error.message);
      return;
    }

    if (!data?.success) {
      alert(data?.message || "OTP verification failed.");
      return;
    }

    setOtpInputs((current) => ({
      ...current,
      [orderId]: "",
    }));

    alert("OTP verified. You can now complete the delivery.");
    await loadDashboard();
  } catch (err) {
    console.error("OTP VERIFICATION ERROR:", err);
    alert("Unable to verify the OTP.");
  }
}


  /* ----------------------------------
     GPS LOCATION
  ----------------------------------- */



  /* ----------------------------------
     LOGOUT
  ----------------------------------- */

  async function logout() {
    if (logoutInProgress.current) return;

    logoutInProgress.current = true;
    isLoggingOut.current = true;

    if (gpsIntervalRef.current !== null) {
      clearInterval(gpsIntervalRef.current);
      gpsIntervalRef.current = null;
    }

    // Give a GPS/database operation already in flight time to finish before sign-out.
    let waitCount = 0;
    while (gpsRequestInProgress.current && waitCount < 120) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      waitCount += 1;
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("RIDER LOGOUT ERROR:", error);
        alert("Logout did not complete. Please try again.");
        logoutInProgress.current = false;
        isLoggingOut.current = false;
        return;
      }
      router.replace("/login");
    } catch (error) {
      console.error("RIDER LOGOUT ERROR:", error);
      alert("Logout did not complete. Please try again.");
      logoutInProgress.current = false;
      isLoggingOut.current = false;
    }
  }

  /* ----------------------------------
     DASHBOARD METRICS
  ----------------------------------- */

  const deliveredCount =
    useMemo(() => {
      return completedOrders.length;
    }, [completedOrders]);

  const earnings =
    useMemo(() => {
      return completedOrders.reduce(
        (sum, order) =>
          sum +
          Number(
            order.rider_amount || 0
          ),
        0
      );
    }, [completedOrders]);

  if (loading) {
    return (
      <main
        className="
          min-h-screen
          flex
          items-center
          justify-center
        "
      >
        <h1
          className="
            text-3xl
            font-bold
          "
        >
          Loading Rider Dashboard...
        </h1>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto w-full max-w-5xl overflow-hidden bg-slate-100 shadow-sm">
        {/* APPROVED MKH RIDER CONCEPT: compact navy header + orange/white KPI cards */}
        <header className="bg-[#263449] px-4 pb-4 pt-4 text-white sm:px-5">
          <div className="flex items-center justify-between border-b border-white/20 pb-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1.5">
                <img src="/logo.png" alt="Mammy Kitchen Hub logo" className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold leading-6">Mammy Kitchen Hub</h1>
                <p className="mt-1 text-sm text-slate-200">Rider workspace</p>
              </div>
            </div>
            <button type="button" aria-label="Notifications" className="rounded-full p-2 text-white hover:bg-white/10">
              <Bell className="h-5 w-5" />
            </button>
          </div>

          <div className="pt-5">
            <h2 className="text-xl font-bold tracking-tight">Good evening, {riderFirstName}</h2>
            <p className="mt-2 text-sm text-slate-200">Manage your deliveries, track earnings and complete orders.</p>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-orange-500 px-3 py-3 text-white">
              <p className="text-xs font-medium">Today's deliveries</p>
              <p className="mt-1 text-2xl font-bold leading-7">{deliveredCount.toString().padStart(2, "0")}</p>
            </div>
            <div className="rounded-xl bg-white px-3 py-3 text-slate-700">
              <p className="text-xs font-medium text-slate-500">Today's earnings</p>
              <p className="mt-1 text-2xl font-bold leading-7">₦{earnings.toLocaleString()}</p>
            </div>
          </div>
        </header>

        {/* Delivery workspace */}
        <main className="px-3 pb-6 pt-4 sm:px-4">
          <div className="mb-3 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">Delivery workspace</h2>
              <p className="mt-1 text-xs text-slate-500">
                Home zone: {dispatchHomeZone || "Not assigned"}
              </p>
              <span className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                dispatchAvailability === "available" && dispatchGpsFresh
                  ? "bg-green-100 text-green-700"
                  : dispatchAvailability === "available" && !dispatchGpsFresh
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-600"
              }`}>
                {dispatchAvailability === "unassigned"
                  ? "Home zone not assigned"
                  : dispatchAvailability === "available" && dispatchGpsFresh
                    ? "Online · Available"
                    : dispatchAvailability === "available"
                      ? "GPS stale · Not dispatch eligible"
                      : "Unavailable"}
              </span>
            </div>
            <button
              type="button"
              onClick={updateDispatchAvailability}
              disabled={!dispatchHomeZone || savingDispatch}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingDispatch ? "Updating…" : dispatchAvailability === "available" ? "Go unavailable" : "Go available"}
            </button>
          </div>

          {dispatchError && (
            <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Dispatch offers could not be loaded: {dispatchError}
            </p>
          )}
          {!dispatchHomeZone && (
            <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Your account needs a permanent home-zone assignment from MKH Admin/Operations before you can receive pickup offers.
            </p>
          )}

          <div className="mb-3 flex gap-2">
            <button onClick={() => setCurrentPage("active")} className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${currentPage === "active" ? "bg-orange-500 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
              Active orders
            </button>
            <button onClick={() => setCurrentPage("earnings")} className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${currentPage === "earnings" ? "bg-orange-500 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
              Earnings
            </button>
            <button onClick={logout} className="ml-auto rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-200" aria-label="Log out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>

        {/* ----------------------------------
            EARNINGS PAGE
        ----------------------------------- */}

        {currentPage === "earnings" ? (
          <div
            className="
              grid
              md:grid-cols-2
              gap-6
            "
          >
            <div
              className="
                bg-white
                p-6 sm:p-8
                rounded-2xl
                border border-slate-200
                shadow-sm
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-4
                  mb-5
                "
              >
                <Wallet
                  className="
                    w-10
                    h-10
                    text-green-500
                  "
                />

                <h2
                  className="
                    text-3xl
                    font-bold
                  "
                >
                  Earnings
                </h2>
              </div>

              <p
                className="
                  text-5xl
                  font-bold
                  text-green-600
                "
              >
                ₦
                {earnings.toLocaleString()}
              </p>
            </div>

            <div
              className="
                bg-white
                p-6 sm:p-8
                rounded-2xl
                border border-slate-200
                shadow-sm
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-4
                  mb-5
                "
              >
                <Bike
                  className="
                    w-10
                    h-10
                    text-orange-500
                  "
                />

                <h2
                  className="
                    text-3xl
                    font-bold
                  "
                >
                  Deliveries
                </h2>
              </div>

              <p
                className="
                  text-5xl
                  font-bold
                "
              >
                {deliveredCount}
              </p>
            </div>
          </div>
        ) : (
          <div
            className="
              space-y-10
            "
          >
            {/* ----------------------------------
                AVAILABLE PICKUPS
            ----------------------------------- */}

            <section>
              <h2
                className="
                  text-2xl
                  font-bold
                  mb-5
                "
              >
                Available Pickups
              </h2>

              <div
                className="
                  space-y-5
                "
              >
                {availableOrders.length ===
                0 ? (
                  <div
                    className="
                      bg-white
                      p-8
                      rounded-2xl
                      text-center
                    "
                  >
                    No deliveries waiting.
                  </div>
                ) : (
                  availableOrders.map(
                    (order) => (
                      <div
                        key={order.id}
                        className="
                          bg-white
                          p-5 sm:p-6
                          rounded-2xl
                          border border-slate-200
                          shadow-sm
                        "
                      >
                        <div
                          className="
                            flex
                            justify-between
                            items-start
                            mb-5
                          "
                        >
                          <div>
                            <h3
                              className="
                                font-bold
                                text-xl
                              "
                            >
                              {
                                order.vendors
                                  ?.name
                              }
                            </h3>

                            <p
                              className="
                                text-gray-500
                              "
                            >
                              {
                                order.vendors
                                  ?.location
                              }
                            </p>

                            <p
                              className="
                                text-sm
                                text-blue-600
                                mt-1
                              "
                            >
                              Customer:{" "}
                              {
                                order
                                  .profiles
                                  ?.full_name
                              }
                            </p>

                            <a
                              href={`tel:${order.profiles?.phone}`}
                              className="
                                block
                                text-sm
                                text-green-600
                                font-medium
                              "
                            >
                              ☎{" "}
                              {
                                order.profiles
                                  ?.phone
                              }
                            </a>

                            <p
                              className="
                                text-sm
                                text-gray-600
                              "
                            >
                              📍{" "}
                              {
                                order.delivery_address
                              }
                            </p>

                            <a
                              href={getGoogleMapsUrl(
                                order.delivery_address,
                                order.vendors?.location
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="
                                inline-block
                                text-sm
                                mt-2 inline-flex items-center rounded-lg bg-orange-50 px-3 py-2
                                font-semibold text-orange-700 transition-colors hover:bg-orange-100
                              "
                            >
                              Open in Google Maps ↗
                            </a>

                            {order.customer_notes && (
                              <p
                                className="
                                  text-sm
                                  text-orange-700
                                  mt-1
                                "
                              >
                                📝{" "}
                                {
                                  order.customer_notes
                                }
                              </p>
                            )}

                            <p
                              className="
                                text-lg
                                font-semibold
                                text-green-600
                                mt-2
                              "
                            >
                              ₦
                              {Number(
                                order.total
                              ).toLocaleString()}
                            </p>

                            <p
                              className="
                                text-sm
                                text-gray-500
                                mt-1
                              "
                            >
                              Rider earns approximately ₦
                              {Number(
                                order.rider_amount ||
                                  0
                              ).toLocaleString()}
                            </p>

                            <p
                              className="
                                text-sm
                                text-orange-600
                                mt-2
                              "
                            >
                              Ordered:{" "}
                              {new Date(
                                order.created_at
                              ).toLocaleString()}
                            </p>
                          </div>

                          <div
                            className="
                              text-right
                            "
                          >
                            <Clock
                              className="
                                text-orange-500
                                ml-auto
                                mb-2
                              "
                            />

                            <p
                              className="
                                text-sm
                                text-gray-500
                              "
                            >
                              Ready
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          {typeof order.dispatch_distance_meters === "number" && (
                            <span className="text-xs text-slate-500">
                              Approx. {Math.round(order.dispatch_distance_meters)} m from vendor
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => order.dispatch_offer_id && void respondToDispatchOffer(order.dispatch_offer_id, "accept")}
                            disabled={!order.dispatch_offer_id || savingDispatch}
                            className="rounded-xl bg-orange-500 px-6 py-3 font-bold text-white hover:bg-orange-600 disabled:opacity-50"
                          >
                            Accept pickup
                          </button>
                          <button
                            type="button"
                            onClick={() => order.dispatch_offer_id && void respondToDispatchOffer(order.dispatch_offer_id, "decline")}
                            disabled={!order.dispatch_offer_id || savingDispatch}
                            className="rounded-xl border border-slate-300 px-6 py-3 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    )
                  )
                )}
              </div>
            </section>

            {/* ----------------------------------
                MY DELIVERIES
            ----------------------------------- */}

            <section>
              <h2
                className="
                  text-2xl
                  font-bold
                  mb-5
                "
              >
                My Deliveries
              </h2>

              <div
                className="
                  space-y-6
                "
              >
                {myOrders.map(
                  (order) => (
                    <div
                      key={order.id}
                      className="
                        bg-white
                        rounded-2xl
                        p-5 sm:p-6
                        border border-slate-200
                        shadow-sm
                      "
                    >
                      <div
                        className="
                          flex
                          justify-between
                          mb-6
                        "
                      >
                        <div>
                          <h3
                            className="
                              font-bold
                              text-xl
                            "
                          >
                            {
                              order.vendors
                                ?.name
                            }
                          </h3>

                          <p
                            className="
                              text-gray-500
                            "
                          >
                            {
                              order.vendors
                                ?.location
                            }
                          </p>

                          <p
                            className="
                              text-sm
                              text-blue-600
                              mt-1
                            "
                          >
                            Customer:{" "}
                            {
                              order.profiles
                                ?.full_name
                            }
                          </p>

                          <a
                            href={`tel:${order.profiles?.phone}`}
                            className="
                              block
                              text-sm
                              text-green-600
                              font-medium
                            "
                          >
                            ☎{" "}
                            {
                              order.profiles
                                ?.phone
                            }
                          </a>

                          <p
                            className="
                              text-sm
                              text-gray-600
                            "
                          >
                            📍{" "}
                            {
                              order.delivery_address
                            }
                          </p>

                          <a
                            href={getGoogleMapsUrl(
                              order.delivery_address,
                              order.vendors?.location
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="
                              inline-block
                              text-sm
                              text-blue-600
                              font-medium
                              mt-1
                            "
                          >
                            Open location in Google Maps ↗
                          </a>

                          {order.customer_notes && (
                            <p
                              className="
                                text-sm
                                text-orange-700
                                mt-1
                              "
                            >
                              📝{" "}
                              {
                                order.customer_notes
                              }
                            </p>
                          )}

                          <p
                            className="
                              capitalize
                              text-orange-600
                              text-sm
                              mt-1
                            "
                          >
                            {order.status}
                          </p>

                          <p
                            className="
                              text-sm
                              text-gray-500
                              mt-2
                            "
                          >
                            Order Value: ₦
                            {Number(
                              order.total
                            ).toLocaleString()}
                          </p>

                          <p
                            className="
                              text-sm
                              text-green-600
                            "
                          >
                            Rider Earnings: ₦
                            {Number(
                              order.rider_amount ||
                                0
                            ).toLocaleString()}
                          </p>

                          <p
                            className="
                              text-sm
                              text-gray-500
                            "
                          >
                            Ordered:{" "}
                            {new Date(
                              order.created_at
                            ).toLocaleString()}
                          </p>
                        </div>

                        <p
                          className="
                            text-2xl
                            font-bold
                            text-green-600
                          "
                        >
                          ₦
                          {Number(
                            order.rider_amount ||
                              0
                          ).toLocaleString()}
                        </p>
                      </div>

                      {/* ----------------------------------
                          ORDER ITEMS
                      ----------------------------------- */}

                      <div
                        className="
                          space-y-2
                          mb-6
                        "
                      >
                        {order.order_items?.map(
                          (item) => (
                            <div
                              key={item.id}
                              className="
                                flex
                                justify-between
                              "
                            >
                              <span>
                                {item.quantity}x{" "}
                                {item.name}
                              </span>

                              <span>
                                ₦
                                {Number(
                                  item.price
                                ).toLocaleString()}
                              </span>
                            </div>
                          )
                        )}
                      </div>

                      {/* ----------------------------------
                          OTP VERIFICATION
                      ----------------------------------- */}

                      {order.status ===
                        "picked_up" &&
                        !order.otp_verified && (
                          <div
                            className="
                              mb-4
                            "
                          >
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={4}
                              placeholder="Enter customer OTP"
                              value={
                                otpInputs[
                                  order.id
                                ] || ""
                              }
                              onChange={(e) =>
                                setOtpInputs(
                                  {
                                    ...otpInputs,
                                    [order.id]:
                                      e.target
                                        .value
                                        .replace(
                                          /\D/g,
                                          ""
                                        ),
                                  }
                                )
                              }
                              className="
                                border
                                p-3
                                rounded-xl
                                w-full
                                mb-2
                              "
                            />

                            <button
                              onClick={() =>
                                verifyOtp(order.id)
                              }
                              className="
                                bg-orange-500
                                text-white
                                px-5
                                py-2
                                rounded-xl
                              "
                            >
                              Verify OTP
                            </button>
                          </div>
                        )}

                      {/* ----------------------------------
                          PICKUP
                      ----------------------------------- */}

                      {(order.status ===
                        "accepted" ||
                        order.status ===
                          "assigned") && (
                        <button
                          onClick={() =>
                            updateStatus(
                              order.id,
                              "picked_up"
                            )
                          }
                          className="
                            bg-blue-500
                            text-white
                            px-6
                            py-3
                            rounded-xl
                            font-bold
                          "
                        >
                          Confirm Pickup
                        </button>
                      )}

                      {/* ----------------------------------
                          COMPLETE DELIVERY
                      ----------------------------------- */}

                      {order.status ===
                        "picked_up" &&
                        order.otp_verified && (
                          <button
                            onClick={() =>
                              updateStatus(
                                order.id,
                                "delivered"
                              )
                            }
                            className="
                              bg-green-500
                              text-white
                              px-6
                              py-3
                              rounded-xl
                              font-bold
                            "
                          >
                            Complete Delivery
                          </button>
                        )}
                    </div>
                  )
                )}
              </div>
            </section>
          </div>
        )}
                  <RiderWalletSummary />
          <RiderPayoutCentre />
</main>
      </div>
    </div>
  );
}

