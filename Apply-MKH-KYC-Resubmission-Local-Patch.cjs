#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const files = {
  tab: path.join(root, 'components', 'vendor', 'VendorKYCTab.tsx'),
  dashboard: path.join(root, 'app', 'vendor-dashboard-v2', 'page.tsx'),
  statusRoute: path.join(root, 'app', 'api', 'vendor', 'kyc-status', 'route.ts'),
  resubmitRoute: path.join(root, 'app', 'api', 'vendor', 'kyc-resubmit', 'route.ts'),
};

function fail(message) {
  console.error(`Patch stopped safely: ${message}`);
  process.exit(1);
}

for (const key of ['tab', 'dashboard', 'statusRoute']) {
  const file = files[key];
  if (!fs.existsSync(file)) fail(`Required file not found (${key}): ${file}`);
}
if (fs.existsSync(files.resubmitRoute)) fail('The KYC resubmission API route already exists; inspect it before applying this patch. No files were changed.');

let tab = fs.readFileSync(files.tab, 'utf8');
let dashboard = fs.readFileSync(files.dashboard, 'utf8');
let statusRoute = fs.readFileSync(files.statusRoute, 'utf8');

// Preflight checks: make no writes unless every expected source fragment matches.
if (!tab.includes('View the current verification status for your vendor account.') ||
    !tab.includes('Current verification status')) {
  fail('VendorKYCTab.tsx is not the expected status-only component. No files were changed.');
}
if (!dashboard.includes('<VendorKYCTab kycStatus={kycStatus} />')) {
  fail('Could not find the expected VendorKYCTab render call. No files were changed.');
}
if (!dashboard.includes('async function submitKyc() {') ||
    !dashboard.includes('async function loadVendorKyc() {')) {
  fail('Could not find the expected KYC submission function boundaries. No files were changed.');
}
if (!dashboard.includes('if (result?.success && typeof result.status === "string") {') ||
    !dashboard.includes('setKycStatus(result.status || "Not Submitted");')) {
  fail('Could not find the expected KYC status loader. No files were changed.');
}
if (!statusRoute.includes('.select("status,created_at,reviewed_at")') ||
    !statusRoute.includes('.select("kyc_status,created_at,kyc_reviewed_at")') ||
    !statusRoute.includes('{ success: true, status: displayStatus(selectedStatus) }')) {
  fail('The KYC status API differs from the expected version. No files were changed.');
}
if (tab.includes('onResubmit') || dashboard.includes('reviewNotes={kycReviewNotes}') || statusRoute.includes('reviewNotes: String(selectedReviewNotes')) {
  fail('Part of the resubmission patch already appears to be applied. No files were changed.');
}

const newTab = `"use client";

import { useState } from "react";

type KycResubmissionFiles = {
  cacFile: File;
  idFile: File;
  selfieFile: File;
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
  const normalizedStatus = status.toLowerCase().replace(/[\\s_-]+/g, " ");
  const canResubmit = ["rejected", "requires attention"].includes(normalizedStatus);

  const [cacFile, setCacFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

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
            disabled={submitting || !cacFile || !idFile || !selfieFile}
            onClick={() => {
              if (cacFile && idFile && selfieFile) {
                void onResubmit({ cacFile, idFile, selfieFile });
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
`;

// Correct the function block, using explicit boundary markers so no adjacent logic is touched.
const submitStart = dashboard.indexOf('async function submitKyc() {');
const submitEnd = dashboard.indexOf('async function loadVendorKyc() {', submitStart);
if (submitStart < 0 || submitEnd < 0 || submitEnd <= submitStart) {
  fail('Could not isolate submitKyc function. No files were changed.');
}
const newSubmitFunction = `async function submitKyc(files?: { cacFile: File; idFile: File; selfieFile: File }) {
  if (submittingKyc) return;
  setSubmittingKyc(true);

  try {
    const submittedCacFile = files?.cacFile ?? cacFile;
    const submittedIdFile = files?.idFile ?? idFile;
    const submittedSelfieFile = files?.selfieFile ?? selfieFile;
    if (!submittedCacFile || !submittedIdFile || !submittedSelfieFile) {
      alert("Please upload the corrected CAC certificate, National ID and selfie.");
      return;
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      alert("Your session could not be verified. Please sign in again.");
      return;
    }

    const statusResponse = await fetch("/api/vendor/kyc-status", { cache: "no-store" });
    const statusResult = await statusResponse.json().catch(() => ({}));
    if (
      !statusResponse.ok ||
      !statusResult?.success ||
      !["Rejected", "Requires Attention"].includes(String(statusResult.status)) ||
      !["application", "vendor_kyc"].includes(String(statusResult.source)) ||
      typeof statusResult.sourceRecordId !== "string"
    ) {
      alert("Resubmission is only available for a rejected KYC submission. Refresh the page and try again.");
      return;
    }

    const isApplicationSource = statusResult.source === "application";
    const bucket = isApplicationSource ? "vendor-documents" : "kyc-documents";
    const cacFolder = "cac";
    const idFolder = isApplicationSource ? "ids" : "id";
    const selfieFolder = isApplicationSource ? "selfies" : "selfie";

    const cacPath = await uploadKycFile(submittedCacFile, cacFolder, bucket);
    if (!cacPath) return;
    const idPath = await uploadKycFile(submittedIdFile, idFolder, bucket);
    if (!idPath) return;
    const selfiePath = await uploadKycFile(submittedSelfieFile, selfieFolder, bucket);
    if (!selfiePath) return;

    const response = await fetch("/api/vendor/kyc-resubmit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: statusResult.source,
        sourceRecordId: statusResult.sourceRecordId,
        cacPath,
        idPath,
        selfiePath,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.success) {
      alert(typeof result?.message === "string" ? result.message : "The corrected documents could not be submitted. Please try again.");
      return;
    }

    setKycStatus("Pending Review");
    setKycReviewNotes("");
    await loadVendorKyc();
    alert("Corrected documents submitted successfully. Your KYC status is now Pending Review.");
  } catch (error) {
    console.error("KYC resubmission error:", error);
    alert("We could not complete the resubmission. Please check your connection and try again.");
  } finally {
    setSubmittingKyc(false);
  }
}
`;
dashboard = dashboard.slice(0, submitStart) + newSubmitFunction + '\n' + dashboard.slice(submitEnd);

const uploadStart = dashboard.indexOf('async function uploadKycFile(');
const uploadEnd = dashboard.indexOf('async function submitKyc(files?', uploadStart);
if (uploadStart < 0 || uploadEnd < 0 || uploadEnd <= uploadStart) fail('Could not isolate uploadKycFile helper. No files were changed.');
let uploadBlock = dashboard.slice(uploadStart, uploadEnd);
if (!uploadBlock.includes('folder: string') || !uploadBlock.includes('.from("kyc-documents")')) fail('The uploadKycFile helper differs from the expected version. No files were changed.');
uploadBlock = uploadBlock.replace('  folder: string\n)', '  folder: string,\n  bucket = "kyc-documents"\n)');
uploadBlock = uploadBlock.replace('.from("kyc-documents")', '.from(bucket)');
if (!uploadBlock.includes('bucket = "kyc-documents"') || !uploadBlock.includes('.from(bucket)')) fail('Could not make the upload helper source-aware. No files were changed.');
dashboard = dashboard.slice(0, uploadStart) + uploadBlock + dashboard.slice(uploadEnd);

// Add state for the Admin's note and wire the new component props.
const kycStatePattern = /const \[kycStatus, setKycStatus\] =\s*useState\("Not Submitted"\);/g;
const kycStateMatches = [...dashboard.matchAll(kycStatePattern)];
if (kycStateMatches.length !== 1) fail('Expected exactly one kycStatus state declaration. No files were changed.');
dashboard = dashboard.replace(kycStatePattern, (match) => `${match}\nconst [kycReviewNotes, setKycReviewNotes] = useState("");`);

dashboard = dashboard.replace(
  'if (result?.success && typeof result.status === "string") {\n      setKycStatus(result.status || "Not Submitted");\n    }',
  'if (result?.success && typeof result.status === "string") {\n      setKycStatus(result.status || "Not Submitted");\n      setKycReviewNotes(typeof result.reviewNotes === "string" ? result.reviewNotes : "");\n    }'
);
if (!dashboard.includes('setKycReviewNotes(typeof result.reviewNotes')) fail('Failed to patch KYC note state update. No files were changed.');
dashboard = dashboard.replace(
  '<VendorKYCTab kycStatus={kycStatus} />',
  '<VendorKYCTab kycStatus={kycStatus} reviewNotes={kycReviewNotes} onResubmit={submitKyc} submitting={submittingKyc} />'
);
if (!dashboard.includes('onResubmit={submitKyc}')) fail('Failed to wire the KYC resubmission handler. No files were changed.');

// Let the authenticated vendor read only their own latest review note via the existing status route.
statusRoute = statusRoute.replace(
  '.select("status,created_at,reviewed_at")',
  '.select("id,status,created_at,reviewed_at,review_notes")'
).replace(
  '.select("kyc_status,created_at,kyc_reviewed_at")',
  '.select("id,kyc_status,created_at,kyc_reviewed_at,kyc_review_notes")'
);
if (!statusRoute.includes('.select("id,status,created_at,reviewed_at,review_notes")') ||
    !statusRoute.includes('.select("id,kyc_status,created_at,kyc_reviewed_at,kyc_review_notes")')) {
  fail('Could not extend KYC status selects to include review notes. No files were changed.');
}
statusRoute = statusRoute.replace(
  '  if (status === "rejected") return "Rejected";\n',
  '  if (status === "rejected") return "Rejected";\n  if (status === "requires_attention") return "Requires Attention";\n'
);
statusRoute = statusRoute.replace(
  /\s*const selectedStatus = applicationTime > kycTime\s*\?\s*application\?\.kyc_status\s*:\s*kyc\?\.status \?\? application\?\.kyc_status;/,
  '\n    const useApplication = applicationTime > kycTime;\n    const selectedStatus = useApplication\n      ? application?.kyc_status\n      : kyc?.status ?? application?.kyc_status;\n    const selectedReviewNotes = useApplication\n      ? application?.kyc_review_notes\n      : kyc?.review_notes ?? application?.kyc_review_notes;\n    const selectedSource = useApplication || !kyc ? \"application\" : \"vendor_kyc\";\n    const selectedRecordId = selectedSource === \"application\" ? application?.id : kyc?.id;'
);
if (!statusRoute.includes('const selectedReviewNotes = useApplication')) fail('Could not compute selected review notes. No files were changed.');
statusRoute = statusRoute.replace(
  '{ success: true, status: displayStatus(selectedStatus) },',
  '{ success: true, status: displayStatus(selectedStatus), reviewNotes: String(selectedReviewNotes ?? "").trim(), source: selectedRecordId ? selectedSource : null, sourceRecordId: selectedRecordId ?? null },'
);
if (!statusRoute.includes('reviewNotes: String(selectedReviewNotes')) fail('Could not include review notes in status response. No files were changed.');

const newRoute = `import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function normalizeStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[\\s-]+/g, "_");
}

function isOwnedObjectPath(value: unknown, folder: string, userId: string): value is string {
  if (typeof value !== "string" || value.length > 1024) return false;
  const segments = value.split("/");
  if (segments.length !== 2 || segments[0] !== folder) return false;
  const name = segments[1];
  return name.startsWith(userId + "-") && !name.includes("..") && !name.includes(String.fromCharCode(92));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return jsonError("Authentication required.", 401);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const source = body?.source;
  if ((source !== "application" && source !== "vendor_kyc") || typeof body?.sourceRecordId !== "string") {
    return jsonError("A valid KYC submission is required.", 400);
  }

  try {
    const [kycResult, applicationResult] = await Promise.all([
      adminClient
        .from("vendor_kyc")
        .select("id,status,created_at,reviewed_at")
        .eq("vendor_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      user.email
        ? adminClient
            .from("vendor_applications")
            .select("id,kyc_status,created_at,kyc_reviewed_at")
            .ilike("email", user.email)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
    ]);

    if (kycResult.error || applicationResult.error) {
      console.error("KYC resubmission status lookup failed:", kycResult.error?.message, applicationResult.error?.message);
      return jsonError("Unable to verify the current KYC status. Please try again later.", 500);
    }

    const kyc = kycResult.data;
    const application = applicationResult.data;
    const kycTime = kyc ? new Date(kyc.reviewed_at || kyc.created_at || 0).getTime() : -1;
    const applicationTime = application ? new Date(application.kyc_reviewed_at || application.created_at || 0).getTime() : -1;
    const currentSource = applicationTime > kycTime || !kyc ? "application" : "vendor_kyc";
    const currentRecord = currentSource === "application" ? application : kyc;
    const currentStatus = currentSource === "application" ? application?.kyc_status : kyc?.status;

    if (!currentRecord || currentRecord.id !== body.sourceRecordId || source !== currentSource) {
      return jsonError("The KYC submission changed while you were preparing documents. Refresh the dashboard and try again.", 409);
    }
    if (!["rejected", "requires_attention"].includes(normalizeStatus(currentStatus))) {
      return jsonError("Resubmission is only available when your latest KYC decision is Rejected or Requires Attention.", 409);
    }

    const expected = source === "application"
      ? { bucket: "vendor-documents", cac: "cac", id: "ids", selfie: "selfies" }
      : { bucket: "kyc-documents", cac: "cac", id: "id", selfie: "selfie" };
    if (
      !isOwnedObjectPath(body?.cacPath, expected.cac, user.id) ||
      !isOwnedObjectPath(body?.idPath, expected.id, user.id) ||
      !isOwnedObjectPath(body?.selfiePath, expected.selfie, user.id)
    ) {
      return jsonError("The corrected document references are invalid. Please upload the documents again.", 400);
    }

    const paths = [body.cacPath, body.idPath, body.selfiePath];
    const objectChecks = await Promise.all(paths.map((objectPath) =>
      adminClient.storage.from(expected.bucket).createSignedUrl(objectPath, 60)
    ));
    if (objectChecks.some((result) => result.error || !result.data?.signedUrl)) {
      return jsonError("One or more uploaded documents could not be verified in private storage. Please upload them again.", 400);
    }

    let updateResult: any;
    if (source === "application") {
      updateResult = await adminClient
        .from("vendor_applications")
        .update({
          cac_url: body.cacPath,
          id_url: body.idPath,
          selfie_url: body.selfiePath,
          kyc_status: "pending_review",
        })
        .eq("id", application.id)
        .eq("kyc_status", application.kyc_status)
        .select("id")
        .maybeSingle();
    } else {
      updateResult = await adminClient
        .from("vendor_kyc")
        .update({
          cac_url: body.cacPath,
          national_id_url: body.idPath,
          selfie_url: body.selfiePath,
          status: "pending",
        })
        .eq("id", kyc.id)
        .eq("status", kyc.status)
        .select("id")
        .maybeSingle();
    }

    if (updateResult.error) {
      console.error("KYC resubmission update failed:", updateResult.error.message);
      return jsonError("The corrected documents could not be saved. Please contact MKH support before retrying.", 500);
    }
    if (!updateResult.data) {
      return jsonError("The KYC record changed during resubmission. Refresh the dashboard and try again.", 409);
    }

    // Updating the rejected row lets the audit trigger preserve the prior decision
    // and capture a documents_resubmitted event without creating a duplicate row.
    return NextResponse.json(
      { success: true, status: "Pending Review" },
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (error) {
    console.error("KYC resubmission route error:", error);
    return jsonError("Unable to complete KYC resubmission.", 500);
  }
}
`;

// Ensure the transformed sources meet minimum sanity checks before making any writes.
if (!newTab.includes('Submit corrected documents') || !newTab.includes('onResubmit({ cacFile, idFile, selfieFile })')) {
  fail('New KYC tab failed an internal sanity check. No files were changed.');
}
if ((dashboard.match(/async function submitKyc\(/g) || []).length !== 1) fail('Unexpected submitKyc function count. No files were changed.');
if (!dashboard.includes('fetch("/api/vendor/kyc-resubmit"')) fail('The dashboard did not wire the server-side resubmission route. No files were changed.');
if (!statusRoute.includes('sourceRecordId: selectedRecordId')) fail('The status route did not expose the current KYC source. No files were changed.');
if (!newRoute.includes('documents_resubmitted') || !newRoute.includes('isOwnedObjectPath') || !newRoute.includes('.update({')) fail('New resubmission route failed sanity checks. No files were changed.');

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join('C:\\MKH\\backups', `mkh-kyc-resubmission-ui-${timestamp}`);
try {
  fs.mkdirSync(backupDir, { recursive: true });
  for (const key of ['tab', 'dashboard', 'statusRoute']) {
    const file = files[key];
    const relative = path.relative(root, file);
    const destination = path.join(backupDir, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(file, destination);
  }
  fs.mkdirSync(path.dirname(files.resubmitRoute), { recursive: true });
  fs.writeFileSync(files.tab, newTab, 'utf8');
  fs.writeFileSync(files.dashboard, dashboard, 'utf8');
  fs.writeFileSync(files.statusRoute, statusRoute, 'utf8');
  fs.writeFileSync(files.resubmitRoute, newRoute, 'utf8');
} catch (error) {
  console.error('Write failed. Restore original files from the backup folder if any source file was already written.');
  console.error(error.message);
  console.error(`Backup folder: ${backupDir}`);
  process.exit(1);
}

console.log('KYC resubmission UI patch applied locally.');
console.log('Changed: components/vendor/VendorKYCTab.tsx; app/vendor-dashboard-v2/page.tsx; app/api/vendor/kyc-status/route.ts; app/api/vendor/kyc-resubmit/route.ts');
console.log(`Backup: ${backupDir}`);
console.log('The patch uploads corrected documents to the appropriate private bucket and asks a server route to recheck status, verify files, and update the rejected KYC source record to pending review. The audit trigger preserves history; no duplicate application or KYC row is created. No SQL is executed.');
console.log('No Git operations or deployment were performed.');
