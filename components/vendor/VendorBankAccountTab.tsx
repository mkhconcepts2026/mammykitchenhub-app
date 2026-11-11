"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Building2, LockKeyhole, RefreshCw, WalletCards } from "lucide-react";

type Bank = {
  name: string;
  code: string;
};

type BankAccount = {
  id: string;
  bankName: string;
  accountName: string;
  accountLast4: string;
  verified: boolean;
  savedAt?: string | null;
};

type OnboardingSuggestion = {
  bankCode: string;
  accountName: string;
  accountLast4: string;
  bankName: string;
};

type ActivePayout = {
  id: string;
  status: string;
  requested_at: string;
} | null;

export default function VendorBankAccountTab() {
  const [loading, setLoading] = useState(true);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [suggestion, setSuggestion] = useState<OnboardingSuggestion | null>(null);
  const [activePayout, setActivePayout] = useState<ActivePayout>(null);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/vendor/bank-account", {
        method: "GET",
        cache: "no-store",
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) {
        throw new Error(result?.message || "Your payout bank-account details could not be loaded.");
      }

      const bankRows = Array.isArray(result.banks) ? result.banks : [];
      setBanks(bankRows);
      setAccount(result.account ?? null);
      setSuggestion(result.onboardingSuggestion ?? null);
      setActivePayout(result.activePayout ?? null);

      const suggestedCode = String(result.onboardingSuggestion?.bankCode ?? "");
      const currentCode = String(result.account?.bankCode ?? "");
      setBankCode(
        bankRows.some((bank: Bank) => bank.code === currentCode)
          ? currentCode
          : bankRows.some((bank: Bank) => bank.code === suggestedCode)
            ? suggestedCode
            : "",
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Bank-account details could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveBankAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!bankCode) {
      setError("Select your bank.");
      return;
    }
    if (!/^\d{10}$/.test(accountNumber)) {
      setError("Enter the correct 10-digit account number.");
      return;
    }
    if (activePayout) {
      setError("Your bank account is locked while Finance is processing a payout.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/vendor/bank-account", {
        method: "PUT",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankCode, accountNumber }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || result?.success !== true) {
        throw new Error(result?.message || "The bank account could not be verified and saved.");
      }

      setAccount(result.account ?? null);
      setSuggestion(null);
      setAccountNumber("");
      setNotice(result.message || "Your payout bank account has been verified and saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Bank-account verification failed.");
    } finally {
      setSaving(false);
    }
  }

  const locked = Boolean(activePayout);
  const selectedBank = banks.find((bank) => bank.code === bankCode);

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-orange-600">
          Vendor payout settings
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          Bank Account
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          Manage the Nigerian bank account MKH uses for your vendor payouts. You can replace it when your bank account changes or develops an issue.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <WalletCards size={21} />
            </div>
            <div>
              <h2 className="font-bold text-slate-950">Current payout account</h2>
              <p className="text-xs text-slate-500">Your saved vendor bank details</p>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
              <RefreshCw size={15} className="animate-spin" />
              Loading bank details...
            </div>
          ) : account ? (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                  {account.verified ? "Verified account" : "Verification required"}
                </span>
                {account.verified && <BadgeCheck size={19} className="text-emerald-600" />}
              </div>
              <p className="mt-3 text-lg font-black text-slate-950">{account.bankName || "Bank not available"}</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">{account.accountName || "Account name unavailable"}</p>
              <p className="mt-2 text-sm tabular-nums text-slate-600">
                Account ending <span className="font-bold">•••• {account.accountLast4}</span>
              </p>
              <p className="mt-3 text-xs leading-5 text-emerald-800">
                {account.verified
                  ? "This is the verified bank account currently registered for your MKH vendor payouts."
                  : "This account is not verified yet. Verify it below before using it for payouts."}
              </p>
            </div>
          ) : suggestion ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
                Details from vendor onboarding
              </p>
              <p className="mt-3 text-lg font-black text-slate-950">
                {suggestion.bankName || "Bank selected during onboarding"}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-700">{suggestion.accountName}</p>
              <p className="mt-2 text-sm tabular-nums text-slate-600">
                Account ending <span className="font-bold">•••• {suggestion.accountLast4}</span>
              </p>
              <p className="mt-3 text-xs leading-5 text-amber-900">
                Your onboarding details are on file, but no verified payout account has been registered yet. Re-enter the account number below so Paystack can verify it.
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
              <Building2 size={24} className="text-slate-400" />
              <p className="mt-3 font-bold text-slate-900">No payout account saved</p>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                Add and verify your bank account to make it available for vendor payouts.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || saving}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={14} />
            Refresh details
          </button>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Building2 size={21} />
            </div>
            <div>
              <h2 className="font-bold text-slate-950">{account ? "Change bank account" : "Add bank account"}</h2>
              <p className="text-xs text-slate-500">Paystack account verification</p>
            </div>
          </div>

          {locked && (
            <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-5 text-amber-900">
              <LockKeyhole size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">Bank changes temporarily locked</p>
                <p className="mt-1">
                  Finance has a payout in {String(activePayout?.status ?? "processing").replace(/_/g, " ")} status. Your destination account cannot be changed until that request is resolved.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={saveBankAccount} className="mt-5 space-y-4">
            <label className="block text-sm font-bold text-slate-700">
              Bank
              <select
                required
                value={bankCode}
                onChange={(event) => setBankCode(event.target.value)}
                disabled={loading || saving || locked || banks.length === 0}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option value="">Select your bank</option>
                {banks.map((bank) => (
                  <option key={bank.code} value={bank.code}>
                    {bank.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Account number
              <input
                required
                type="password"
                inputMode="numeric"
                autoComplete="off"
                minLength={10}
                maxLength={10}
                pattern="[0-9]{10}"
                value={accountNumber}
                onChange={(event) =>
                  setAccountNumber(event.target.value.replace(/\D/g, "").slice(0, 10))
                }
                placeholder="Enter 10-digit account number"
                disabled={loading || saving || locked}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal tabular-nums outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
              {(account || suggestion) && (
                <span className="mt-1.5 block text-xs font-normal text-slate-500">
                  For security, MKH displays only the last four digits of a saved account. Enter the full number to verify the replacement.
                </span>
              )}
            </label>

            {selectedBank && (
              <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                Selected bank: <strong className="text-slate-900">{selectedBank.name}</strong>
              </div>
            )}

            {error && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-800">
                {error}
              </div>
            )}
            {notice && (
              <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-5 text-emerald-800">
                {notice}
              </div>
            )}

            <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              Paystack verifies the bank and account-holder name before MKH saves your details. This action only updates your payout account; it does not submit a payout or move money.
            </div>

            <button
              type="submit"
              disabled={loading || saving || locked || banks.length === 0}
              className="w-full rounded-xl bg-orange-600 px-5 py-3.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? "Verifying and saving..." : account ? "Verify & Save New Bank Account" : "Verify & Save Bank Account"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
