import MissionControl from "./MissionControl";
import SmartExceptionDetection from "./SmartExceptionDetection";
import ActiveIncidentCenter from "./ActiveIncidentCenter";
import CustomerOperations from "./CustomerOperations";
import VendorOperations from "./VendorOperations";
import RiderOperations from "./RiderOperations";
import ResolutionOperations from "./ResolutionOperations";
import RightOperationsPanel from "./RightOperationsPanel";
import LiveOperationsTimeline from "./LiveOperationsTimeline";
import AuditTrail from "./AuditTrail";



interface Props {
  order: any;
}

export default function EnterpriseOrderSidebar({
  order,
}: Props) {
  return (
    <div className="sticky top-6 space-y-6">

  {!order && (

  <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

    {/* Header */}

    <div className="border-b border-slate-200 bg-slate-900 px-8 py-6">

      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-400">
        Operations Workspace
      </p>

      <h2 className="mt-2 text-3xl font-bold text-white">
        Enterprise Intelligence
      </h2>

      <p className="mt-2 text-sm text-slate-300">
        Select an order above to review operational intelligence,
        customer details, vendor performance, rider activity,
        financials and AI recommendations.
      </p>

    </div>

    {/* Empty State */}

    <div className="flex flex-col items-center justify-center px-10 py-20 text-center">

      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-orange-100 text-4xl">
        📦
      </div>

      <h3 className="mt-8 text-3xl font-bold text-slate-900">
        No Order Selected
      </h3>

      <p className="mt-4 max-w-2xl text-base leading-8 text-slate-500">
        Select any order from the queue above.
        Once selected, this workspace will immediately display
        Mission Control, operational intelligence, customer,
        vendor, rider, financial and AI insights for that order.
      </p>

    </div>

  </section>

)}

    {order && (

  <div className="space-y-10">

    {/* Mission Control */}

<MissionControl order={order} />

{/* Live Operations Timeline */}

<LiveOperationsTimeline order={order} />

{/* Audit Trail */}

<AuditTrail order={order} />

{/* Operational Health */}

    <section className="space-y-6">

      <div className="border-b border-slate-200 pb-3">
        <h2 className="text-xl font-bold text-slate-900">
          Operational Health
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Monitor incidents, SLA risks and operational exceptions.
        </p>
      </div>

      <SmartExceptionDetection order={order} />

      <ActiveIncidentCenter order={order} />

    </section>

    {/* Order Participants */}

    <section className="space-y-6">

      <div className="border-b border-slate-200 pb-3">
        <h2 className="text-xl font-bold text-slate-900">
          Order Participants
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Customer, vendor and rider information for this order.
        </p>
      </div>

      <CustomerOperations order={order} />

      <VendorOperations order={order} />

      <RiderOperations order={order} />

    </section>

    {/* Resolution & Automation */}

    <section className="space-y-6">

      <div className="border-b border-slate-200 pb-3">
        <h2 className="text-xl font-bold text-slate-900">
          Resolution & Automation
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Recommended actions and operational tools.
        </p>
      </div>

      <ResolutionOperations order={order} />

      <RightOperationsPanel order={order} />

    </section>

  </div>

)}

    </div>
  );
}