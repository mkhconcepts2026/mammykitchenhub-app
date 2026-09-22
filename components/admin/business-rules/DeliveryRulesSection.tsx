"use client";

export default function DeliveryRulesSection() {

  return (

    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">

      <div className="border-b border-slate-200 px-8 py-6">

        <h2 className="text-2xl font-bold text-slate-900">

          Delivery Rules Engine

        </h2>

        <p className="mt-2 text-slate-500">

          Configure rider payment distribution, MKH delivery revenue,
          delivery pricing policies and future incentive programs.

        </p>

      </div>

      <div className="grid gap-6 p-8 lg:grid-cols-3">

        {/* Rider Split */}

        <div className="rounded-2xl border border-slate-200 p-6">

          <h3 className="font-bold text-slate-900">

            Rider Delivery Share

          </h3>

          <p className="mt-2 text-sm text-slate-500">

            Percentage of the delivery fee paid to riders.

          </p>

          <div className="mt-6 flex items-center gap-3">

            <input
              type="number"
              value="70"
              readOnly
              className="w-24 rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl font-black"
            />

            <span className="text-2xl font-black">

              %

            </span>

          </div>

          <button
            className="mt-6 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-orange-600"
          >

            Edit Rule

          </button>

        </div>

        {/* MKH Share */}

        <div className="rounded-2xl border border-slate-200 p-6">

          <h3 className="font-bold text-slate-900">

            MKH Delivery Share

          </h3>

          <p className="mt-2 text-sm text-slate-500">

            Percentage retained by MKH from every delivery fee.

          </p>

          <div className="mt-6 flex items-center gap-3">

            <input
              type="number"
              value="30"
              readOnly
              className="w-24 rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl font-black"
            />

            <span className="text-2xl font-black">

              %

            </span>

          </div>

          <button
            className="mt-6 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-orange-600"
          >

            Edit Rule

          </button>

        </div>

        {/* Delivery Fee Model */}

        <div className="rounded-2xl border border-slate-200 p-6">

          <h3 className="font-bold text-slate-900">

            Delivery Fee Model

          </h3>

          <p className="mt-2 text-sm text-slate-500">

            Select how customer delivery fees are calculated.

          </p>

          <div className="mt-6">

            <input
              type="text"
              value="Distance Based"
              readOnly
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg font-semibold"
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