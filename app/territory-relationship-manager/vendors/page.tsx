"use client";

import { useEffect, useMemo, useState } from "react";

import VendorKPICards from "@/components/territory-manager/VendorKPICards";
import VendorTable from "@/components/territory-manager/VendorTable";
import VendorDrawer from "@/components/territory-manager/VendorDrawer";

import {
  getVendors,
  getVendorWallets,
  getVendorApplications,
  getVendorTransactions,
} from "@/lib/services/vendors";

import { VendorRecord } from "@/types/vendor";

export default function VendorsPage() {
  const [loading, setLoading] = useState(true);

  const [vendors, setVendors] =
    useState<VendorRecord[]>([]);

  const [pendingApplications, setPendingApplications] =
    useState(0);

  const [selectedVendor, setSelectedVendor] =
    useState<VendorRecord | null>(null);

  const [drawerOpen, setDrawerOpen] =
    useState(false);

  async function loadData() {
    try {
      setLoading(true);

      const [
        vendorRows,
        walletRows,
        applicationRows,
        transactionRows,
      ] = await Promise.all([
        getVendors(),
        getVendorWallets(),
        getVendorApplications(),
        getVendorTransactions(),
      ]);

      const merged: VendorRecord[] =
        vendorRows.map((vendor) => {
          const wallet =
            walletRows.find(
              (w) => w.vendor_id === vendor.id
            );

          const transactions =
            transactionRows.filter(
              (transaction) =>
                transaction.vendor_id === vendor.id
            );

          return {
            id: vendor.id,
            name: vendor.name,
            cuisine: vendor.cuisine,
            email: vendor.email,
            phone: vendor.phone,
            owner_name: vendor.owner_name,
            status: vendor.status,
            rating: Number(
              vendor.rating ?? 0
            ),

            available_balance: Number(
              wallet?.available_balance ?? 0
            ),

            pending_balance: Number(
              wallet?.accrued_balance ?? 0
            ),

            lifetime_earnings: Number(
              wallet?.lifetime_earnings ?? 0
            ),

            transactions,
          };
        });

      setVendors(merged);

      setPendingApplications(
        applicationRows.filter(
          (application) =>
            application.status === "pending"
        ).length
      );
    } catch (error) {
      console.error(
        "Failed to load TRM vendors:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

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