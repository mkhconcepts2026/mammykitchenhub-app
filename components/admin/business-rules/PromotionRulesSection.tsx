"use client";

export default function PromotionRulesSection() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">

      <div className="border-b border-slate-200 px-8 py-6">

        <h2 className="text-2xl font-bold text-slate-900">
          Promotion Rules Engine
        </h2>

        <p className="mt-2 text-slate-500">
          Configure promotional campaigns, marketing incentives, discount
          policies and temporary business rules.
        </p>

      </div>

      <div className="grid gap-6 p-8 lg:grid-cols-3">

        {/* Free Delivery */}

        <div className="rounded-2xl border border-slate-200 p-6">

          <h3 className="font-bold text-slate-900">
            Free Delivery Campaign
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Temporarily waive customer delivery fees.
          </p>

          <div className="mt-6 rounded-xl bg-slate-50 p-4">
            Disabled
          </div>

          <button className="mt-6 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-orange-600">
            Configure
          </button>

        </div>

        {/* Vendor Promotion */}

        <div className="rounded-2xl border border-slate-200 p-6">

          <h3 className="font-bold text-slate-900">
            Vendor Promotion
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Configure temporary vendor commission campaigns.
          </p>

          <div className="mt-6 rounded-xl bg-slate-50 p-4">
            No Active Promotion
          </div>

          <button className="mt-6 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-orange-600">
            Configure
          </button>

        </div>

        {/* Rider Bonus */}

        <div className="rounded-2xl border border-slate-200 p-6">

          <h3 className="font-bold text-slate-900">
            Rider Bonus Campaign
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Configure temporary rider incentive programmes.
          </p>

          <div className="mt-6 rounded-xl bg-slate-50 p-4">
            No Active Campaign
          </div>

          <button className="mt-6 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-orange-600">
            Configure
          </button>

        </div>

      </div>

    </section>
  );
}