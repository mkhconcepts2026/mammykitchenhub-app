interface SmartExceptionDetectionProps {
  order?: any;
}

export default function SmartExceptionDetection({
  order,
}: SmartExceptionDetectionProps) {

  const exceptions = [];

if (!order?.rider_id && order?.status !== "delivered" && order?.status !== "cancelled") {
  exceptions.push({
    title: "Rider Assignment Delay",
    description:
      "No rider has been assigned to this order yet.",
    severity: "Medium",
    color: "orange",
  });
}

if (order?.status === "preparing") {
  exceptions.push({
    title: "Vendor Preparation Monitoring",
    description:
      "Vendor is preparing the order. Continue monitoring progress toward pickup.",
    severity: "Monitor",
    color: "blue",
  });
}

if (order?.status === "cancelled") {
  exceptions.push({
    title: "Order Cancelled",
    description:
      "This order has been cancelled and may require follow-up.",
    severity: "Critical",
    color: "red",
  });
}

if (order?.status === "delivered") {
  exceptions.push({
    title: "Order Successfully Delivered",
    description:
      "Delivery completed successfully. No operational issues detected.",
    severity: "Resolved",
    color: "green",
  });
}

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">

      <div className="flex items-center justify-between">

        <div>

          <h3 className="text-2xl font-bold">
            Smart Exception Detection
          </h3>

          <p className="text-gray-500 mt-1">
            AI continuously monitors this order for operational exceptions
            requiring manager attention.
          </p>

        </div>

        <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-semibold">
          {exceptions.length} Active Alert{exceptions.length !== 1 ? "s" : ""}
        </span>

      </div>

    <div className="space-y-4 mt-6">

  {exceptions.length === 0 ? (

    <div className="bg-white border border-emerald-200 rounded-xl p-4">

      <div className="flex justify-between items-start">

        <div>

          <h4 className="font-semibold text-emerald-700">
            No Active Alerts
          </h4>

          <p className="text-sm text-gray-500 mt-2">
            AI has not detected any operational exceptions for this order.
          </p>

        </div>

        <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-semibold">
          Healthy
        </span>

      </div>

    </div>

  ) : (

    exceptions.map((exception, index) => {

      const styleMap = {
  orange: {
    border: "border-orange-200",
    title: "text-orange-700",
    badge: "bg-orange-100 text-orange-700",
  },
  blue: {
    border: "border-blue-200",
    title: "text-blue-700",
    badge: "bg-blue-100 text-blue-700",
  },
  red: {
    border: "border-red-200",
    title: "text-red-700",
    badge: "bg-red-100 text-red-700",
  },
  green: {
    border: "border-emerald-200",
    title: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700",
  },
};

const styles =
  styleMap[exception.color as keyof typeof styleMap] ?? styleMap.blue;

      return (

        <div
          key={index}
          className={`bg-white border ${styles.border} rounded-xl p-4`}
        >

          <div className="flex justify-between items-start">

            <div>

              <h4 className={`font-semibold ${styles.title}`}>
                {exception.title}
              </h4>

              <p className="text-sm text-gray-500 mt-2">
                {exception.description}
              </p>

            </div>

            <span
              className={`px-2 py-1 rounded-lg text-xs font-semibold ${styles.badge}`}
            >
              {exception.severity}
            </span>

          </div>

        </div>

      );

    })

  )}

</div>

    </div>
  );
}