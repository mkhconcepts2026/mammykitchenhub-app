"use client";

interface CurrentOrder {
  id: string;
  order_number: string | null;
  status: string;
  vendor_id: string | null;
  rider_id: string | null;
  total: number;
  created_at: string;
}

interface Rider {
  id: string;
  rider_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  accuracy: number;
  updated_at: string;

  profiles?: {
    full_name: string | null;
    status: string | null;
  };

  current_order: CurrentOrder | null;

  operational_status:
    | "available"
    | "assigned"
    | "delivering"
    | "offline";
}

interface Props {
  riders: Rider[];
}

function formatOperationalStatus(status: string) {
  switch (status) {
    case "available":
      return "Available";

    case "assigned":
      return "Assigned";

    case "delivering":
      return "Delivering";

    case "offline":
      return "Offline";

    default:
      return status;
  }
}

function getOperationalStatusStyle(status: string) {
  switch (status) {
    case "available":
      return "bg-emerald-100 text-emerald-700";

    case "assigned":
      return "bg-blue-100 text-blue-700";

    case "delivering":
      return "bg-orange-100 text-orange-700";

    case "offline":
      return "bg-slate-100 text-slate-600";

    default:
      return "bg-slate-100 text-slate-600";
  }
}

function formatOrderStatus(status: string) {
  switch (status) {
    case "assigned":
      return "Assigned";

    case "picked_up":
      return "Picked Up";

    default:
      return status
        .replaceAll("_", " ")
        .replace(/\b\w/g, (character) =>
          character.toUpperCase()
        );
  }
}

function getGpsFreshness(updatedAt: string) {
  const updatedTime = new Date(updatedAt).getTime();

  if (Number.isNaN(updatedTime)) {
    return "Unknown";
  }

  const ageSeconds = Math.floor(
    (Date.now() - updatedTime) / 1000
  );

  if (ageSeconds <= 15) {
    return "Live";
  }

  if (ageSeconds <= 60) {
    return `${ageSeconds}s ago`;
  }

  const ageMinutes = Math.floor(ageSeconds / 60);

  if (ageMinutes < 60) {
    return `${ageMinutes}m ago`;
  }

  return "Stale";
}

function getGpsFreshnessStyle(updatedAt: string) {
  const freshness = getGpsFreshness(updatedAt);

  if (freshness === "Live") {
    return "text-emerald-600";
  }

  if (freshness === "Unknown" || freshness === "Stale") {
    return "text-red-600";
  }

  return "text-amber-600";
}

export default function RiderLocationPanel({
  riders,
}: Props) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">
              Live Rider Locations
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Real-time rider GPS and operational activity.
            </p>
          </div>

          <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            {riders.length} Rider
            {riders.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="max-h-[650px] overflow-y-auto">
        {riders.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No rider GPS locations available.
          </div>
        ) : (
          riders.map((rider) => {
            const currentOrder = rider.current_order;

            const orderNumber =
              currentOrder?.order_number ??
              currentOrder?.id ??
              null;

            const operationalStatus =
              formatOperationalStatus(
                rider.operational_status
              );

            const gpsFreshness =
              getGpsFreshness(rider.updated_at);

            return (
              <div
                key={rider.id}
                className="border-b border-slate-100 px-6 py-5 transition-colors hover:bg-slate-50"
              >
                {/* Rider Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-[#0F172A]">
                      {rider.profiles?.full_name ??
                        "Unknown Rider"}
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      {Number(rider.latitude).toFixed(5)},{" "}
                      {Number(rider.longitude).toFixed(5)}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${getOperationalStatusStyle(
                      rider.operational_status
                    )}`}
                  >
                    {operationalStatus}
                  </span>
                </div>

                {/* Current Delivery */}
                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Current Delivery
                  </p>

                  {currentOrder ? (
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#0F172A]">
                          {orderNumber}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Order Status:{" "}
                          {formatOrderStatus(
                            currentOrder.status
                          )}
                        </p>
                      </div>

                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                        Active
                      </span>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm font-medium text-slate-500">
                      No active delivery
                    </p>
                  )}
                </div>

                {/* GPS Metrics */}
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-400">
                      Speed
                    </p>

                    <p className="font-semibold text-[#0F172A]">
                      {Math.round(
                        Number(rider.speed ?? 0)
                      )}{" "}
                      km/h
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-400">
                      Accuracy
                    </p>

                    <p className="font-semibold text-[#0F172A]">
                      {Math.round(
                        Number(rider.accuracy ?? 0)
                      )}{" "}
                      m
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-400">
                      Last GPS Update
                    </p>

                    <p
                      className={`font-semibold ${getGpsFreshnessStyle(
                        rider.updated_at
                      )}`}
                    >
                      {gpsFreshness}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-400">
                      Updated
                    </p>

                    <p className="font-semibold text-[#0F172A]">
                      {new Date(
                        rider.updated_at
                      ).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}