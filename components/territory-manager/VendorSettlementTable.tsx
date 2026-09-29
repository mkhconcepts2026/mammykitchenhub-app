"use client";

interface Props {
  ledger: any[];
}

export default function VendorSettlementTable({
  ledger,
}: Props) {
  const vendorEntries = ledger.filter(
    (entry) => entry.entry_type === "vendor_earning"
  );

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-8 py-6">
        <h2 className="text-2xl font-bold text-[#0F172A]">
          Vendor Settlements
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Vendor earnings recorded through the settlement ledger.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50">
            <tr className="text-left text-sm font-semibold text-slate-600">
              <th className="px-6 py-4">Vendor</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Order</th>
              <th className="px-6 py-4">Date</th>
            </tr>
          </thead>

          <tbody>
            {vendorEntries.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-slate-500"
                >
                  No vendor settlements available.
                </td>
              </tr>
            ) : (
              vendorEntries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-t border-slate-200 hover:bg-orange-50"
                >
                  <td className="px-6 py-5 font-semibold">
                    {entry.vendors?.name ?? "Unknown Vendor"}
                  </td>

                  <td className="px-6 py-5 font-bold">
                    ₦{Number(entry.amount ?? 0).toLocaleString()}
                  </td>

                  <td className="px-6 py-5">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        entry.status === "completed"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {entry.status ?? "Unknown"}
                    </span>
                  </td>

                  <td className="px-6 py-5">
                    {entry.order_id
                      ? entry.order_id.slice(0, 8)
                      : "-"}
                  </td>

                  <td className="px-6 py-5">
                    {entry.created_at
                      ? new Date(
                          entry.created_at
                        ).toLocaleDateString()
                      : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}