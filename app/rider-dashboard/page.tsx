"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import {
  Bike,
  Wallet,
  Clock,
  LogOut,
} from "lucide-react";

import { Settlement } from "@/types/settlement";
import { processSettlement } from "@/lib/services/settlementEngine";

type RiderPage =
  | "active"
  | "earnings";

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

      console.log("AUTH USER ID:", user.id);

      const { data: profile } =
        await supabase
          .from("profiles")
          .select("id, role")
          .eq("id", user.id)
          .single();

      console.log("PROFILE:", profile);

      /* ----------------------------------
         AVAILABLE PICKUPS
      ----------------------------------- */

      const {
        data: queue,
        error: queueError,
      } = await supabase
        .from("orders")
        .select(`
          *,
          order_items!order_items_order_id_fkey(
            id,
            name,
            quantity,
            price
          ),
          vendors(
            name,
            location
          ),
          profiles!orders_user_id_fkey(
            full_name,
            email,
            phone
          )
        `)
        .eq("status", "ready_for_pickup")
        .is("rider_id", null)
        .order("created_at", {
          ascending: false,
        });

      if (queueError) {
        console.error(
          "AVAILABLE ORDERS ERROR:",
          queueError
        );
      }

      /* ----------------------------------
         RIDER ACTIVE JOBS
      ----------------------------------- */

      const {
        data: active,
        error: activeError,
      } = await supabase
        .from("orders")
        .select(`
          *,
          order_items!order_items_order_id_fkey(
            id,
            name,
            quantity,
            price
          ),
          vendors(
            name,
            location
          ),
          profiles!orders_user_id_fkey(
            full_name,
            email,
            phone
          )
        `)
        .eq("rider_id", user.id)
        .neq("status", "delivered")
        .order("created_at", {
          ascending: false,
        });

      if (activeError) {
        console.error(
          "ACTIVE ORDERS ERROR:",
          activeError
        );
      }

      setAvailableOrders(queue || []);
      setMyOrders(active || []);

      /* ----------------------------------
         COMPLETED DELIVERIES
      ----------------------------------- */

      const {
        data: completed,
        error: completedError,
      } = await supabase
        .from("orders")
        .select(`
          *,
          vendors(
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
        console.error(
          "COMPLETED ORDERS ERROR:",
          completedError
        );
      }

      setCompletedOrders(completed || []);
    } catch (err) {
      console.error(
        "RIDER DASHBOARD ERROR:",
        err
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    checkCurrentLocation();

    const interval = setInterval(() => {
      checkCurrentLocation();
    }, 5000);

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
      .subscribe();

    return () => {
      clearInterval(interval);

      supabase.removeChannel(channel);
    };
  }, []);

  /* ----------------------------------
   ACCEPT DELIVERY
----------------------------------- */

async function acceptDelivery(
  orderId: string
) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("No rider logged in.");
      return;
    }

    /*
     * Generate the customer delivery OTP
     * when the rider accepts the delivery.
     */
    const generatedOtp =
      Math.floor(
        1000 + Math.random() * 9000
      ).toString();

    console.log(
      "GENERATED OTP:",
      generatedOtp
    );

    /*
     * IMPORTANT:
     *
     * Rider acceptance changes:
     *
     * READY_FOR_PICKUP
     *        ↓
     * ASSIGNED
     *
     * It must NOT become "accepted".
     *
     * "accepted" belongs to the Vendor
     * accepting the customer's order.
     *
     * We also require:
     *
     * status = ready_for_pickup
     * rider_id IS NULL
     *
     * This prevents two riders from claiming
     * the same delivery.
     */

    const {
      data,
      error,
    } = await supabase
      .from("orders")
      .update({
        rider_id: user.id,
        status: "assigned",
        delivery_otp: generatedOtp,
        otp_verified: false,
      })
      .eq("id", orderId)
      .eq("status", "ready_for_pickup")
      .is("rider_id", null)
      .select()
      .single();

    console.log(
      "ACCEPT RESULT:",
      data
    );

    console.log(
      "UPDATED ORDER:",
      data
    );

    console.log(
      "RIDER ID AFTER ACCEPT:",
      data?.rider_id
    );

    console.log(
      "ACCEPT ERROR:",
      error
    );

    if (error) {
      console.error(
        "ACCEPT DELIVERY ERROR:",
        error
      );

      alert(
        error.message ||
        "Unable to accept this delivery."
      );

      return;
    }

    if (!data) {
      alert(
        "This delivery is no longer available. Another rider may have accepted it."
      );

      await loadDashboard();

      return;
    }

    /*
     * Record the rider acceptance.
     */
    const {
      error: eventError,
    } = await supabase
      .from("order_events")
      .insert({
        order_id: orderId,
        event_type: "assigned",
        title: "Rider Accepted Delivery",
        description:
          "Rider accepted the delivery assignment.",
        actor_type: "rider",
        actor_id: user.id,
      });

    if (eventError) {
      console.error(
        "RIDER ACCEPTANCE EVENT ERROR:",
        eventError
      );
    }

    await loadDashboard();

  } catch (err) {
    console.error(
      "ACCEPT DELIVERY ERROR:",
      err
    );

    alert(
      "Unable to accept this delivery."
    );
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
        const now =
          new Date().toISOString();

        const {
          error: pickupError,
        } = await supabase
          .from("orders")
          .update({
            status: "picked_up",
            picked_up_at: now,
          })
          .eq("id", orderId)
          .eq("rider_id", user.id);

        if (pickupError) {
          console.error(
            "PICKUP UPDATE ERROR:",
            pickupError
          );

          alert(pickupError.message);
          return;
        }

        await supabase
          .from("order_events")
          .insert({
            order_id: orderId,
            event_type: "picked_up",
            title: "Rider Picked Up Order",
            description:
              "Order picked up by rider.",
            actor_type: "rider",
            actor_id: user.id,
          });

        await loadDashboard();

        return;
      }

      /* ----------------------------------
         DELIVERY
         ----------------------------------- */

      if (status === "delivered") {
        /*
         * Before delivery, retrieve the canonical
         * order record and verify that this rider
         * is actually assigned to it.
         */

        const {
          data: currentOrder,
          error: currentOrderError,
        } = await supabase
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .eq("rider_id", user.id)
          .single();

        if (currentOrderError) {
          console.error(
            "DELIVERY ORDER LOOKUP ERROR:",
            currentOrderError
          );

          alert(
            "Unable to verify this delivery."
          );

          return;
        }

        if (!currentOrder) {
          alert(
            "Order could not be found."
          );

          return;
        }

        /*
         * Delivery can only be completed when:
         *
         * 1. Rider owns the delivery
         * 2. Order is currently picked_up
         * 3. Customer OTP has been verified
         */

        if (
          currentOrder.status !==
          "picked_up"
        ) {
          alert(
            "This order must be picked up before it can be delivered."
          );

          return;
        }

        if (
          !currentOrder.otp_verified
        ) {
          alert(
            "Customer OTP must be verified before completing delivery."
          );

          return;
        }

        /* ----------------------------------
           DUPLICATE SETTLEMENT PROTECTION
        ----------------------------------- */

        const {
          data: existingRiderLedger,
          error: ledgerCheckError,
        } = await supabase
          .from("financial_ledger")
          .select("id")
          .eq("order_id", orderId)
          .eq("rider_id", user.id)
          .maybeSingle();

        if (ledgerCheckError) {
          console.error(
            "SETTLEMENT CHECK ERROR:",
            ledgerCheckError
          );

          alert(
            "Unable to verify settlement status. Delivery was not completed."
          );

          return;
        }

        /*
         * If rider settlement already exists,
         * do not process financial settlement again.
         */
        if (existingRiderLedger) {
          console.warn(
            "SETTLEMENT ALREADY EXISTS FOR ORDER:",
            orderId
          );

          alert(
            "This order has already been settled."
          );

          return;
        }

        /* ----------------------------------
           MARK ORDER DELIVERED
        ----------------------------------- */

        const now =
          new Date().toISOString();

        const {
          data: deliveredOrder,
          error: deliveryError,
        } = await supabase
          .from("orders")
          .update({
            status: "delivered",
            delivered_at: now,
          })
          .eq("id", orderId)
          .eq("rider_id", user.id)
          .select("*")
          .single();

        if (deliveryError) {
          console.error(
            "DELIVERY UPDATE ERROR:",
            deliveryError
          );

          alert(
            deliveryError.message
          );

          return;
        }

        if (!deliveredOrder) {
          alert(
            "Delivery update failed."
          );

          return;
        }

        console.log(
          "DELIVERED ORDER:",
          deliveredOrder
        );

        /* ----------------------------------
           ORDER EVENT
        ----------------------------------- */

        const {
          error: eventError,
        } = await supabase
          .from("order_events")
          .insert({
            order_id: orderId,
            event_type: "delivered",
            title: "Order Delivered",
            description:
              "Order delivered and customer OTP verified.",
            actor_type: "rider",
            actor_id: user.id,
          });

        if (eventError) {
          console.error(
            "DELIVERY EVENT ERROR:",
            eventError
          );
        }

        /* ----------------------------------
           BUILD SETTLEMENT
        ----------------------------------- */

        const settlement: Settlement = {
          id: crypto.randomUUID(),

          order_id:
            deliveredOrder.id,

          vendor_id:
            deliveredOrder.vendor_id,

          rider_id:
            deliveredOrder.rider_id,

          territory_id: null,

          order_total:
            Number(
              deliveredOrder.total || 0
            ),

          vendor_amount:
            Number(
              deliveredOrder.vendor_amount || 0
            ),

          rider_amount:
            Number(
              deliveredOrder.rider_amount || 0
            ),

          mkh_platform_amount:
            Number(
              deliveredOrder.platform_fee || 0
            ),

          mkh_delivery_amount:
            Number(
              deliveredOrder.delivery_fee || 0
            ) -
            Number(
              deliveredOrder.rider_amount || 0
            ),

          service_charge: 0,

          status: "completed",

          settled_at:
            new Date().toISOString(),

          created_at:
            new Date().toISOString(),
        };

        console.log(
          "🚀 RIDER DELIVERY → SETTLEMENT"
        );

        console.log(
          "SETTLEMENT CREATED:",
          settlement
        );

        /* ----------------------------------
           PROCESS FINANCIAL SETTLEMENT
        ----------------------------------- */

        const settlementResult =
          await processSettlement(
            settlement
          );

        console.log(
          "SETTLEMENT RESULT:",
          settlementResult
        );

        if (
          !settlementResult?.success
        ) {
          console.error(
            "❌ SETTLEMENT FAILED:",
            settlementResult
          );

          alert(
            "Delivery was completed, but financial settlement requires attention."
          );

          await loadDashboard();

          return;
        }

        console.log(
          "✅ RIDER DELIVERY + SETTLEMENT COMPLETE"
        );

        alert(
          "Delivery completed successfully."
        );

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

  async function verifyOtp(
    orderId: string,
    correctOtp: string
  ) {
    const enteredOtp =
      otpInputs[orderId];

    if (
      enteredOtp !== correctOtp
    ) {
      alert("Incorrect OTP");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert(
        "Rider session not found."
      );

      return;
    }

    const {
      data: order,
      error: orderError,
    } = await supabase
      .from("orders")
      .select(
        "id, rider_id, status, delivery_otp"
      )
      .eq("id", orderId)
      .eq("rider_id", user.id)
      .single();

    if (orderError || !order) {
      console.error(
        "OTP ORDER LOOKUP ERROR:",
        orderError
      );

      alert(
        "Unable to verify this delivery."
      );

      return;
    }

    if (
      order.status !== "picked_up"
    ) {
      alert(
        "OTP can only be verified after pickup."
      );

      return;
    }

    if (
      order.delivery_otp !==
      enteredOtp
    ) {
      alert("Incorrect OTP");
      return;
    }

    const {
      error: otpError,
    } = await supabase
      .from("orders")
      .update({
        otp_verified: true,
      })
      .eq("id", orderId)
      .eq("rider_id", user.id);

    if (otpError) {
      console.error(
        "OTP UPDATE ERROR:",
        otpError
      );

      alert(
        otpError.message
      );

      return;
    }

    setOtpInputs((current) => ({
      ...current,
      [orderId]: "",
    }));

    alert(
      "OTP Verified. You can now complete the delivery."
    );

    await loadDashboard();
  }

  /* ----------------------------------
     GPS LOCATION
  ----------------------------------- */

  async function checkCurrentLocation() {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
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

        if (
          profileError ||
          profile?.role !== "rider"
        ) {
          console.warn(
            "GPS update blocked. User is not a rider."
          );

          return;
        }

        const {
          latitude,
          longitude,
          accuracy,
          heading,
          speed,
        } = position.coords;

        console.log(
          "SENDING LOCATION:",
          latitude,
          longitude,
          new Date().toLocaleTimeString()
        );

        console.log(
          "Authenticated User:",
          user.id
        );

        const {
          error,
        } = await supabase
          .from("rider_locations")
          .upsert(
            {
              rider_id: user.id,
              latitude,
              longitude,
              accuracy:
                accuracy || 0,
              heading:
                heading || 0,
              speed:
                speed || 0,
              location:
                `POINT(${longitude} ${latitude})`,
              updated_at:
                new Date(),
            },
            {
              onConflict:
                "rider_id",
            }
          );

        if (error) {
          console.error(
            "LOCATION ERROR:",
            error
          );
        } else {
          console.log(
            "LOCATION SAVED SUCCESSFULLY"
          );
        }
      },
      (error) => {
        console.error(
          "GPS ERROR:",
          error
        );

        switch (error.code) {
          case error.PERMISSION_DENIED:
            console.error(
              "Permission denied."
            );
            break;

          case error.POSITION_UNAVAILABLE:
            console.error(
              "Location unavailable."
            );
            break;

          case error.TIMEOUT:
            console.error(
              "Location request timed out."
            );
            break;

          default:
            console.error(
              "Unknown GPS error."
            );
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );
  }

  /* ----------------------------------
     LOGOUT
  ----------------------------------- */

  async function logout() {
    await supabase.auth.signOut();

    router.push("/login");
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
    <div
      className="
        min-h-screen
        bg-gray-100
        p-6
      "
    >
      <div
        className="
          max-w-6xl
          mx-auto
        "
      >
        {/* ----------------------------------
            HEADER
        ----------------------------------- */}

        <div
          className="
            flex
            justify-between
            items-center
            mb-10
          "
        >
          <div>
            <h1
              className="
                text-4xl
                font-bold
              "
            >
              Rider Dashboard
            </h1>

            <p
              className="
                text-gray-500
                mt-2
              "
            >
              Manage deliveries & earnings
            </p>
          </div>

          <button
            onClick={logout}
            className="
              bg-red-500
              text-white
              px-5
              py-3
              rounded-xl
              flex
              items-center
              gap-2
            "
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>

        {/* ----------------------------------
            NAVIGATION
        ----------------------------------- */}

        <div
          className="
            flex
            gap-4
            mb-8
          "
        >
          <button
            onClick={() =>
              setCurrentPage("active")
            }
            className={`
              px-6
              py-3
              rounded-xl
              font-semibold
              ${
                currentPage === "active"
                  ? "bg-orange-500 text-white"
                  : "bg-white"
              }
            `}
          >
            Active
          </button>

          <button
            onClick={() =>
              setCurrentPage("earnings")
            }
            className={`
              px-6
              py-3
              rounded-xl
              font-semibold
              ${
                currentPage === "earnings"
                  ? "bg-orange-500 text-white"
                  : "bg-white"
              }
            `}
          >
            Earnings
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
                p-8
                rounded-3xl
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
                p-8
                rounded-3xl
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
                          p-6
                          rounded-3xl
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
                              📞{" "}
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
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                order.delivery_address ||
                                  ""
                              )}`}
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
                              Open in Google Maps →
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

                        <button
                          onClick={() =>
                            acceptDelivery(
                              order.id
                            )
                          }
                          className="
                            bg-orange-500
                            text-white
                            px-6
                            py-3
                            rounded-xl
                            font-bold
                          "
                        >
                          Accept Delivery
                        </button>
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
                        rounded-3xl
                        p-6
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
                            📞{" "}
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
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                              order.delivery_address ||
                                ""
                            )}`}
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
                            Open in Google Maps →
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
                                verifyOtp(
                                  order.id,
                                  order.delivery_otp ||
                                    ""
                                )
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
      </div>
    </div>
  );
}