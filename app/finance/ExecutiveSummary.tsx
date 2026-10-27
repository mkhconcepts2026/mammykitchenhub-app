
"use client";

interface ExecutiveSummaryProps {
  totalOrders: number;
  averageRevenue: number;
  pendingRequests: number;
  completedPayouts: number;
}

export default function ExecutiveSummary({
  totalOrders,
  averageRevenue,
  pendingRequests,
  completedPayouts,
}: ExecutiveSummaryProps) {
  const metrics = [
    {
      label: "Total Orders",
      value: totalOrders.toLocaleString("en-NG"),
      accent: "border-l-slate-900",
    },
    {
      label: "Average MKH Revenue",
      value: `₦${averageRevenue.toLocaleString("en-NG")}`,
      accent: "border-l-emerald-600",
    },
    {
      label: "Pending Requests",
      value: pendingRequests.toLocaleString("en-NG"),
      accent: "border-l-amber-400",
    },
    {
      label: "Completed Payouts",
      value: completedPayouts.toLocaleString("en-NG"),
      accent: "border-l-emerald-600",
    },
  ];

  return (
    <section
      aria-labelledby="finance-executive-summary"
      className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <div className="mb-6">
        <h2
          id="finance-executive-summary"
          className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl"
        >
          Executive Summary
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          A snapshot of orders and payout activity.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className={`min-w-0 rounded-xl border border-slate-200 border-l-4 bg-slate-50/70 p-5 ${metric.accent}`}
          >
            <p className="text-sm font-medium text-slate-500">
              {metric.label}
            </p>

            <p className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-950 tabular-nums sm:text-3xl">
              {metric.value}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
