"use client";

import { useMemo, useState } from "react";
import { Eye, Search } from "lucide-react";

import { RiderRecord } from "@/types/rider";

interface RiderTableProps {
  riders: RiderRecord[];
  loading: boolean;
  onView: (rider: RiderRecord) => void;
}

export default function RiderTable({
  riders,
  loading,
  onView,
}: RiderTableProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const filteredRiders = useMemo(() => {
    return riders.filter((rider) => {
      const matchesSearch =
        rider.full_name
          ?.toLowerCase()
          .includes(search.toLowerCase()) ||
        rider.email
          ?.toLowerCase()
          .includes(search.toLowerCase()) ||
        rider.phone
          ?.toLowerCase()
          .includes(search.toLowerCase());

      const matchesStatus =
        status === "all" || rider.status === status;

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
            Monitor riders across your territory.
          </p>

        </div>

        <div className="flex flex-col gap-3 md:flex-row">

          <div className="relative">

            <Search
              className="absolute left-3 top-3 text-slate-400"
              size={18}
            />

            <input
              type="text"
              placeholder="Search riders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-xl border border-slate-300 py-2 pl-10 pr-4 outline-none focus:border-orange-500"
            />

          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-2 outline-none focus:border-orange-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="offline">Offline</option>
            <option value="busy">Busy</option>
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
                Status
              </th>

              <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                Wallet
              </th>

              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                Last Updated
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
                  colSpan={6}
                  className="px-6 py-10 text-center text-slate-500"
                >
                  Loading riders...
                </td>

              </tr>

            ) : filteredRiders.length === 0 ? (

              <tr>

                <td
                  colSpan={6}
                  className="px-6 py-10 text-center text-slate-500"
                >
                  No riders found.
                </td>

              </tr>

            ) : (

              filteredRiders.map((rider) => (

                <tr
                  key={rider.id}
                  className="transition-colors hover:bg-orange-50"
                >

                  <td className="px-6 py-5">

                    <div>

                      <h3 className="font-semibold text-slate-900">
                        {rider.full_name || "Unnamed Rider"}
                      </h3>

                      <p className="text-sm text-slate-500">
                        {rider.email}
                      </p>

                    </div>

                  </td>

                  <td className="px-6 py-5">
                    {rider.phone || "-"}
                  </td>

                  <td className="px-6 py-5">

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        rider.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : rider.status === "busy"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {rider.status}
                    </span>

                  </td>

                  <td className="px-6 py-5 text-right font-semibold">
                    ₦
                    {Number(
                      rider.available_balance ?? 0
                    ).toLocaleString()}
                  </td>

                  <td className="px-6 py-5 text-sm text-slate-500">
                    {rider.updated_at
                      ? new Date(
                          rider.updated_at
                        ).toLocaleString()
                      : "-"}
                  </td>

                  <td className="px-6 py-5 text-center">

                    <button
                      onClick={() => onView(rider)}
                      className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
                    >
                      <Eye size={16} />
                      View
                    </button>

                  </td>

                </tr>

              ))

            )}

          </tbody>

        </table>

      </div>

    </section>
  );
}