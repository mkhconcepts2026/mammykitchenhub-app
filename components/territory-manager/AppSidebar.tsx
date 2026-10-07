"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Radio,
  ShoppingBag,
  Bike,
  Store,
  Map,
  Wallet,
  LogOut,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import MKHBrandPanel from "./MKHBrandPanel";

const menuItems = [
  {
    label: "Executive Dashboard",
    icon: LayoutDashboard,
    href: "/territory-relationship-manager",
  },
  {
    label: "Live Operations",
    icon: Radio,
    href: "/territory-relationship-manager/live-operations",
  },
  {
    label: "Orders",
    icon: ShoppingBag,
    href: "/territory-relationship-manager/orders",
  },
  {
    label: "Riders",
    icon: Bike,
    href: "/territory-relationship-manager/riders",
  },
  {
    label: "Vendors",
    icon: Store,
    href: "/territory-relationship-manager/vendors",
  },
  {
    label: "Territory Map",
    icon: Map,
    href: "/territory-relationship-manager/territory-map",
  },
  {
    label: "Finance",
    icon: Wallet,
    href: "/territory-relationship-manager/finance",
  },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="flex w-72 flex-col bg-slate-900 text-white">

      <MKHBrandPanel />

      {/* Navigation */}
      <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">

        {menuItems.map((item) => {
          const Icon = item.icon;

          const active =
            item.href === "/territory-relationship-manager"
              ? pathname === item.href
              : pathname === item.href ||
                pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 ${
                active
                  ? "bg-emerald-600 text-white shadow-lg"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon size={20} />

              <span className="text-sm font-medium">
                {item.label}
              </span>
            </Link>
          );
        })}

      </nav>

      {/* Logout */}
      <div className="border-t border-slate-800 p-5">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl bg-slate-800 px-4 py-3 text-slate-300 transition-all duration-200 hover:bg-red-600 hover:text-white"
        >
          <LogOut size={20} />

          <span className="text-sm font-semibold">
            Logout
          </span>
        </button>
      </div>

    </aside>
  );
}