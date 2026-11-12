"use client";

import { useEffect, useState } from "react";

import TerritoryMap from "@/components/territory-manager/TerritoryMap";
import RiderLocationPanel from "@/components/territory-manager/RiderLocationPanel";


export default function TerritoryMapPage() {

  const [riders, setRiders] = useState<any[]>([]);

useEffect(() => {
  async function loadMap() {
    try {
      const response = await fetch("/api/trm/workspace?section=map", { cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) {
        throw new Error(result?.message || "Unable to load rider locations for your territory.");
      }
      setRiders(Array.isArray(result.riders) ? result.riders : []);
    } catch (error) {
      console.error("Failed to load rider locations:", error);
    }
  }

  void loadMap();

  const refreshInterval = setInterval(() => {
    void loadMap();
  }, 15000);

  return () => {
    clearInterval(refreshInterval);
  };
}, []);

  return (
    <div className="space-y-8">

      {/* Hero */}

      <section className="rounded-3xl bg-[#0F172A] px-10 py-8 text-white shadow-xl">

        <p className="text-sm uppercase tracking-[0.35em] text-orange-400">
          MAMMY KITCHEN HUB
        </p>

        <h1 className="mt-3 text-4xl font-black">
          Territory Map
        </h1>

        <p className="mt-4 text-slate-300">
          Monitor location updates for riders assigned to vendors in your territory. Updates every 15 seconds.
        </p>

      </section>

      {/* Territory KPI Strip */}

<section className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">

  <div className="rounded-2xl border-l-4 border-emerald-500 bg-emerald-50 p-6 shadow-sm">
    <p className="text-sm font-semibold text-slate-500">
      Riders Online
    </p>

    <h2 className="mt-3 text-3xl font-black text-slate-900">
      {riders.length}
    </h2>
  </div>

  <div className="rounded-2xl border-l-4 border-blue-500 bg-blue-50 p-6 shadow-sm">
    <p className="text-sm font-semibold text-slate-500">
      Average Speed
    </p>

    <h2 className="mt-3 text-3xl font-black text-slate-900">
      {riders.length === 0
        ? 0
        : Math.round(
            riders.reduce(
              (sum, rider) => sum + Number(rider.speed ?? 0),
              0
            ) / riders.length
          )} km/h
    </h2>
  </div>

  <div className="rounded-2xl border-l-4 border-purple-500 bg-purple-50 p-6 shadow-sm">
    <p className="text-sm font-semibold text-slate-500">
      GPS Accuracy
    </p>

    <h2 className="mt-3 text-3xl font-black text-slate-900">
      {riders.length === 0
        ? 0
        : Math.round(
            riders.reduce(
              (sum, rider) => sum + Number(rider.accuracy ?? 0),
              0
            ) / riders.length
          )} m
    </h2>
  </div>

  <div className="rounded-2xl border-l-4 border-orange-500 bg-orange-50 p-6 shadow-sm">
    <p className="text-sm font-semibold text-slate-500">
      Latest Update
    </p>

    <h2 className="mt-3 text-xl font-black text-slate-900">
      {riders.length > 0
        ? new Date(riders[0].updated_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "--"}
    </h2>
  </div>

</section>

      {/* Workspace */}

      <section className="grid grid-cols-1 gap-8 xl:grid-cols-3">

        <div className="xl:col-span-2">
          <TerritoryMap riders={riders} />
        </div>

        <div>
          <RiderLocationPanel riders={riders} />
        </div>

      </section>

    </div>
  );
}