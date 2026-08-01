"use client";


interface Props {
  order: any;
}

export default function LiveOperationsTimeline({ order }: Props) {
  if (!order) return null;

  const timeline = [
    {
      label: "Order Created",
      time: order.created_at,
      color: "bg-slate-900",
    },
    {
      label: "Vendor Accepted",
      time: order.accepted_at,
      color: "bg-blue-600",
    },
    {
      label: "Preparing",
      time: order.preparing_at,
      color: "bg-orange-500",
    },
    {
      label: "Ready for Pickup",
      time: order.ready_at,
      color: "bg-purple-600",
    },
    {
      label: "Picked Up",
      time: order.picked_up_at,
      color: "bg-indigo-600",
    },
    {
      label: "Delivered",
      time: order.delivered_at,
      color: "bg-emerald-600",
    },
    {
      label: "Cancelled",
      time: order.cancelled_at,
      color: "bg-red-600",
    },
  ].filter((event) => event.time);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-8 py-6">
        <h2 className="text-2xl font-bold text-slate-900">
          Live Operations Timeline
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Real-time operational progression for this order.
        </p>
      </div>

      <div className="space-y-6 p-8">
        {timeline.map((event, index) => (
          <div key={event.label} className="flex items-start gap-5">
            <div className="flex flex-col items-center">
              <div
                className={`h-4 w-4 rounded-full ${event.color}`}
              />

              {index !== timeline.length - 1 && (
                <div className="mt-2 h-12 w-0.5 bg-slate-200" />
              )}
            </div>

            <div>
              <h3 className="font-bold text-slate-900">
                {event.label}
              </h3>

              <p className="text-sm text-slate-500">
                {new Date(event.time).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}