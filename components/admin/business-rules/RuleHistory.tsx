"use client";

export default function RuleHistory() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">

      <div className="border-b border-slate-200 px-8 py-6">

        <h2 className="text-2xl font-bold text-slate-900">
          Governance Audit Centre
        </h2>

        <p className="mt-2 text-slate-500">
          Complete audit history of every business rule, approval,
          activation and governance event across the MKH platform.
        </p>

      </div>

      <div className="overflow-x-auto">

        <table className="min-w-full">

          <thead className="bg-slate-50">

            <tr className="text-left text-sm font-semibold text-slate-600">

              <th className="px-6 py-4">
                Date & Time
              </th>

              <th className="px-6 py-4">
                Rule
              </th>

              <th className="px-6 py-4">
                Changed By
              </th>

              <th className="px-6 py-4">
                Previous Value
              </th>

              <th className="px-6 py-4">
                New Value
              </th>

              <th className="px-6 py-4">
                Status
              </th>

              <th className="px-6 py-4">
                Reason
              </th>

            </tr>

          </thead>

          <tbody>

            <tr className="border-t border-slate-200">

              <td className="px-6 py-5">
                --
              </td>

              <td className="px-6 py-5 font-semibold">
                Vendor Commission
              </td>

              <td className="px-6 py-5">
                Finance Manager
              </td>

              <td className="px-6 py-5">
                10%
              </td>

              <td className="px-6 py-5">
                8%
              </td>

              <td className="px-6 py-5">

                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">

                  Scheduled

                </span>

              </td>

              <td className="px-6 py-5">
                Enterprise Agreement
              </td>

            </tr>

          </tbody>

        </table>

      </div>

    </section>
  );
}