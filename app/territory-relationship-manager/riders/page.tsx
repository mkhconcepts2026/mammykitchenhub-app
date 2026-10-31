"use client";

import { useEffect, useMemo, useState } from "react";

import RiderKPICards from "@/components/territory-manager/RiderKPICards";
import RiderTable from "@/components/territory-manager/RiderTable";
import RiderDrawer from "@/components/territory-manager/RiderDrawer";

import { RiderRecord } from "@/types/rider";

export default function RidersPage() {
  const [loading, setLoading] = useState(true);

  const [riders, setRiders] = useState<RiderRecord[]>([]);

  const [selectedRider, setSelectedRider] =
    useState<RiderRecord | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);

  async function loadRiders() {
    try {
      setLoading(true);
      const response = await fetch("/api/trm/workspace?section=riders", { cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) {
        throw new Error(result?.message || "Unable to load riders assigned to your territory.");
      }
      const latestRiders = Array.isArray(result.riders) ? result.riders as RiderRecord[] : [];
      setRiders(latestRiders);
    } catch (error) {
      console.error("Failed to load territory riders:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRiders();
    const refreshId = window.setInterval(() => void loadRiders(), 30_000);
    return () => window.clearInterval(refreshId);
  }, []);

  useEffect(() => {
    if (selectedRider && !riders.some((rider) => rider.id === selectedRider.id)) {
      setSelectedRider(null);
      setDrawerOpen(false);
    }
  }, [riders, selectedRider]);

  const totalRiders = riders.length;

  const activeRiders = useMemo(
    () =>
      riders.filter(
        (rider) =>
          rider.operational_status !== "offline"
      ).length,
    [riders]
  );

  const offlineRiders = useMemo(
    () =>
      riders.filter(
        (rider) =>
          rider.operational_status === "offline"
      ).length,
    [riders]
  );

  const outstandingWallet = useMemo(
    () =>
      riders.reduce(
        (sum, rider) =>
          sum + (rider.pending_balance ?? 0),
        0
      ),
    [riders]
  );

  return (
    <div className="space-y-8">

      {/* Hero */}

      <section className="relative overflow-hidden rounded-3xl bg-[#F97316] shadow-2xl">

        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#D4AF37]/20 blur-3xl" />

        <div className="absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex items-center justify-between px-10 py-8">

          <div>

            <p className="text-sm font-bold uppercase tracking-[0.35em] text-[#0F172A]">
              MAMMY KITCHEN HUB
            </p>

            <h1 className="mt-3 text-4xl font-black text-white">
              Rider Command Center
            </h1>

            <p className="mt-4 max-w-2xl text-orange-100">
              Supervise riders across your territory,
              monitor operational status and support
              delivery performance.
            </p>

          </div>

        </div>

      </section>

      <RiderKPICards
        totalRiders={totalRiders}
        activeRiders={activeRiders}
        offlineRiders={offlineRiders}
        outstandingWallet={outstandingWallet}
      />

      {riders.some((rider) => rider.wallet_scope_limited) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Some riders are linked to vendors outside this territory. Their account-wide wallet balances are hidden here to prevent cross-territory financial data exposure.
        </div>
      )}

      <RiderTable
        riders={riders}
        loading={loading}
        onView={(rider) => {
          setSelectedRider(rider);
          setDrawerOpen(true);
        }}
      />

      <RiderDrawer
        rider={selectedRider}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedRider(null);
        }}
      />

    </div>
  );
}