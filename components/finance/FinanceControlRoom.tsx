"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Wallet, CreditCard, ReceiptText, ShieldCheck } from "lucide-react";

type WalletSummary = {
  wallet_count: number;
  available_balance: number;
  pending_balance?: number;
  accrued_balance?: number;
  lifetime_earnings?: number;
  locked_balance?: number;
};

type ControlRoomData = {
  orderPayments: Array<{ payment_method: string; payment_status: string; order_count: number; order_total: number }>;
  ledger: Array<{ entry_type: string; status: string; entry_count: number; amount_total: number }>;
  wallets: { vendor: WalletSummary; rider: WalletSummary; customer: WalletSummary };
  payoutRequests: Array<{ requester_type: string; status: string; request_count: number; amount_total: number }>;
};

type RiderRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  wallet: { available_balance: number; pending_balance: number; lifetime_earnings: number; updated_at: string } | null;
  wallet_count: number;
  wallet_issue: string | null;
};

type ApiPayload = { success: boolean; summary: ControlRoomData; riders: RiderRow[] };

const fmt = (value: unknown) => `₦${Number(value ?? 0).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
const titleCase = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function paymentLabel(method: string) {
  if (method === "cash_on_delivery") return "Cash on Delivery (test only)";
  if (method === "wallet") return "MKH Wallet";
  if (["card", "paystack"].includes(method)) return "Card payment (Paystack integration pending)";
  return titleCase(method);
}

export default function FinanceControlRoom() {
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/finance/control-room", { cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) {
        throw new Error(result?.message || "Finance control-room data could not be loaded.");
      }
      setData(result as ApiPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Finance control-room data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function activateWallet(rider: RiderRow) {
    if (rider.wallet_count > 0) return;
    if (!window.confirm(`Create an empty, zero-balance wallet for ${rider.full_name || rider.email || "this rider"}? No funds will be credited.`)) return;

    setActivating(rider.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/finance/control-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rider_id: rider.id }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) {
        throw new Error(result?.message || "Rider wallet could not be activated.");
      }
      setNotice(result.result?.message || "Rider wallet activated with zero balances.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rider wallet could not be activated.");
    } finally {
      setActivating(null);
    }
  }

  const summary = data?.summary;
  const walletCards = summary ? [
    { title: "Vendor wallets", count: summary.wallets.vendor.wallet_count, available: summary.wallets.vendor.available_balance, reserved: summary.wallets.vendor.pending_balance, lifetime: summary.wallets.vendor.lifetime_earnings },
    { title: "Rider wallets", count: summary.wallets.rider.wallet_count, available: summary.wallets.rider.available_balance, reserved: summary.wallets.rider.pending_balance, lifetime: summary.wallets.rider.lifetime_earnings },
    { title: "Customer wallet balances", count: summary.wallets.customer.wallet_count, available: summary.wallets.customer.available_balance, reserved: summary.wallets.customer.locked_balance, lifetime: null },
  ] : [];

  return (
    <section className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">Finance operations</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">Finance Control Room</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">Persisted order payments, financial ledger totals and wallet positions. This panel reports balances; it does not initiate payouts or change settlement calculations.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={15} className={loading ? "animate-spin" : ""}/>Refresh data</button>
      </div>

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>TEST DATA NOTICE:</strong> Existing COD testing records and test wallet balances are included in these totals. Do not interpret them as live production collections or amounts due.</div>

      {loading && !summary ? <div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">Loading finance records…</div> : null}
      {summary && (
        <>
          <div className="grid gap-4 xl:grid-cols-3">
            {walletCards.map((card) => <article key={card.title} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between"><h3 className="font-bold text-slate-900">{card.title}</h3><Wallet size={18} className="text-orange-600"/></div><p className="mt-1 text-xs text-slate-500">{card.count} wallet records</p><div className="mt-4 space-y-2 text-sm"><div className="flex justify-between gap-2"><span className="text-slate-500">Available</span><strong className="tabular-nums">{fmt(card.available)}</strong></div><div className="flex justify-between gap-2"><span className="text-slate-500">Pending / locked</span><strong className="tabular-nums">{fmt(card.reserved)}</strong></div>{card.lifetime !== null && <div className="flex justify-between gap-2"><span className="text-slate-500">Lifetime earnings</span><strong className="tabular-nums">{fmt(card.lifetime)}</strong></div>}</div></article>)}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <article className="rounded-xl border border-slate-200 p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2"><CreditCard size={18} className="text-orange-600"/><h3 className="font-bold">Order payments by method and status</h3></div>
              {!summary.orderPayments.length ? <p className="text-sm text-slate-500">No order-payment records found.</p> : <div className="space-y-3">{summary.orderPayments.map((row) => <div key={`${row.payment_method}:${row.payment_status}`} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"><div><p className="text-sm font-semibold text-slate-800">{paymentLabel(row.payment_method)}</p><p className="text-xs text-slate-500">{row.order_count} orders · {titleCase(row.payment_status)}</p></div><p className="font-bold tabular-nums">{fmt(row.order_total)}</p></div>)}</div>}
            </article>
            <article className="rounded-xl border border-slate-200 p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2"><ReceiptText size={18} className="text-orange-600"/><h3 className="font-bold">Financial ledger by entry type</h3></div>
              {!summary.ledger.length ? <p className="text-sm text-slate-500">No financial ledger entries found.</p> : <div className="space-y-3">{summary.ledger.map((row) => <div key={`${row.entry_type}:${row.status}`} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"><div><p className="text-sm font-semibold text-slate-800">{titleCase(row.entry_type)}</p><p className="text-xs text-slate-500">{row.entry_count} entries · {titleCase(row.status)}</p></div><p className="font-bold tabular-nums">{fmt(row.amount_total)}</p></div>)}</div>}
            </article>
          </div>

          <article className="rounded-xl border border-slate-200 p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2"><ShieldCheck size={18} className="text-orange-600"/><div><h3 className="font-bold">Rider wallet activation</h3><p className="text-xs text-slate-500">Create a missing empty wallet for an active rider. Existing balances are never overwritten.</p></div></div>
            {!data?.riders?.length ? <p className="text-sm text-slate-500">No active rider profiles were found.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Rider</th><th className="px-3 py-3">Available</th><th className="px-3 py-3">Pending</th><th className="px-3 py-3">Lifetime</th><th className="px-3 py-3">Wallet status</th><th className="px-3 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{data.riders.map((rider) => <tr key={rider.id}><td className="px-3 py-3"><p className="font-semibold">{rider.full_name || "Rider"}</p><p className="text-xs text-slate-500">{rider.email || rider.phone || rider.id}</p></td><td className="px-3 py-3 tabular-nums">{rider.wallet ? fmt(rider.wallet.available_balance) : "—"}</td><td className="px-3 py-3 tabular-nums">{rider.wallet ? fmt(rider.wallet.pending_balance) : "—"}</td><td className="px-3 py-3 tabular-nums">{rider.wallet ? fmt(rider.wallet.lifetime_earnings) : "—"}</td><td className="px-3 py-3">{rider.wallet_issue ? <span className="text-xs font-semibold text-rose-700">Duplicate wallet rows</span> : rider.wallet ? <span className="text-xs font-semibold text-emerald-700">Active</span> : <span className="text-xs font-semibold text-amber-700">Not activated</span>}</td><td className="px-3 py-3">{rider.wallet_count === 0 ? <button onClick={() => void activateWallet(rider)} disabled={activating === rider.id} className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-700 disabled:opacity-50">{activating === rider.id ? "Activating…" : "Activate zero-balance wallet"}</button> : <span className="text-xs text-slate-400">No action needed</span>}</td></tr>)}</tbody></table></div>}
          </article>

          <article className="rounded-xl border border-slate-200 p-4 sm:p-5">
            <h3 className="font-bold">Payout request position</h3>
            <p className="mt-1 text-xs text-slate-500">Read-only summary of all requester types. The existing vendor payout workflow remains unchanged.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{summary.payoutRequests.map((row) => <div key={`${row.requester_type}:${row.status}`} className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">{titleCase(row.requester_type)} · {titleCase(row.status)}</p><p className="mt-1 text-xl font-black tabular-nums">{fmt(row.amount_total)}</p><p className="text-xs text-slate-500">{row.request_count} requests</p></div>)}</div>
          </article>
        </>
      )}
    </section>
  );
}
