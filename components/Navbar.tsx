"use client";

import Image from "next/image";
import { MapPin, ShoppingCart, User, Menu } from "lucide-react";

interface NavbarProps {
  cartCount?: number;
}

export function Navbar({ cartCount = 0 }: NavbarProps) {
  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">

      <div className="max-w-7xl mx-auto px-4 py-3">

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-4">

            <button className="lg:hidden">
              <Menu className="w-6 h-6" />
            </button>

            <Image
              src="/logo.png"
              alt="MKH Logo"
              width={140}
              height={50}
              className="h-10 w-auto"
              priority
            />

          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">

            <MapPin className="w-5 h-5 text-primary" />

            <div className="hidden sm:block">

              <p className="text-sm text-gray-500">
                Deliver to
              </p>

              <p className="font-medium text-sm">
                Lagos, Nigeria
              </p>

            </div>

          </div>

          <div className="flex items-center gap-4">

            <button className="relative">

              <ShoppingCart className="w-6 h-6 text-gray-700" />

              {cartCount > 0 && (

                <span className="absolute -top-2 -right-2 bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">

                  {cartCount}

                </span>

              )}

            </button>

            <button className="hidden sm:flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg">

              <User className="w-5 h-5" />

              <span>Profile</span>

            </button>

          </div>

        </div>

      </div>

    </nav>
  );
}