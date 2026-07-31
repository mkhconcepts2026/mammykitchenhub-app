interface MissionControlProps {
  order?: any;
}

export default function MissionControl({
  order,
}: MissionControlProps) {

  const elapsedMinutes = order?.created_at
  ? Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(order.created_at).getTime()) / 60000
      )
    )
  : 0;

  const elapsedDisplay = (() => {
  const days = Math.floor(elapsedMinutes / 1440);
  const hours = Math.floor((elapsedMinutes % 1440) / 60);
  const minutes = elapsedMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return minutes > 0
      ? `${hours}h ${minutes}m`
      : `${hours}h`;
  }

  return `${minutes}m`;
})();

  const slaRisk =
  order?.status === "delivered"
    ? "Completed"
    : order?.status === "cancelled"
    ? "Cancelled"
    : elapsedMinutes >= 40
    ? "High"
    : elapsedMinutes >= 20
    ? "Medium"
    : "Low";

const operationalHealth =
  order?.status === "cancelled"
    ? "Critical"
    : slaRisk === "High"
    ? "At Risk"
    : "Healthy";

const slaStatus =
  order?.status === "delivered"
    ? "Completed"
    : order?.status === "cancelled"
    ? "Breached"
    : slaRisk === "High"
    ? "Breached"
    : slaRisk === "Medium"
    ? "Attention"
    : "On Track";

const operationalHealthClass =
  operationalHealth === "Healthy"
    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
    : operationalHealth === "At Risk"
    ? "bg-amber-100 text-amber-700 border border-amber-200"
    : "bg-red-100 text-red-700 border border-red-200";

const orderStatusClass =
  order?.status === "delivered"
    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
    : order?.status === "cancelled"
    ? "bg-red-100 text-red-700 border border-red-200"
    : order?.status === "preparing" || order?.status === "ready"
    ? "bg-amber-100 text-amber-700 border border-amber-200"
    : "bg-blue-100 text-blue-700 border border-blue-200";

const slaStatusClass =
  slaStatus === "On Track"
    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
    : slaStatus === "Attention"
    ? "bg-amber-100 text-amber-700 border border-amber-200"
    : slaStatus === "Breached"
    ? "bg-red-100 text-red-700 border border-red-200"
    : "bg-blue-100 text-blue-700 border border-blue-200";

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

      {/* Header */}

      <div className="bg-[#0F172A] px-6 py-6">

        <div className="flex items-start justify-between">

          <div>

            <p className="text-xs font-bold uppercase tracking-[0.35em] text-slate-400">
              Mission Control
            </p>

           <h2 className="mt-3 text-4xl font-black text-white">

  {order?.order_number ?? "Order Pending"}

</h2>
            <p className="mt-3 max-w-md text-slate-300">

              Executive operational summary for the selected order.

            </p>

          </div>

          <div className="space-y-3">

            <div className={`rounded-full px-4 py-2 text-sm font-bold ${operationalHealthClass}`}>

              {operationalHealth}

            </div>

            <div className={`rounded-full px-4 py-2 text-sm font-bold capitalize ${orderStatusClass}`}>

              {order?.status ?? "Unknown"}

            </div>

            <div className={`rounded-full px-4 py-2 text-sm font-bold ${slaStatusClass}`}>

              SLA {slaStatus}

            </div>

          </div>

        </div>

      </div>

     {/* Enterprise KPI Strip */}

<div className="border-t border-slate-200 bg-white">

  <div className="grid grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_1fr_1.45fr_1fr]">

    <div className="border-r border-slate-200 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Order Value
      </p>

      <h3 className="mt-2 text-3xl font-black text-slate-900">
        ₦{Number(order?.total ?? 0).toLocaleString()}
      </h3>
    </div>

    <div className="border-r border-slate-200 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Vendor
      </p>

      <h3 className="mt-2 text-lg font-bold leading-7">
        {order?.vendors?.name ?? "Unknown"}
      </h3>
    </div>

    <div className="border-r border-slate-200 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Rider
      </p>

      <h3 className="mt-2 text-lg font-bold leading-7">
        {order?.rider?.full_name ?? "Awaiting Assignment"}
      </h3>
    </div>

    <div className="border-r border-slate-200 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Elapsed
      </p>

    <h3 className="mt-2 text-2xl xl:text-3xl font-black">
  {elapsedDisplay}
</h3>
    </div>

    <div className="border-r border-slate-200 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        SLA Risk
      </p>

 <h3
  className={`mt-2 text-2xl xl:text-3xl font-black leading-tight break-words ${
    slaRisk === "High"
      ? "text-red-600"
      : slaRisk === "Medium"
      ? "text-amber-600"
      : slaRisk === "Completed"
      ? "text-blue-600"
      : slaRisk === "Cancelled"
      ? "text-slate-500"
      : "text-emerald-600"
  }`}
>
  {slaRisk}
</h3>
    </div>

    <div className="p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Manager
      </p>

      <h3 className="mt-2 text-xl font-bold text-orange-600">
        Monitoring
      </h3>
    </div>

  </div>

</div>

    </section>
  );
}