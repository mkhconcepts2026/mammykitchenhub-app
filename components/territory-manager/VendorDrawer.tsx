"use client";

import {
  X,
  Mail,
  Phone,
  Wallet,
  Store,
  Star,
  ArrowDownToLine,
  ArrowUpFromLine,
  ReceiptText,
} from "lucide-react";

import { VendorRecord } from "@/types/vendor";

interface VendorDrawerProps {
  vendor: VendorRecord | null;
  open: boolean;
  onClose: () => void;
}

function formatCurrency(amount: number) {
  return `₦${Number(amount ?? 0).toLocaleString()}`;
}

function formatDate(date: string | null) {
  if (!date) return "-";

  return new Date(date).toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTransactionTypeLabel(type: string | null) {
  if (!type) return "Transaction";

  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusClasses(status: string | null) {
  switch (status) {
    case "completed":
      return "bg-emerald-50 text-emerald-700";

    case "pending":
      return "bg-amber-50 text-amber-700";

    case "failed":
      return "bg-red-50 text-red-700";

    case "reversed":
      return "bg-slate-100 text-slate-700";

    default:
      return "bg-slate-100 text-slate-600";
  }
}

function getTransactionIcon(type: string | null) {
  const normalized = (type ?? "").toLowerCase();

  if (
    normalized.includes("withdraw") ||
    normalized.includes("payout") ||
    normalized.includes("debit")
  ) {
    return ArrowUpFromLine;
  }

  if (
    normalized.includes("earning") ||
    normalized.includes("credit") ||
    normalized.includes("deposit")
  ) {
    return ArrowDownToLine;
  }

  return ReceiptText;
}

export default function VendorDrawer({
  vendor,
  open,
  onClose,
}: VendorDrawerProps) {
  if (!open || !vendor) return null;

  const transactions = vendor.transactions ?? [];

  return (
    <>
      {/* Backdrop */}

      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />

      {/* Drawer */}

      <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-lg overflow-y-auto bg-white shadow-2xl">

        {/* Hero */}

        <div className="bg-[#F97316] px-8 py-6 text-white">

          <div className="flex items-start justify-between">

            <div>

              <p className="text-xs font-bold uppercase tracking-[0.3em] text-orange-100">
                MAMMY KITCHEN HUB
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Vendor Profile
              </h2>

              <p className="mt-2 text-orange-100">
                Vendor operational overview.
              </p>

            </div>

            <button
              onClick={onClose}
              className="rounded-xl bg-white/20 p-2 hover:bg-white/30"
              aria-label="Close vendor drawer"
            >
              <X size={22} />
            </button>

          </div>

        </div>

        {/* Content */}

        <div className="space-y-8 p-8">

          {/* Vendor Information */}

          <section className="rounded-2xl border border-slate-200 p-6">

            <h3 className="mb-5 flex items-center gap-2 text-lg font-bold">
              <Store size={20} />
              Vendor Information
            </h3>

            <div className="space-y-4">

              <div>
                <p className="text-xs uppercase text-slate-500">
                  Business Name
                </p>

                <p className="font-semibold">
                  {vendor.name}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase text-slate-500">
                  Owner
                </p>

                <p>
                  {vendor.owner_name || "-"}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Mail size={18} className="text-slate-400" />
                <span>{vendor.email || "-"}</span>
              </div>

              <div className="flex items-center gap-3">
                <Phone size={18} className="text-slate-400" />
                <span>{vendor.phone || "-"}</span>
              </div>

              <div>
                <p className="text-xs uppercase text-slate-500">
                  Status
                </p>

                <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {vendor.status || "Unknown"}
                </span>
              </div>

            </div>

          </section>

          {/* Wallet */}

          <section className="rounded-2xl border border-slate-200 p-6">

            <h3 className="mb-5 flex items-center gap-2 text-lg font-bold">
              <Wallet size={20} />
              Wallet Summary
            </h3>

            <div className="grid gap-4">

              <div className="rounded-xl bg-orange-50 p-4">

                <p className="text-xs uppercase text-slate-500">
                  Available Balance
                </p>

                <p className="mt-2 text-2xl font-black">
                  {formatCurrency(vendor.available_balance)}
                </p>

              </div>

              <div className="rounded-xl bg-slate-50 p-4">

                <p className="text-xs uppercase text-slate-500">
                  Pending Balance
                </p>

                <p className="mt-2 text-xl font-bold">
                  {formatCurrency(vendor.pending_balance)}
                </p>

              </div>

              <div className="rounded-xl bg-amber-50 p-4">

                <p className="text-xs uppercase text-slate-500">
                  Lifetime Earnings
                </p>

                <p className="mt-2 text-xl font-bold">
                  {formatCurrency(vendor.lifetime_earnings)}
                </p>

              </div>

            </div>

          </section>

          {/* Rating */}

          <section className="rounded-2xl border border-slate-200 p-6">

            <h3 className="mb-5 flex items-center gap-2 text-lg font-bold">
              <Star size={20} />
              Vendor Rating
            </h3>

            <p className="text-3xl font-black">
              ⭐ {Number(vendor.rating).toFixed(1)}
            </p>

          </section>

          {/* Transactions */}

          <section className="rounded-2xl border border-slate-200 p-6">

            <div className="mb-5 flex items-center justify-between">

              <div>
                <h3 className="text-lg font-bold">
                  Recent Transactions
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Vendor financial activity.
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {transactions.length}{" "}
                {transactions.length === 1 ? "transaction" : "transactions"}
              </span>

            </div>

            {transactions.length === 0 ? (

              <div className="rounded-xl bg-slate-50 p-6 text-center">

                <ReceiptText
                  size={28}
                  className="mx-auto mb-3 text-slate-400"
                />

                <p className="font-medium text-slate-600">
                  No transactions available.
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  Vendor financial activity will appear here.
                </p>

              </div>

            ) : (

              <div className="space-y-3">

                {transactions.map((transaction) => {

                  const TransactionIcon = getTransactionIcon(
                    transaction.type
                  );

                  return (
                    <div
                      key={transaction.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >

                      <div className="flex items-start justify-between gap-4">

                        <div className="flex min-w-0 items-start gap-3">

                          <div className="rounded-xl bg-slate-100 p-2">
                            <TransactionIcon
                              size={18}
                              className="text-slate-600"
                            />
                          </div>

                          <div className="min-w-0">

                            <p className="font-semibold text-slate-900">
                              {getTransactionTypeLabel(
                                transaction.type
                              )}
                            </p>

                            <p className="mt-1 truncate text-sm text-slate-500">
                              {transaction.description ||
                                "Vendor transaction"}
                            </p>

                          </div>

                        </div>

                        <p className="shrink-0 text-right font-bold text-slate-900">
                          {formatCurrency(transaction.amount)}
                        </p>

                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">

                        <div className="text-xs text-slate-400">
                          {formatDate(transaction.created_at)}
                        </div>

                        <div className="flex items-center gap-2">

                          {transaction.reference && (
                            <span className="max-w-[150px] truncate text-xs text-slate-400">
                              {transaction.reference}
                            </span>
                          )}

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                              transaction.status
                            )}`}
                          >
                            {transaction.status || "unknown"}
                          </span>

                        </div>

                      </div>

                    </div>
                  );
                })}

              </div>

            )}

          </section>

        </div>

      </aside>
    </>
  );
}