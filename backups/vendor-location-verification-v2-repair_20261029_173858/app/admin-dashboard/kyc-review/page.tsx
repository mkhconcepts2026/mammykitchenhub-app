"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, FileCheck2, FileText, RefreshCw, Search, ShieldCheck, Store, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type VendorApplication = {
  id: string;
  kitchen_name: string | null;
  email: string | null;
  phone: string | null;
  vendor_type: string | null;
  business_address: string | null;
  owner_name: string | null;
  cac_url: string | null;
  id_url: string | null;
  selfie_url: string | null;
  kitchen_photo_url: string | null;
  onboarding_status: string | null;
  kyc_status: string | null;
  status: string | null;
  kyc_review_notes: string | null;
  created_at: string | null;
};

const supabase = createClient();
const PAGE_SIZE = 25;
const APPLICATION_FIELDS = [
  "id", "kitchen_name", "email", "phone", "vendor_type", "business_address",
  "owner_name", "cac_url", "id_url", "selfie_url", "kitchen_photo_url",
  "onboarding_status", "kyc_status", "status", "kyc_review_notes", "created_at",
].join(",");

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function isPendingKyc(value: unknown) {
  const status = normalize(value);
  return status === "" || ["pending", "pending_review", "under_review", "needs_review"].includes(status);
}

function recordedDocuments(application: VendorApplication) {
  return [application.cac_url, application.id_url, application.selfie_url, application.kitchen_photo_url]
    .filter((url) => Boolean(String(url ?? "").trim())).length;
}

function niceStatus(value: unknown) {
  const status = String(value ?? "pending_review").replaceAll("_", " ").trim();
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : "Pending review";
}

export default function VendorKycReviewPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<VendorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<VendorApplication | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [savingDecision, setSavingDecision] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [accessChecking, setAccessChecking] = useState(true);
  const [accessError, setAccessError] = useState("");

  const loadApplications = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setLoadError("");
    try {
      // Read all application pages so a queue of 500+ applicants is not silently truncated.
      const allRows: VendorApplication[] = [];
      const batchSize = 500;
      for (let offset = 0; ; offset += batchSize) {
        const { data, error } = await supabase
          .from("vendor_applications")
          .select(APPLICATION_FIELDS)
          .order("created_at", { ascending: false })
          .range(offset, offset + batchSize - 1);
        if (error) throw error;
        const batch = (data ?? []) as VendorApplication[];
        allRows.push(...batch);
        if (batch.length < batchSize) break;
      }
      setApplications(allRows.filter((row) => isPendingKyc(row.kyc_status)));
    } catch (error) {
      console.error("Vendor KYC queue load error:", error);
      setLoadError(error instanceof Error ? error.message : "Unable to load vendor applications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function verifyAndLoad() {
      setAccessChecking(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        if (active) router.replace("/login");
        return;
      }
      const { data: effectiveRole, error: roleError } = await (supabase as any).rpc("current_effective_app_role");
      const role = String(effectiveRole ?? "").toUpperCase();
      if (roleError || !["ADMIN", "COO"].includes(role)) {
        if (active) setAccessError("Access denied. An active Admin or COO account is required to review vendor KYC.");
        if (active) setAccessChecking(false);
        return;
      }
      if (active) {
        setCurrentUserId(user.id);
        setAccessChecking(false);
        await loadApplications();
      }
    }
    void verifyAndLoad();
    return () => { active = false; };
  }, [loadApplications, router]);

  const filtered = useMemo(() => {
    const query = normalize(search);
    if (!query) return applications;
    return applications.filter((application) => [
      application.kitchen_name,
      application.owner_name,
      application.email,
      application.phone,
      application.vendor_type,
      application.business_address,
      application.status,
      application.onboarding_status,
      application.kyc_status,
    ].some((value) => normalize(value).includes(query)));
  }, [applications, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  function openReview(application: VendorApplication) {
    setSelected(application);
    setReviewNotes(application.kyc_review_notes ?? "");
    setNotice(null);
  }

  async function recordDecision(decision: "verified" | "rejected") {
    if (!selected) return;
    if (!currentUserId) {
      setNotice({ type: "error", text: "Your login session could not be verified. Please sign in again." });
      return;
    }
    if (decision === "verified") {
      const needsCac = /kitchen|restaurant/i.test(String(selected.vendor_type ?? ""));
      if (!selected.id_url || !selected.selfie_url || (needsCac && !selected.cac_url)) {
        setNotice({
          type: "error",
          text: needsCac
            ? "Required documents are missing. A kitchen/restaurant application needs CAC, National ID and selfie references before KYC can be verified."
            : "Required documents are missing. National ID and selfie references are required before KYC can be verified.",
        });
        return;
      }
    }
    if (decision === "rejected" && !reviewNotes.trim()) {
      setNotice({ type: "error", text: "Enter a reason before rejecting KYC." });
      return;
    }

    setSavingDecision(true);
    setNotice(null);
    try {
      const { data, error } = await supabase
        .from("vendor_applications")
        .update({
          kyc_status: decision,
          kyc_reviewed_at: new Date().toISOString(),
          kyc_reviewed_by: currentUserId,
          kyc_review_notes: reviewNotes.trim() || null,
        })
        .eq("id", selected.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("No application row was updated. Check Admin access and vendor application policies.");

      setSelected(null);
      setReviewNotes("");
      setNotice({
        type: "success",
        text: `${selected.kitchen_name || "Vendor application"}: KYC marked ${decision}. Business approval status was not changed.`,
      });
      await loadApplications(true);
    } catch (error) {
      console.error("Vendor KYC decision error:", error);
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to save the KYC decision." });
    } finally {
      setSavingDecision(false);
    }
  }

  if (accessChecking) {
    return <main className="min-h-screen bg-slate-50 p-8"><div className="mx-auto max-w-5xl rounded-2xl border bg-white p-8 text-slate-600">Checking Admin access…</div></main>;
  }
  if (accessError) {
    return <main className="min-h-screen bg-slate-50 p-8"><div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-8 text-red-700">{accessError}<div className="mt-5"><button onClick={() => router.replace("/admin-dashboard")} className="rounded-lg border px-4 py-2 font-semibold text-slate-800">Back to Admin Dashboard</button></div></div></main>;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-600">Mammy Kitchen Hub · Admin</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Vendor KYC Review</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Review identity and business documents before recording a KYC decision. This review does not change the vendor’s business approval status.</p>
          </div>
          <button type="button" onClick={() => router.push("/admin-dashboard")} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold hover:bg-slate-100"><ArrowLeft size={17} /> Back to Admin Dashboard</button>
        </header>

        {notice && !selected && <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{notice.text}</div>}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Pending review</h2>
              <p className="mt-1 text-sm text-slate-500">{loading ? "Loading live vendor applications…" : `${filtered.length.toLocaleString()} matching application${filtered.length === 1 ? "" : "s"} · ${applications.length.toLocaleString()} awaiting KYC review`}</p>
            </div>
            <button type="button" onClick={() => void loadApplications(true)} disabled={refreshing || loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Refreshing…" : "Refresh"}</button>
          </div>

          <div className="mt-5">
            <label htmlFor="vendor-kyc-search" className="mb-2 block text-sm font-semibold text-slate-700">Search pending vendors</label>
            <div className="relative max-w-2xl">
              <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input id="vendor-kyc-search" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search by vendor name, owner, email, phone, address or status…" className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" />
            </div>
          </div>

          {loadError && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><strong>Unable to load live vendor applications.</strong><p className="mt-1">{loadError}</p><p className="mt-2">No mock vendor data is displayed. Check the connection or access policy, then refresh.</p></div>}

          {loading ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">Loading pending vendor applications from the database…</div>
          ) : !loadError && pageRows.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-10 text-center"><Store size={28} className="mx-auto text-slate-400" /><h3 className="mt-3 font-bold">{search ? "No matching vendors" : "No pending KYC reviews"}</h3><p className="mt-1 text-sm text-slate-500">{search ? "Try a different name, email, phone number or status." : "New applications requiring KYC review will appear here."}</p></div>
          ) : !loadError && (
            <>
              <div className="mt-5 divide-y divide-slate-100">
                {pageRows.map((application) => (
                  <article key={application.id} className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words font-bold text-slate-900">{application.kitchen_name || "Unnamed vendor application"}</h3>
                      <p className="mt-1 break-words text-sm text-slate-600">{application.email || "No email recorded"}{application.vendor_type ? ` · ${application.vendor_type}` : ""}</p>
                      {application.owner_name && <p className="mt-1 text-sm text-slate-600">Owner: {application.owner_name}</p>}
                      {application.business_address && <p className="mt-1 text-sm text-slate-500">{application.business_address}</p>}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800">{niceStatus(application.kyc_status)}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">Application: {niceStatus(application.status || "pending")}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{recordedDocuments(application)} document(s) recorded</span>
                        {application.phone && <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{application.phone}</span>}
                      </div>
                    </div>
                    <button type="button" onClick={() => openReview(application)} className="shrink-0 rounded-xl bg-slate-900 px-5 py-3 font-bold text-white hover:bg-slate-700">Review documents</button>
                  </article>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <p className="text-sm text-slate-500">Showing {((safePage - 1) * PAGE_SIZE + 1).toLocaleString()}–{Math.min(safePage * PAGE_SIZE, filtered.length).toLocaleString()} of {filtered.length.toLocaleString()}</p>
                <div className="flex items-center gap-2"><button type="button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40">Previous</button><span className="px-2 text-sm text-slate-600">Page {safePage} of {pageCount}</span><button type="button" disabled={safePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40">Next</button></div>
              </div>
            </>
          )}
        </section>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm md:p-6" role="dialog" aria-modal="true" aria-labelledby="kyc-review-title">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 md:px-7">
              <div><p className="text-xs font-bold uppercase tracking-wider text-orange-600">KYC decision</p><h2 id="kyc-review-title" className="mt-1 text-2xl font-black">{selected.kitchen_name || "Vendor application"}</h2><p className="mt-1 text-sm text-slate-500">Recording this decision does not approve or reject the vendor’s business application.</p></div>
              <button type="button" onClick={() => { setSelected(null); setNotice(null); }} aria-label="Close review" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={22} /></button>
            </div>
            <div className="space-y-6 p-5 md:p-7">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner</p><p className="mt-1 font-semibold">{selected.owner_name || "Not recorded"}</p></div>
                <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</p><p className="mt-1 break-words font-semibold">{selected.email || "No email"}</p><p className="text-sm text-slate-600">{selected.phone || "No phone"}</p></div>
              </div>
              <section>
                <h3 className="mb-3 flex items-center gap-2 font-bold"><FileText size={18} /> Documents</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {([
                    ["CAC / Business registration", selected.cac_url],
                    ["National ID", selected.id_url],
                    ["Selfie / identity photo", selected.selfie_url],
                    ["Kitchen / business photo", selected.kitchen_photo_url],
                  ] as [string, string | null][]).map(([label, url]) => (
                    <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                      <div className="min-w-0"><p className="font-semibold">{label}</p><p className={`mt-1 text-xs ${url ? "text-emerald-700" : "text-amber-700"}`}>{url ? "Document reference recorded" : "Not supplied"}</p></div>
                      {url ? <a href={url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-orange-700 hover:underline">Open <ExternalLink size={14} /></a> : <span className="text-xs text-slate-400">Missing</span>}
                    </div>
                  ))}
                </div>
              </section>
              <div>
                <label htmlFor="kyc-review-notes" className="mb-2 block font-semibold">Review notes {" "}<span className="font-normal text-slate-500">(required for rejection)</span></label>
                <textarea id="kyc-review-notes" value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} rows={3} maxLength={2000} placeholder="Record verification result or explain missing / rejected documents…" className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" />
              </div>
              {notice && <div role="alert" className={`rounded-xl border px-4 py-3 text-sm ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{notice.text}</div>}
              <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-100 pt-5 sm:flex-row">
                <button type="button" onClick={() => void recordDecision("rejected")} disabled={savingDecision} className="rounded-xl border border-red-200 px-5 py-3 font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">{savingDecision ? "Saving…" : "Reject KYC"}</button>
                <button type="button" onClick={() => void recordDecision("verified")} disabled={savingDecision} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800 disabled:opacity-50"><ShieldCheck size={18} />{savingDecision ? "Saving…" : "Verify KYC"}</button>
              </div>
              <p className="text-xs text-slate-500">Only KYC fields are updated. The vendor’s business approval status is not changed by this action.</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

