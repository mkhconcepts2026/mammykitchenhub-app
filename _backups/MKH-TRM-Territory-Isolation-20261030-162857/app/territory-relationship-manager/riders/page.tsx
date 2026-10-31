"use client";

import { useEffect, useMemo, useState } from "react";

import RiderKPICards from "@/components/territory-manager/RiderKPICards";
import RiderTable from "@/components/territory-manager/RiderTable";
import RiderDrawer from "@/components/territory-manager/RiderDrawer";

import {
  getRiders,
  getRiderLocations,
  getRiderWallets,
  getRiderCurrentOrders,
  getRiderOperationalStatus,
} from "@/lib/services/riders";

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

      const [
        profiles,
        locations,
        wallets,
        currentOrders,
      ] = await Promise.all([
        getRiders(),
        getRiderLocations(),
        getRiderWallets(),
        getRiderCurrentOrders(),
      ]);

      const merged: RiderRecord[] = profiles.map((profile) => {
        const wallet = wallets.find(
          (w) => w.rider_id === profile.id
        );

        const location = locations.find(
          (l) => l.rider_id === profile.id
        );

        const currentOrder =
          currentOrders.find(
            (order) => order.rider_id === profile.id
          ) ?? null;

        const operationalStatus =
          getRiderOperationalStatus(
            profile.status,
            currentOrder
          );

        return {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          phone: profile.phone,

          // Account status remains sourced from profiles.
          status: profile.status,

          // Live operational status is derived separately.
          operational_status: operationalStatus,

          available_balance:
            Number(wallet?.available_balance ?? 0),

          pending_balance:
            Number(wallet?.pending_balance ?? 0),

          lifetime_earnings:
            Number(wallet?.lifetime_earnings ?? 0),

          updated_at:
            location?.updated_at ?? null,

          current_order: currentOrder,
        };
      });

      setRiders(merged);
    } catch (error) {
      console.error(
        "Failed to load TRM riders:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRiders();
  }, []);

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
          sum + rider.pending_balance,
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