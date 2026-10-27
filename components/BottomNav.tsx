
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Search,
  ShoppingCart,
  User,
} from "lucide-react";
import { useCart } from "@/components/CartContext";

export function BottomNav() {
  const pathname = usePathname();
  const { totalItems } = useCart();

  const navItems = [
    {
      label: "Home",
      href: "/dashboard",
      icon: Home,
    },
    {
      label: "Search",
      href: "/dashboard#vendor-search",
      icon: Search,
    },
    {
      label: "Cart",
      href: "/cart",
      icon: ShoppingCart,
    },
    {
      label: "Account",
      href: "/customer-dashboard",
      icon: User,
    },
  ];

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        {navItems.map((item) => {
          const Icon = item.icon;

          const isActive =
            item.label === "Home"
              ? pathname === "/dashboard"
              : item.label === "Cart"
                ? pathname === "/cart"
                : item.label === "Account"
                  ? pathname === "/customer-dashboard"
                  : false;

          return (
            <Link
              key={item.label}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-3 py-1 transition-colors ${
                isActive
                  ? "text-orange-500"
                  : "text-gray-500 hover:text-orange-500"
              }`}
            >
              <span className="relative">
                <Icon className="h-6 w-6" />

                {item.label === "Cart" && totalItems > 0 && (
                  <span className="absolute -right-3 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                    {totalItems > 99 ? "99+" : totalItems}
                  </span>
                )}
              </span>

              <span
                className={`text-xs ${
                  isActive ? "font-semibold" : "font-medium"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
