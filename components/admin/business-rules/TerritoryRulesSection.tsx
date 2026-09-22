"use client";

export default function TerritoryRulesSection() {

  return (

    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">

      <div className="border-b border-slate-200 px-8 py-6">

        <h2 className="text-2xl font-bold text-slate-900">

          Territory Rules Engine

        </h2>

        <p className="mt-2 text-slate-500">

          Configure territory-specific commissions, delivery policies,
          settlement rules and operational overrides.

        </p>

      </div>

      <div className="overflow-x-auto">

        <table className="min-w-full">

          <thead className="bg-slate-50">

            <tr className="text-left text-sm font-semibold text-slate-600">

              <th className="px-6 py-4">Territory</th>

              <th className="px-6 py-4">Vendor Commission</th>

              <th className="px-6 py-4">Rider Split</th>

              <th className="px-6 py-4">Delivery Model</th>

              <th className="px-6 py-4">Status</th>

              <th className="px-6 py-4">Action</th>

            </tr>

          </thead>

          <tbody>

            <tr className="border-t">

              <td className="px-6 py-5 font-semibold">

                Global Default

              </td>

              <td className="px-6 py-5">

                10%

              </td>

              <td className="px-6 py-5">

                70 / 30

              </td>

              <td className="px-6 py-5">

                Distance Based

              </td>

              <td className="px-6 py-5">

                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">

                  Active

                </span>

              </td>

              <td className="px-6 py-5">

                <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">

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