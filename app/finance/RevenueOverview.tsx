
"use client";

interface RevenueOverviewProps {
  totalRevenue: number;
  platformRevenue: number;
  deliveryRevenue: number;
  pendingPayouts: number;
  processingPayouts: number;
  paidPayouts: number;
}

const formatNaira = (amount: number) =>
  `₦${amount.toLocaleString("en-NG", {
    maximumFractionDigits: 0,
  })}`;

export default function RevenueOverview({
  totalRevenue,
  platformRevenue,
  deliveryRevenue,
  pendingPayouts,
  processingPayouts,
  paidPayouts,
}: RevenueOverviewProps) {
  const cards = [
    {
      label: "Total MKH Revenue",
      value: totalRevenue,
      accent: "border-t-slate-950",
    },
    {
      label: "Platform Fees",
      value: platformRevenue,
      accent: "border-t-emerald-600",
    },
    {
      label: "MKH Delivery Share",
      value: deliveryRevenue,
      accent: "border-t-amber-400",
    },
    {
      label: "Pending Payouts",
      value: pendingPayouts,
      accent: "border-t-amber-400",
    },
    {
      label: "Processing Payouts",
      value: processingPayouts,
      accent: "border-t-slate-700",
    },
    {
      label: "Paid Payouts",
      value: paidPayouts,
      accent: "border-t-emerald-600",
    },
  ];

  return (
    <section
      aria-label="Revenue and payout overview"
      className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
    >
      {cards.map((card) => (
        <article
          key={card.label}
          className={`rounded-2xl border border-t-4 border-slate-200 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md ${card.accent}`}
        >
          <p className="text-sm font-semibold tracking-wide text-slate-500">
            {card.label}
          </p>

          <p className="mt-3 break-words text-3xl font-bold tracking-tight text-slate-950 tabular-nums sm:text-4xl">
            {formatNaira(card.value)}
          </p>
        </article>
      ))}
    </section>
  );
}
