"use client";

interface Rider {
  id: string;
  latitude: number;
  longitude: number;
  speed: number;
  accuracy: number;
  updated_at: string;
  profiles?: {
    full_name: string;
    status: string;
  };
}

interface Props {
  riders: Rider[];
}

export default function RiderLocationPanel({ riders }: Props) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-xl font-bold text-[#0F172A]">
          Live Rider Locations
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Real-time rider GPS activity.
        </p>
      </div>

      <div className="max-h-[650px] overflow-y-auto">

        {riders.length === 0 ? (

          <div className="p-8 text-center text-slate-500">
            No riders online.
          </div>

        ) : (

          riders.map((rider) => (

            <div
              key={rider.id}
              className="border-b border-slate-100 px-6 py-5 hover:bg-slate-50"
            >

              <div className="flex items-center justify-between">

                <div>

                  <h3 className="font-semibold text-[#0F172A]">
                    {rider.profiles?.full_name ?? "Unknown Rider"}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {rider.latitude.toFixed(5)},{" "}
                    {rider.longitude.toFixed(5)}
                  </p>

                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    rider.profiles?.status === "active"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {rider.profiles?.status ?? "Unknown"}
                </span>

              </div>

              <div className="mt-4 grid grid-cols-3 gap-4 text-sm">

                <div>
                  <p className="text-slate-400">Speed</p>
                  <p className="font-semibold">
                    {Math.round(rider.speed ?? 0)} km/h
                  </p>
                </div>

                <div>
                  <p className="text-slate-400">Accuracy</p>
                  <p className="font-semibold">
                    {Math.round(rider.accuracy ?? 0)} m
                  </p>
                </div>

                <div>
                  <p className="text-slate-400">Updated</p>
                  <p className="font-semibold">
                    {new Date(rider.updated_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

              </div>

            </div>

          ))

        )}

      </div>
    </div>
  );
}