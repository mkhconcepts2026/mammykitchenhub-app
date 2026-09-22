"use client";

export default function PlatformChargesSection() {

  return (

    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">

      <div className="border-b border-slate-200 px-8 py-6">

        <h2 className="text-2xl font-bold text-slate-900">

          Platform Charges Engine

        </h2>

        <p className="mt-2 text-slate-500">

          Configure all customer-facing platform charges, operational
          fees and service policies applied across the MKH ecosystem.

        </p>

      </div>

      <div className="grid gap-6 p-8 lg:grid-cols-3">

        {/* Customer Service Fee */}

        <div className="rounded-2xl border border-slate-200 p-6">

          <h3 className="font-bold text-slate-900">

            Customer Service Fee

          </h3>

          <p className="mt-2 text-sm text-slate-500">

            Standard service charge applied to every eligible order.

          </p>

          <div className="mt-6 flex items-center gap-3">

            <span className="text-2xl font-black">₦</span>

            <input
              type="number"
              value="300"
              readOnly
              className="w-32 rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl font-black"
            />

          </div>

          <button
            className="mt-6 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-orange-600"
          >

            Edit Rule

          </button>

        </div>

        {/* Small Order Fee */}

        <div className="rounded-2xl border border-slate-200 p-6">

          <h3 className="font-bold text-slate-900">

            Small Order Fee

          </h3>

          <p className="mt-2 text-sm text-slate-500">

            Extra operational fee for orders below the minimum threshold.

          </p>

          <div className="mt-6 flex items-center gap-3">

            <span className="text-2xl font-black">₦</span>

            <input
              type="number"
              value="0"
              readOnly
              className="w-32 rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl font-black"
            />

          </div>

          <button
            className="mt-6 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-orange-600"
          >

            Edit Rule

          </button>

        </div>

        {/* Convenience Fee */}

        <div className="rounded-2xl border border-slate-200 p-6">

          <h3 className="font-bold text-slate-900">

            Convenience Fee

          </h3>

          <p className="mt-2 text-sm text-slate-500">

            Optional platform convenience charge for premium services.

          </p>

          <div className="mt-6 flex items-center gap-3">

            <span className="text-2xl font-black">₦</span>

            <input
              type="number"
              value="0"
              readOnly
              className="w-32 rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl font-black"
            />

          </div>

          <button
            className="mt-6 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-orange-600"
          >

            Edit Rule

          </button>

        </div>

      </div>

    </section>

  );

}