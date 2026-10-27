
"use client";

interface SettlementCentreProps {
  payoutRequests: any[];
  vendorsMap: Record<string, string>;
  markProcessing: (request: any) => void;
  markPaid: (request: any) => void;
}

const formatNaira = (amount: number) =>
  `₦${amount.toLocaleString("en-NG", {
    maximumFractionDigits: 2,
  })}`;

function getStatusStyle(status: string) {
  switch (status?.toLowerCase()) {
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "processing":
      return "border-slate-300 bg-slate-100 text-slate-700";
    case "paid":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default function SettlementCentre({
  payoutRequests,
  vendorsMap,
  markProcessing,
  markPaid,
}: SettlementCentreProps) {
  return (
    <section
      aria-labelledby="finance-settlement-heading"
      className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
    >
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="finance-settlement-heading"
            className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl"
          >
            Settlement Centre
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Review payout requests and update their processing status.
          </p>
        </div>

        <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {payoutRequests.length}{" "}
          {payoutRequests.length === 1 ? "request" : "requests"}
        </span>
      </div>

      {payoutRequests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
          <p className="font-semibold text-slate-700">
            No payout requests found
          </p>
          <p className="mt-1 text-sm text-slate-500">
            New requests will appear here when available.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {payoutRequests.map((request) => {
            const status = String(request.status ?? "").toLowerCase();
            const vendorName =
              vendorsMap[request.requester_id] || "Unknown Vendor";

            const requestedDate = request.requested_at
              ? new Date(request.requested_at)
              : null;

            const dateLabel =
              requestedDate && !Number.isNaN(requestedDate.getTime())
                ? requestedDate.toLocaleDateString("en-NG", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "Date unavailable";

            return (
              <article
                key={request.id}
                className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 sm:p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="break-words text-xl font-bold tracking-tight text-slate-950 tabular-nums sm:text-2xl">
                      {formatNaira(Number(request.amount || 0))}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Requested {dateLabel}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusStyle(status)}`}
                      >
                        {status ? status.toUpperCase() : "UNKNOWN"}
                      </span>

                      <span className="max-w-full break-words rounded-lg bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
                        {vendorName}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
                    {status === "pending" && (
                      <button
                        type="button"
                        onClick={() => markProcessing(request)}
                        className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                      >
                        Approve
                      </button>
                    )}

                    {status === "processing" && (
                      <button
                        type="button"
                        onClick={() => markPaid(request)}
                        className="inline-flex min-h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                      >
                        Mark Paid (Submitted Transfer)
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
