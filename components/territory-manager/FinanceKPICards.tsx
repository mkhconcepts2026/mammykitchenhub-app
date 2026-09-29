"use client";

interface Props {
  vendorWallets: any[];
  riderWallets: any[];
  financialLedger: any[];
  riderEarnings: any[];
}

export default function FinanceKPICards({
  vendorWallets,
  riderWallets,
  financialLedger,
  riderEarnings,
}: Props) {
  const vendorAvailableBalance = vendorWallets.reduce(
    (sum, wallet) => sum + Number(wallet.available_balance ?? 0),
    0
  );

  const vendorAccruedBalance = vendorWallets.reduce(
    (sum, wallet) => sum + Number(wallet.accrued_balance ?? 0),
    0
  );

  const riderPendingBalance = riderWallets.reduce(
    (sum, wallet) => sum + Number(wallet.pending_balance ?? 0),
    0
  );

  const platformRevenue = financialLedger
    .filter(
      (entry) => entry.entry_type === "platform_revenue"
    )
    .reduce(
      (sum, entry) => sum + Number(entry.amount ?? 0),
      0
    );

  const cards = [
    {
      title: "Vendor Available",
      value: `₦${vendorAvailableBalance.toLocaleString()}`,
      color: "border-emerald-500",
      bg: "bg-emerald-50",
      icon: "🏦",
    },
    {
      title: "Vendor Accrued",
      value: `₦${vendorAccruedBalance.toLocaleString()}`,
      color: "border-orange-500",
      bg: "bg-orange-50",
      icon: "💳",
    },
    {
      title: "Rider Pending",
      value: `₦${riderPendingBalance.toLocaleString()}`,
      color: "border-blue-500",
      bg: "bg-blue-50",
      icon: "🏍",
    },
    {
      title: "Platform Revenue",
      value: `₦${platformRevenue.toLocaleString()}`,
      color: "border-purple-500",
      bg: "bg-purple-50",
      icon: "💰",
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`rounded-2xl border-l-4 ${card.color} ${card.bg} p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                {card.title}
              </p>

              <h2 className="mt-3 text-3xl font-black text-slate-900">
                {card.value}
              </h2>
            </div>

            <div className="text-4xl">
              {card.icon}
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}