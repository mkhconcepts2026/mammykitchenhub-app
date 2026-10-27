"use client";

interface SettlementCentreProps {
  payoutRequests: any[];
  vendorsMap: Record<string, string>;
  approvePayout: (request: any) => void;
  startProcessing: (request: any) => void;
  submitTransfer: (request: any) => void;
  markPaid: (request: any) => void;
  holdPayout: (request: any) => void;
  resumePayout: (request: any) => void;
  rejectPayout: (request: any) => void;
  reportTransferFailure: (request: any) => void;
}

const formatNaira = (amount: number) =>
  `₦${amount.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

function getStatusStyle(status: string) {
  switch (status?.toLowerCase()) {
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "approved":
      return "border-blue-200 bg-blue-50 text-blue-800";
    case "processing":
    case "transfer_submitted":
      return "border-slate-300 bg-slate-100 text-slate-700";
    case "on_hold":
      return "border-orange-200 bg-orange-50 text-orange-800";
    case "paid":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "rejected":
    case "failed":
      return "border-red-200 bg-red-50 text-red-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default function SettlementCentre({
  payoutRequests,
  vendorsMap,
  approvePayout,
  startProcessing,
  submitTransfer,
  markPaid,
  holdPayout,
  resumePayout,
  rejectPayout,
  reportTransferFailure,
}: SettlementCentreProps) {
  // This centre operates only on vendor payouts; other payout workflows stay separate.
  const vendorPayoutRequests = payoutRequests.filter(
    (request) => String(request.requester_type ?? "").toLowerCase() === "vendor"
  );

  const buttonClass =
    "inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
  const darkButton =
    `${buttonClass} bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-400`;
  const greenButton =
    `${buttonClass} bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500`;
  const lightButton =
    `${buttonClass} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-400`;
  const redButton =
    `${buttonClass} bg-red-600 text-white hover:bg-red-700 focus:ring-red-500`;

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
            Review vendor payouts and manage each settlement stage.
          </p>
        </div>
        <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {vendorPayoutRequests.length}{" "}
          {vendorPayoutRequests.length === 1 ? "request" : "requests"}
        </span>
      </div>

      {vendorPayoutRequests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
          <p className="font-semibold text-slate-700">No vendor payout requests found</p>
          <p className="mt-1 text-sm text-slate-500">
            Vendor payout requests will appear here when available.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {vendorPayoutRequests.map((request) => {
            const status = String(request.status ?? "").toLowerCase();
            const vendorName = vendorsMap[request.requester_id] || "Unknown Vendor";
            const requestedDate = request.requested_at ? new Date(request.requested_at) : null;
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
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="break-words text-xl font-bold tracking-tight text-slate-950 tabular-nums sm:text-2xl">
                      {formatNaira(Number(request.amount || 0))}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Requested {dateLabel}</p>
                    {request.transfer_reference && (
                      <p className="mt-1 break-all text-xs text-slate-500">
                        Transfer reference: {request.transfer_reference}
                      </p>
                    )}
                    {status === "on_hold" && request.hold_reason && (
                      <p className="mt-2 text-sm text-orange-800">
                        Hold reason: {request.hold_reason}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusStyle(status)}`}>
                        {status ? status.replaceAll("_", " ").toUpperCase() : "UNKNOWN"}
                      </span>
                      <span className="max-w-full break-words rounded-lg bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
                        {vendorName}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:max-w-[55%] lg:justify-end">
                    {status === "pending" && (
                      <>
                        <button type="button" onClick={() => approvePayout(request)} className={darkButton}>Approve</button>
                        <button type="button" onClick={() => rejectPayout(request)} className={redButton}>Reject</button>
                        <button type="button" onClick={() => holdPayout(request)} className={lightButton}>Hold</button>
                      </>
                    )}
                    {status === "approved" && (
                      <>
                        <button type="button" onClick={() => startProcessing(request)} className={darkButton}>Start Processing</button>
                        <button type="button" onClick={() => rejectPayout(request)} className={redButton}>Reject</button>
                        <button type="button" onClick={() => holdPayout(request)} className={lightButton}>Hold</button>
                      </>
                    )}
                    {status === "processing" && (
                      <>
                        <button type="button" onClick={() => submitTransfer(request)} className={greenButton}>Submit Transfer</button>
                        <button type="button" onClick={() => reportTransferFailure(request)} className={redButton}>Confirm Transfer Failure</button>
                        <button type="button" onClick={() => holdPayout(request)} className={lightButton}>Hold</button>
                      </>
                    )}
                    {status === "transfer_submitted" && (
                      <>
                        <button type="button" onClick={() => markPaid(request)} className={greenButton}>Confirm Paid</button>
                        <button type="button" onClick={() => reportTransferFailure(request)} className={redButton}>Confirm Transfer Failure</button>
                        <button type="button" onClick={() => holdPayout(request)} className={lightButton}>Hold / Investigate</button>
                      </>
                    )}
                    {status === "on_hold" && (
                      <button type="button" onClick={() => resumePayout(request)} className={darkButton}>
                        Resume Previous Stage
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
