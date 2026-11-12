"use client";

import { useEffect, useState } from "react";

import FinanceKPICards from "@/components/territory-manager/FinanceKPICards";
import VendorSettlementTable from "@/components/territory-manager/VendorSettlementTable";
import RiderEarningsTable from "@/components/territory-manager/RiderEarningsTable";
import TransactionFeed from "@/components/territory-manager/TransactionFeed";

import {
  getVendorWallets,
  getFinancialLedger,
  getRiderWallets,
  getRiderEarnings,
} from "@/lib/services/finance";

export default function TerritoryRelationshipManagerFinancePage() {
  const [vendorWallets, setVendorWallets] = useState<any[]>([]);
  const [financialLedger, setFinancialLedger] = useState<any[]>([]);
  const [riderWallets, setRiderWallets] = useState<any[]>([]);
  const [riderEarnings, setRiderEarnings] = useState<any[]>([]);

  useEffect(() => {
    async function loadFinance() {
      try {
        const [
          wallets,
          ledger,
          riderWalletData,
          riderEarningData,
        ] = await Promise.all([
          getVendorWallets(),
          getFinancialLedger(),
          getRiderWallets(),
          getRiderEarnings(),
        ]);

        setVendorWallets(wallets);
        setFinancialLedger(ledger);
        setRiderWallets(riderWalletData);
        setRiderEarnings(riderEarningData);
      } catch (error) {
        console.error("Finance Dashboard:", error);
      }
    }

    loadFinance();

    const refreshInterval = setInterval(loadFinance, 10000);

    return () => clearInterval(refreshInterval);
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
          Monitor vendor settlements, rider earnings, wallet balances
          and financial activity across your territory.
        </p>
      </section>

      <FinanceKPICards
        vendorWallets={vendorWallets}
        riderWallets={riderWallets}
        financialLedger={financialLedger}
        riderEarnings={riderEarnings}
      />

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