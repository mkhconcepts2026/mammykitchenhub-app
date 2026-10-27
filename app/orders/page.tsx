"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  price: number | string;
};

type Order = {
  id: string;
  status: string;
  vendor_id: string | null;
  total: number | string;
  created_at: string;
  delivery_address: string | null;
  customer_notes: string | null;
  order_items: OrderItem[] | null;
  rider: { full_name: string | null; phone: string | null } | null;
};

const statuses = [
  "pending",
  "accepted",
  "preparing",
  "ready_for_pickup",
  "assigned",
  "picked_up",
  "delivered",
];

const otpEligibleStatuses = ["accepted", "assigned", "picked_up"];

function badgeColor(status: string) {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-700";
    case "accepted":
      return "bg-blue-100 text-blue-700";
    case "preparing":
      return "bg-purple-100 text-purple-700";
    case "ready_for_pickup":
      return "bg-orange-100 text-orange-700";
    case "assigned":
      return "bg-blue-100 text-blue-700";
    case "picked_up":
      return "bg-indigo-100 text-indigo-700";
    case "delivered":
      return "bg-green-100 text-green-700";
    case "cancelled":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function formatNaira(value: number | string | null | undefined) {
  return `₦${Number(value ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveryOtps, setDeliveryOtps] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState("");
  const [reviewRatings, setReviewRatings] = useState<Record<string, number>>({});
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [reviewSubmitting, setReviewSubmitting] = useState<Record<string, boolean>>({});
  const [reviewMessages, setReviewMessages] = useState<
    Record<string, { type: "success" | "error"; text: string }>
  >({});
  const [reviewedOrderIds, setReviewedOrderIds] = useState<string[]>([]);

  const loadOrders = useCallback(async () => {
    const supabase = createClient();

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setOrders([]);
        setDeliveryOtps({});
        setReviewedOrderIds([]);
        setLoadError("Please sign in to view your orders.");
        return;
      }

      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          status,
          vendor_id,
          total,
          created_at,
          delivery_address,
          customer_notes,
          order_items (
            id,
            name,
            quantity,
            price
          ),
          rider:profiles!orders_rider_id_fkey (
            full_name,
            phone
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("LOAD ORDERS ERROR:", error);
        setLoadError("Unable to load your orders. Please try again.");
        return;
      }

      const customerOrders = (data ?? []) as unknown as Order[];
      setOrders(customerOrders);
      setLoadError("");

      const { data: existingReviews, error: existingReviewsError } =
        await supabase
          .from("customer_reviews")
          .select("order_id")
          .eq("customer_id", user.id);

      if (existingReviewsError) {
        console.error("LOAD CUSTOMER REVIEWS ERROR:", existingReviewsError);
      } else {
        setReviewedOrderIds(
          (existingReviews ?? []).map((review) => review.order_id as string)
        );
      }

      const eligibleOrders = customerOrders.filter((order) =>
        otpEligibleStatuses.includes(order.status)
      );

      const otpResults = await Promise.all(
        eligibleOrders.map(async (order) => {
          const { data: otp, error: otpError } = await supabase.rpc(
            "get_my_delivery_otp",
            { p_order_id: order.id }
          );

          if (otpError || typeof otp !== "string" || !/^\d{4}$/.test(otp)) {
            return null;
          }

          return [order.id, otp] as const;
        })
      );

      const nextOtps: Record<string, string> = {};

      for (const result of otpResults) {
        if (result) {
          nextOtps[result[0]] = result[1];
        }
      }

      setDeliveryOtps(nextOtps);
    } catch (error) {
      console.error("LOAD ORDERS ERROR:", error);
      setLoadError("Something went wrong while loading your orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  const submitReview = async (order: Order) => {
    const rating = reviewRatings[order.id];

    if (!rating || rating < 1 || rating > 5) {
      setReviewMessages((current) => ({
        ...current,
        [order.id]: {
          type: "error",
          text: "Please select a rating from 1 to 5 stars.",
        },
      }));
      return;
    }

    if (!order.vendor_id) {
      setReviewMessages((current) => ({
        ...current,
        [order.id]: {
          type: "error",
          text: "We couldn't verify the vendor for this order. Please contact support.",
        },
      }));
      return;
    }

    setReviewSubmitting((current) => ({ ...current, [order.id]: true }));
    setReviewMessages((current) => {
      const next = { ...current };
      delete next[order.id];
      return next;
    });

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setReviewMessages((current) => ({
          ...current,
          [order.id]: {
            type: "error",
            text: "Please sign in again before submitting your review.",
          },
        }));
        return;
      }

      const { error: insertError } = await supabase
        .from("customer_reviews")
        .insert({
          order_id: order.id,
          customer_id: user.id,
          vendor_id: order.vendor_id,
          rating,
          comment: (reviewComments[order.id] ?? "").trim() || null,
        });

      if (insertError) {
        let message =
          "We couldn't submit your review. Please try again.";

        if (insertError.code === "23505") {
          message = "A review has already been submitted for this order.";
        } else if (insertError.code === "42501") {
          message =
            "This order is not yet eligible for review. Please try again after delivery is confirmed.";
        } else {
          console.error("CUSTOMER REVIEW SUBMISSION ERROR:", insertError);
        }

        setReviewMessages((current) => ({
          ...current,
          [order.id]: { type: "error", text: message },
        }));
        return;
      }

      setReviewedOrderIds((current) =>
        current.includes(order.id) ? current : [...current, order.id]
      );

      setReviewMessages((current) => ({
        ...current,
        [order.id]: {
          type: "success",
          text: "Thank you! Your review has been submitted.",
        },
      }));
    } catch (error) {
      console.error("CUSTOMER REVIEW SUBMISSION ERROR:", error);
      setReviewMessages((current) => ({
        ...current,
        [order.id]: {
          type: "error",
          text: "Something went wrong while submitting your review. Please try again.",
        },
      }));
    } finally {
      setReviewSubmitting((current) => ({ ...current, [order.id]: false }));
    }
  };

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    const initialLoadId = window.setTimeout(() => {
      if (active) void loadOrders();
    }, 0);

    const channel = supabase
      .channel("customer-orders-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          if (active) void loadOrders();
        }
      )
      .subscribe();

    // Polling ensures the OTP is checked even if a realtime event is missed.
    const intervalId = window.setInterval(() => {
      if (active) void loadOrders();
    }, 10000);

    return () => {
      active = false;
      window.clearTimeout(initialLoadId);
      window.clearInterval(intervalId);
      void supabase.removeChannel(channel);
    };
  }, [loadOrders]);

  async function cancelOrder(orderId: string) {
    if (!confirm("Cancel this order?")) return;

    const supabase = createClient();

    try {
      const { data, error } = await supabase.rpc("cancel_my_order", {
        p_order_id: orderId,
      });

      if (error) {
        console.error("CANCEL ORDER ERROR:", error);
        alert(error.message || "Failed to cancel order.");
        return;
      }

      if (!data?.success) {
        alert("The order could not be cancelled.");
        return;
      }

      alert("Order cancelled successfully.");
      await loadOrders();
    } catch (error) {
      console.error("CANCEL ORDER ERROR:", error);
      alert("An unexpected error occurred while cancelling the order.");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <h1 className="text-2xl font-bold">Loading Orders...</h1>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold sm:text-4xl">My Orders</h1>

          <Link
            href="/dashboard"
            className="rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white hover:bg-orange-600"
          >
            Continue Shopping
          </Link>
        </div>

        {loadError && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-red-700">
            {loadError}
            <button
              onClick={() => void loadOrders()}
              className="ml-3 font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <h2 className="mb-3 text-2xl font-bold">No Orders Yet</h2>
            <p className="text-gray-600">
              Your orders will appear here after you place an order.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => {
              const progressStatuses = statuses.filter(
                (status) => status !== "assigned"
              );
              const currentIndex = progressStatuses.indexOf(order.status);
              const isCancelled = order.status === "cancelled";
              const otp = deliveryOtps[order.id];

              return (
                <article
                  key={order.id}
                  className="rounded-2xl bg-white p-6 shadow-sm"
                >
                  <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold">Order</h2>
                      <p className="break-all text-sm text-gray-500">
                        {order.id}
                      </p>

                      <div className="mt-4 space-y-2 text-sm">
                        <p>
                          <strong>Delivery Address:</strong>{" "}
                          {order.delivery_address || "N/A"}
                        </p>

                        {order.customer_notes && (
                          <p>
                            <strong>Notes:</strong> {order.customer_notes}
                          </p>
                        )}

                        {order.rider?.full_name && (
                          <p>
                            <strong>Rider:</strong> {order.rider.full_name}
                            {order.rider.phone ? ` · ${order.rider.phone}` : ""}
                          </p>
                        )}
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-4 py-2 capitalize ${badgeColor(
                        order.status
                      )}`}
                    >
                      {order.status.replaceAll("_", " ")}
                    </span>
                  </div>

                  <section className="mb-8">
                    <h3 className="mb-4 font-bold">Order Progress</h3>

                    {isCancelled ? (
                      <p className="rounded-xl bg-red-50 p-3 text-red-700">
                        This order was cancelled.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {progressStatuses.map((step, index) => (
                          <div
                            key={step}
                            className={`rounded-full px-3 py-2 text-sm capitalize ${
                              currentIndex >= 0 && index <= currentIndex
                                ? "bg-green-500 text-white"
                                : "bg-gray-200 text-gray-500"
                            }`}
                          >
                            {step.replaceAll("_", " ")}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {!isCancelled && (
                    <section className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 p-5">
                      {otp ? (
                        <>
                          <h3 className="mb-2 font-bold text-orange-800">
                            Your Delivery Verification Code
                          </h3>
                          <p className="mb-3 text-sm text-gray-700">
                            Keep this code private. Give it to your rider when
                            your order arrives so the delivery can be verified.
                          </p>
                          <p className="text-3xl font-bold tracking-[0.4em] text-orange-600">
                            {otp}
                          </p>
                        </>
                      ) : (
                        <>
                          <h3 className="mb-2 font-bold text-orange-800">
                            Your Delivery Code
                          </h3>
                          <p className="text-sm text-gray-700">
                            {otpEligibleStatuses.includes(order.status)
                              ? "Your code is not available yet. This page checks again automatically."
                              : "Your delivery code will appear here after a rider accepts your order."}
                          </p>
                        </>
                      )}
                    </section>
                  )}

                  <section className="mb-6">
                    <h3 className="mb-3 font-bold">Items Ordered</h3>

                    {order.order_items?.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between gap-4 py-2"
                      >
                        <span>
                          {item.quantity} × {item.name}
                        </span>
                        <span className="shrink-0">
                          {formatNaira(item.price)}
                        </span>
                      </div>
                    ))}
                  </section>

                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 pt-4">
                    <div>
                      <p className="text-sm text-gray-600">
                        {new Date(order.created_at).toLocaleDateString(
                          "en-NG",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </p>
                      <p className="text-xl font-bold text-orange-500">
                        {formatNaira(order.total)}
                      </p>
                    </div>

                    {order.status === "pending" && (
                      <button
                        onClick={() => void cancelOrder(order.id)}
                        className="rounded-xl bg-red-500 px-5 py-3 text-white hover:bg-red-600"
                      >
                        Cancel Order
                      </button>
                    )}
                  </div>

                  {["delivered", "completed"].includes(
                    order.status.trim().toLowerCase()
                  ) && (
                    <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                      {reviewedOrderIds.includes(order.id) ? (
                        <div role="status" className="text-green-800">
                          <h3 className="font-bold">
                            {reviewMessages[order.id]?.type === "success"
                              ? "Review submitted"
                              : "Already reviewed"}
                          </h3>
                          <p className="mt-1 text-sm">
                            {reviewMessages[order.id]?.text ??
                              "You've already reviewed this order."}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div>
                            <h3 className="font-bold text-gray-900">
                              Rate Your Order
                            </h3>
                            <p className="mt-1 text-sm text-gray-600">
                              How was your experience? Your comment is optional.
                            </p>
                          </div>

                          <div>
                            <div
                              role="group"
                              aria-label="Select a rating from one to five stars"
                              className="flex items-center gap-1"
                            >
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  aria-label={`Rate ${star} out of 5 stars`}
                                  aria-pressed={reviewRatings[order.id] === star}
                                  disabled={Boolean(reviewSubmitting[order.id])}
                                  onClick={() =>
                                    setReviewRatings((current) => ({
                                      ...current,
                                      [order.id]: star,
                                    }))
                                  }
                                  className={`rounded-md p-1 text-3xl leading-none transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                    star <= (reviewRatings[order.id] ?? 0)
                                      ? "text-amber-400"
                                      : "text-gray-300 hover:text-amber-300"
                                  }`}
                                >
                                  ★
                                </button>
                              ))}
                            </div>
                            <p className="mt-1 text-sm text-gray-600">
                              {reviewRatings[order.id]
                                ? `${reviewRatings[order.id]} out of 5 stars selected`
                                : "Select your rating"}
                            </p>
                          </div>

                          <div>
                            <label
                              htmlFor={`review-comment-${order.id}`}
                              className="mb-2 block text-sm font-semibold text-gray-700"
                            >
                              Comment (optional)
                            </label>
                            <textarea
                              id={`review-comment-${order.id}`}
                              rows={3}
                              maxLength={1000}
                              disabled={Boolean(reviewSubmitting[order.id])}
                              value={reviewComments[order.id] ?? ""}
                              onChange={(event) =>
                                setReviewComments((current) => ({
                                  ...current,
                                  [order.id]: event.target.value,
                                }))
                              }
                              placeholder="Tell us what you liked or what we could improve."
                              className="w-full rounded-xl border border-gray-300 bg-white p-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:opacity-60"
                            />
                            <p className="mt-1 text-right text-xs text-gray-500">
                              {(reviewComments[order.id] ?? "").length}/1000
                            </p>
                          </div>

                          {reviewMessages[order.id]?.type === "error" && (
                            <p
                              role="alert"
                              className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
                            >
                              {reviewMessages[order.id]?.text}
                            </p>
                          )}

                          <button
                            type="button"
                            disabled={
                              !reviewRatings[order.id] ||
                              Boolean(reviewSubmitting[order.id])
                            }
                            onClick={() => void submitReview(order)}
                            className="rounded-xl bg-[#ff6b00] px-5 py-3 font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {reviewSubmitting[order.id]
                              ? "Submitting..."
                              : "Submit Review"}
                          </button>
                        </div>
                      )}
                    </section>
                  )}

                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
