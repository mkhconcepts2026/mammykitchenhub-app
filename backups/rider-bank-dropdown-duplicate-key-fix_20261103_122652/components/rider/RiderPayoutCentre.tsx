"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

type Bank = { name: string; code: string };
type BankAccount = {
  id: string;
  bank_name: string;
  bank_code: string;
  account_name: string;
  account_number_last4: string;
  verification_status: string;
  verified_at: string | null;
};
type Payout = {
  id: string;
  amount: number | string;
  status: string;
  transfer_reference: string;
  requested_at: string;
  destination_bank_name: string | null;
  destination_account_last4: string | null;
  failure_reason?: string | null;
};
type WalletResponse = {
  success?: boolean;
  wallet?: { available_balance?: number | string | null } | null;
  message?: string;
};

const naira = (value: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const when = (value: string) =>
  new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));

export default function RiderPayoutCentre() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedBank = useMemo(
    () => banks.find((bank) => bank.code === bankCode),
    [banks, bankCode]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [walletRes, bankRes, accountRes, payoutRes] = await Promise.all([
        fetch("/api/rider/wallet", { cache: "no-store" }),
        fetch("/api/rider/banks", { cache: "no-store" }),
        fetch("/api/rider/bank-account", { cache: "no-store" }),
        fetch("/api/rider/payouts", { cache: "no-store" }),
      ]);

      const [walletJson, bankJson, accountJson, payoutJson] = await Promise.all([
        walletRes.json(),
        bankRes.json(),
        accountRes.json(),
        payoutRes.json(),
      ]);

      if (!walletRes.ok || !walletJson.success) {
        throw new Error(walletJson.message || "Unable to load your available wallet balance.");
      }
      setAvailableBalance(Number(walletJson.wallet?.available_balance ?? 0));

      if (!bankRes.ok || !bankJson.success) {
        throw new Error(bankJson.message || "Bank list unavailable.");
      }
      if (!accountRes.ok || !accountJson.success) {
        throw new Error(accountJson.message || "Saved bank details unavailable.");
      }
      if (!payoutRes.ok || !payoutJson.success) {
        throw new Error(payoutJson.message || "Payout history unavailable.");
      }

      setBanks(bankJson.banks ?? []);
      setBankAccount(accountJson.bankAccount ?? null);
      setPayouts(payoutJson.payouts ?? []);
      setEditing(!accountJson.bankAccount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load payout centre.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveBankAccount(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/rider/bank-account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bank_name: selectedBank?.name,
          bank_code: bankCode,
          account_number: accountNumber,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Bank account could not be saved.");
      }

      setBankAccount(result.bankAccount);
      setAccountNumber("");
      setEditing(false);
      setMessage(result.message || "Bank account verified.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bank account could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function withdraw() {
    if (!bankAccount || availableBalance <= 0 || withdrawing) return;

    const confirmed = window.confirm(
      `Withdraw your full available balance of ${naira(availableBalance)} to ${bankAccount.bank_name} account ending ${bankAccount.account_number_last4}?`
    );
    if (!confirmed) return;

    setWithdrawing(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/rider/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Withdrawal could not be submitted.");
      }

      setMessage(result.message || "TEST withdrawal submitted.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Withdrawal could not be submitted.");
    } finally {
      setWithdrawing(false);
    }
  }

  const activeStatus = (status: string) =>
    ["reserved", "transfer_submitted", "needs_reconciliation"].includes(status.toLowerCase());

  return (
    <section style={{ fontFamily: "Poppins, sans-serif" }} className="mt-4 overflow-hidden rounded-2xl border border-[#D4AF37]/50 border-t-4 border-t-[#D4AF37] bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-4 pt-5 sm:px-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
            Rider payout centre
          </p>
          <h2 className="mt-1 text-xl font-bold text-[#0F172A]">
            Bank account &amp; withdrawals
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Withdraw eligible wallet earnings to your verified bank account.
          </p>
        </div>
        <span className="rounded-full border border-[#D4AF37] bg-[#D4AF37]/10 px-3 py-1 text-xs font-bold text-[#0F172A]">
          TEST MODE · No real money
        </span>
      </div>

      <div className="space-y-4 px-4 pb-5 sm:px-5">
        {message && (
          <p role="status" className="rounded-lg border border-[#16A34A]/30 bg-[#16A34A]/10 p-3 text-sm text-[#16A34A]">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-[#64748B]">Loading payout details…</p>
        ) : (
          <>
            <div className="rounded-xl border border-[#64748B]/25 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-bold text-[#0F172A]">My Bank Account</h3>
                {bankAccount && !editing && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="text-sm font-semibold text-[#0F172A] hover:text-[#F97316]"
                  >
                    Change account
                  </button>
                )}
              </div>

              {bankAccount && !editing ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#0F172A]">{bankAccount.account_name}</p>
                    <p className="text-sm text-[#64748B]">
                      {bankAccount.bank_name} · •••• {bankAccount.account_number_last4}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#16A34A]/10 px-3 py-1 text-xs font-bold text-[#16A34A]">
                    Verified
                  </span>
                </div>
              ) : (
                <form onSubmit={saveBankAccount} className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm font-medium text-[#64748B]">
                    Bank
                    <select
                      required
                      value={bankCode}
                      onChange={(e) => setBankCode(e.target.value)}
                      className="min-h-11 rounded-lg border border-[#64748B]/40 bg-white px-3 text-[#0F172A] outline-none focus:border-[#F97316]"
                    >
                      <option value="">Select a bank</option>
                      {banks.map((bank) => (
                        <option key={bank.code} value={bank.code}>{bank.name}</option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1 text-sm font-medium text-[#64748B]">
                    10-digit account number
                    <input
                      required
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={10}
                      pattern="[0-9]{10}"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      className="min-h-11 rounded-lg border border-[#64748B]/40 px-3 text-[#0F172A] outline-none focus:border-[#F97316]"
                      placeholder="Enter account number"
                    />
                  </label>

                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <button
                      type="submit"
                      disabled={saving || !bankCode || accountNumber.length !== 10}
                      className="rounded-lg bg-[#F97316] px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? "Verifying…" : "Verify and save bank account"}
                    </button>
                    {bankAccount && (
                      <button
                        type="button"
                        onClick={() => setEditing(false)}
                        className="rounded-lg border border-[#0F172A] px-4 py-2.5 text-sm font-semibold text-[#0F172A]"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  <p className="text-xs leading-5 text-[#64748B] sm:col-span-2">
                    Paystack verifies the account holder. MKH stores the account number encrypted and displays only the last four digits.
                  </p>
                </form>
              )}
            </div>

            <div className="rounded-xl border border-[#64748B]/25 p-4">
              <h3 className="font-bold text-[#0F172A]">Withdraw Earnings</h3>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm text-[#64748B]">Available balance</p>
                  <p className="text-2xl font-bold tabular-nums text-[#0F172A]">
                    {naira(availableBalance)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!bankAccount || availableBalance <= 0 || withdrawing || payouts.some((p) => activeStatus(p.status))}
                  onClick={() => void withdraw()}
                  className="rounded-lg bg-[#F97316] px-5 py-3 text-sm font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {withdrawing ? "Submitting…" : "Withdraw available balance"}
                </button>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#64748B]">
                Only earnings already released into your available wallet balance can be withdrawn. MKH&apos;s Monday eligibility/release rule remains unchanged. Pending earnings are not withdrawn.
              </p>
              {payouts.some((p) => activeStatus(p.status)) && (
                <p className="mt-2 text-sm font-medium text-[#D4AF37]">
                  You have a withdrawal being processed or reconciled. Please wait for its final status before submitting another.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-[#64748B]/25 p-4">
              <h3 className="font-bold text-[#0F172A]">Payout History</h3>
              {payouts.length ? (
                <div className="mt-3 divide-y divide-[#64748B]/15">
                  {payouts.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="font-semibold text-[#0F172A]">{naira(Number(p.amount))}</p>
                        <p className="text-xs text-[#64748B]">
                          {p.destination_bank_name ?? "Bank"} · •••• {p.destination_account_last4 ?? "----"} · {when(p.requested_at)}
                        </p>
                        <p className="mt-1 break-all font-mono text-[10px] text-[#64748B]">
                          Reference: {p.transfer_reference}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#0F172A]/5 px-3 py-1 text-xs font-bold capitalize text-[#0F172A]">
                        {p.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-[#64748B]">No withdrawal requests yet.</p>
              )}
            </div>
          </>
        )}

      </div>
    </section>
  );
}