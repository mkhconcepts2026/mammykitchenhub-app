"use client";

interface EnterpriseIntelligencePanelProps {
  order: any;
}

export default function EnterpriseIntelligencePanel({
  order,
}: EnterpriseIntelligencePanelProps) {

  // No order selected yet
  if (!order) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
          Enterprise Intelligence
        </h2>

        <p className="mt-3 text-sm text-slate-500">
          Select an order from the Orders Queue to launch the Enterprise
          Intelligence Workspace.
        </p>
      </div>
    );
  }

  const created = new Date(order.created_at);

  const elapsedMinutes = Math.floor(
    (Date.now() - created.getTime()) / 1000 / 60
  );

  const orderHealth =
    elapsedMinutes < 20
      ? "Healthy"
      : elapsedMinutes < 35
      ? "Attention"
      : "Critical";

  const slaStatus =
    elapsedMinutes < 30 ? "On Track" : "SLA Risk";

  const territoryImpact =
    order.status === "cancelled"
      ? "High"
      : elapsedMinutes > 30
      ? "Medium"
      : "Low";

  let recommendation = "Monitoring operational progress.";

  switch ((order.status || "").toLowerCase()) {

    case "pending":
      recommendation =
        elapsedMinutes > 10
          ? "Vendor has not accepted the order. Contact the vendor immediately."
          : "Waiting for vendor acceptance.";
      break;

    case "accepted":
      recommendation =
        "Vendor has accepted the order. Monitor kitchen preparation.";
      break;

    case "preparing":
      recommendation =
        elapsedMinutes > 25
          ? "Kitchen preparation is taking longer than expected. Contact the vendor."
          : "Kitchen preparation is progressing normally.";
      break;

    case "ready":
      recommendation =
        "Order is ready. Ensure a rider is assigned promptly.";
      break;

    case "picked_up":
      recommendation =
        "Order is with the rider. Monitor delivery progress.";
      break;

    case "delivered":
      recommendation =
        "Order completed successfully.";
      break;

    case "cancelled":
      recommendation =
        "Review the cancellation reason and customer experience.";
      break;

    default:
      recommendation =
        "Monitoring operational progress.";
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

      <h2 className="mb-6 text-xl font-bold text-slate-900">
        Enterprise Intelligence
      </h2>

      <div className="grid grid-cols-2 gap-4">

        <div className="rounded-xl border bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Order Health
          </p>

          <h3
            className={`mt-2 text-xl font-bold ${
              orderHealth === "Healthy"
                ? "text-green-600"
                : orderHealth === "Attention"
                ? "text-orange-500"
                : "text-red-600"
            }`}
          >
            {orderHealth}
          </h3>
        </div>

        <div className="rounded-xl border bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">
            SLA Status
          </p>

          <h3 className="mt-2 text-xl font-bold">
            {slaStatus}
          </h3>
        </div>

        <div className="rounded-xl border bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Elapsed Time
          </p>

          <h3 className="mt-2 text-xl font-bold">
            {elapsedMinutes} mins
          </h3>
        </div>

        <div className="rounded-xl border bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Territory Impact
          </p>

          <h3 className="mt-2 text-xl font-bold">
            {territoryImpact}
          </h3>
        </div>

      </div>

      <div className="mt-6 border-t pt-6">

        <h3 className="text-lg font-bold text-slate-900">
          AI Operational Recommendation
        </h3>

        <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-4">

          <p className="text-sm leading-6 text-slate-700">
            {recommendation}
          </p>

        </div>

      </div>

    </div>
  );
}