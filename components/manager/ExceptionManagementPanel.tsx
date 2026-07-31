"use client";

type Order = {
  id: string;
  status: string;
};

type Props = {
  exceptions: Order[];
  onViewOrder: (order: Order) => void;
  onAssignRider: (order: Order) => void;
};

export default function ExceptionManagementPanel({
  exceptions,
  onViewOrder,
  onAssignRider,
}: Props) {
  return (
    <div
      className="
        bg-red-50
        border
        border-red-200
        rounded-3xl
        p-6
        mb-8
      "
    >
      <h2
        className="
          text-2xl
          font-bold
          text-red-700
          mb-4
        "
      >
        ⚠ Exception Management
      </h2>

      {exceptions.length === 0 ? (
        <p className="text-green-600">
          No operational issues detected.
        </p>
      ) : (
        <div className="space-y-3">
          {exceptions.map((order) => (
            <div
              key={order.id}
              className="
                bg-white
                rounded-xl
                p-4
                border
              "
            >
              <p className="font-semibold">
                #{order.id.slice(0, 8)}
              </p>

              <p className="text-sm text-gray-600">
                Status: {order.status}
              </p>

              {order.status === "pending" && (
                <>
                  <p className="text-sm text-red-600 font-medium">
                    Vendor has not accepted this order.
                  </p>

                  <p className="text-sm text-gray-500">
                    Recommended Action:
                    Contact vendor immediately.
                  </p>
                </>
              )}

              {order.status === "preparing" && (
                <>
                  <p className="text-sm text-red-600 font-medium">
                    Food preparation is taking too long.
                  </p>

                  <p className="text-sm text-gray-500">
                    Recommended Action:
                    Check vendor kitchen status.
                  </p>
                </>
              )}

              {order.status === "ready_for_pickup" && (
                <>
                  <p className="text-sm text-red-600 font-medium">
                    Order is waiting for rider assignment.
                  </p>

                  <p className="text-sm text-gray-500">
                    Recommended Action:
                    Assign a rider immediately.
                  </p>
                </>
              )}

              {order.status === "assigned" && (
                <>
                  <p className="text-sm text-red-600 font-medium">
                    Rider has not picked up this order.
                  </p>

                  <p className="text-sm text-gray-500">
                    Recommended Action:
                    Contact rider for update.
                  </p>
                </>
              )}

              <div
                className="
                  mt-4
                  flex
                  flex-wrap
                  gap-2
                "
              >
                <button
                  onClick={() => onViewOrder(order)}
                  className="
                    bg-blue-500
                    text-white
                    px-4
                    py-2
                    rounded-lg
                    text-sm
                  "
                >
                  👁 View Order
                </button>

                {order.status === "ready_for_pickup" && (
                  <button
                    onClick={() => onAssignRider(order)}
                    className="
                      bg-orange-500
                      text-white
                      px-4
                      py-2
                      rounded-lg
                      text-sm
                    "
                  >
                    🔄 Assign Rider
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}