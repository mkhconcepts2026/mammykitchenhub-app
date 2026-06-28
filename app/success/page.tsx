"use client";

import {
  Suspense,
  useEffect,
  useState
} from "react";

import Link from "next/link";

import { useSearchParams }
from "next/navigation";

import {
  CheckCircle,
  Receipt,
  Clock,
} from "lucide-react";

import { createClient }
from "@/lib/supabase/client";

function SuccessContent() {

  const searchParams =
    useSearchParams();

  const orderId =
    searchParams.get("order");

  const supabase =
    createClient();

  const [order,
    setOrder] =
    useState<any>(null);

  const [loading,
    setLoading] =
    useState(true);

  useEffect(() => {

    async function loadOrder() {

      if (!orderId) {

        setLoading(false);

        return;
      }

      const {
        data,
        error,
      } =
        await supabase
          .from("orders")
          .select("*")
          .eq(
            "id",
            orderId
          )
          .single();

      if (!error) {

        setOrder(data);
      }

      setLoading(false);
    }

    loadOrder();

  }, [orderId]);

  if (loading) {

    return (

      <main className="min-h-screen flex items-center justify-center">

        <h1 className="text-2xl font-bold">

          Loading Order...

        </h1>

      </main>

    );
  }

  return (

    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">

      <div className="bg-white rounded-3xl shadow-lg p-10 max-w-xl w-full text-center">

        <CheckCircle
          className="
            w-20
            h-20
            text-green-500
            mx-auto
            mb-6
          "
        />

        <h1 className="text-4xl font-bold mb-4">

          Order Successful 🎉

        </h1>

        <p className="text-gray-500 mb-8">

          Your order has been placed successfully.

        </p>

        {order && (

          <div className="space-y-5 mb-10">

            <div className="bg-gray-50 rounded-2xl p-5 flex gap-4 items-center">

              <Receipt
                className="
                  text-orange-500
                  w-8
                  h-8
                "
              />

              <div className="text-left">

                <p className="font-semibold">

                  Order ID

                </p>

                <p className="text-gray-500 break-all">

                  {order.id}

                </p>

              </div>

            </div>

            <div className="bg-gray-50 rounded-2xl p-5 flex gap-4 items-center">

              <Clock
                className="
                  text-orange-500
                  w-8
                  h-8
                "
              />

              <div className="text-left">

                <p className="font-semibold">

                  Status

                </p>

                <p className="text-gray-500 capitalize">

                  {order.status}

                </p>

              </div>

            </div>

            <div className="bg-gray-50 rounded-2xl p-5">

              <p className="font-semibold mb-2">

                Total

              </p>

              <p className="text-2xl font-bold text-orange-500">

                ₦
                {order.total.toLocaleString()}

              </p>

            </div>

          </div>

        )}

        <div className="space-y-4">

          <Link
            href="/orders"
            className="
              block
              bg-orange-500
              text-white
              px-8
              py-4
              rounded-2xl
              font-semibold
              hover:bg-orange-600
            "
          >

            View My Orders

          </Link>

          <Link
            href="/dashboard"
            className="
              block
              border
              border-gray-300
              text-gray-700
              px-8
              py-4
              rounded-2xl
              font-semibold
              hover:bg-gray-100
            "
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

        <main className="min-h-screen flex items-center justify-center">

          <h1 className="text-2xl font-bold">

            Loading...

          </h1>

        </main>

      }
    >

      <SuccessContent />

    </Suspense>

  );

}