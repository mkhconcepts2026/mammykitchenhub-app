"use client";

import type { ChangeEvent } from "react";

type VendorStorefrontCardProps = {
  vendorName: string;
  image: string;
  uploading: boolean;
  message: string;
  error: string;
  onPhotoChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export default function VendorStorefrontCard({
  vendorName,
  image,
  uploading,
  message,
  error,
  onPhotoChange,
}: VendorStorefrontCardProps) {
  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <div className="h-40 w-full shrink-0 overflow-hidden rounded-xl bg-slate-100 md:w-60">
          {image ? (
            <img
              src={image}
              alt={`${vendorName || "Store"} storefront`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-5 text-center text-sm text-slate-500">
              No storefront photo uploaded yet
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">Store profile</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">{vendorName || "Your Store"} storefront photo</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            This image is shown to customers on your public vendor card. Use a clear photo that represents your store or the food and drinks you offer.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="file"
              accept="image/png,image/jpeg"
              disabled={uploading}
              onChange={onPhotoChange}
              className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:font-semibold file:text-slate-800 disabled:opacity-60"
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">PNG or JPG, maximum 5 MB.</p>
          {uploading && <p role="status" className="mt-3 text-sm font-medium text-slate-600">Uploading storefront photoâ€¦</p>}
          {message && <p role="status" className="mt-3 text-sm font-medium text-green-700">{message}</p>}
          {error && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{error}</p>}
        </div>
      </div>
    </section>
  );
}