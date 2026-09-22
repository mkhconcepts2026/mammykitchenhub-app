"use client";

export default function ApprovalQueue() {

  return (

    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">

      <div className="border-b border-slate-200 px-8 py-6">

        <h2 className="text-2xl font-bold text-slate-900">

          Governance Approval Queue

        </h2>

        <p className="mt-2 text-slate-500">

          Review, approve or reject pending business rule changes before
          they become active across the MKH platform.

        </p>

      </div>

      <div className="overflow-x-auto">

        <table className="min-w-full">

          <thead className="bg-slate-50">

            <tr className="text-left text-sm font-semibold text-slate-600">

              <th className="px-6 py-4">Rule</th>

              <th className="px-6 py-4">Category</th>

              <th className="px-6 py-4">Requested By</th>

              <th className="px-6 py-4">Submitted</th>

              <th className="px-6 py-4">Status</th>

              <th className="px-6 py-4">Action</th>

            </tr>

          </thead>

          <tbody>

            <tr className="border-t">

              <td className="px-6 py-5 font-semibold">

                Vendor Commission

              </td>

              <td className="px-6 py-5">

                Financial Policy

              </td>

              <td className="px-6 py-5">

                Finance Manager

              </td>

              <td className="px-6 py-5">

                --

              </td>

              <td className="px-6 py-5">

                <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">

                  Pending Approval

                </span>

              </td>

              <td className="px-6 py-5">

                <div className="flex gap-2">

                  <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">

                    Approve

                  </button>

                  <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">

                    Reject

                  </button>

                </div>

              </td>

            </tr>

          </tbody>

        </table>

      </div>

    </section>

  );

}