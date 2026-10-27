"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle, Receipt, Clock, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Order = {
  id: string;
  status: string;
  total: number | string;
};

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order");

  const [order, setOrder] = useState<Order | null>(null);
  const [otp, setOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderNotFound, setOrderNotFound] = useState(false);

  useEffect(() => {
    if (!orderId) {
      return;
    }

    let cancelled = false;

    async function refreshOrder() {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("orders")
        .select("id, status, total")
        .eq("id", orderId)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setOrderNotFound(true);
        setLoading(false);
        return;
      }

      setOrderNotFound(false);
      setOrder(data as Order);

      const eligibleStatuses = ["accepted", "assigned", "picked_up"];

      if (eligibleStatuses.includes(data.status)) {
        const { data: code, error: otpError } = await supabase.rpc(
          "get_my_delivery_otp",
          { p_order_id: orderId }
        );

        if (!cancelled) {
          setOtp(!otpError && code ? String(code) : null);
        }
      } else {
        setOtp(null);
      }

      if (!cancelled) setLoading(false);
    }

    void refreshOrder();

    const intervalId = window.setInterval(() => {
      void refreshOrder();
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [orderId]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-lg font-semibold">Loading your order...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-lg sm:p-10">
        <CheckCircle className="mx-auto mb-5 h-16 w-16 text-green-500" />

        <h1 className="mb-3 text-3xl font-bold text-gray-900">
          Order Successful!
        </h1>

        <p className="mb-8 text-gray-600">
          Your order has been placed successfully.
        </p>

        {orderNotFound && (
          <p className="mb-6 rounded-xl bg-amber-50 p-4 text-amber-800">
            We could not load your order details. Please check My Orders.
          </p>
        )}

        {order && (
          <div className="mb-8 space-y-4 text-left">
            <div className="flex items-center gap-4 rounded-2xl bg-gray-50 p-5">
              <Receipt className="h-8 w-8 shrink-0 text-orange-500" />
              <div className="min-w-0">
                <p className="font-semibold">Order ID</p>
                <p className="break-all text-sm text-gray-500">{order.id}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-2xl bg-gray-50 p-5">
              <Clock className="h-8 w-8 shrink-0 text-orange-500" />
              <div>
                <p className="font-semibold">Order Status</p>
                <p className="capitalize text-gray-600">
                  {order.status.replaceAll("_", " ")}
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="mb-2 font-semibold">Order Total</p>
              <p className="text-2xl font-bold text-orange-500">
                {"\u20A6"}
                {Number(order.total ?? 0).toLocaleString("en-NG", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>

            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6 text-center">
              <ShieldCheck className="mx-auto mb-3 h-9 w-9 text-orange-600" />

              {otp ? (
                <>
                  <p className="font-semibold text-gray-900">
                    Your Delivery Verification Code
                  </p>
                  <p className="my-3 text-4xl font-bold tracking-[0.35em] text-orange-600">
                    {otp}
                  </p>
                  <p className="text-sm text-gray-600">
                    Keep this code private and give it to your rider when
                    your order arrives, so the delivery can be verified.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-gray-900">
                    Your Delivery Code
                  </p>
                  <p className="mt-2 text-sm text-gray-600">
                    Your code will appear here after a rider accepts your
                    order. This page checks automatically every 10 seconds.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <Link
            href="/orders"
            className="block rounded-2xl bg-orange-500 px-8 py-4 font-semibold text-white hover:bg-orange-600"
          >
            View My Orders
          </Link>

          <Link
            href="/dashboard"
            className="block rounded-2xl border border-gray-300 px-8 py-4 font-semibold text-gray-700 hover:bg-gray-100"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <p className="text-lg font-semibold">Loading...</p>
        </main>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}

