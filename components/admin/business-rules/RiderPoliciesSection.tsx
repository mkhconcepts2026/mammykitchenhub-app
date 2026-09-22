"use client";

export default function RiderPoliciesSection() {

  return (

    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">

      <div className="border-b border-slate-200 px-8 py-6">

        <h2 className="text-2xl font-bold text-slate-900">

          Rider Policies Engine

        </h2>

        <p className="mt-2 text-slate-500">

          Configure rider payment models, bonus structures, incentives,
          operational policies and rider classification rules.

        </p>

      </div>

      <div className="grid gap-6 p-8 lg:grid-cols-4">

        {/* Rider Category */}

        <div className="rounded-2xl border border-slate-200 p-6">

          <h3 className="font-bold text-slate-900">

            Rider Category

          </h3>

          <p className="mt-2 text-sm text-slate-500">

            Default rider classification.

          </p>

          <div className="mt-6 rounded-xl bg-slate-50 p-4">

            Standard Rider

          </div>

          <button className="mt-6 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-orange-600">

            Edit Rule

          </button>

        </div>

        {/* Delivery Split */}

        <div className="rounded-2xl border border-slate-200 p-6">

          <h3 className="font-bold text-slate-900">

            Default Delivery Split

          </h3>

          <p className="mt-2 text-sm text-slate-500">

            Rider share of delivery revenue.

          </p>

          <div className="mt-6 flex items-center gap-3">

            <input
              readOnly
              value="70"
              className="w-24 rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl font-black"
            />

            <span className="text-2xl font-black">%</span>

          </div>

          <button className="mt-6 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-orange-600">

            Edit Rule

          </button>

        </div>

        {/* Bonus Policy */}

        <div className="rounded-2xl border border-slate-200 p-6">

          <h3 className="font-bold text-slate-900">

            Bonus Policy

          </h3>

          <p className="mt-2 text-sm text-slate-500">

            Incentive programme for riders.

          </p>

          <div className="mt-6 rounded-xl bg-slate-50 p-4">

            Disabled

          </div>

          <button className="mt-6 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-orange-600">

            Configure

          </button>

        </div>

        {/* Performance Rules */}

        <div className="rounded-2xl border border-slate-200 p-6">

          <h3 className="font-bold text-slate-900">

            Performance Rules

          </h3>

          <p className="mt-2 text-sm text-slate-500">

            Acceptance, cancellation and completion policies.

          </p>

          <div className="mt-6 rounded-xl bg-slate-50 p-4">

            Standard Policy

          </div>

          <button className="mt-6 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-orange-600">

            Configure

          </button>

        </div>

      </div>

    </section>

  );

}