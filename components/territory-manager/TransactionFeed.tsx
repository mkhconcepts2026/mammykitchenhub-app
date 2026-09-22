"use client";

interface Props {
  transactions: any[];
}

export default function TransactionFeed({
  transactions,
}: Props) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">

      <div className="border-b border-slate-200 px-8 py-6">

        <h2 className="text-2xl font-bold text-[#0F172A]">
          Recent Financial Activity
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Latest settlements and financial transactions across the territory.
        </p>

      </div>

      <div className="divide-y divide-slate-100">

        {transactions.length === 0 ? (

          <div className="p-10 text-center text-slate-500">
            No recent financial activity.
          </div>

        ) : (

          transactions.slice(0, 10).map((transaction) => (

            <div
              key={transaction.id}
              className="flex items-center justify-between px-8 py-5 hover:bg-slate-50 transition-colors"
            >

              <div>

                <h3 className="font-semibold text-[#0F172A]">
                  {transaction.vendors?.name ?? "Unknown Vendor"}
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  {new Date(transaction.created_at).toLocaleString()}
                </p>

              </div>

              <div className="text-right">

                <p className="text-lg font-bold text-[#0F172A]">
                  ₦{Number(transaction.net_amount).toLocaleString()}
                </p>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    transaction.status === "paid"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-orange-100 text-orange-700"
                  }`}
                >
                  {transaction.status}
                </span>

              </div>

            </div>

          ))

        )}

      </div>

    </section>
  );
}