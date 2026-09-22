"use client";

interface Props {
  transactions: any[];
}

export default function VendorSettlementTable({
  transactions,
}: Props) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">

      <div className="border-b border-slate-200 px-8 py-6">

        <h2 className="text-2xl font-bold text-[#0F172A]">
          Vendor Settlements
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Settlement pipeline across all vendors.
        </p>

      </div>

      <div className="overflow-x-auto">

        <table className="min-w-full">

          <thead className="bg-slate-50">

            <tr className="text-left text-sm font-semibold text-slate-600">

              <th className="px-6 py-4">Vendor</th>
              <th className="px-6 py-4">Gross</th>
              <th className="px-6 py-4">Commission</th>
              <th className="px-6 py-4">Net</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Settlement Date</th>

            </tr>

          </thead>

          <tbody>

            {transactions.length === 0 ? (

              <tr>

                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-slate-500"
                >
                  No vendor settlements available.
                </td>

              </tr>

            ) : (

              transactions.map((transaction) => (

                <tr
                  key={transaction.id}
                  className="border-t border-slate-200 hover:bg-orange-50"
                >

                  <td className="px-6 py-5 font-semibold">
                    {transaction.vendors?.name ?? "-"}
                  </td>

                  <td className="px-6 py-5">
                    ₦{Number(transaction.gross_amount).toLocaleString()}
                  </td>

                  <td className="px-6 py-5">
                    ₦{Number(transaction.mkh_commission).toLocaleString()}
                  </td>

                  <td className="px-6 py-5 font-bold">
                    ₦{Number(transaction.net_amount).toLocaleString()}
                  </td>

                  <td className="px-6 py-5">

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        transaction.status === "paid"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {transaction.status}
                    </span>

                  </td>

                  <td className="px-6 py-5">

                    {transaction.settlement_date
                      ? new Date(
                          transaction.settlement_date
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