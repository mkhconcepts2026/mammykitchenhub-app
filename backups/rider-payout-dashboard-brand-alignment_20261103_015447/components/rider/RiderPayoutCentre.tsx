"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

type Bank = { name: string; code: string };
type BankAccount = {
  id: string; bank_name: string; bank_code: string; account_name: string;
  account_number_last4: string; verification_status: string; verified_at: string | null;
};
type Payout = {
  id: string; amount: number | string; status: string; transfer_reference: string;
  requested_at: string; destination_bank_name: string | null;
  destination_account_last4: string | null; failure_reason?: string | null;
};

const naira = (value: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(value);
const when = (value: string) => new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(value));

export default function RiderPayoutCentre({ availableBalance, onRefresh }: { availableBalance: number; onRefresh: () => void }) {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedBank = useMemo(() => banks.find((bank) => bank.code === bankCode), [banks, bankCode]);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [bankRes, accountRes, payoutRes] = await Promise.all([
        fetch("/api/rider/banks", { cache: "no-store" }),
        fetch("/api/rider/bank-account", { cache: "no-store" }),
        fetch("/api/rider/payouts", { cache: "no-store" }),
      ]);
      const [bankJson, accountJson, payoutJson] = await Promise.all([bankRes.json(), accountRes.json(), payoutRes.json()]);
      if (!bankRes.ok || !bankJson.success) throw new Error(bankJson.message || "Bank list unavailable.");
      if (!accountRes.ok || !accountJson.success) throw new Error(accountJson.message || "Saved bank details unavailable.");
      if (!payoutRes.ok || !payoutJson.success) throw new Error(payoutJson.message || "Payout history unavailable.");
      setBanks(bankJson.banks ?? []); setBankAccount(accountJson.bankAccount ?? null); setPayouts(payoutJson.payouts ?? []);
      setEditing(!accountJson.bankAccount);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load payout centre."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function saveBankAccount(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/rider/bank-account", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bank_name: selectedBank?.name, bank_code: bankCode, account_number: accountNumber }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Bank account could not be saved.");
      setBankAccount(result.bankAccount); setAccountNumber(""); setEditing(false); setMessage(result.message || "Bank account verified.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Bank account could not be saved."); }
    finally { setSaving(false); }
  }

  async function withdraw() {
    if (!bankAccount || availableBalance <= 0 || withdrawing) return;
    const confirmed = window.confirm(`Withdraw your full available balance of ${naira(availableBalance)} to ${bankAccount.bank_name} account ending ${bankAccount.account_number_last4}?`);
    if (!confirmed) return;
    setWithdrawing(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/rider/payouts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Withdrawal could not be submitted.");
      setMessage(result.message || "TEST withdrawal submitted.");
      await Promise.all([load(), Promise.resolve(onRefresh())]);
    } catch (e) { setError(e instanceof Error ? e.message : "Withdrawal could not be submitted."); }
    finally { setWithdrawing(false); }
  }

  const activeStatus = (status: string) => ["reserved", "transfer_submitted", "needs_reconciliation"].includes(status.toLowerCase());
  return (
    <section className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Rider payout centre</p><h2 className="mt-1 text-xl font-black text-slate-950">Bank account & withdrawals</h2><p className="mt-1 text-sm text-slate-500">Withdraw eligible wallet earnings directly to your verified bank account.</p></div>
        <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">TEST MODE · No real money</span>
      </div>
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {loading ? <p className="text-sm text-slate-500">Loading payout details…</p> : <>
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-bold text-slate-900">My Bank Account</h3>{bankAccount && !editing && <button type="button" onClick={() => setEditing(true)} className="text-sm font-semibold text-emerald-700">Change account</button>}</div>
          {bankAccount && !editing ? <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-slate-900">{bankAccount.account_name}</p><p className="text-sm text-slate-600">{bankAccount.bank_name} · •••• {bankAccount.account_number_last4}</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Verified</span></div> : <form onSubmit={saveBankAccount} className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-slate-700">Bank<select required value={bankCode} onChange={(e) => setBankCode(e.target.value)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3"><option value="">Select a bank</option>{banks.map((bank) => <option key={bank.code} value={bank.code}>{bank.name}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">10-digit account number<input required inputMode="numeric" autoComplete="off" maxLength={10} pattern="[0-9]{10}" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))} className="min-h-11 rounded-lg border border-slate-300 px-3" placeholder="Enter account number" /></label>
            <div className="flex flex-wrap gap-2 sm:col-span-2"><button disabled={saving || !bankCode || accountNumber.length !== 10} className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Verifying…" : "Verify and save bank account"}</button>{bankAccount && <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold">Cancel</button>}</div>
            <p className="text-xs text-slate-500 sm:col-span-2">Paystack verifies the account holder. MKH stores the account number encrypted and displays only the last four digits.</p>
          </form>}
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-bold text-slate-900">Withdraw Earnings</h3>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-slate-500">Available balance</p><p className="text-2xl font-black tabular-nums text-slate-950">{naira(availableBalance)}</p></div><button type="button" disabled={!bankAccount || availableBalance <= 0 || withdrawing || payouts.some((p) => activeStatus(p.status))} onClick={() => void withdraw()} className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{withdrawing ? "Submitting…" : "Withdraw available balance"}</button></div>
          <p className="mt-2 text-xs leading-5 text-slate-500">Only earnings already released into your available wallet balance can be withdrawn. MKH's Monday eligibility/release rule remains unchanged. Pending earnings are not withdrawn.</p>
          {payouts.some((p) => activeStatus(p.status)) && <p className="mt-2 text-sm font-medium text-amber-700">You have a withdrawal being processed or reconciled. Please wait for its final status before submitting another.</p>}
        </div>
        <div className="rounded-xl border border-slate-200 p-4"><h3 className="font-bold text-slate-900">Payout History</h3>{payouts.length ? <div className="mt-3 divide-y divide-slate-100">{payouts.map((p) => <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold text-slate-900">{naira(Number(p.amount))}</p><p className="text-xs text-slate-500">{p.destination_bank_name ?? "Bank"} · •••• {p.destination_account_last4 ?? "----"} · {when(p.requested_at)}</p><p className="mt-1 break-all font-mono text-[10px] text-slate-400">Reference: {p.transfer_reference}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize text-slate-700">{p.status.replace(/_/g, " ")}</span></div>)}</div> : <p className="mt-2 text-sm text-slate-500">No withdrawal requests yet.</p>}</div>
      </>}
    </section>
  );
}
