"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Wallet } from "lucide-react";

type WalletData = {
  success: boolean;
  active: boolean;
  wallet: {
    available_balance: number | string;
    pending_balance: number | string;
    lifetime_earnings: number | string;
  } | null;
  message?: string;
};

const formatNaira = (value: number | string | null | undefined) =>
  `₦${Number(value ?? 0).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

export default function RiderWalletSummary() {
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/rider/wallet", { cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) {
        throw new Error(result?.message || "Rider wallet information is unavailable.");
      }
      setData(result as WalletData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rider wallet information is unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="mx-3 mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:mx-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><span className="rounded-lg bg-orange-100 p-2 text-orange-700"><Wallet size={18}/></span><div><h3 className="font-bold text-slate-900">My Rider Wallet</h3><p className="text-xs text-slate-500">Persisted wallet balances</p></div></div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50"><RefreshCw size={13} className={loading ? "animate-spin" : ""}/>Refresh</button>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{error}</p>}
      {loading && !data ? <p className="mt-3 text-sm text-slate-500">Loading wallet…</p> : null}
      {data && !data.active && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Your rider wallet has not yet been activated. Please contact MKH Finance.</p>}
      {data?.active && data.wallet && <div className="mt-4 grid gap-3 sm:grid-cols-3">{[
        { label: "Available balance", value: data.wallet.available_balance },
        { label: "Pending balance", value: data.wallet.pending_balance },
        { label: "Lifetime earnings", value: data.wallet.lifetime_earnings },
      ].map((item) => <div key={item.label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-medium text-slate-500">{item.label}</p><p className="mt-1 text-lg font-black tabular-nums text-slate-900">{formatNaira(item.value)}</p></div>)}</div>}
    </section>
  );
}
