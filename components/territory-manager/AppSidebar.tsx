"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Radio,
  ShoppingBag,
  Bike,
  Store,
  Map,
  Wallet,
  AlertTriangle,
  BarChart3,
  FileBarChart2,
  Settings,
} from "lucide-react";

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
  {
    label: "Exception Center",
    icon: AlertTriangle,
    href: "/territory-relationship-manager/exceptions",
  },
  {
    label: "Business Intelligence",
    icon: BarChart3,
    href: "/territory-relationship-manager/analytics",
  },
  {
    label: "Reports",
    icon: FileBarChart2,
    href: "/territory-relationship-manager/reports",
  },
  {
    label: "Settings",
    icon: Settings,
    href: "/territory-relationship-manager/settings",
  },
];

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-72 bg-slate-900 text-white flex flex-col">

      <MKHBrandPanel />

      {/* Navigation */}

      <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">

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

      {/* Footer */}

      <div className="border-t border-slate-800 p-5">

        <div className="rounded-xl bg-slate-800 p-4">

          <p className="text-xs text-slate-400">

            Territory Relationship Manager

          </p>

          <p className="text-sm font-semibold mt-1">

            Operations Center V4.0

          </p>

        </div>

      </div>

    </aside>
  );
}