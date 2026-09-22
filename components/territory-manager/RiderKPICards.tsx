"use client";

interface RiderKPICardsProps {
  totalRiders: number;
  activeRiders: number;
  offlineRiders: number;
  outstandingWallet: number;
}

const cards = (
  totalRiders: number,
  activeRiders: number,
  offlineRiders: number,
  outstandingWallet: number
) => [
  {
    title: "Total Riders",
    value: totalRiders,
    icon: "🏍",
    border: "border-orange-500",
    bg: "bg-orange-50",
  },
  {
    title: "Active Riders",
    value: activeRiders,
    icon: "🟢",
    border: "border-emerald-500",
    bg: "bg-emerald-50",
  },
  {
    title: "Offline Riders",
    value: offlineRiders,
    icon: "⚫",
    border: "border-slate-500",
    bg: "bg-slate-100",
  },
  {
    title: "Outstanding Wallet",
    value: `₦${outstandingWallet.toLocaleString()}`,
    icon: "💰",
    border: "border-[#D4AF37]",
    bg: "bg-amber-50",
  },
];

export default function RiderKPICards({
  totalRiders,
  activeRiders,
  offlineRiders,
  outstandingWallet,
}: RiderKPICardsProps) {
  return (
    <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">

      {cards(
        totalRiders,
        activeRiders,
        offlineRiders,
        outstandingWallet
      ).map((card) => (

        <div
          key={card.title}
          className={`rounded-2xl border-l-4 ${card.border} ${card.bg} p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}
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