"use client";

import { useMemo, useState } from "react";
import { Eye, Search } from "lucide-react";

import { RiderRecord } from "@/types/rider";

interface RiderTableProps {
  riders: RiderRecord[];
  loading: boolean;
  onView: (rider: RiderRecord) => void;
}

const operationalStatusConfig = {
  available: {
    label: "Available",
    className: "bg-emerald-100 text-emerald-700",
  },
  assigned: {
    label: "Assigned",
    className: "bg-amber-100 text-amber-700",
  },
  delivering: {
    label: "Delivering",
    className: "bg-orange-100 text-orange-700",
  },
  offline: {
    label: "Offline",
    className: "bg-slate-200 text-slate-700",
  },
};

export default function RiderTable({
  riders,
  loading,
  onView,
}: RiderTableProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const filteredRiders = useMemo(() => {
    return riders.filter((rider) => {
      const searchTerm = search.toLowerCase();

      const matchesSearch =
        rider.full_name
          ?.toLowerCase()
          .includes(searchTerm) ||
        rider.email
          ?.toLowerCase()
          .includes(searchTerm) ||
        rider.phone
          ?.toLowerCase()
          .includes(searchTerm) ||
        rider.current_order?.order_number
          ?.toLowerCase()
          .includes(searchTerm);

      const matchesStatus =
        status === "all" ||
        rider.operational_status === status;

      return matchesSearch && matchesStatus;
    });
  }, [riders, search, status]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">

      {/* Header */}

      <div className="flex flex-col gap-4 border-b border-slate-200 p-6 lg:flex-row lg:items-center lg:justify-between">

        <div>

          <h2 className="text-2xl font-bold text-slate-900">
            Rider Command Center
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Monitor rider availability, assignments and
            active deliveries across your territory.
          </p>

        </div>

        <div className="flex flex-col gap-3 md:flex-row">

          {/* Search */}

          <div className="relative">

            <Search
              className="absolute left-3 top-3 text-slate-400"
              size={18}
            />

            <input
              type="text"
              placeholder="Search riders or orders..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              className="rounded-xl border border-slate-300 py-2 pl-10 pr-4 outline-none focus:border-orange-500"
            />

          </div>

          {/* Operational Status Filter */}

          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value)
            }
            className="rounded-xl border border-slate-300 px-4 py-2 outline-none focus:border-orange-500"
          >
            <option value="all">
              All Operational Status
            </option>

            <option value="available">
              Available
            </option>

            <option value="assigned">
              Assigned
            </option>

            <option value="delivering">
              Delivering
            </option>

            <option value="offline">
              Offline
            </option>
          </select>

        </div>

      </div>

      {/* Table */}

      <div className="overflow-x-auto">

        <table className="min-w-full">

          <thead className="bg-slate-50">

            <tr>

              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                Rider
              </th>

              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                Phone
              </th>

              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                Operational Status
              </th>

              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                Current Order
              </th>

              <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                Wallet
              </th>

              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                Last GPS Update
              </th>

              <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                Action
              </th>

            </tr>

          </thead>

          <tbody className="divide-y divide-slate-100">

            {loading ? (

              <tr>

                <td
                  colSpan={7}
                  className="px-6 py-10 text-center text-slate-500"
                >
                  Loading riders...
                </td>

              </tr>

            ) : filteredRiders.length === 0 ? (

              <tr>

                <td
                  colSpan={7}
                  className="px-6 py-10 text-center text-slate-500"
                >
                  No riders found.
                </td>

              </tr>

            ) : (

              filteredRiders.map((rider) => {

                const statusConfig =
                  operationalStatusConfig[
                    rider.operational_status
                  ];

                return (

                  <tr
                    key={rider.id}
                    className="transition-colors hover:bg-orange-50"
                  >

                    {/* Rider */}

                    <td className="px-6 py-5">

                      <div>

                        <h3 className="font-semibold text-slate-900">
                          {rider.full_name ||
                            "Unnamed Rider"}
                        </h3>

                        <p className="text-sm text-slate-500">
                          {rider.email}
                        </p>

                      </div>

                    </td>

                    {/* Phone */}

                    <td className="px-6 py-5">
                      {rider.phone || "-"}
                    </td>

                    {/* Operational Status */}

                    <td className="px-6 py-5">

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusConfig.className}`}
                      >
                        {statusConfig.label}
                      </span>

                    </td>

                    {/* Current Order */}

                    <td className="px-6 py-5">

                      {rider.current_order ? (

                        <div>

                          <p className="font-semibold text-slate-900">
                            {rider.current_order
                              .order_number ||
                              rider.current_order.id.slice(
                                0,
                                8
                              )}
                          </p>

                          <p className="text-xs capitalize text-slate-500">
                            {rider.current_order.status.replace(
                              /_/g,
                              " "
                            )}
                          </p>

                        </div>

                      ) : (

                        <span className="text-sm text-slate-400">
                          No active order
                        </span>

                      )}

                    </td>

                    {/* Wallet */}

                    <td className="px-6 py-5 text-right font-semibold">

                      ₦
                      {Number(
                        rider.available_balance ?? 0
                      ).toLocaleString()}

                    </td>

                    {/* GPS */}

                    <td className="px-6 py-5 text-sm text-slate-500">

                      {rider.updated_at
                        ? new Date(
                            rider.updated_at
                          ).toLocaleString()
                        : "-"}

                    </td>

                    {/* Action */}

                    <td className="px-6 py-5 text-center">

                      <button
                        onClick={() =>
                          onView(rider)
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
                      >

                        <Eye size={16} />

                        View

                      </button>

                    </td>

                  </tr>

                );
              })

            )}

          </tbody>

        </table>

      </div>

    </section>
  );
}