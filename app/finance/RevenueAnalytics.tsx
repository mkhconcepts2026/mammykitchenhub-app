
"use client";

interface RevenueAnalyticsProps {
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  averageOrderValue: number;
  highestRevenueDay: string;
  highestRevenueAmount: number;
}

const formatNaira = (amount: number) =>
  `₦${amount.toLocaleString("en-NG")}`;

export default function RevenueAnalytics({
  todayRevenue,
  weekRevenue,
  monthRevenue,
  averageOrderValue,
  highestRevenueDay,
  highestRevenueAmount,
}: RevenueAnalyticsProps) {
  const periods = [
    {
      label: "Today's Revenue",
      value: todayRevenue,
      accent: "border-t-amber-400",
    },
    {
      label: "This Week",
      value: weekRevenue,
      accent: "border-t-slate-800",
    },
    {
      label: "This Month",
      value: monthRevenue,
      accent: "border-t-emerald-600",
    },
  ];

  const highlights = [
    {
      label: "Average Order Value",
      value: formatNaira(averageOrderValue),
      accent: "border-l-emerald-600",
    },
    {
      label: "Best Revenue Day",
      value: highestRevenueDay || "-",
      accent: "border-l-amber-400",
      secondary: formatNaira(highestRevenueAmount),
    },
  ];

  return (
    <section
      aria-labelledby="finance-revenue-analytics"
      className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <div className="mb-6">
        <h2
          id="finance-revenue-analytics"
          className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl"
        >
          Revenue Analytics
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Revenue performance across key periods.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {periods.map((period) => (
          <article
            key={period.label}
            className={`min-w-0 rounded-xl border border-slate-200 border-t-4 bg-slate-50/70 p-5 ${period.accent}`}
          >
            <p className="text-sm font-medium text-slate-500">
              {period.label}
            </p>
            <p className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-950 tabular-nums sm:text-3xl">
              {formatNaira(period.value)}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {highlights.map((highlight) => (
          <article
            key={highlight.label}
            className={`min-w-0 rounded-xl border border-slate-200 border-l-4 bg-white p-5 ${highlight.accent}`}
          >
            <p className="text-sm font-medium text-slate-500">
              {highlight.label}
            </p>
            <p className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-950 tabular-nums sm:text-3xl">
              {highlight.value}
            </p>
            {highlight.secondary && (
              <p className="mt-2 text-sm font-semibold text-emerald-700 tabular-nums">
                {highlight.secondary}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
