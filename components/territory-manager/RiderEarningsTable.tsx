"use client";

interface Props {
  earnings: any[];
}

export default function RiderEarningsTable({
  earnings,
}: Props) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">

      <div className="border-b border-slate-200 px-8 py-6">

        <h2 className="text-2xl font-bold text-[#0F172A]">
          Rider Earnings
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Rider payouts across your territory.
        </p>

      </div>

      <div className="overflow-x-auto">

        <table className="min-w-full">

          <thead className="bg-slate-50">

            <tr className="text-left text-sm font-semibold text-slate-600">

              <th className="px-6 py-4">Rider</th>
              <th className="px-6 py-4">Order</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Paid</th>

            </tr>

          </thead>

          <tbody>

            {earnings.length === 0 ? (

              <tr>

                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-slate-500"
                >
                  No rider earnings available.
                </td>

              </tr>

            ) : (

              earnings.map((earning) => (

                <tr
                  key={earning.id}
                  className="border-t border-slate-200 hover:bg-blue-50"
                >

                  <td className="px-6 py-5 font-semibold">
                    {earning.profiles?.full_name ?? "-"}
                  </td>

                  <td className="px-6 py-5">
                    {earning.order_id.slice(0, 8)}
                  </td>

                  <td className="px-6 py-5 font-bold">
                    ₦{Number(earning.amount).toLocaleString()}
                  </td>

                  <td className="px-6 py-5">

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        earning.status === "paid"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {earning.status}
                    </span>

                  </td>

                  <td className="px-6 py-5">

                    {earning.paid_at
                      ? new Date(
                          earning.paid_at
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