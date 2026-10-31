"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertCircle,
  ArrowDownToLine,
  Banknote,
  Bell,
  ChartNoAxesCombined,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileChartColumnIncreasing,
  LayoutDashboard,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Users,
  Wallet,
} from "lucide-react";

type NavId = "overview" | "payments" | "ledger" | "wallets" | "payouts" | "reports";

type AggregateRow = {
  payment_method?: string;
  payment_status?: string;
  order_count?: number;
  order_total?: number;
  entry_type?: string;
  status?: string;
  entry_count?: number;
  amount_total?: number;
  requester_type?: string;
  request_count?: number;
};

type WalletSummary = {
  wallet_count: number;
  available_balance: number;
  pending_balance?: number;
  accrued_balance?: number;
  lifetime_earnings?: number;
  locked_balance?: number;
};

type DailyPaidOrder = {
  day: string;
  paid_order_count: number;
  paid_order_value: number;
};

type OrderSummary = {
  total_orders: number;
  total_order_value: number;
  paid_orders: number;
  paid_order_value: number;
  unpaid_cod_orders: number;
  unpaid_cod_order_value: number;
  unpaid_other_orders: number;
  unpaid_other_order_value: number;
};

type CommandSummary = {
  generatedAt: string;
  orderSummary: OrderSummary;
  orderPayments: AggregateRow[];
  dailyPaidOrders: DailyPaidOrder[];
  ledger: AggregateRow[];
  wallets: {
    vendor: WalletSummary;
    rider: WalletSummary;
    customer: WalletSummary;
  };
  payoutRequests: AggregateRow[];
};

type RiderWallet = {
  available_balance: number;
  pending_balance: number;
  lifetime_earnings: number;
  updated_at: string;
};

type RiderRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  wallet: RiderWallet | null;
  wallet_count: number;
  wallet_issue: string | null;
};

type ApiPayload = {
  success: boolean;
  generatedAt: string;
  profile: { full_name: string | null; email: string | null; role: string | null };
  summary: CommandSummary;
  riders: RiderRow[];
  riderCounts: { active: number; withWallet: number; missingWallet: number; duplicateWallet: number };
};

type NavItem = { id: NavId; label: string; description: string; icon: LucideIcon };

const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Overview", description: "Executive position", icon: LayoutDashboard },
  { id: "payments", label: "Payments", description: "Order payment records", icon: CreditCard },
  { id: "ledger", label: "Financial Ledger", description: "Recorded entries", icon: FileChartColumnIncreasing },
  { id: "wallets", label: "Wallets", description: "Vendor, rider and customer", icon: Wallet },
  { id: "payouts", label: "Payout Position", description: "Requests by status", icon: ArrowDownToLine },
  { id: "reports", label: "Reports & Controls", description: "Reconciliation view", icon: ChartNoAxesCombined },
];

const safeNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatNaira = (value: unknown) =>
  `₦${safeNumber(value).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

const titleCase = (value: unknown) =>
  String(value ?? "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

function paymentMethodLabel(method: string) {
  const normalized = method.toLowerCase();
  if (normalized === "cash_on_delivery") return "Cash on Delivery — test only";
  if (normalized === "wallet") return "MKH Wallet";
  if (normalized === "card" || normalized === "paystack") return "Card / Paystack";
  return titleCase(method);
}

function statusTone(status: string) {
  const value = status.toLowerCase();
  if (["paid", "completed", "successful"].includes(value)) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (["failed", "reversed", "cancelled", "canceled"].includes(value)) return "bg-rose-50 text-rose-700 ring-rose-200";
  if (["pending", "unpaid", "on_hold", "transfer_submitted"].includes(value)) return "bg-amber-50 text-amber-800 ring-amber-200";
  if (["processing", "approved"].includes(value)) return "bg-sky-50 text-sky-700 ring-sky-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-600">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-9 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
        <Activity size={18} />
      </div>
      <p className="mt-3 text-sm font-bold text-slate-800">{title}</p>
      <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

export default function FinanceCommandCenter() {
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeSection, setActiveSection] = useState<NavId>("overview");
  const [riderSearch, setRiderSearch] = useState("");
  const [activatingRider, setActivatingRider] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/finance/command-center", { cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) {
        throw new Error(result?.message || "Finance command-centre data could not be loaded.");
      }
      setData(result as ApiPayload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Finance command-centre data could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = data?.summary;
  const orderSummary = summary?.orderSummary;
  const payoutRows = summary?.payoutRequests ?? [];
  const ledgerRows = summary?.ledger ?? [];
  const paymentRows = summary?.orderPayments ?? [];
  const dailyRows = summary?.dailyPaidOrders ?? [];
  const riderRows = data?.riders ?? [];

  const openPayoutPosition = useMemo(() => {
    const openStatuses = new Set(["pending", "approved", "processing", "transfer_submitted", "on_hold"]);
    return payoutRows.reduce(
      (total, row) => {
        if (!openStatuses.has(String(row.status ?? "").toLowerCase())) return total;
        return {
          count: total.count + safeNumber(row.request_count),
          amount: total.amount + safeNumber(row.amount_total),
        };
      },
      { count: 0, amount: 0 }
    );
  }, [payoutRows]);

  const filteredRiders = useMemo(() => {
    const query = riderSearch.trim().toLowerCase();
    if (!query) return riderRows;
    return riderRows.filter((rider) =>
      [rider.full_name, rider.email, rider.phone].some((value) => String(value ?? "").toLowerCase().includes(query))
    );
  }, [riderRows, riderSearch]);

  const maxDailyValue = Math.max(1, ...dailyRows.map((row) => safeNumber(row.paid_order_value)));

  function navigateTo(section: NavId) {
    setActiveSection(section);
    document.getElementById(`finance-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function activateRiderWallet(rider: RiderRow) {
    if (rider.wallet_count !== 0) return;
    const riderName = rider.full_name || rider.email || "this rider";
    const confirmed = window.confirm(
      `Create an empty, zero-balance MKH wallet for ${riderName}? This will not credit money or change earnings.`
    );
    if (!confirmed) return;

    setActivatingRider(rider.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/finance/command-center", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rider_id: rider.id }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) {
        throw new Error(result?.message || "Rider wallet activation failed.");
      }
      setNotice(result.result?.message || "Rider wallet activation completed. No funds were credited.");
      await load(true);
    } catch (activationError) {
      setError(activationError instanceof Error ? activationError.message : "Rider wallet activation failed.");
    } finally {
      setActivatingRider(null);
    }
  }

  const walletSummary = summary?.wallets;
  const displayName = data?.profile?.full_name || data?.profile?.email || "Finance Team";
  const roleName = titleCase(data?.profile?.role || "Finance");
  const generatedAt = data?.generatedAt || summary?.generatedAt;

  return (
    <div className="min-h-screen bg-[#f3f6fa] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[258px] flex-col bg-[#0b1426] text-white lg:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="rounded-xl bg-white px-3 py-2">
            <Image src="/logo.png" alt="Mammy Kitchen Hub" width={190} height={62} priority className="h-11 w-auto object-contain" />
          </div>
          <p className="mt-4 text-sm font-black tracking-wide">Finance & Accounts</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Financial Control Center</p>
        </div>

        <div className="px-4 pt-5">
          <p className="px-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500">Finance modules</p>
          <nav className="mt-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTo(item.id)}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${active ? "bg-orange-600 text-white shadow-lg shadow-orange-950/25" : "text-slate-300 hover:bg-white/8 hover:text-white"}`}
                >
                  <Icon size={18} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{item.label}</span>
                    <span className={`mt-0.5 block text-[10px] ${active ? "text-orange-100" : "text-slate-500 group-hover:text-slate-400"}`}>{item.description}</span>
                  </span>
                  <ChevronRight size={15} className={active ? "opacity-100" : "opacity-0 group-hover:opacity-70"} />
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto border-t border-white/10 p-4">
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Finance access verified
            </div>
            <p className="mt-1 text-[10px] leading-4 text-slate-400">Reports are read-only. Wallet activation creates an empty wallet only.</p>
          </div>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[258px]">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-[76px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600 lg:hidden"><CircleDollarSign size={21}/></div>
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-orange-600">Mammy Kitchen Hub</p>
                <h1 className="truncate text-xl font-black tracking-tight text-slate-950 sm:text-2xl">Finance Command Center</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="max-w-[190px] truncate text-xs font-extrabold text-slate-800">{displayName}</p>
                <p className="text-[10px] font-semibold text-slate-500">{roleName}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0b1426] text-xs font-black text-white">
                {displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "FN"}
              </div>
              <button type="button" onClick={() => void load(true)} disabled={loading || refreshing} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-extrabold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50">
                <RefreshCw size={15} className={refreshing ? "animate-spin" : ""}/><span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto border-t border-slate-100 px-4 py-2 lg:hidden">
            {NAV_ITEMS.map((item) => <button key={item.id} type="button" onClick={() => navigateTo(item.id)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${activeSection === item.id ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600"}`}>{item.label}</button>)}
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] space-y-7 px-4 py-6 sm:px-7 sm:py-8">
          <section className="relative overflow-hidden rounded-[26px] bg-[#101d32] px-6 py-6 text-white shadow-xl shadow-slate-900/10 sm:px-8 lg:px-9">
            <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-orange-500/15 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 right-[28%] h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl" />
            <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-orange-300">MKH finance operations</p>
                <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">Financial Control & Intelligence</h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">A consolidated view of recorded order payments, the financial ledger, wallet positions and payout request status across Mammy Kitchen Hub.</p>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-bold text-emerald-200"><span className="h-2 w-2 rounded-full bg-emerald-400"/>Finance data service available</span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-300"><ShieldCheck size={13}/>Server-authorized access</span>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-5 backdrop-blur">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Reporting integrity</p>
                <div className="mt-3 flex items-center gap-2 text-lg font-black"><LockKeyhole size={19} className="text-emerald-300"/>Read-only financial reporting</div>
                <p className="mt-2 text-xs leading-5 text-slate-300">This dashboard does not initiate transfers, change payout statuses, or recalculate settlements.</p>
                <p className="mt-4 border-t border-white/10 pt-3 text-[10px] text-slate-400">{generatedAt ? `Last refreshed ${new Date(generatedAt).toLocaleString("en-NG")}` : "Waiting for first data refresh"}</p>
              </div>
            </div>
          </section>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950">
            <strong>Payment interpretation:</strong> Cash on Delivery is a testing-only payment method. Unpaid COD order values are displayed separately and are not counted as paid collections. An order marked paid reflects the stored order status; it is not independent bank-transfer confirmation.
          </div>

          {error && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <span className="flex items-center gap-2"><AlertCircle size={17}/>{error}</span>
              <button type="button" onClick={() => void load()} className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-bold hover:bg-rose-100">Retry</button>
            </div>
          )}
          {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

          {loading && !summary ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((item) => <div key={item} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}
            </div>
          ) : null}

          {summary && orderSummary && (
            <>
              <section id="finance-overview" className="scroll-mt-28">
                <div className="mb-4 flex items-end justify-between gap-3">
                  <div><p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Executive position</p><h2 className="mt-1 text-xl font-black text-slate-950">Finance at a glance</h2></div>
                  <span className="text-[10px] font-semibold text-slate-400">Live database summary</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <KpiCard icon={CircleDollarSign} label="Order value marked paid" value={formatNaira(orderSummary.paid_order_value)} helper={`${safeNumber(orderSummary.paid_orders).toLocaleString("en-NG")} orders currently marked paid`} accent="emerald" />
                  <KpiCard icon={Banknote} label="Unpaid COD test orders" value={safeNumber(orderSummary.unpaid_cod_orders).toLocaleString("en-NG")} helper={`${formatNaira(orderSummary.unpaid_cod_order_value)} order value — not collected`} accent="amber" />
                  <KpiCard icon={Store} label="Total orders recorded" value={safeNumber(orderSummary.total_orders).toLocaleString("en-NG")} helper={`${formatNaira(orderSummary.total_order_value)} total order value across statuses`} accent="blue" />
                  <KpiCard icon={Clock3} label="Open payout requests" value={openPayoutPosition.count.toLocaleString("en-NG")} helper={`${formatNaira(openPayoutPosition.amount)} across pending, approved, processing, submitted and held`} accent="orange" />
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <SectionHeading eyebrow="Payment activity" title="Paid order value — last 14 days" description="Daily value of orders whose stored payment status is paid. Unpaid COD orders are excluded." />
                  {dailyRows.length === 0 ? <EmptyState title="No daily payment records" description="The database summary returned no daily order-payment points for this period." /> : (
                    <div className="mt-3">
                      <div className="mb-3 flex items-center justify-between text-[10px] text-slate-400"><span>{dailyRows.length} daily points</span><span>Highest day: {formatNaira(maxDailyValue)}</span></div>
                      <div className="flex h-48 items-end gap-1.5 border-b border-slate-200 px-1 sm:gap-2">
                        {dailyRows.map((row) => {
                          const value = safeNumber(row.paid_order_value);
                          const height = value > 0 ? Math.max(5, (value / maxDailyValue) * 100) : 2;
                          const dayLabel = new Date(`${row.day}T12:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
                          return (
                            <div key={row.day} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2" title={`${dayLabel}: ${formatNaira(value)} · ${safeNumber(row.paid_order_count)} paid orders`}>
                              <div className="flex h-[156px] w-full items-end justify-center">
                                <div className={`w-full max-w-[34px] rounded-t-md transition group-hover:opacity-80 ${value > 0 ? "bg-gradient-to-t from-orange-600 to-orange-400" : "bg-slate-100"}`} style={{ height: `${height}%` }} />
                              </div>
                              <span className="whitespace-nowrap text-[9px] font-semibold text-slate-400">{new Date(`${row.day}T12:00:00`).getDate()}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400"><span>{dailyRows[0]?.day}</span><span>Dates use the database session calendar</span><span>{dailyRows[dailyRows.length - 1]?.day}</span></div>
                    </div>
                  )}
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <SectionHeading eyebrow="Wallet coverage" title="Wallet network" description="Balances are shown separately by account type; they are not combined into one total." />
                  <div className="space-y-3">
                    <WalletMiniCard title="Vendor wallets" icon={Store} data={walletSummary?.vendor} color="orange" />
                    <WalletMiniCard title="Rider wallets" icon={Users} data={walletSummary?.rider} color="blue" />
                    <WalletMiniCard title="Customer wallets" icon={Wallet} data={walletSummary?.customer} color="emerald" />
                  </div>
                </article>
              </section>

              <section id="finance-payments" className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <SectionHeading eyebrow="Collections and order value" title="Payment position" description="Order amounts are grouped by the saved payment method and saved payment status. This is not a bank reconciliation statement." />
                {paymentRows.length === 0 ? <EmptyState title="No order-payment records" description="No orders were returned by the Finance read model." /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[650px] text-left text-sm">
                      <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500"><tr><th className="rounded-l-lg px-4 py-3">Payment method</th><th className="px-4 py-3">Payment status</th><th className="px-4 py-3 text-right">Orders</th><th className="rounded-r-lg px-4 py-3 text-right">Order value</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">{paymentRows.map((row) => <tr key={`${row.payment_method}:${row.payment_status}`} className="hover:bg-slate-50/70"><td className="px-4 py-3 font-bold text-slate-800">{paymentMethodLabel(String(row.payment_method ?? "unknown"))}</td><td className="px-4 py-3"><StatusPill value={String(row.payment_status ?? "unknown")} /></td><td className="px-4 py-3 text-right tabular-nums text-slate-600">{safeNumber(row.order_count).toLocaleString("en-NG")}</td><td className="px-4 py-3 text-right font-extrabold tabular-nums text-slate-950">{formatNaira(row.order_total)}</td></tr>)}</tbody>
                    </table>
                  </div>
                )}
              </section>

              <section id="finance-ledger" className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <SectionHeading eyebrow="Accounting records" title="Financial ledger intelligence" description="Persisted ledger entries grouped by entry type and status. Different entry types are kept separate to avoid double-counting allocations." />
                {ledgerRows.length === 0 ? <EmptyState title="No ledger entries found" description="No financial_ledger rows were returned. An empty ledger is shown as empty, not as a failed query." /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[650px] text-left text-sm">
                      <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500"><tr><th className="rounded-l-lg px-4 py-3">Entry type</th><th className="px-4 py-3">Ledger status</th><th className="px-4 py-3 text-right">Entries</th><th className="rounded-r-lg px-4 py-3 text-right">Recorded amount</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">{ledgerRows.map((row) => <tr key={`${row.entry_type}:${row.status}`} className="hover:bg-slate-50/70"><td className="px-4 py-3 font-bold text-slate-800">{titleCase(row.entry_type)}</td><td className="px-4 py-3"><StatusPill value={String(row.status ?? "unknown")} /></td><td className="px-4 py-3 text-right tabular-nums text-slate-600">{safeNumber(row.entry_count).toLocaleString("en-NG")}</td><td className="px-4 py-3 text-right font-extrabold tabular-nums text-slate-950">{formatNaira(row.amount_total)}</td></tr>)}</tbody>
                    </table>
                  </div>
                )}
              </section>

              <section id="finance-wallets" className="scroll-mt-28 space-y-5">
                <SectionHeading eyebrow="Wallet supervision" title="Wallet balances & rider activation" description="Finance can create an empty wallet for an active rider who has no wallet row. Existing balances are not overwritten or credited." />
                <div className="grid gap-4 xl:grid-cols-3">
                  <WalletDetailCard title="Vendor wallet position" data={walletSummary?.vendor} kind="vendor" />
                  <WalletDetailCard title="Rider wallet position" data={walletSummary?.rider} kind="rider" />
                  <WalletDetailCard title="Customer wallet position" data={walletSummary?.customer} kind="customer" />
                </div>
                <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
                    <div><h3 className="font-black text-slate-950">Rider wallet register</h3><p className="mt-1 text-xs text-slate-500">{data?.riderCounts.active ?? 0} active rider profiles · {data?.riderCounts.withWallet ?? 0} with one wallet · {data?.riderCounts.missingWallet ?? 0} not activated</p></div>
                    <div className="relative w-full sm:w-72"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={riderSearch} onChange={(event: { target: { value: string } }) => setRiderSearch(event.target.value)} placeholder="Search rider name or email" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs outline-none transition focus:border-orange-400 focus:bg-white" /></div>
                  </div>
                  {filteredRiders.length === 0 ? <div className="p-5"><EmptyState title={riderRows.length ? "No riders match this search" : "No active rider profiles"} description={riderRows.length ? "Try another rider name, email or phone number." : "No active rider profile was returned for wallet supervision."} /></div> : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[850px] text-left text-sm">
                        <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Rider</th><th className="px-4 py-3 text-right">Available</th><th className="px-4 py-3 text-right">Pending</th><th className="px-4 py-3 text-right">Lifetime earnings</th><th className="px-4 py-3">Wallet status</th><th className="px-4 py-3 text-right">Action</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">{filteredRiders.map((rider) => <tr key={rider.id} className="hover:bg-slate-50/70"><td className="px-4 py-3"><p className="font-extrabold text-slate-900">{rider.full_name || "Rider"}</p><p className="mt-0.5 text-xs text-slate-500">{rider.email || rider.phone || rider.id}</p></td><td className="px-4 py-3 text-right font-semibold tabular-nums">{rider.wallet ? formatNaira(rider.wallet.available_balance) : "—"}</td><td className="px-4 py-3 text-right tabular-nums">{rider.wallet ? formatNaira(rider.wallet.pending_balance) : "—"}</td><td className="px-4 py-3 text-right tabular-nums">{rider.wallet ? formatNaira(rider.wallet.lifetime_earnings) : "—"}</td><td className="px-4 py-3">{rider.wallet_issue ? <StatusPill value="duplicate wallet rows" /> : rider.wallet ? <StatusPill value="active" /> : <StatusPill value="not activated" />}</td><td className="px-4 py-3 text-right">{rider.wallet_count === 0 ? <button type="button" onClick={() => void activateRiderWallet(rider)} disabled={activatingRider === rider.id} className="rounded-lg bg-orange-600 px-3 py-2 text-[11px] font-extrabold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50">{activatingRider === rider.id ? "Activating…" : "Activate zero-balance wallet"}</button> : rider.wallet_issue ? <span className="text-[11px] font-bold text-rose-700">Finance review required</span> : <span className="text-[11px] font-bold text-emerald-700">Already active</span>}</td></tr>)}</tbody>
                      </table>
                    </div>
                  )}
                </article>
              </section>

              <section id="finance-payouts" className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <SectionHeading eyebrow="Payout obligations" title="Payout request position" description="Read-only request summary by requester type and current status. No approval, transfer, paid, rejection, reversal or balance action is exposed here." />
                {payoutRows.length === 0 ? <EmptyState title="No payout requests found" description="The payout_requests table returned no grouped request records." /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px] text-left text-sm">
                      <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500"><tr><th className="rounded-l-lg px-4 py-3">Requester type</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Requests</th><th className="rounded-r-lg px-4 py-3 text-right">Requested amount</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">{payoutRows.map((row) => <tr key={`${row.requester_type}:${row.status}`}><td className="px-4 py-3 font-bold text-slate-800">{titleCase(row.requester_type)}</td><td className="px-4 py-3"><StatusPill value={String(row.status ?? "unknown")} /></td><td className="px-4 py-3 text-right tabular-nums">{safeNumber(row.request_count).toLocaleString("en-NG")}</td><td className="px-4 py-3 text-right font-extrabold tabular-nums">{formatNaira(row.amount_total)}</td></tr>)}</tbody>
                    </table>
                  </div>
                )}
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950"><strong>Payout workflow held separate:</strong> this dashboard does not change the approved payout state machine or initiate transfers. The payout action workflow will be addressed during the dedicated payout/fulfilment walkthrough.</div>
              </section>

              <section id="finance-reports" className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <SectionHeading eyebrow="Control checks" title="Reports & reconciliation controls" description="A concise set of indicators to help Finance distinguish recorded activity from outstanding work." />
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <ControlMetric label="Rider profiles" value={data?.riderCounts.active ?? 0} detail="Active rider profiles returned" icon={Users}/>
                  <ControlMetric label="Rider wallets missing" value={data?.riderCounts.missingWallet ?? 0} detail="Active riders with no wallet row" icon={Wallet} alert={(data?.riderCounts.missingWallet ?? 0) > 0}/>
                  <ControlMetric label="Duplicate rider wallets" value={data?.riderCounts.duplicateWallet ?? 0} detail="Requires manual Finance investigation" icon={AlertCircle} alert={(data?.riderCounts.duplicateWallet ?? 0) > 0}/>
                  <ControlMetric label="Unpaid non-COD orders" value={safeNumber(orderSummary.unpaid_other_orders)} detail={`${formatNaira(orderSummary.unpaid_other_order_value)} value; method/status need review`} icon={Bell} alert={safeNumber(orderSummary.unpaid_other_orders) > 0}/>
                </div>
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-extrabold text-slate-800">How to read this dashboard</p><ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-600"><li>• Order value is not automatically cash received.</li><li>• Orders marked paid are grouped separately from unpaid orders.</li><li>• Ledger entry types remain separate to avoid summing allocations together.</li><li>• Vendor, rider and customer wallet positions are never combined.</li></ul></div>
                  <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-extrabold text-slate-800">Data sources</p><ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-600"><li>• Order payments: <code>orders</code></li><li>• Accounting entries: <code>financial_ledger</code></li><li>• Wallet positions: vendor, rider and customer wallet tables</li><li>• Payout requests: <code>payout_requests</code></li></ul></div>
                </div>
              </section>

              <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 py-4 text-[10px] text-slate-400">
                <span>MKH Finance & Accounts · Read-only reporting with guarded rider wallet activation</span>
                <span>{generatedAt ? `Data snapshot: ${new Date(generatedAt).toLocaleString("en-NG")}` : "No snapshot timestamp"}</span>
              </footer>
            </>
          )}

          {!loading && !summary && !error && <EmptyState title="Finance data is not available" description="The Finance API returned no summary. Refresh the page or contact an administrator if this continues." />}
        </main>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  helper,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  helper: string;
  accent: "emerald" | "amber" | "blue" | "orange";
}) {
  const styles = {
    emerald: "border-emerald-500 bg-emerald-50/70 text-emerald-700",
    amber: "border-amber-500 bg-amber-50/70 text-amber-700",
    blue: "border-blue-500 bg-blue-50/70 text-blue-700",
    orange: "border-orange-500 bg-orange-50/70 text-orange-700",
  };
  const [border, background, foreground] = styles[accent].split(" ");
  return (
    <article className={`min-w-0 rounded-2xl border border-slate-200 border-l-4 ${border} bg-white p-5 shadow-sm`}>
      <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold text-slate-500">{label}</p><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${background} ${foreground}`}><Icon size={18}/></span></div>
      <p className="mt-4 break-words text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{value}</p>
      <p className="mt-2 text-[10px] leading-4 text-slate-500">{helper}</p>
    </article>
  );
}

function StatusPill({ value }: { value: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold ring-1 ring-inset ${statusTone(value)}`}>{titleCase(value)}</span>;
}

function WalletMiniCard({
  title,
  icon: Icon,
  data,
  color,
}: {
  title: string;
  icon: LucideIcon;
  data?: WalletSummary;
  color: "orange" | "blue" | "emerald";
}) {
  const tone = color === "orange" ? "bg-orange-50 text-orange-600" : color === "blue" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600";
  return (
    <div className="rounded-xl border border-slate-200 p-3.5">
      <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}><Icon size={16}/></span><span className="text-xs font-extrabold text-slate-800">{title}</span></div><span className="text-[10px] text-slate-400">{safeNumber(data?.wallet_count)} wallets</span></div>
      <div className="mt-3 flex items-center justify-between gap-2"><span className="text-[10px] text-slate-500">Available</span><span className="text-sm font-black tabular-nums text-slate-950">{formatNaira(data?.available_balance)}</span></div>
    </div>
  );
}

function WalletDetailCard({
  title,
  data,
  kind,
}: {
  title: string;
  data?: WalletSummary;
  kind: "vendor" | "rider" | "customer";
}) {
  const reserveLabel = kind === "customer" ? "Locked balance" : "Pending balance";
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2"><h3 className="font-black text-slate-900">{title}</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{safeNumber(data?.wallet_count)} wallets</span></div>
      <div className="mt-4 space-y-3 text-xs">
        <WalletLine label="Available balance" value={data?.available_balance}/>
        <WalletLine label={reserveLabel} value={kind === "customer" ? data?.locked_balance : data?.pending_balance}/>
        {kind === "vendor" && <WalletLine label="Accrued balance" value={data?.accrued_balance}/>}
        {kind !== "customer" && <WalletLine label="Lifetime earnings" value={data?.lifetime_earnings}/>}
      </div>
    </article>
  );
}

function WalletLine({ label, value }: { label: string; value: unknown }) {
  return <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0"><span className="text-slate-500">{label}</span><strong className="tabular-nums text-slate-900">{formatNaira(value)}</strong></div>;
}

function ControlMetric({
  label,
  value,
  detail,
  icon: Icon,
  alert = false,
}: {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
  alert?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${alert ? "border-amber-200 bg-amber-50/70" : "border-slate-200 bg-slate-50"}`}>
      <div className="flex items-center justify-between gap-2"><p className="text-xs font-bold text-slate-600">{label}</p><Icon size={17} className={alert ? "text-amber-600" : "text-slate-400"}/></div>
      <p className="mt-3 text-2xl font-black text-slate-950">{value.toLocaleString("en-NG")}</p>
      <p className="mt-1 text-[10px] leading-4 text-slate-500">{detail}</p>
    </div>
  );
}
