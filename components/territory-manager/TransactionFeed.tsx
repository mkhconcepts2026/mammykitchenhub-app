"use client";

interface Props {
  ledger: any[];
}

function formatEntryType(entryType: string) {
  switch (entryType) {
    case "vendor_earning":
      return "Vendor Earnings";
    case "rider_earning":
      return "Rider Earnings";
    case "platform_revenue":
      return "Platform Revenue";
    case "delivery_revenue":
      return "Delivery Revenue";
    default:
      return entryType
        .replaceAll("_", " ")
        .replace(/\b\w/g, (character) =>
          character.toUpperCase()
        );
  }
}

function getEntryLabel(entry: any) {
  if (entry.entry_type === "vendor_earning") {
    return entry.vendors?.name ?? "Unknown Vendor";
  }

  if (entry.entry_type === "rider_earning") {
    return entry.profiles?.full_name ?? "Unknown Rider";
  }

  return formatEntryType(entry.entry_type);
}

function getEntryStyle(entryType: string) {
  switch (entryType) {
    case "vendor_earning":
      return "bg-orange-100 text-orange-700";
    case "rider_earning":
      return "bg-blue-100 text-blue-700";
    case "platform_revenue":
      return "bg-purple-100 text-purple-700";
    case "delivery_revenue":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function TransactionFeed({
  ledger,
}: Props) {
  const recentEntries = ledger.slice(0, 10);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-8 py-6">
        <h2 className="text-2xl font-bold text-[#0F172A]">
          Recent Financial Activity
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Latest financial ledger activity across the territory.
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {recentEntries.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            No recent financial activity.
          </div>
        ) : (
          recentEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between px-8 py-5 transition-colors hover:bg-slate-50"
            >
              <div>
                <h3 className="font-semibold text-[#0F172A]">
                  {getEntryLabel(entry)}
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  {formatEntryType(entry.entry_type)}
                  {entry.order_id
                    ? ` • Order ${entry.order_id.slice(0, 8)}`
                    : ""}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {entry.created_at
                    ? new Date(entry.created_at).toLocaleString()
                    : "-"}
                </p>
              </div>

              <div className="text-right">
                <p className="text-lg font-bold text-[#0F172A]">
                  ₦{Number(entry.amount ?? 0).toLocaleString()}
                </p>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${getEntryStyle(
                    entry.entry_type
                  )}`}
                >
                  {entry.status ?? "Unknown"}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}