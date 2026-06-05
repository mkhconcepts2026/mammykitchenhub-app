"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/components/CartContext";

export function CartBar() {

  const {
    totalItems,
    subtotal,
  } = useCart();

  if (totalItems === 0) return null;

  return (

    <Link
      href="/cart"
      className="
        fixed
        bottom-5
        left-1/2
        -translate-x-1/2
        z-50
        w-[92%]
        max-w-md
      "
    >

      <div
        className="
          bg-orange-500
          text-white
          rounded-2xl
          shadow-2xl
          px-5
          py-4
          flex
          items-center
          justify-between
          cursor-pointer
          hover:bg-orange-600
          transition-colors
        "
      >

        <div className="flex items-center gap-3">

          <ShoppingCart className="w-6 h-6" />

          <div>

            <p className="font-bold">

              {totalItems} Item
              {totalItems > 1 ? "s" : ""}

            </p>

            <p className="text-sm opacity-90">

              View Cart

            </p>

          </div>

        </div>

        <p className="font-bold">

          ₦{subtotal.toLocaleString()}

        </p>

      </div>

    </Link>

  );
}