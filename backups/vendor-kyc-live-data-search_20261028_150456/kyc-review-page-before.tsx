"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type KycApplication = {
  source: "application" | "vendor_kyc";
  id: string;
  vendorId?: string;
  displayName: string;
  email: string | null;
  vendorType: string | null;
  applicationStatus: string | null;
  kycStatus: string;
  createdAt: string | null;
  documentAvailability: {
    cac: boolean;
    nationalId: boolean;
    selfie: boolean;
    kitchenPhoto: boolean;
  };
};

type KycDocument = {
  key: string;
  label: string;
  available: boolean;
  url: string | null;
};

type QueueResult = { success: boolean; applications?: KycApplication[]; message?: string };

const supabase = createClient();

export default function AdminKycReviewPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<KycApplication[]>([]);
  const [selected, setSelected] = useState<KycApplication | null>(null);
  const [documents, setDocuments] = useState<KycDocument[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [savingDecision, setSavingDecision] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadQueue = useCallback(async () => {
    setError("");
    const response = await fetch("/api/admin/vendor-kyc/queue", { cache: "no-store" });
    const result = (await response.json()) as QueueResult;
    if (!response.ok || !result.success) {
      throw new Error(result.message || "Unable to load KYC review queue.");
    }
    setApplications(result.applications || []);
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace("/login");
          return;
        }
        const { data: effectiveRole, error: roleError } = await (supabase as any).rpc("current_effective_app_role");
        const role = String(effectiveRole ?? "").toUpperCase();
        if (roleError || !["ADMIN", "COO"].includes(role)) {
          router.replace("/login");
          return;
        }
        await loadQueue();
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Unable to open KYC review.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void initialize();
    return () => { active = false; };
  }, [loadQueue, router]);

  async function openDocuments(application: KycApplication) {
    setSelected(application);
    setDocuments([]);
    setNotes("");
    setError("");
    setNotice("");
    setLoadingDocuments(true);
    try {
      const params = new URLSearchParams({ source: application.source, id: application.id });
      const response = await fetch(`/api/admin/vendor-kyc/documents?${params.toString()}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to open documents.");
      setDocuments(result.documents || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open documents.");
    } finally {
      setLoadingDocuments(false);
    }
  }

  async function recordDecision(decision: "approved" | "rejected") {
    if (!selected || savingDecision) return;
    const verb = decision === "approved" ? "approve" : "reject";
    if (!window.confirm(`Confirm KYC ${verb} for ${selected.displayName}? This will not approve or reject the vendor business application.`)) return;
    setSavingDecision(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/vendor-kyc/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: selected.source, id: selected.id, decision, notes }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Could not save the KYC decision.");
      setNotice(`KYC ${decision} recorded for ${selected.displayName}.`);
      setSelected(null);
      setDocuments([]);
      setNotes("");
      await loadQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the KYC decision.");
    } finally {
      setSavingDecision(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-900 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-orange-600">Mammy Kitchen Hub · Admin</p>
            <h1 className="mt-1 text-3xl font-bold">Vendor KYC Review</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">Review identity and business documents before recording a KYC decision. This review does not change the vendor's business approval status.</p>
          </div>
          <button onClick={() => router.push("/admin-dashboard")} className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold hover:bg-slate-100">Back to Admin Dashboard</button>
        </header>

        {notice && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">{notice}</p>}
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Pending review</h2>
            <button disabled={loading} onClick={() => { setLoading(true); void loadQueue().catch((e) => setError(e instanceof Error ? e.message : "Refresh failed.")).finally(() => setLoading(false)); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50">Refresh</button>
          </div>

          {loading ? <p className="py-8 text-slate-500">Loading review queue…</p> : applications.length === 0 ? <p className="py-8 text-slate-500">No pending KYC reviews.</p> : (
            <div className="divide-y divide-slate-100">
              {applications.map((application) => (
                <article key={`${application.source}:${application.id}`} className="flex flex-col justify-between gap-4 py-4 md:flex-row md:items-center">
                  <div className="min-w-0">
                    <h3 className="font-bold">{application.displayName}</h3>
                    <p className="text-sm text-slate-600">{application.email || "Email not recorded"}{application.vendorType ? ` · ${application.vendorType}` : ""}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800">{application.kycStatus}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{application.source === "application" ? "Onboarding application" : "Vendor KYC submission"}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{Object.values(application.documentAvailability).filter(Boolean).length} document(s) recorded</span>
                    </div>
                  </div>
                  <button onClick={() => void openDocuments(application)} className="shrink-0 rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-700">Review documents</button>
                </article>
              ))}
            </div>
          )}
        </section>

        {selected && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-orange-600">Selected record</p>
                <h2 className="mt-1 text-2xl font-bold">{selected.displayName}</h2>
                <p className="text-sm text-slate-600">{selected.email || "Email not recorded"}</p>
              </div>
              <button onClick={() => { setSelected(null); setDocuments([]); setNotes(""); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Close review</button>
            </div>

            <div className="mt-5">
              <h3 className="font-bold">Submitted documents</h3>
              {loadingDocuments ? <p className="py-4 text-slate-500">Preparing secure, time-limited links…</p> : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {documents.map((document) => (
                    <div key={document.key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                      <div>
                        <p className="font-semibold">{document.label}</p>
                        <p className="text-xs text-slate-500">{document.url ? "Secure link expires in 5 minutes" : "Not available for this record"}</p>
                      </div>
                      {document.url && <a href={document.url} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Open</a>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label className="mt-6 block text-sm font-semibold" htmlFor="kyc-review-notes">Review notes (optional)</label>
            <textarea id="kyc-review-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} rows={3} placeholder="Record the reason for rejection or any review observations…" className="mt-2 w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-orange-500" />
            <p className="mt-2 text-xs text-slate-500">Approving KYC records only the verification decision. It does not activate a vendor or change a separate business application decision.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button disabled={savingDecision || loadingDocuments} onClick={() => void recordDecision("approved")} className="rounded-xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-50">Approve KYC</button>
              <button disabled={savingDecision || loadingDocuments} onClick={() => void recordDecision("rejected")} className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50">Reject KYC</button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
