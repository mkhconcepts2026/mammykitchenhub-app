"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Search, MapPin, ChevronDown } from "lucide-react";

type TrmHeaderData = {
  success: boolean;
  assigned?: boolean;
  manager?: { name?: string };
  territory?: { name?: string } | null;
};

export default function AppHeader() {
  const [data, setData] = useState<TrmHeaderData | null>(null);

  useEffect(() => {
    let active = true;

    async function loadIdentity() {
      try {
        const response = await fetch("/api/trm/dashboard?view=identity", { cache: "no-store" });
        const result = await response.json().catch(() => null);
        if (active && response.ok && result?.success === true) {
          setData(result as TrmHeaderData);
        }
      } catch (error) {
        console.error("TRM header identity lookup failed:", error);
      }
    }

    void loadIdentity();
    const refreshId = window.setInterval(() => void loadIdentity(), 60_000);

    return () => {
      active = false;
      window.clearInterval(refreshId);
    };
  }, []);

  const managerName = data?.manager?.name || "Territory Relationship Manager";
  const territoryName = data?.assigned ? data.territory?.name || "Territory not assigned" : "Territory not assigned";
  const initials = useMemo(() => {
    const parts = managerName.trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "TR";
  }, [managerName]);

  return (
    <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Territory Relationship Manager</h1>
        <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
          <MapPin size={15} />
          <span>{territoryName}</span>
          <ChevronDown size={15} />
        </div>
      </div>

      <div className="hidden lg:flex items-center w-[420px]">
        <div className="flex items-center w-full rounded-xl border border-slate-200 px-4 py-3 bg-slate-50">
          <Search size={18} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search orders, riders, vendors..."
            className="ml-3 w-full bg-transparent outline-none text-sm"
            aria-label="Search orders, riders and vendors"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button type="button" className="relative" aria-label="Notifications">
          <Bell size={22} className="text-slate-700" />
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">5</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-emerald-600 flex items-center justify-center text-white font-semibold">
            {initials}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{managerName}</p>
            <p className="text-xs text-slate-500">Territory Relationship Manager</p>
          </div>
        </div>
      </div>
    </header>
  );
}
