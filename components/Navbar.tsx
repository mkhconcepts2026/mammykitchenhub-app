
"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPin, ShoppingCart, User, Menu } from "lucide-react";
import { useCart } from "@/components/CartContext";

export function Navbar() {
  const { totalItems } = useCart();

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex min-h-[76px] items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Browse vendors"
              onClick={() => {
                window.location.href = "/dashboard";
              }}
              className="flex-shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 lg:hidden"
            >
              <Menu className="h-6 w-6 text-gray-700" />
            </button>

            <Link
              href="/dashboard"
              aria-label="Mammy Kitchen Hub home"
              className="flex-shrink-0"
            >
              <Image
                src="/logo.png"
                alt="Mammy Kitchen Hub"
                width={180}
                height={52}
                priority
                className="h-auto w-[125px] sm:w-[155px] lg:w-[180px]"
              />
            </Link>
          </div>

          <div className="hidden items-center gap-2 rounded-xl bg-orange-50 px-3 py-2 sm:flex">
            <MapPin className="h-5 w-5 flex-shrink-0 text-orange-600" />
            <div>
              <p className="text-xs text-gray-500">Deliver to</p>
              <p className="text-sm font-semibold text-gray-800">
                Lagos, Nigeria
              </p>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href="/cart"
              aria-label={`Shopping cart, ${totalItems} items`}
              className="relative flex h-11 w-11 items-center justify-center rounded-xl text-gray-700 transition hover:bg-orange-50 hover:text-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            >
              <ShoppingCart className="h-6 w-6" />

              {totalItems > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-xs font-bold text-white">
                  {totalItems > 99 ? "99+" : totalItems}
                </span>
              )}
            </Link>

            <Link
              href="/customer-dashboard"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-gray-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 sm:px-4"
            >
              <User className="h-5 w-5" />
              <span className="hidden sm:inline">Profile</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
