"use client";

import { useState } from "react";

type KycResubmissionFiles = {
  cacFile: File;
  idFile: File;
  selfieFile: File;
  kitchenPhotoFile: File;
};

type VendorKYCTabProps = {
  kycStatus: string;
  reviewNotes?: string;
  onResubmit: (files: KycResubmissionFiles) => Promise<void>;
  submitting?: boolean;
};

export default function VendorKYCTab({
  kycStatus,
  reviewNotes = "",
  onResubmit,
  submitting = false,
}: VendorKYCTabProps) {
  const status = (kycStatus || "Not Submitted").trim();
  const normalizedStatus = status.toLowerCase().replace(/[\s_-]+/g, " ");
  const canResubmit = ["rejected", "requires attention"].includes(normalizedStatus);

  const [cacFile, setCacFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [kitchenPhotoFile, setKitchenPhotoFile] = useState<File | null>(null);

  const tone =
    normalizedStatus === "verified" || normalizedStatus === "approved"
      ? {
          indicator: "bg-emerald-500",
          badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
          panel: "border-emerald-200 bg-emerald-50/60",
        }
      : normalizedStatus === "pending" || normalizedStatus === "pending review"
        ? {
            indicator: "bg-amber-500",
            badge: "border-amber-200 bg-amber-50 text-amber-700",
            panel: "border-amber-200 bg-amber-50/60",
          }
        : normalizedStatus === "not submitted"
          ? {
              indicator: "bg-slate-400",
              badge: "border-slate-200 bg-slate-50 text-slate-700",
              panel: "border-slate-200 bg-slate-50",
            }
          : normalizedStatus === "rejected" || normalizedStatus === "requires attention"
            ? {
                indicator: "bg-red-500",
                badge: "border-red-200 bg-red-50 text-red-700",
                panel: "border-red-200 bg-red-50/60",
              }
            : {
                indicator: "bg-blue-500",
                badge: "border-blue-200 bg-blue-50 text-blue-700",
                panel: "border-blue-200 bg-blue-50/60",
              };

  const fileInputClass =
    "mt-2 block w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-50 file:px-3 file:py-2 file:font-semibold file:text-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-400";

  return (
    <section className="space-y-6">
      <header>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-orange-600">
          Account compliance
        </p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          KYC Verification
        </h1>
        <p className="mt-2 text-base text-slate-500">
          View the current verification status for your vendor account.
        </p>
      </header>

      <div className={"rounded-2xl border p-6 shadow-sm md:p-8 " + tone.panel}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className={"mt-1.5 h-3 w-3 shrink-0 rounded-full " + tone.indicator} />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Current verification status</h2>
              <p className="mt-1 text-sm text-slate-600">This status reflects the latest saved KYC record.</p>
            </div>
          </div>
          <span
            className={"inline-flex w-fit items-center rounded-full border px-4 py-2 text-sm font-semibold " + tone.badge}
            role="status"
            aria-live="polite"
          >
            {status}
          </span>
        </div>
      </div>

      {canResubmit && (
        <div className="space-y-5 rounded-2xl border border-red-200 bg-white p-6 shadow-sm md:p-8">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Correct &amp; Resubmit Documents</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Please review the Admin's feedback and upload corrected copies of all three documents. Your previous rejection and notes remain in the review history; resubmitting does not approve your business application.
            </p>
          </div>

          <div className="rounded-xl border border-red-100 bg-red-50 p-4" aria-live="polite">
            <p className="text-sm font-semibold text-red-800">Admin review notes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-red-700">
              {reviewNotes.trim() || "No review note was supplied. Please upload the corrected documents requested by MKH Admin."}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-800">
              Corrected kitchen photo (PNG or JPG, up to 5 MB)
              <input
                className={fileInputClass}
                type="file"
                accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                onChange={(event) => setKitchenPhotoFile(event.currentTarget.files?.[0] ?? null)}
              />
              <span className="mt-1 block break-all text-xs font-normal text-slate-500">
                {kitchenPhotoFile?.name || "Choose a clear photo of your kitchen"}
              </span>
            </label>
            <div className="rounded-xl border border-orange-100 bg-orange-50 p-4 text-sm leading-6 text-slate-700">
              Please include a current, clear kitchen photo along with all three corrected KYC documents.
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block text-sm font-semibold text-slate-800">
              Corrected CAC certificate
              <input className={fileInputClass} type="file" accept=".pdf,image/*" onChange={(event) => setCacFile(event.currentTarget.files?.[0] ?? null)} />
              <span className="mt-1 block break-all text-xs font-normal text-slate-500">{cacFile?.name || "PDF or image"}</span>
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Corrected National ID
              <input className={fileInputClass} type="file" accept=".pdf,image/*" onChange={(event) => setIdFile(event.currentTarget.files?.[0] ?? null)} />
              <span className="mt-1 block break-all text-xs font-normal text-slate-500">{idFile?.name || "PDF or image"}</span>
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Corrected selfie
              <input className={fileInputClass} type="file" accept=".pdf,image/*" onChange={(event) => setSelfieFile(event.currentTarget.files?.[0] ?? null)} />
              <span className="mt-1 block break-all text-xs font-normal text-slate-500">{selfieFile?.name || "PDF or image"}</span>
            </label>
          </div>

          <button
            type="button"
            disabled={submitting || !cacFile || !idFile || !selfieFile || !kitchenPhotoFile}
            onClick={() => {
              if (cacFile && idFile && selfieFile && kitchenPhotoFile) {
                void onResubmit({ cacFile, idFile, selfieFile, kitchenPhotoFile });
              }
            }}
            className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Uploading documents…" : "Submit corrected documents"}
          </button>
          <p className="text-xs leading-5 text-slate-500">
            Documents are uploaded to MKH's private KYC storage. Your corrected submission will return to Admin review.
          </p>
        </div>
      )}
    </section>
  );
}
