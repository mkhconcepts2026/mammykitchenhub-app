"use client";

interface ActivityEvent {
  id: string;
  orderNumber: string;
  vendor: string;
  event: string;
  timestamp: string;
}

interface Props {
  events: ActivityEvent[];
}

export default function TerritoryActivityFeed({ events }: Props) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-8 py-6">
        <h2 className="text-2xl font-bold text-slate-900">
          Territory Activity Feed
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Live operational events across your territory.
        </p>
      </div>

      <div className="p-8">
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">
            No operational activity available.
          </p>
        ) : (
          <div className="space-y-5">
            {events.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start justify-between rounded-2xl border border-slate-100 p-4"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {activity.vendor}
                  </p>

                  <p className="text-sm text-slate-600">
                    {activity.event}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Order #{activity.orderNumber}
                  </p>
                </div>

                <div className="text-right text-xs text-slate-500">
                  {new Date(activity.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}