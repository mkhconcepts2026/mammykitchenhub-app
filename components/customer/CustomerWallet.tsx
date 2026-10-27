
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock3,
  CreditCard,
  Eye,
  EyeOff,
  Gift,
  History,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Ticket,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type WalletRecord = {
  id: string;
  available_balance: number;
  locked_balance: number;
};

type WalletTransaction = {
  id: string;
  transaction_type: string;
  amount: number;
  status: string;
  description: string | null;
  created_at: string;
};

type ActivationResponse = {
  success: boolean;
  message?: string;
  wallet?: WalletRecord;
  alreadyExists?: boolean;
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(amount);

const transactionLabel = (type: string) =>
  type.replaceAll("_", " ").replace(/\b\w/g, (letter) =>
    letter.toUpperCase()
  );

export default function CustomerWallet() {
  const [wallet, setWallet] = useState<WalletRecord | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBalance, setShowBalance] = useState(true);
  const [error, setError] = useState("");
  const [activating, setActivating] = useState(false);

  const loadWallet = useCallback(async () => {
    try {
      const supabase = createClient();

      // Start with an asynchronous operation before changing state.
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      setError("");

      if (authError) throw authError;

      if (!user) {
        setWallet(null);
        setTransactions([]);
        throw new Error("Please sign in to view your wallet.");
      }

      const { data: walletData, error: walletError } = await supabase
        .from("customer_wallets")
        .select("id, available_balance, locked_balance")
        .eq("customer_id", user.id)
        .maybeSingle();

      if (walletError) throw walletError;

      setWallet(walletData);

      if (!walletData) {
        setTransactions([]);
        return;
      }

      const { data: transactionData, error: transactionError } =
        await supabase
          .from("customer_wallet_transactions")
          .select(
            "id, transaction_type, amount, status, description, created_at"
          )
          .eq("wallet_id", walletData.id)
          .order("created_at", { ascending: false })
          .limit(5);

      if (transactionError) throw transactionError;

      setTransactions(transactionData ?? []);
    } catch (err) {
      console.error("CUSTOMER WALLET LOAD ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "We couldn't load your wallet. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const activateWallet = async () => {
    if (activating) return;

    setActivating(true);
    setError("");

    try {
      const response = await fetch("/api/customer/wallet/activate", {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
      });

      const result = (await response.json()) as ActivationResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "We couldn't activate your wallet."
        );
      }

      await loadWallet();
    } catch (err) {
      console.error("CUSTOMER WALLET ACTIVATION ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "We couldn't activate your wallet. Please try again."
      );
    } finally {
      setActivating(false);
    }
  };

  useEffect(() => {
  let cancelled = false;

  const startLoading = async () => {
    await Promise.resolve();

    if (!cancelled) {
      await loadWallet();
    }
  };

  void startLoading();

  return () => {
    cancelled = true;
  };
}, [loadWallet]);

  const balanceText = (amount: number) =>
    showBalance ? money(amount) : "₦ ••••••";

  return (
    <section
      id="customer-wallet"
      className="mt-6 overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm"
    >
      <div className="bg-gradient-to-br from-orange-600 via-orange-500 to-amber-400 p-5 text-white sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/15">
              <Wallet className="h-6 w-6" />
            </span>

            <div>
              <h2 className="text-xl font-extrabold">MKH Wallet</h2>
              <p className="text-sm text-orange-50">
                Your money. Your rewards.
              </p>
            </div>
          </div>

          <span className="flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold">
            <ShieldCheck className="h-4 w-4" />
            Secure wallet
          </span>
        </div>

        <div className="mt-8">
          <div className="flex items-center gap-2 text-sm text-orange-50">
            Available cash balance

            <button
              type="button"
              onClick={() => setShowBalance((value) => !value)}
              aria-label={showBalance ? "Hide balance" : "Show balance"}
              className="rounded-md p-1 hover:bg-white/15"
            >
              {showBalance ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </button>
          </div>

          <p className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {loading
              ? "Loading..."
              : wallet
                ? balanceText(Number(wallet.available_balance))
                : "Not activated"}
          </p>

          <p className="mt-2 text-sm text-orange-50">
            {wallet
              ? "Available for eligible MKH purchases and withdrawals."
              : "Your cash wallet will appear here once securely activated."}
          </p>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled
            title="Secure funding will be enabled after payment integration."
            className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 font-bold text-orange-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-75"
          >
            <Plus className="h-5 w-5" />
            Add Money
          </button>

          <button
            type="button"
            disabled
            title="Withdrawals will be enabled after payout integration."
            className="flex items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/10 px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-75"
          >
            <ArrowUpRight className="h-5 w-5" />
            Withdraw
          </button>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-7">
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <p>{error}</p>

            <button
              type="button"
              onClick={() => void loadWallet()}
              className="mt-2 font-bold underline"
            >
              Try again
            </button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-emerald-600">
                <Gift className="h-5 w-5" />
              </span>

              <div>
                <h3 className="font-bold text-gray-900">Gift Cards</h3>
                <p className="text-xs text-gray-600">Redeem eligible value</p>
              </div>
            </div>

            <p className="mt-4 text-sm text-gray-600">
              Keep gift-card value separate from cash.
            </p>
          </div>

          <div className="rounded-2xl border border-purple-100 bg-purple-50/70 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-purple-600">
                <Ticket className="h-5 w-5" />
              </span>

              <div>
                <h3 className="font-bold text-gray-900">MKH Rewards</h3>
                <p className="text-xs text-gray-600">Promotional credits</p>
              </div>
            </div>

            <p className="mt-4 text-sm text-gray-600">
              Campaign benefits remain non-withdrawable.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-100">
          <div className="flex items-center justify-between border-b border-gray-100 p-4">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-orange-600" />
              <h3 className="font-bold text-gray-900">Recent Activity</h3>
            </div>

            <span className="text-xs text-gray-500">Last 5</span>
          </div>

          {loading ? (
            <p className="p-5 text-sm text-gray-500">
              Loading your transactions...
            </p>
          ) : !wallet ? (
            <div className="p-6 text-center">
              <LockKeyhole className="mx-auto h-8 w-8 text-orange-500" />

              <p className="mt-2 font-semibold text-gray-800">
                Activate your MKH Wallet
              </p>

              <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
                Activate your secure wallet to prepare for future MKH
                payments, eligible withdrawals and rewards.
              </p>

              <button
                type="button"
                onClick={() => void activateWallet()}
                disabled={activating || loading}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {activating ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Activating...
                  </>
                ) : (
                  <>
                    <Wallet className="h-5 w-5" />
                    Activate My Wallet
                  </>
                )}
              </button>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-6 text-center">
              <CreditCard className="mx-auto h-8 w-8 text-gray-400" />

              <p className="mt-2 font-semibold text-gray-800">
                No transactions yet
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Your wallet activity will appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {transactions.map((transaction) => (
                <li
                  key={transaction.id}
                  className="flex items-center gap-3 p-4"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-600">
                    {transaction.transaction_type === "top_up" ||
                    transaction.transaction_type === "refund" ||
                    transaction.transaction_type === "withdrawal_reversal" ? (
                      <ArrowDownLeft className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <ArrowUpRight className="h-5 w-5 text-orange-600" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">
                      {transaction.description ||
                        transactionLabel(transaction.transaction_type)}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      {new Date(transaction.created_at).toLocaleString(
                        "en-NG"
                      )}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-gray-900">
                      {money(Number(transaction.amount))}
                    </p>

                    <p className="mt-1 text-xs capitalize text-gray-500">
                      {transaction.status.replaceAll("_", " ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-2 border-t border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500">
            <Clock3 className="h-4 w-4" />
            Transactions are displayed from your wallet records.
          </div>
        </div>
      </div>
    </section>
  );
}
