"use client";

import { useEffect, useMemo, useState } from "react";

import VendorKPICards from "@/components/territory-manager/VendorKPICards";
import VendorTable from "@/components/territory-manager/VendorTable";
import VendorDrawer from "@/components/territory-manager/VendorDrawer";

import { VendorRecord } from "@/types/vendor";

export default function VendorsPage() {
  const [loading, setLoading] = useState(true);

  const [vendors, setVendors] =
    useState<VendorRecord[]>([]);

  const [pendingApplications, setPendingApplications] =
    useState<number | string>("—");

  const [selectedVendor, setSelectedVendor] =
    useState<VendorRecord | null>(null);

  const [drawerOpen, setDrawerOpen] =
    useState(false);

  async function loadData() {
    try {
      setLoading(true);
      const response = await fetch("/api/trm/workspace?section=vendors", { cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) {
        throw new Error(result?.message || "Unable to load vendors assigned to your territory.");
      }
      const latestVendors = Array.isArray(result.vendors) ? result.vendors as VendorRecord[] : [];
      setVendors(latestVendors);
      // Applications without an authoritative territory/vendor link are not
      // counted here; showing the global application total would cross scopes.
      setPendingApplications(result.pendingApplications ?? "—");
    } catch (error) {
      console.error("Failed to load territory vendors:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    const refreshId = window.setInterval(() => void loadData(), 45_000);
    return () => window.clearInterval(refreshId);
  }, []);

  useEffect(() => {
    if (selectedVendor && !vendors.some((vendor) => vendor.id === selectedVendor.id)) {
      setSelectedVendor(null);
      setDrawerOpen(false);
    }
  }, [vendors, selectedVendor]);

  const totalVendors = vendors.length;

  const activeVendors = useMemo(
    () =>
      vendors.filter(
        (vendor) =>
          vendor.status === "active"
      ).length,
    [vendors]
  );

  const outstandingWallet = useMemo(
    () =>
      vendors.reduce(
        (sum, vendor) =>
          sum + vendor.pending_balance,
        0
      ),
    [vendors]
  );

  return (
    <div className="space-y-8">

      {/* Hero */}

      <section className="relative overflow-hidden rounded-3xl bg-[#F97316] shadow-2xl">

        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#D4AF37]/20 blur-3xl" />

        <div className="absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />

        <div className="relative px-10 py-6">

          <p className="text-sm font-bold uppercase tracking-[0.35em] text-[#0F172A]">
            MAMMY KITCHEN HUB
          </p>

          <h1 className="mt-3 text-4xl font-black text-white">
            Vendor Command Center
          </h1>

          <p className="mt-4 max-w-2xl text-orange-100">
            Manage vendors, supervise operational
            performance, monitor wallets and onboarding
            activities across your territory.
          </p>

        </div>

      </section>

      <VendorKPICards
        totalVendors={totalVendors}
        activeVendors={activeVendors}
        pendingApplications={pendingApplications}
        outstandingWallet={outstandingWallet}
      />

      <VendorTable
        vendors={vendors}
        loading={loading}
        onView={(vendor) => {
          setSelectedVendor(vendor);
          setDrawerOpen(true);
        }}
      />

      <VendorDrawer
        vendor={selectedVendor}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedVendor(null);
        }}
      />

    </div>
  );
}