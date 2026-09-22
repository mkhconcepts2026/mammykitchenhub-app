"use client";

export default function SettlementPoliciesSection() {

  return (

    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">

      <div className="border-b border-slate-200 px-8 py-6">

        <h2 className="text-2xl font-bold text-slate-900">

          Settlement Policies Engine

        </h2>

        <p className="mt-2 text-slate-500">

          Configure vendor settlements, rider payouts, reconciliation
          windows and financial processing policies across MKH.

        </p>

      </div>

      <div className="grid gap-6 p-8 lg:grid-cols-4">

        {/* Vendor Settlement Window */}

        <div className="rounded-2xl border border-slate-200 p-6">

          <h3 className="font-bold text-slate-900">

            Vendor Settlement

          </h3>

          <p className="mt-2 text-sm text-slate-500">

            Approved payout window.

          </p>

          <div className="mt-6 rounded-xl bg-slate-50 p-4">

            <p className="font-semibold">

              Friday 4:00 PM

            </p>

            <p className="text-slate-500">

              →

            </p>

            <p className="font-semibold">

              Sunday 11:59 PM

            </p>

          </div>

          <button
            className="mt-6 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-orange-600"
          >
            Edit Rule
          </button>

        </div>

        {/* Rider Settlement */}

        <div className="rounded-2xl border border-slate-200 p-6">

          <h3 className="font-bold text-slate-900">

            Rider Settlement

          </h3>

          <p className="mt-2 text-sm text-slate-500">

            Rider payout schedule.

          </p>

          <div className="mt-6 rounded-xl bg-slate-50 p-4">

            <p className="font-semibold">

              Daily

            </p>

            <p className="text-slate-500">

              00:00 Hours

            </p>

          </div>

          <button
            className="mt-6 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-orange-600"
          >
            Edit Rule
          </button>

        </div>

        {/* Reconciliation */}

        <div className="rounded-2xl border border-slate-200 p-6">

          <h3 className="font-bold text-slate-900">

            Reconciliation

          </h3>

          <p className="mt-2 text-sm text-slate-500">

            Financial reconciliation schedule.

          </p>

          <div className="mt-6 rounded-xl bg-slate-50 p-4">

            <p className="font-semibold">

              Daily

            </p>

            <p className="text-slate-500">

              Automatic

            </p>

          </div>

          <button
            className="mt-6 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-orange-600"
          >
            Edit Rule
          </button>

        </div>

        {/* Approval */}

        <div className="rounded-2xl border border-slate-200 p-6">

          <h3 className="font-bold text-slate-900">

            Approval Workflow

          </h3>

          <p className="mt-2 text-sm text-slate-500">

            Financial approval policy.

          </p>

          <div className="mt-6 rounded-xl bg-slate-50 p-4">

            <p className="font-semibold">

              Finance Director

            </p>

            <p className="text-slate-500">

              Required

            </p>

          </div>

          <button
            className="mt-6 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-orange-600"
          >
            Edit Rule
          </button>

        </div>

      </div>

    </section>

  );

}