"use client";

import {
  X,
  Mail,
  Phone,
  Wallet,
  MapPin,
  Calendar,
  Package,
} from "lucide-react";

import { RiderRecord } from "@/types/rider";

interface RiderDrawerProps {
  rider: RiderRecord | null;
  open: boolean;
  onClose: () => void;
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

export default function RiderDrawer({
  rider,
  open,
  onClose,
}: RiderDrawerProps) {
  if (!open || !rider) return null;

  const statusConfig =
    operationalStatusConfig[
      rider.operational_status
    ];

  return (
    <>
      {/* Backdrop */}

      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />

      {/* Drawer */}

      <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-lg overflow-y-auto bg-white shadow-2xl">

        {/* Header */}

        <div className="bg-[#F97316] px-8 py-6 text-white">

          <div className="flex items-start justify-between">

            <div>

              <p className="text-xs font-bold uppercase tracking-[0.3em] text-orange-100">
                Mammy Kitchen Hub
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Rider Profile
              </h2>

              <p className="mt-2 text-orange-100">
                Operational overview for this rider.
              </p>

            </div>

            <button
              onClick={onClose}
              className="rounded-xl bg-white/20 p-2 transition hover:bg-white/30"
              aria-label="Close rider profile"
            >
              <X size={22} />
            </button>

          </div>

        </div>

        {/* Content */}

        <div className="space-y-8 p-8">

          {/* Profile */}

          <section className="rounded-2xl border border-slate-200 p-6">

            <h3 className="mb-5 text-lg font-bold text-slate-900">
              Rider Information
            </h3>

            <div className="space-y-4">

              <div>

                <p className="text-xs uppercase text-slate-500">
                  Full Name
                </p>

                <p className="font-semibold text-slate-900">
                  {rider.full_name || "-"}
                </p>

              </div>

              <div className="flex items-center gap-3">

                <Mail
                  size={18}
                  className="text-slate-400"
                />

                <span>
                  {rider.email || "-"}
                </span>

              </div>

              <div className="flex items-center gap-3">

                <Phone
                  size={18}
                  className="text-slate-400"
                />

                <span>
                  {rider.phone || "-"}
                </span>

              </div>

            </div>

          </section>

          {/* Operational Status */}

          <section className="rounded-2xl border border-slate-200 p-6">

            <h3 className="mb-5 text-lg font-bold text-slate-900">
              Operational Status
            </h3>

            <div className="flex items-center justify-between gap-4">

              <span
                className={`rounded-full px-4 py-2 text-sm font-semibold ${statusConfig.className}`}
              >
                {statusConfig.label}
              </span>

              <span className="text-xs text-slate-500">
                Account:{" "}
                <span className="font-semibold capitalize text-slate-700">
                  {rider.status || "unknown"}
                </span>
              </span>

            </div>

          </section>

          {/* Current Delivery */}

          <section className="rounded-2xl border border-slate-200 p-6">

            <h3 className="mb-5 flex items-center gap-2 text-lg font-bold text-slate-900">

              <Package size={20} />

              Current Delivery

            </h3>

            {rider.current_order ? (

              <div className="space-y-4">

                <div className="rounded-xl bg-orange-50 p-4">

                  <p className="text-xs uppercase text-slate-500">
                    Order
                  </p>

                  <p className="mt-2 text-xl font-black text-slate-900">
                    {rider.current_order.order_number ||
                      rider.current_order.id.slice(0, 8)}
                  </p>

                </div>

                <div className="grid grid-cols-2 gap-4">

                  <div className="rounded-xl bg-slate-50 p-4">

                    <p className="text-xs uppercase text-slate-500">
                      Status
                    </p>

                    <p className="mt-2 font-semibold capitalize text-slate-900">
                      {rider.current_order.status.replace(
                        /_/g,
                        " "
                      )}
                    </p>

                  </div>

                  <div className="rounded-xl bg-slate-50 p-4">

                    <p className="text-xs uppercase text-slate-500">
                      Order Value
                    </p>

                    <p className="mt-2 font-semibold text-slate-900">
                      ₦
                      {Number(
                        rider.current_order.total ?? 0
                      ).toLocaleString()}
                    </p>

                  </div>

                </div>

                <p className="text-sm text-slate-500">
                  Created{" "}
                  {new Date(
                    rider.current_order.created_at
                  ).toLocaleString()}
                </p>

              </div>

            ) : (

              <div className="rounded-xl bg-slate-50 p-5">

                <p className="font-semibold text-slate-700">
                  No active delivery
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  This rider currently has no assigned
                  or picked-up order.
                </p>

              </div>

            )}

          </section>

          {/* Wallet */}

          <section className="rounded-2xl border border-slate-200 p-6">

            <h3 className="mb-5 flex items-center gap-2 text-lg font-bold text-slate-900">

              <Wallet size={20} />

              Wallet Summary

            </h3>

            <div className="grid grid-cols-1 gap-4">

              <div className="rounded-xl bg-orange-50 p-4">

                <p className="text-xs uppercase text-slate-500">
                  Available Balance
                </p>

                <p className="mt-2 text-2xl font-black text-slate-900">
                  ₦
                  {Number(
                    rider.available_balance ?? 0
                  ).toLocaleString()}
                </p>

              </div>

              <div className="rounded-xl bg-slate-50 p-4">

                <p className="text-xs uppercase text-slate-500">
                  Pending Balance
                </p>

                <p className="mt-2 text-xl font-bold">
                  ₦
                  {Number(
                    rider.pending_balance ?? 0
                  ).toLocaleString()}
                </p>

              </div>

              <div className="rounded-xl bg-amber-50 p-4">

                <p className="text-xs uppercase text-slate-500">
                  Lifetime Earnings
                </p>

                <p className="mt-2 text-xl font-bold">
                  ₦
                  {Number(
                    rider.lifetime_earnings ?? 0
                  ).toLocaleString()}
                </p>

              </div>

            </div>

          </section>

          {/* Last Location */}

          <section className="rounded-2xl border border-slate-200 p-6">

            <h3 className="mb-5 flex items-center gap-2 text-lg font-bold text-slate-900">

              <MapPin size={20} />

              Last GPS Update

            </h3>

            <p className="text-slate-700">

              {rider.updated_at
                ? new Date(
                    rider.updated_at
                  ).toLocaleString()
                : "No location update available."}

            </p>

          </section>

          {/* Account */}

          <section className="rounded-2xl border border-slate-200 p-6">

            <h3 className="mb-5 flex items-center gap-2 text-lg font-bold text-slate-900">

              <Calendar size={20} />

              Account

            </h3>

            <div className="space-y-2 text-sm">

              <p className="text-slate-500">
                Account Status
              </p>

              <p className="font-semibold capitalize text-slate-900">
                {rider.status || "Unknown"}
              </p>

            </div>

          </section>

        </div>

      </aside>
    </>
  );
}