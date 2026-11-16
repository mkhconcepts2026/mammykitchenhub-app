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
  dispatch_mode?: "vendor_coverage" | "trm_cross_zone";
  dispatch_distance_meters?: number | null;
  offer_expires_at?: string;


  // Payment fields used by the COD completion flow
  payment_method?: string | null;
  payment_status?: string | null;

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
  const [gpsStatus, setGpsStatus] = useState<"checking" | "live" | "permission_denied" | "unavailable" | "error">("checking");
  const [gpsMessage, setGpsMessage] = useState("Checking device location…");
  const [gpsUpdatedAt, setGpsUpdatedAt] = useState<string | null>(null);
  const [homeZoneName,setHomeZoneName]=useState<string|null>(null);
  const [availabilityStatus,setAvailabilityStatus]=useState<"available"|"unavailable"|"unassigned">("unassigned");
  const [availabilitySaving,setAvailabilitySaving]=useState(false);
  const [dispatchMessage,setDispatchMessage]=useState("");

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
      payment_method,
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

    /* RIDER-SPECIFIC PICKUP OFFERS */

    const dispatchResponse=await fetch("/api/rider/dispatch",{cache:"no-store"});
    const dispatchData=await dispatchResponse.json().catch(()=>null);
    if(!dispatchResponse.ok||dispatchData?.success!==true){
      console.error("RIDER DISPATCH OFFERS ERROR:",dispatchData?.message);
      setDispatchMessage(dispatchData?.message||"Unable to load pickup offers.");
    }else{
      setHomeZoneName(dispatchData.homeZone?.name??null);
      setAvailabilityStatus(dispatchData.availabilityStatus??"unassigned");
      setGpsUpdatedAt(dispatchData.gps?.updatedAt??gpsUpdatedAt);
      setAvailableOrders((dispatchData.offers??[]).map((offer:any)=>({
        ...offer.order,
        dispatch_offer_id:offer.id,
        dispatch_mode:offer.dispatch_mode,
        dispatch_distance_meters:offer.distance_meters,
        offer_expires_at:offer.expires_at,
      })).filter((order:any)=>order?.id));
      setDispatchMessage("");
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
        payment_method,
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
    if (isLoggingOut.current || gpsRequestInProgress.current) return;
    if (!navigator.geolocation) {
      setGpsStatus("unavailable");
      setGpsMessage("This browser does not provide device location. Use a supported browser with location services enabled.");
      return;
    }
    if (!navigator.onLine) {
      setGpsStatus("error");
      setGpsMessage("Your device is offline. GPS will be sent when the internet connection returns.");
      return;
    }

    gpsRequestInProgress.current = true;
    setGpsStatus("checking");
    setGpsMessage("Getting a fresh location from your device…");
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 15000,
        });
      });
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (isLoggingOut.current) return;
      if (authError || !user) {
        setGpsStatus("error");
        setGpsMessage("Your rider session could not be verified. Sign in again to send GPS updates.");
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("role").eq("id", user.id).single();
      if (isLoggingOut.current) return;
      if (profileError || profile?.role !== "rider") {
        setGpsStatus("error");
        setGpsMessage("This session is not recognised as a rider account. GPS was not saved.");
        return;
      }
      const { latitude, longitude, accuracy, heading, speed } = position.coords;
      const savedAt = new Date().toISOString();
      const { error } = await supabase.from("rider_locations").upsert(
        {
          rider_id: user.id, latitude, longitude, accuracy: accuracy ?? 0,
          heading: heading ?? 0, speed: speed ?? 0,
          location: `POINT(${longitude} ${latitude})`,
          updated_at: savedAt,
        },
        { onConflict: "rider_id" }
      );
      if (error) {
        console.error("LOCATION SAVE ERROR:", {
          code: error.code, message: error.message, details: error.details, hint: error.hint,
        });
        setGpsStatus("error");
        setGpsMessage("Your device location was received, but MKH could not save it. Check your connection and try again.");
        return;
      }
      setGpsStatus("live");
      setGpsUpdatedAt(savedAt);
      setGpsMessage("Your current location was saved to MKH.");
      const refreshResponse=await fetch("/api/rider/dispatch",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"refresh"})
      });
      if(refreshResponse.ok){void loadDashboard();}
    } catch (error) {
      const gpsError = error as GeolocationPositionError;
      if (gpsError?.code === 1) {
        setGpsStatus("permission_denied");
        setGpsMessage("Location permission is blocked. Allow location access for this site in your browser or phone settings.");
      } else if (gpsError?.code === 2) {
        setGpsStatus("unavailable");
        setGpsMessage("Your device could not determine its location. Turn on phone location services and try again.");
      } else if (gpsError?.code === 3) {
        setGpsStatus("error");
        setGpsMessage("Getting your location timed out. Keep the Rider Dashboard open and try again.");
      } else {
        setGpsStatus("error");
        setGpsMessage(error instanceof Error ? error.message : "GPS update failed. Try again.");
      }
      console.error("GPS UPDATE ERROR:", error);
    } finally {
      gpsRequestInProgress.current = false;
    }
  }

  useEffect(() => {
    isLoggingOut.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboard();
    void checkCurrentLocation();
    const interval = setInterval(() => { void checkCurrentLocation(); }, 15000);
    gpsIntervalRef.current = interval;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !isLoggingOut.current) void checkCurrentLocation();
    };
    const handleOnline = () => { if (!isLoggingOut.current) void checkCurrentLocation(); };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    const channel = supabase.channel("rider-live").on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      () => { void loadDashboard(); }
    ).subscribe();
    return () => {
      isLoggingOut.current = true;
      clearInterval(interval);
      gpsIntervalRef.current = null;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      supabase.removeChannel(channel);
    };
  }, []);

  /* ----------------------------------
   ACCEPT DELIVERY
----------------------------------- */


async function respondToDispatchOffer(offerId:string,decision:"accept"|"decline") {
  try {
    const response=await fetch("/api/rider/dispatch",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action:"respond",offerId,decision})
    });
    const result=await response.json().catch(()=>null);
    if(!response.ok||result?.success!==true){
      throw new Error(result?.message||"Unable to respond to this pickup offer.");
    }
    if(decision==="accept"){
      alert("Pickup accepted. The order is now assigned to you.");
    }else{
      setDispatchMessage("Pickup declined. MKH is offering the order to the next eligible rider.");
    }
    await loadDashboard();
  }catch(error){
    console.error("RIDER DISPATCH RESPONSE ERROR:",error);
    alert(error instanceof Error?error.message:"Unable to respond to this pickup offer.");
  }
}

async function updateDispatchAvailability(next:"available"|"unavailable"){
  setAvailabilitySaving(true);setDispatchMessage("");
  try{
    const response=await fetch("/api/rider/dispatch",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action:"availability",status:next})
    });
    const result=await response.json().catch(()=>null);
    if(!response.ok||result?.success!==true)throw new Error(result?.message||"Unable to update availability.");
    setAvailabilityStatus(next);
    await loadDashboard();
  }catch(error){
    setDispatchMessage(error instanceof Error?error.message:"Unable to update availability.");
  }finally{setAvailabilitySaving(false);}
}


  /* ----------------------------------
     UPDATE RIDER DELIVERY STATUS
  ----------------------------------- */

  async function updateStatus(
    orderId: string,
    status: string,
    paymentMethod?: string
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
        let data: any = null;
        let error: any = null;

        if (paymentMethod === "cash_on_delivery") {
          const cashCollected = window.confirm(
            "Confirm that you have physically collected the full COD payment from the customer. Continue only after the cash has been received."
          );

          if (!cashCollected) return;

          const result = await supabase.rpc(
            "mkh_complete_cod_delivery",
            {
              p_order_id: orderId,
              p_cash_collected: true,
            }
          );

          data = result.data;
          error = result.error;
        } else {
          const result = await supabase.rpc(
            "complete_my_delivery",
            { p_order_id: orderId }
          );

          data = result.data;
          error = result.error;
        }

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
            <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${gpsStatus === "live" ? "bg-emerald-500/15 text-emerald-100" : gpsStatus === "checking" ? "bg-amber-500/15 text-amber-100" : "bg-red-500/15 text-red-100"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">
                  {gpsStatus === "live" ? "GPS Live" : gpsStatus === "checking" ? "Checking GPS" : gpsStatus === "permission_denied" ? "Location permission needed" : gpsStatus === "unavailable" ? "GPS unavailable" : "GPS update problem"}
                </span>
                <button type="button" onClick={() => void checkCurrentLocation()} disabled={gpsStatus === "checking"} className="rounded-md border border-current/40 px-2 py-1 font-semibold disabled:opacity-50">Retry GPS</button>
              </div>
              <p className="mt-1 leading-5">{gpsMessage}</p>
              {gpsUpdatedAt && <p className="mt-1 opacity-80">Last saved: {new Date(gpsUpdatedAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/15 bg-white/5 px-3 py-3">
              <div>
                <p className="text-sm font-bold">Home zone: {homeZoneName||"Not assigned"}</p>
                <p className="text-xs text-slate-200">This is your permanent zone. Cross-zone pickups do not change it.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-1 text-xs font-bold ${availabilityStatus==="available"?"bg-emerald-500/20 text-emerald-100":availabilityStatus==="unavailable"?"bg-slate-500/30 text-slate-100":"bg-amber-500/20 text-amber-100"}`}>
                  {availabilityStatus==="available"?"Available":availabilityStatus==="unavailable"?"Unavailable":"Zone not assigned"}
                </span>
                {availabilityStatus!=="unassigned"&&(
                  <button type="button" disabled={availabilitySaving} onClick={()=>void updateDispatchAvailability(availabilityStatus==="available"?"unavailable":"available")} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-800 disabled:opacity-50">
                    {availabilitySaving?"Updating…":availabilityStatus==="available"?"Go unavailable":"Set available"}
                  </button>
                )}
              </div>
            </div>
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

        <RiderWalletSummary />

        <RiderPayoutCentre />

        {/* Delivery workspace */}
        <main className="px-3 pb-6 pt-4 sm:px-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Delivery workspace</h2>
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${gpsStatus === "live" ? "bg-green-100 text-green-700" : gpsStatus === "checking" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{gpsStatus === "live" ? "GPS Live" : gpsStatus === "checking" ? "Checking GPS" : "GPS Offline"}</span>
          </div>

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
                {dispatchMessage&&<p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{dispatchMessage}</p>}
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

                        <div className="flex flex-wrap items-center gap-2">
                          {order.dispatch_mode==="trm_cross_zone"?(
                            <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-800">TRM cross-zone dispatch</span>
                          ):(
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">Vendor coverage offer</span>
                          )}
                          {typeof order.dispatch_distance_meters==="number"&&<span className="text-xs text-slate-500">{(order.dispatch_distance_meters/1000).toFixed(2)} km from pickup</span>}
                          {order.offer_expires_at&&<span className="text-xs text-slate-500">Offer expires {new Date(order.offer_expires_at).toLocaleTimeString("en-NG",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</span>}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => order.dispatch_offer_id&&void respondToDispatchOffer(order.dispatch_offer_id,"accept")}
                            disabled={!order.dispatch_offer_id}
                            className="rounded-xl bg-orange-500 px-6 py-3 font-bold text-white disabled:opacity-50"
                          >
                            Accept Pickup
                          </button>
                          <button
                            onClick={() => order.dispatch_offer_id&&void respondToDispatchOffer(order.dispatch_offer_id,"decline")}
                            disabled={!order.dispatch_offer_id}
                            className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 disabled:opacity-50"
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
                              updateStatus(order.id, "delivered", order.payment_method ?? undefined)
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
        </main>
      </div>
    </div>
  );
}

