export default function EnterpriseOperationsScorecard() {
  return (

    <>
      <div className="mt-6 rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-lime-50 p-6">

  <div className="flex items-center justify-between">

    <div>

      <h3 className="text-xl font-bold">
        Enterprise Operations Scorecard
      </h3>

      <p className="mt-1 text-sm text-gray-500">
        Executive performance scorecard across every operational pillar.
      </p>

    </div>

    <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
      BOARD VIEW
    </span>

  </div>

  <div className="mt-6 space-y-5">

    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span>Customer Experience</span>
        <span className="font-semibold text-green-600">97%</span>
      </div>
      <div className="h-3 rounded-full bg-gray-200">
        <div className="h-3 w-[97%] rounded-full bg-green-500"></div>
      </div>
    </div>

    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span>Vendor Performance</span>
        <span className="font-semibold text-blue-600">94%</span>
      </div>
      <div className="h-3 rounded-full bg-gray-200">
        <div className="h-3 w-[94%] rounded-full bg-blue-500"></div>
      </div>
    </div>

    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span>Rider Efficiency</span>
        <span className="font-semibold text-cyan-600">96%</span>
      </div>
      <div className="h-3 rounded-full bg-gray-200">
        <div className="h-3 w-[96%] rounded-full bg-cyan-500"></div>
      </div>
    </div>

    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span>Dispatch Intelligence</span>
        <span className="font-semibold text-purple-600">95%</span>
      </div>
      <div className="h-3 rounded-full bg-gray-200">
        <div className="h-3 w-[95%] rounded-full bg-purple-500"></div>
      </div>
    </div>

    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span>Automation Reliability</span>
        <span className="font-semibold text-emerald-600">99%</span>
      </div>
      <div className="h-3 rounded-full bg-gray-200">
        <div className="h-3 w-[99%] rounded-full bg-emerald-500"></div>
      </div>
    </div>

    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span>AI Decision Quality</span>
        <span className="font-semibold text-indigo-600">98%</span>
      </div>
      <div className="h-3 rounded-full bg-gray-200">
        <div className="h-3 w-[98%] rounded-full bg-indigo-500"></div>
      </div>
    </div>

  </div>

  <div className="mt-6 rounded-xl border bg-white p-5">

    <h4 className="font-bold">
      Executive Assessment
    </h4>

    <div className="mt-4 grid grid-cols-2 gap-4">

      <div className="rounded-lg border p-4">
        <p className="text-sm text-gray-500">
          Overall Enterprise Score
        </p>
        <h4 className="mt-2 text-3xl font-bold text-green-600">
          A+
        </h4>
      </div>

      <div className="rounded-lg border p-4">
        <p className="text-sm text-gray-500">
          Operational Maturity
        </p>
        <h4 className="mt-2 text-3xl font-bold text-blue-600">
          Level 5
        </h4>
      </div>

    </div>

  </div>

  <div className="mt-6 rounded-xl border border-emerald-200 bg-white p-5">

    <h4 className="font-bold">
      CEO Brief
    </h4>

    <p className="mt-3 text-sm text-gray-700">
      The territory is performing at an enterprise-grade standard across customer service, dispatch operations, vendor execution, rider performance, automation, and AI-assisted decision-making. Current indicators support sustained operational excellence with no immediate executive intervention required.
    </p>

  </div>

</div>
    </>

  );
}