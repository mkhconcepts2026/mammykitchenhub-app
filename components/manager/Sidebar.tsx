"use client";

import {
  LayoutDashboard,
  ClipboardList,
  Map,
  Bike,
  Store,
  AlertTriangle,
  Wallet,
  BarChart3,
  Settings,
} from "lucide-react";

const menu = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "operations", label: "Operations Queue", icon: ClipboardList },
  { id: "dispatch", label: "Live Dispatch", icon: Map },
  { id: "riders", label: "Riders", icon: Bike },
  { id: "vendors", label: "Vendors", icon: Store },
  { id: "exceptions", label: "Exceptions", icon: AlertTriangle },
  { id: "finance", label: "Finance", icon: Wallet },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function Sidebar({
  activeTab,
  setActiveTab,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}) {
  return (
    <aside className="w-72 bg-[#0F172A] text-white flex flex-col justify-between h-screen sticky top-0">

      <div>

        <div className="px-8 py-8 border-b border-slate-700">

          <h1 className="text-3xl font-black tracking-wide">
            MKH
          </h1>

          <p className="text-sm text-slate-400 mt-2">
            Operations Command Center
          </p>

        </div>

        <nav className="p-4 space-y-2">

          {menu.map((item) => {

            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${
                  activeTab === item.id
                    ? "bg-orange-500 text-white shadow-lg"
                    : "hover:bg-slate-800 text-slate-300"
                }`}
              >
                <Icon size={20} />

                <span className="font-medium">
                  {item.label}
                </span>

              </button>
            );
          })}

        </nav>

      </div>

      <div className="border-t border-slate-700 p-6">

        <div className="font-semibold">
          Operations Manager
        </div>

        <div className="text-sm text-green-400 mt-2">
          ● System Online
        </div>

      </div>

    </aside>
  );
}