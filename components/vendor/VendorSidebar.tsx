"use client";

import {
  LayoutDashboard,
  ClipboardList,
  UtensilsCrossed,
  Wallet,
  ShieldCheck,
  LogOut,
  ArrowUpRight,
} from "lucide-react";

type Tab = "dashboard" | "orders" | "menu" | "earnings" | "kyc";

type Props = {
  currentTab: string;
  setCurrentTab: (tab: Tab) => void;
  vendorName: string;
  logout: () => void;
};

const navigation: Array<{
  tab: Tab;
  label: string;
  Icon: typeof LayoutDashboard;
}> = [
  { tab: "dashboard", label: "Overview", Icon: LayoutDashboard },
  { tab: "orders", label: "Orders", Icon: ClipboardList },
  { tab: "menu", label: "Menu & availability", Icon: UtensilsCrossed },
  { tab: "earnings", label: "Earnings & payouts", Icon: Wallet },
  { tab: "kyc", label: "KYC verification", Icon: ShieldCheck },
];

export default function VendorSidebar({
  currentTab,
  setCurrentTab,
  vendorName,
  logout,
}: Props) {
  return (
    <aside className="relative flex min-h-screen w-[250px] shrink-0 flex-col overflow-hidden bg-[#0b1220] text-white sm:w-[270px] lg:sticky lg:top-0 lg:h-screen">
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#ff6b00]/10 blur-3xl" />

      <div className="relative flex items-center gap-3 border-b border-white/10 px-5 py-6">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-1 shadow-lg shadow-black/20">
          <img
            src="/logo.png"
            alt="Mammy Kitchen Hub logo"
            className="absolute inset-0 h-full w-full object-contain"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
          <span className="text-sm font-black text-[#ff6b00]">MKH</span>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#ff8a26]">
            Mammy Kitchen Hub
          </p>
          <p className="mt-1 text-sm font-semibold text-white">Vendor Workspace</p>
        </div>
      </div>

      <div className="relative flex-1 px-4 py-6">
        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
          Manage your business
        </p>
        <nav aria-label="Vendor dashboard navigation" className="space-y-2">
          {navigation.map(({ tab, label, Icon }) => {
            const active = currentTab === tab;
            return (
              <button
                key={tab}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setCurrentTab(tab)}
                className={`group flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8a26] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1220] ${
                  active
                    ? "bg-[#ff6b00] text-white shadow-lg shadow-orange-950/30"
                    : "text-slate-300 hover:bg-white/8 hover:text-white"
                }`}
              >
                <Icon size={18} strokeWidth={2.1} className="shrink-0" />
                <span className="min-w-0 flex-1">{label}</span>
                {active && <ArrowUpRight size={16} className="shrink-0" />}
              </button>
            );
          })}
        <a href="/vendor-dashboard-v2/commission" data-mkh-commission-agreements-link="true" className="group flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-sm font-semibold text-slate-300 transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8a26] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1220]">
  <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-current text-[9px] font-black">CA</span>
  <span>Commission agreements</span>
</a>
</nav>

        <div className="mt-8 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-bold text-emerald-300">Workspace active</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Keep your menu, orders and payout details up to date.
          </p>
        </div>
      </div>

      <div className="relative border-t border-white/10 p-4">
        <div className="mb-4 flex min-w-0 items-center gap-3 px-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sm font-bold text-[#ff9b50]">
            {(vendorName || "V").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{vendorName || "Your Store"}</p>
            <p className="text-xs text-slate-400">Vendor account</p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8a26]"
        >
          <LogOut size={17} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
