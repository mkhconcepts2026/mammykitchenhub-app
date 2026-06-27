"use client";

interface RecentFinancialActivityProps {

  payoutRequests: any[];

  vendorsMap: Record<string, string>;

  searchTerm: string;

  setSearchTerm: (
    value: string
  ) => void;

  statusFilter: string;

  setStatusFilter: (
    value: string
  ) => void;

}

export default function RecentFinancialActivity({

  payoutRequests,

  vendorsMap,

  searchTerm,

  setSearchTerm,

  statusFilter,

  setStatusFilter

}: RecentFinancialActivityProps) {

  return (

    <div
      className="
        bg-white
        rounded-3xl
        p-8
        shadow-sm
        border
        border-gray-100
        mt-8
      "
    >

      <h2
        className="
          text-3xl
          font-bold
          mb-6
        "
      >
        Recent Financial Activity
      </h2>

      <div
        className="
          flex
          flex-col
          md:flex-row
          gap-4
          mb-6
        "
      >

        <input
          type="text"
          placeholder="Search vendor..."
          value={searchTerm}
          onChange={(e) =>
            setSearchTerm(
              e.target.value
            )
          }
          className="
            flex-1
            border
            rounded-xl
            px-4
            py-3
            outline-none
            focus:ring-2
            focus:ring-orange-500
          "
        />

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(
              e.target.value
            )
          }
          className="
            border
            rounded-xl
            px-4
            py-3
          "
        >

          <option>
            All Status
          </option>

          <option>
            Pending
          </option>

          <option>
            Processing
          </option>

          <option>
            Paid
          </option>

        </select>

      </div>

      {payoutRequests.length === 0 ? (

        <p className="text-gray-500">
          No financial activity yet.
        </p>

      ) : (

        <div className="space-y-4">

          {payoutRequests

            .filter((request) => {

              const vendorName =
                vendorsMap[
                  request.requester_id
                ] || "";

              const matchesSearch =

                vendorName
                  .toLowerCase()
                  .includes(
                    searchTerm
                      .toLowerCase()
                  );

              const matchesStatus =

                statusFilter ===
                "All Status"

                ||

                request.status
                  .toLowerCase()

                ===

                statusFilter
                  .toLowerCase();

              return (
                matchesSearch &&
                matchesStatus
              );

            })

            .slice(0, 5)

            .map((request) => (

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
                    {
                      vendorsMap[
                        request.requester_id
                      ] || "Unknown Vendor"
                    }
                  </p>

                  <p className="text-sm text-gray-500">
                    {
                      request.status
                        .toUpperCase()
                    }
                  </p>

                </div>

                <div className="text-right">

                  <p className="font-bold">
                    ₦{
                      Number(
                        request.amount
                      ).toLocaleString()
                    }
                  </p>

                  <p className="text-xs text-gray-400">
                    {
                      new Date(
                        request.requested_at
                      ).toLocaleDateString(
                        "en-NG"
                      )
                    }
                  </p>

                </div>

              </div>

            ))}

        </div>

      )}

    </div>

  );

}