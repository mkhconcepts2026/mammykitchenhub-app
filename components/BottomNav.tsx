"use client";

import {
  Home,
  Search,
  ShoppingCart,
  User,
} from "lucide-react";

interface BottomNavProps {
  cartCount?: number;
}

export function BottomNav({
  cartCount = 0,
}: BottomNavProps) {

  return (

    <nav
      className="
        lg:hidden
        fixed
        bottom-0
        left-0
        right-0
        bg-white
        border-t
        border-gray-200
        z-50
      "
    >

      <div
        className="
          flex
          items-center
          justify-around
          py-3
        "
      >

        <button
          className="
            flex
            flex-col
            items-center
            gap-1
            text-orange-500
          "
        >

          <Home className="w-6 h-6" />

          <span className="text-xs font-medium">

            Home

          </span>

        </button>

        <button
          className="
            flex
            flex-col
            items-center
            gap-1
            text-gray-500
          "
        >

          <Search className="w-6 h-6" />

          <span className="text-xs">

            Search

          </span>

        </button>

        <button
          className="
            flex
            flex-col
            items-center
            gap-1
            text-gray-500
            relative
          "
        >

          <ShoppingCart className="w-6 h-6" />

          <span className="text-xs">

            Cart

          </span>

          {cartCount > 0 && (

            <span
              className="
                absolute
                -top-1
                right-4
                bg-orange-500
                text-white
                text-xs
                rounded-full
                w-5
                h-5
                flex
                items-center
                justify-center
              "
            >

              {cartCount}

            </span>

          )}

        </button>

        <button
          className="
            flex
            flex-col
            items-center
            gap-1
            text-gray-500
          "
        >

          <User className="w-6 h-6" />

          <span className="text-xs">

            Account

          </span>

        </button>

      </div>

    </nav>

  );
}