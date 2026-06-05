"use client";

import Image from "next/image";
import { Minus, Plus, Trash2, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { useCart } from "@/components/CartContext";

export default function CartPage() {

  const router = useRouter();

  const {
    items,
    addItem,
    removeItem,
    clearCart,
    subtotal,
  } = useCart();

  const deliveryFee = 1500;

  const total = subtotal + deliveryFee;

  return (

    <div className="min-h-screen bg-gray-50">

      <div className="max-w-5xl mx-auto px-4 py-8">

        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 mb-8"
        >

          <ArrowLeft className="w-5 h-5" />

          Back

        </button>

        <h1 className="text-3xl font-bold mb-8">

          Your Cart

        </h1>

        {items.length === 0 ? (

          <div className="bg-white rounded-2xl p-10 text-center shadow-sm">

            <h2 className="text-xl font-semibold mb-4">

              Cart is Empty

            </h2>

            <p className="text-gray-500 mb-6">

              Add delicious meals to continue.

            </p>

            <button
              onClick={() => router.push("/dashboard")}
              className="
                bg-orange-500
                text-white
                px-6
                py-3
                rounded-xl
                hover:bg-orange-600
              "
            >

              Browse Vendors

            </button>

          </div>

        ) : (

          <div className="grid lg:grid-cols-[1fr_380px] gap-8">

            <div className="space-y-5">

              {items.map((item) => (

                <div
                  key={item.id}
                  className="
                    bg-white
                    rounded-2xl
                    p-5
                    shadow-sm
                    border
                    border-gray-100
                  "
                >

                  <div className="flex gap-4">

                    <div className="relative w-24 h-24 flex-shrink-0">

                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="96px"
                        className="rounded-xl object-cover"
                      />

                    </div>

                    <div className="flex-1">

                      <h3 className="font-bold text-lg mb-2">

                        {item.name}

                      </h3>

                      <p className="text-gray-500 text-sm mb-3">

                        {item.description}

                      </p>

                      <p className="font-bold text-orange-500">

                        ₦{item.price.toLocaleString()}

                      </p>

                    </div>

                    <div className="flex flex-col justify-between">

                      <button
                        onClick={() => removeItem(item.id)}
                        className="self-end text-red-500"
                      >

                        <Trash2 className="w-5 h-5" />

                      </button>

                      <div className="flex items-center gap-3">

                        <button
                          onClick={() => removeItem(item.id)}
                          className="
                            w-8
                            h-8
                            rounded-full
                            bg-orange-100
                            flex
                            items-center
                            justify-center
                          "
                        >

                          <Minus className="w-4 h-4" />

                        </button>

                        <span className="font-bold">

                          {item.quantity}

                        </span>

                        <button
                          onClick={() => addItem(item)}
                          className="
                            w-8
                            h-8
                            rounded-full
                            bg-orange-500
                            text-white
                            flex
                            items-center
                            justify-center
                          "
                        >

                          <Plus className="w-4 h-4" />

                        </button>

                      </div>

                    </div>

                  </div>

                </div>

              ))}

            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm h-fit">

              <h2 className="text-2xl font-bold mb-6">

                Order Summary

              </h2>

              <div className="space-y-4 mb-6">

                <div className="flex justify-between">

                  <span>Subtotal</span>

                  <span>

                    ₦{subtotal.toLocaleString()}

                  </span>

                </div>

                <div className="flex justify-between">

                  <span>Delivery Fee</span>

                  <span>

                    ₦{deliveryFee.toLocaleString()}

                  </span>

                </div>

                <div className="border-t pt-4 flex justify-between font-bold text-xl">

                  <span>Total</span>

                  <span>

                    ₦{total.toLocaleString()}

                  </span>

                </div>

              </div>

              <button
                onClick={() => router.push("/checkout")}
                className="
                  w-full
                  bg-orange-500
                  text-white
                  py-4
                  rounded-xl
                  font-bold
                  mb-4
                  hover:bg-orange-600
                  transition-colors
                "
              >

                Proceed to Checkout

              </button>

              <button
                onClick={clearCart}
                className="
                  w-full
                  border
                  border-red-500
                  text-red-500
                  py-4
                  rounded-xl
                  hover:bg-red-50
                "
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