"use client";

export default function CommissionRulesSection() {

  return (

    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">

      <div className="border-b border-slate-200 px-8 py-6">

        <h2 className="text-2xl font-bold text-slate-900">

          Commission Engine

        </h2>

        <p className="mt-2 text-slate-500">

          Configure vendor commissions, platform commissions and
          commercial revenue policies used throughout the MKH platform.

        </p>

      </div>

      <div className="grid gap-6 p-8 lg:grid-cols-3">

        {/* Vendor Commission */}

        <div className="rounded-2xl border border-slate-200 p-6">

          <h3 className="font-bold text-slate-900">

            Default Vendor Commission

          </h3>

          <p className="mt-2 text-sm text-slate-500">

            Applied to every vendor unless an override exists.

          </p>

          <div className="mt-6 flex items-center gap-3">

            <input

              type="number"

              value="10"

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

        {/* Platform Fee */}

        <div className="rounded-2xl border border-slate-200 p-6">

          <h3 className="font-bold text-slate-900">

            Platform Fee

          </h3>

          <p className="mt-2 text-sm text-slate-500">

            Percentage retained by MKH for marketplace operations.

          </p>

          <div className="mt-6 flex items-center gap-3">

            <input

              type="number"

              value="2.5"

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

        {/* Customer Service Fee */}

        <div className="rounded-2xl border border-slate-200 p-6">

          <h3 className="font-bold text-slate-900">

            Customer Service Charge

          </h3>

          <p className="mt-2 text-sm text-slate-500">

            Fixed operational fee charged to customers.

          </p>

          <div className="mt-6 flex items-center gap-3">

            <input

              type="number"

              value="300"

              readOnly

              className="w-36 rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl font-black"

            />

            <span className="text-xl font-bold">

              ₦

            </span>

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