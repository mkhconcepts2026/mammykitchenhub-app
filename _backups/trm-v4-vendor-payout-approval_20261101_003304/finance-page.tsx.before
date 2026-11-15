"use client";

import { useEffect, useState } from "react";

import FinanceKPICards from "@/components/territory-manager/FinanceKPICards";
import VendorSettlementTable from "@/components/territory-manager/VendorSettlementTable";
import RiderEarningsTable from "@/components/territory-manager/RiderEarningsTable";
import TransactionFeed from "@/components/territory-manager/TransactionFeed";

export default function TerritoryRelationshipManagerFinancePage() {
  const [vendorWallets, setVendorWallets] = useState<any[]>([]);
  const [financialLedger, setFinancialLedger] = useState<any[]>([]);
  const [riderWallets, setRiderWallets] = useState<any[]>([]);
  const [riderEarnings, setRiderEarnings] = useState<any[]>([]);
  const [walletScopeLimitedRiderCount, setWalletScopeLimitedRiderCount] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadFinance() {
      try {
        const response = await fetch("/api/trm/workspace?section=finance", { cache: "no-store" });
        const result = await response.json().catch(() => null);
        if (!response.ok || result?.success !== true) {
          throw new Error(result?.message || "Unable to load financial records for your territory.");
        }
        if (!active) return;
        setVendorWallets(Array.isArray(result.vendorWallets) ? result.vendorWallets : []);
        setFinancialLedger(Array.isArray(result.financialLedger) ? result.financialLedger : []);
        setRiderWallets(Array.isArray(result.riderWallets) ? result.riderWallets : []);
        setRiderEarnings(Array.isArray(result.riderEarnings) ? result.riderEarnings : []);
        setWalletScopeLimitedRiderCount(Number(result.walletScopeLimitedRiderCount ?? 0));
      } catch (error) {
        console.error("TRM territory Finance:", error);
      }
    }
    void loadFinance();
    const refreshInterval = window.setInterval(() => void loadFinance(), 30_000);
    return () => {
      active = false;
      window.clearInterval(refreshInterval);
    };
  }, []);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-[#0F172A] px-10 py-8 text-white shadow-xl">
        <p className="text-sm uppercase tracking-[0.35em] text-orange-400">
          MAMMY KITCHEN HUB
        </p>

        <h1 className="mt-3 text-4xl font-black">
          Territory Finance Center
        </h1>

        <p className="mt-4 max-w-3xl text-slate-300">
          Monitor financial records belonging to vendors and riders assigned to your territory. No settlement or payout actions are performed here.
        </p>
      </section>

      <FinanceKPICards
        vendorWallets={vendorWallets}
        riderWallets={riderWallets}
        financialLedger={financialLedger}
        riderEarnings={riderEarnings}
      />

      {walletScopeLimitedRiderCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {walletScopeLimitedRiderCount} rider account(s) linked to vendors outside this territory are excluded from these account-wide wallet totals. Territory-specific rider earnings remain limited to orders in your assigned territory.
        </div>
      )}

      <VendorSettlementTable
        ledger={financialLedger}
      />

      <RiderEarningsTable
        earnings={riderEarnings}
      />

      <TransactionFeed
        ledger={financialLedger}
      />
    </div>
  );
}