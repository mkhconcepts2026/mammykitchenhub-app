"use client";

export default function VendorOverridesSection() {

  return (

    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">

      <div className="border-b border-slate-200 px-8 py-6">

        <h2 className="text-2xl font-bold text-slate-900">

          Vendor Overrides Engine

        </h2>

        <p className="mt-2 text-slate-500">

          Configure negotiated commission structures, settlement policies,
          operational exceptions and enterprise agreements for individual
          vendors without affecting global platform rules.

        </p>

      </div>

      <div className="overflow-x-auto">

        <table className="min-w-full">

          <thead className="bg-slate-50">

            <tr className="text-left text-sm font-semibold text-slate-600">

              <th className="px-6 py-4">

                Vendor

              </th>

              <th className="px-6 py-4">

                Territory

              </th>

              <th className="px-6 py-4">

                Commission

              </th>

              <th className="px-6 py-4">

                Settlement

              </th>

              <th className="px-6 py-4">

                Status

              </th>

              <th className="px-6 py-4">

                Action

              </th>

            </tr>

          </thead>

          <tbody>

            <tr className="border-t">

              <td className="px-6 py-5 font-semibold">

                Global Default

              </td>

              <td className="px-6 py-5">

                All Territories

              </td>

              <td className="px-6 py-5">

                10%

              </td>

              <td className="px-6 py-5">

                Weekend

              </td>

              <td className="px-6 py-5">

                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">

                  Active

                </span>

              </td>

              <td className="px-6 py-5">

                <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600">

                  Configure

                </button>

              </td>

            </tr>

          </tbody>

        </table>

      </div>

    </section>

  );

}