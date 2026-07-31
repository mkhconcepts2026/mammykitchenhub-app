import EnterpriseOperationsScorecard from "./EnterpriseOperationsScorecard";
import EnterpriseGovernanceComplianceCenter from "./EnterpriseGovernanceComplianceCenter";
import EnterpriseResilienceBusinessContinuityCenter from "./EnterpriseResilienceBusinessContinuityCenter";
import MissionControl from "./MissionControl";
import CustomerOperations from "./CustomerOperations";
import VendorOperations from "./VendorOperations";
import RiderOperations from "./RiderOperations";
import ResolutionOperations from "./ResolutionOperations";
import RightOperationsPanel from "./RightOperationsPanel";
import SmartExceptionDetection from "./SmartExceptionDetection";
import ActiveIncidentCenter from "./ActiveIncidentCenter";

type Props = {
  order: any;
};

export default function OrderIntelligenceWorkspace({
  order,
}: Props) {
  return (
    <div
      className="
        fixed
        inset-0
        z-50
        bg-black/50
        flex
        items-center
        justify-center
        p-4
      "
    >
      <div
        className="
          bg-white
          rounded-3xl
          shadow-2xl
          w-full
          max-w-7xl
          h-[90vh]
          flex
          flex-col
          overflow-hidden
        "
      >
        {/* Header */}

        <div
          className="
            flex
            items-center
            justify-between
            px-8
            py-6
            border-b
            border-gray-200
            shrink-0
          "
        >
          <div>
            <h2 className="text-3xl font-bold text-slate-900">
              Order Intelligence Workspace
            </h2>

            <p className="text-gray-500 mt-1">
              {order?.id
                ? `Order #${order.id.slice(0, 8)}`
                : "No order selected"}
            </p>
          </div>

         
        </div>

        {/* Workspace */}

        <div
          className="
            flex-1
            overflow-y-auto
            p-6
          "
        >
          <div
            className="
              grid
              grid-cols-1
              xl:grid-cols-3
              gap-6
            "
          >
            {/* Main Workspace */}

            <div
              className="
                xl:col-span-2
                space-y-6
              "
            >
 <MissionControl order={order} />

<SmartExceptionDetection order={order} />

<ActiveIncidentCenter order={order} />

<CustomerOperations order={order} />

<VendorOperations order={order} />

<RiderOperations order={order} />

<ResolutionOperations order={order} />

            </div>

                     {/* Intelligence Panel */}

            <div className="space-y-6">
              <RightOperationsPanel order={order} />

              <EnterpriseOperationsScorecard />

              <EnterpriseGovernanceComplianceCenter />

              <EnterpriseResilienceBusinessContinuityCenter />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}