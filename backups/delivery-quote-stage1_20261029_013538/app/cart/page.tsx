
"use client";

import Image from "next/image";
import {
  Minus,
  Plus,
  Trash2,
  ArrowLeft,
  ShoppingCart,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/CartContext";

export default function CartPage() {
  const router = useRouter();

  const {
    items,
    addItem,
    decreaseItemQuantity,
    removeItem,
    clearCart,
    subtotal,
  } = useCart();

  const deliveryFee = 1500;
  const platformFee = 300;
  const total = subtotal + deliveryFee + platformFee;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-8 flex items-center gap-2 rounded-lg text-gray-700 transition hover:text-orange-600"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>

        <h1 className="mb-8 text-3xl font-bold text-gray-900">
          Your Cart
        </h1>

        {items.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-50">
              <ShoppingCart className="h-8 w-8 text-orange-500" />
            </div>

            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Your Cart is Empty
            </h2>

            <p className="mb-6 text-gray-500">
              Add delicious meals to continue.
            </p>

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="rounded-xl bg-orange-500 px-6 py-3 font-bold text-white transition hover:bg-orange-600"
            >
              Browse Vendors
            </button>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
            <div className="space-y-5">
              {items.map((item) => (
                <div
                  key={`${item.vendor_id}-${item.id}`}
                  className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
                >
                  <div className="flex gap-4">
                    <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-orange-50">
                      <Image
                        src={item.image || "/placeholder-food.jpg"}
                        alt={item.name}
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="mb-2 text-lg font-bold text-gray-900">
                        {item.name}
                      </h3>

                      {item.description && (
                        <p className="mb-3 text-sm text-gray-500">
                          {item.description}
                        </p>
                      )}

                      <p className="font-bold text-orange-600">
                        ₦{item.price.toLocaleString("en-NG")}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        Line total: ₦
                        {(item.price * item.quantity).toLocaleString("en-NG")}
                      </p>
                    </div>

                    <div className="flex flex-col items-end justify-between gap-4">
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        aria-label={`Remove ${item.name} from cart`}
                        className="rounded-lg p-2 text-red-500 transition hover:bg-red-50"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            decreaseItemQuantity(item.id)
                          }
                          aria-label={`Decrease ${item.name} quantity`}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-gray-800 transition hover:bg-orange-200"
                        >
                          <Minus className="h-4 w-4" />
                        </button>

                        <span
                          className="min-w-5 text-center font-bold text-gray-900"
                          aria-live="polite"
                        >
                          {item.quantity}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            addItem({
                              ...item,
                              quantity: 1,
                            })
                          }
                          aria-label={`Increase ${item.name} quantity`}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-white transition hover:bg-orange-600"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="h-fit rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-6 text-2xl font-bold text-gray-900">
                Order Summary
              </h2>

              <div className="mb-6 space-y-4">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">
                    ₦{subtotal.toLocaleString("en-NG")}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-gray-600">Delivery Fee</span>
                  <span className="font-medium">
                    ₦{deliveryFee.toLocaleString("en-NG")}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-gray-600">Platform Fee</span>
                  <span className="font-medium">
                    ₦{platformFee.toLocaleString("en-NG")}
                  </span>
                </div>

                <div className="flex justify-between border-t pt-4 text-xl font-bold">
                  <span>Total</span>
                  <span className="text-orange-600">
                    ₦{total.toLocaleString("en-NG")}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push("/checkout")}
                className="mb-4 w-full rounded-xl bg-orange-500 py-4 font-bold text-white transition hover:bg-orange-600"
              >
                Proceed to Checkout
              </button>

              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Are you sure you want to remove all items from your cart?"
                    )
                  ) {
                    clearCart();
                  }
                }}
                className="w-full rounded-xl border border-red-200 py-3 font-semibold text-red-500 transition hover:bg-red-50"
              >
                Clear Cart
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
