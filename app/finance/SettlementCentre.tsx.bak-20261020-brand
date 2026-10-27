"use client";

interface SettlementCentreProps {

  payoutRequests: any[];

  vendorsMap: Record<string, string>;

  markProcessing: (request: any) => void;

  markPaid: (request: any) => void;

}

export default function SettlementCentre({

  payoutRequests,

  vendorsMap,

  markProcessing,

  markPaid

}: SettlementCentreProps) {

  return (

    <div
      className="
        bg-white
        rounded-3xl
        p-8
        shadow-sm
        border
        border-gray-100
      "
    >

      <h2
        className="
          text-3xl
          font-bold
          mb-6
        "
      >
        Settlement Center
      </h2>

      {payoutRequests.length === 0 ? (

        <p className="text-gray-500">
          No payout requests found.
        </p>

      ) : (

        <div className="space-y-4">

          {payoutRequests.map((request) => (

            <div
              key={request.id}
              className="
                flex
                justify-between
                items-center
                border-b
                pb-4
              "
            >

              <div>

                <p className="font-semibold">
                  ₦{Number(request.amount).toLocaleString()}
                </p>

                <p
                  className="
                    text-xs
                    text-gray-400
                    mt-1
                  "
                >
                  Requested{" "}
                  {new Date(
                    request.requested_at
                  ).toLocaleDateString(
                    "en-NG",
                    {
                      day: "numeric",
                      month: "short",
                      year: "numeric"
                    }
                  )}
                </p>

                <span
                  className={`
                    inline-block
                    mt-2
                    px-3
                    py-1
                    rounded-full
                    text-xs
                    font-semibold

                    ${
                      request.status === "pending"

                        ? "bg-yellow-100 text-yellow-700"

                        : request.status === "processing"

                        ? "bg-blue-100 text-blue-700"

                        : request.status === "paid"

                        ? "bg-green-100 text-green-700"

                        : "bg-gray-100 text-gray-700"
                    }
                  `}
                >
                  {request.status.toUpperCase()}
                </span>

              </div>

              <div
                className="
                  flex
                  items-center
                  gap-3
                "
              >

                <span
                  className="
                    px-4
                    py-2
                    rounded-xl
                    bg-gray-100
                    text-sm
                    font-medium
                  "
                >
                  {vendorsMap[
                    request.requester_id
                  ] || "Unknown Vendor"}
                </span>

                {request.status === "pending" && (

                  <button
                    onClick={() =>
                      markProcessing(request)
                    }
                    className="
                      bg-blue-600
                      text-white
                      px-4
                      py-2
                      rounded-xl
                      text-sm
                      font-semibold
                    "
                  >
                    Mark Processing
                  </button>

                )}

                {request.status === "processing" && (

                  <button
                    onClick={() =>
                      markPaid(request)
                    }
                    className="
                      bg-green-600
                      text-white
                      px-4
                      py-2
                      rounded-xl
                      text-sm
                      font-semibold
                    "
                  >
                    Mark Paid
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