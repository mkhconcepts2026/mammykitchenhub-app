"use client";

interface Props {
  vendorWallets: any[];
  riderWallets: any[];
  vendorTransactions: any[];
  riderEarnings: any[];
}

export default function FinanceKPICards({
  vendorWallets,
  riderWallets,
  vendorTransactions,
  riderEarnings,
}: Props) {
  const vendorBalance = vendorWallets.reduce(
    (sum, wallet) => sum + Number(wallet.available_balance ?? 0),
    0
  );

  const riderBalance = riderWallets.reduce(
    (sum, wallet) => sum + Number(wallet.available_balance ?? 0),
    0
  );

  const pendingSettlements = vendorTransactions
    .filter((transaction) => transaction.status !== "paid")
    .reduce(
      (sum, transaction) => sum + Number(transaction.net_amount ?? 0),
      0
    );

  const totalRiderEarnings = riderEarnings.reduce(
    (sum, earning) => sum + Number(earning.amount ?? 0),
    0
  );

  const cards = [
    {
      title: "Vendor Wallets",
      value: `₦${vendorBalance.toLocaleString()}`,
      color: "border-emerald-500",
      bg: "bg-emerald-50",
      icon: "🏦",
    },
    {
      title: "Rider Wallets",
      value: `₦${riderBalance.toLocaleString()}`,
      color: "border-blue-500",
      bg: "bg-blue-50",
      icon: "🏍",
    },
    {
      title: "Pending Settlements",
      value: `₦${pendingSettlements.toLocaleString()}`,
      color: "border-orange-500",
      bg: "bg-orange-50",
      icon: "💳",
    },
    {
      title: "Rider Earnings",
      value: `₦${totalRiderEarnings.toLocaleString()}`,
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