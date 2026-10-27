
"use client";

interface RecentFinancialActivityProps {
  payoutRequests: any[];
  vendorsMap: Record<string, string>;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
}

const formatNaira = (amount: number) =>
  `₦${amount.toLocaleString("en-NG", {
    maximumFractionDigits: 2,
  })}`;

function getStatusStyle(status: string) {
  switch (status.toLowerCase()) {
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

export default function RecentFinancialActivity({
  payoutRequests,
  vendorsMap,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
}: RecentFinancialActivityProps) {
  const filteredRequests = payoutRequests.filter((request) => {
    const vendorName = String(
      vendorsMap[request.requester_id] || ""
    );

    const matchesSearch = vendorName
      .toLowerCase()
      .includes(searchTerm.trim().toLowerCase());

    const requestStatus = String(
      request.status ?? ""
    ).toLowerCase();

    const matchesStatus =
      statusFilter.toLowerCase() === "all status" ||
      requestStatus === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const visibleRequests = filteredRequests.slice(0, 5);

  return (
    <section
      aria-labelledby="finance-recent-activity"
      className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
    >
      <div className="mb-6">
        <h2
          id="finance-recent-activity"
          className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl"
        >
          Recent Financial Activity
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Review recent vendor payout requests and their current status.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
        <div>
          <label
            htmlFor="finance-vendor-search"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Search vendor
          </label>
          <input
            id="finance-vendor-search"
            type="search"
            placeholder="Enter vendor name..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
          />
        </div>

        <div>
          <label
            htmlFor="finance-status-filter"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Filter by status
          </label>
          <select
            id="finance-status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
          >
            <option>All Status</option>
            <option>Pending</option>
            <option>Processing</option>
            <option>Paid</option>
          </select>
        </div>
      </div>

      {payoutRequests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
          <p className="font-semibold text-slate-700">
            No financial activity yet
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Vendor payout activity will appear here when available.
          </p>
        </div>
      ) : visibleRequests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
          <p className="font-semibold text-slate-700">
            No matching activity found
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Try another vendor name or status filter.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {visibleRequests.map((request) => {
            const vendorName =
              vendorsMap[request.requester_id] || "Unknown Vendor";

            const status = String(
              request.status ?? ""
            ).toLowerCase();

            const requestedDate = request.requested_at
              ? new Date(request.requested_at)
              : null;

            const dateLabel =
              requestedDate &&
              !Number.isNaN(requestedDate.getTime())
                ? requestedDate.toLocaleDateString("en-NG", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "Date unavailable";

            return (
              <article
                key={request.id}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="break-words font-semibold text-slate-900">
                    {vendorName}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusStyle(status)}`}
                    >
                      {status ? status.toUpperCase() : "UNKNOWN"}
                    </span>

                    <span className="text-xs text-slate-500">
                      Requested {dateLabel}
                    </span>
                  </div>
                </div>

                <p className="break-words text-lg font-bold tracking-tight text-slate-950 tabular-nums sm:shrink-0 sm:text-right">
                  {formatNaira(Number(request.amount || 0))}
                </p>
              </article>
            );
          })}
        </div>
      )}

      {filteredRequests.length > 5 && (
        <p className="mt-5 border-t border-slate-200 pt-4 text-xs text-slate-500">
          Showing the 5 most recent matching requests.
        </p>
      )}
    </section>
  );
}
