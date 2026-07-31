export default function EnterpriseGovernanceComplianceCenter() {
  return (
    <>
<div className="mt-6 rounded-2xl border border-rose-300 bg-gradient-to-br from-rose-50 via-white to-orange-50 p-6">

  <div className="flex items-center justify-between">

    <div>

      <h3 className="text-xl font-bold">
        Enterprise Governance & Compliance Center
      </h3>

      <p className="mt-1 text-sm text-gray-500">
        Executive oversight for governance, compliance, security, audits and operational resilience.
      </p>

    </div>

    <span className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white">
      GOVERNANCE
    </span>

  </div>

  <div className="mt-6 grid grid-cols-2 gap-4">

    <div className="rounded-xl border bg-white p-5">
      <p className="text-sm text-gray-500">Compliance Score</p>
      <h4 className="mt-2 text-3xl font-bold text-green-600">
        99%
      </h4>
    </div>

    <div className="rounded-xl border bg-white p-5">
      <p className="text-sm text-gray-500">Audit Readiness</p>
      <h4 className="mt-2 text-3xl font-bold text-blue-600">
        Ready
      </h4>
    </div>

    <div className="rounded-xl border bg-white p-5">
      <p className="text-sm text-gray-500">Security Status</p>
      <h4 className="mt-2 text-3xl font-bold text-emerald-600">
        Protected
      </h4>
    </div>

    <div className="rounded-xl border bg-white p-5">
      <p className="text-sm text-gray-500">Business Continuity</p>
      <h4 className="mt-2 text-3xl font-bold text-indigo-600">
        Stable
      </h4>
    </div>

  </div>

  <div className="mt-6 rounded-xl border bg-white p-5">

    <h4 className="font-bold">
      Governance Checklist
    </h4>

    <div className="mt-4 space-y-3">

      <div className="flex justify-between">
        <span>Operational Policies</span>
        <span className="font-semibold text-green-600">
          Compliant
        </span>
      </div>

      <div className="flex justify-between">
        <span>Financial Controls</span>
        <span className="font-semibold text-green-600">
          Verified
        </span>
      </div>

      <div className="flex justify-between">
        <span>Audit Logs</span>
        <span className="font-semibold text-blue-600">
          Complete
        </span>
      </div>

      <div className="flex justify-between">
        <span>Incident Reporting</span>
        <span className="font-semibold text-green-600">
          Current
        </span>
      </div>

      <div className="flex justify-between">
        <span>Risk Register</span>
        <span className="font-semibold text-amber-600">
          Under Review
        </span>
      </div>

    </div>

  </div>

  <div className="mt-6 rounded-xl border border-rose-200 bg-white p-5">

    <h4 className="font-bold">
      Executive Governance Brief
    </h4>

    <p className="mt-3 text-sm text-gray-700">
      Governance indicators remain within enterprise standards. Compliance obligations are being met, audit evidence is complete, operational controls remain effective, and no governance issues requiring executive intervention have been detected.
    </p>

  </div>

</div>
    </>

  );
}