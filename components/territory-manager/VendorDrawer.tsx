"use client";

import {
  X,
  Mail,
  Phone,
  Wallet,
  Store,
  Star,
} from "lucide-react";

import { VendorRecord } from "@/types/vendor";

interface VendorDrawerProps {
  vendor: VendorRecord | null;
  open: boolean;
  onClose: () => void;
}

export default function VendorDrawer({
  vendor,
  open,
  onClose,
}: VendorDrawerProps) {
  if (!open || !vendor) return null;

  return (
    <>
      {/* Backdrop */}

      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />

      {/* Drawer */}

      <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-lg overflow-y-auto bg-white shadow-2xl">

        {/* Hero */}

        <div className="bg-[#F97316] px-8 py-6 text-white">

          <div className="flex items-start justify-between">

            <div>

              <p className="text-xs font-bold uppercase tracking-[0.3em] text-orange-100">

                MAMMY KITCHEN HUB

              </p>

              <h2 className="mt-2 text-3xl font-black">

                Vendor Profile

              </h2>

              <p className="mt-2 text-orange-100">

                Vendor operational overview.

              </p>

            </div>

            <button
              onClick={onClose}
              className="rounded-xl bg-white/20 p-2 hover:bg-white/30"
            >
              <X size={22} />
            </button>

          </div>

        </div>

        {/* Content */}

        <div className="space-y-8 p-8">

          {/* Vendor */}

          <section className="rounded-2xl border border-slate-200 p-6">

            <h3 className="mb-5 flex items-center gap-2 text-lg font-bold">

              <Store size={20} />

              Vendor Information

            </h3>

            <div className="space-y-4">

              <div>

                <p className="text-xs uppercase text-slate-500">

                  Business Name

                </p>

                <p className="font-semibold">

                  {vendor.name}

                </p>

              </div>

              <div>

                <p className="text-xs uppercase text-slate-500">

                  Owner

                </p>

                <p>

                  {vendor.owner_name || "-"}

                </p>

              </div>

              <div className="flex items-center gap-3">

                <Mail size={18} className="text-slate-400" />

                {vendor.email}

              </div>

              <div className="flex items-center gap-3">

                <Phone size={18} className="text-slate-400" />

                {vendor.phone}

              </div>

            </div>

          </section>

          {/* Wallet */}

          <section className="rounded-2xl border border-slate-200 p-6">

            <h3 className="mb-5 flex items-center gap-2 text-lg font-bold">

              <Wallet size={20} />

              Wallet Summary

            </h3>

            <div className="grid gap-4">

              <div className="rounded-xl bg-orange-50 p-4">

                <p className="text-xs uppercase text-slate-500">

                  Available Balance

                </p>

                <p className="mt-2 text-2xl font-black">

                  ₦{vendor.available_balance.toLocaleString()}

                </p>

              </div>

              <div className="rounded-xl bg-slate-50 p-4">

                <p className="text-xs uppercase text-slate-500">

                  Pending Balance

                </p>

                <p className="mt-2 text-xl font-bold">

                  ₦{vendor.pending_balance.toLocaleString()}

                </p>

              </div>

              <div className="rounded-xl bg-amber-50 p-4">

                <p className="text-xs uppercase text-slate-500">

                  Lifetime Earnings

                </p>

                <p className="mt-2 text-xl font-bold">

                  ₦{vendor.lifetime_earnings.toLocaleString()}

                </p>

              </div>

            </div>

          </section>

          {/* Rating */}

          <section className="rounded-2xl border border-slate-200 p-6">

            <h3 className="mb-5 flex items-center gap-2 text-lg font-bold">

              <Star size={20} />

              Vendor Rating

            </h3>

            <p className="text-3xl font-black">

              ⭐ {Number(vendor.rating).toFixed(1)}

            </p>

          </section>

          {/* Transactions */}

          <section className="rounded-2xl border border-slate-200 p-6">

            <h3 className="mb-3 text-lg font-bold">

              Recent Transactions

            </h3>

            <div className="rounded-xl bg-slate-50 p-5 text-center text-slate-500">

              No transactions available.

            </div>

          </section>

        </div>

      </aside>

    </>
  );
}