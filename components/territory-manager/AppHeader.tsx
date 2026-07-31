"use client";

import {
  Bell,
  Search,
  MapPin,
  ChevronDown,
} from "lucide-react";

export default function AppHeader() {
  return (
    <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm">

      {/* Left */}

      <div>

        <h1 className="text-2xl font-bold text-slate-800">
          Territory Relationship Manager
        </h1>

        <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">

          <MapPin size={15} />

          <span>Lagos Territory</span>

          <ChevronDown size={15} />

        </div>

      </div>

      {/* Center */}

      <div className="hidden lg:flex items-center w-[420px]">

        <div className="flex items-center w-full rounded-xl border border-slate-200 px-4 py-3 bg-slate-50">

          <Search size={18} className="text-slate-400" />

          <input
            type="text"
            placeholder="Search orders, riders, vendors..."
            className="ml-3 w-full bg-transparent outline-none text-sm"
          />

        </div>

      </div>

      {/* Right */}

      <div className="flex items-center gap-6">

        <button className="relative">

          <Bell size={22} className="text-slate-700" />

          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">

            5

          </span>

        </button>

        <div className="flex items-center gap-3">

          <div className="h-11 w-11 rounded-full bg-emerald-600 flex items-center justify-center text-white font-semibold">

            TR

          </div>

          <div>

            <p className="text-sm font-semibold text-slate-800">

              Territory Manager

            </p>

            <p className="text-xs text-slate-500">

              Operations Center

            </p>

          </div>

        </div>

      </div>

    </header>
  );
}