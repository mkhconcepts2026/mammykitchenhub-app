"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, FileText, LoaderCircle, RefreshCw, ShieldCheck, Store, X } from "lucide-react";

type Agreement = {
  id: string;
  agreement_version: number;
  agreement_type: "percentage" | "full_sales" | string;
  commission_rate: number | string;
  policy_version: number;
  status: string;
  offered_at: string;
  accepted_at: string | null;
  effective_from: string | null;
  effective_to: string | null;
  terms_snapshot: Record<string, unknown> | null;
};

type PageData = {
  vendor: { id: string; name: string; status: string };
  commissionEnforcementEnabled: boolean;
  currentPolicyVersion: number | null;
  agreements: Agreement[];
};

type PendingAction = { action: "accept" | "decline"; agreement: Agreement } | null;

const moneyPercent = (value: number | string) => {
  const rate = Number(value);
  return `${Number.isFinite(rate) ? (rate * 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}%`;
};

const dateTime = (value?: string | null) => {
  if (!value) return "When the vendor accepts";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not specified"
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

const statusStyle = (status: string) => {
  switch (status.toLowerCase()) {
    case "offered": return "border-amber-200 bg-amber-50 text-amber-800";
    case "accepted": return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "declined": return "border-rose-200 bg-rose-50 text-rose-800";
    case "expired": return "border-slate-200 bg-slate-100 text-slate-600";
    case "superseded": return "border-slate-200 bg-slate-100 text-slate-600";
    case "revoked": return "border-rose-200 bg-rose-50 text-rose-800";
    default: return "border-slate-200 bg-slate-100 text-slate-700";
  }
};

export default function VendorCommissionAgreementsPage() {
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [acceptedAcknowledgement, setAcceptedAcknowledgement] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadPage = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setPageError("");
    try {
      const response = await fetch("/api/vendor/commission-agreements", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Unable to load commission agreements.");
      }
      setPageData(result as PageData);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to load commission agreements.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadPage(); }, [loadPage]);

  const closeConfirmation = () => {
    if (submitting) return;
    setPendingAction(null);
    setAcceptedAcknowledgement(false);
    setDeclineReason("");
    setActionError("");
  };

  const submitAction = async () => {
    if (!pendingAction) return;
    if (pendingAction.action === "accept" && !acceptedAcknowledgement) {
      setActionError("Please confirm that you have reviewed and agree to the offer summary.");
      return;
    }
    if (pendingAction.action === "decline" && declineReason.trim().length < 5) {
      setActionError("Please provide a decline reason of at least five characters.");
      return;
    }

    setSubmitting(true);
    setActionError("");
    setSuccessMessage("");
    try {
      const response = await fetch("/api/vendor/commission-agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: pendingAction.action,
          agreementId: pendingAction.agreement.id,
          reason: declineReason.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "The requested action could not be completed.");
      }
      setPendingAction(null);
      setAcceptedAcknowledgement(false);
      setDeclineReason("");
      setSuccessMessage(
        pendingAction.action === "accept"
          ? "The offer was accepted and recorded. Commission enforcement remains controlled separately by MKH."
          : "The offer was declined and the reason was recorded for audit."
      );
      await loadPage(true);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The requested action could not be completed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#eef2f7] p-5 text-[#0b1220] md:p-8">
        <div className="mx-auto flex max-w-5xl items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <LoaderCircle className="animate-spin text-[#ff6b00]" />
          <span className="font-semibold">Loading your commission agreements…</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#eef2f7] px-4 py-6 text-[#0b1220] md:px-8 md:py-9">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="mb-2">
          <a data-mkh-vendor-dashboard-back="true" href="/vendor-dashboard-v2" className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-[#ff6b00] hover:text-[#ff6b00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b00]" aria-label="Back to Vendor Dashboard">
            <span aria-hidden="true">&#8592;</span> Back to Vendor Dashboard
          </a>
        </div>
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#ff6b00]">Mammy Kitchen Hub · Vendor Workspace</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">Commission Agreements</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Review commission offers issued for your vendor account. Nothing is accepted until you explicitly confirm the terms.</p>
          </div>
          <button type="button" onClick={() => void loadPage(true)} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </header>

        {pageError && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <AlertTriangle className="mt-0.5 shrink-0" size={19} />
            <div><p className="font-bold">Unable to load your agreements</p><p className="mt-1">{pageError}</p></div>
          </div>
        )}

        {pageData && (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#ff6b00]"><Store size={23} /></div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Vendor account</p>
                    <h2 className="mt-1 text-lg font-extrabold">{pageData.vendor.name || "Your vendor"}</h2>
                    <p className="mt-0.5 text-xs text-slate-500">Agreement decisions apply only to this linked vendor.</p>
                  </div>
                </div>
                <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-2 text-xs font-extrabold ${pageData.commissionEnforcementEnabled ? "border-amber-300 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
                  <ShieldCheck size={15} /> Commission enforcement {pageData.commissionEnforcementEnabled ? "enabled" : "OFF"}
                </span>
              </div>
              {!pageData.commissionEnforcementEnabled && (
                <p className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-sm leading-6 text-emerald-900">Accepting an offer records your agreement to the displayed terms. It does not turn on platform-wide commission enforcement, initiate settlement, or move funds.</p>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div><h2 className="text-xl font-extrabold">Your offers and agreement history</h2><p className="mt-1 text-sm text-slate-600">Most recent first · up to 50 records</p></div>
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm">{pageData.agreements.length} record{pageData.agreements.length === 1 ? "" : "s"}</span>
              </div>

              {pageData.agreements.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                  <FileText className="mx-auto text-slate-400" size={30} />
                  <h3 className="mt-3 text-lg font-bold">No commission offers yet</h3>
                  <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-slate-600">When MKH issues a commission offer for your vendor account, it will appear here for review.</p>
                </div>
              ) : pageData.agreements.map((agreement) => {
                const isOffered = agreement.status.toLowerCase() === "offered";
                const isFullSales = agreement.agreement_type === "full_sales";
                const snapshot = agreement.terms_snapshot ?? {};
                const reason = typeof snapshot.reason === "string" ? snapshot.reason : "No additional reason was recorded.";
                const allowedRates = Array.isArray(snapshot.allowed_rates)
                  ? snapshot.allowed_rates.map((rate) => moneyPercent(String(rate))).join(", ")
                  : "Not recorded in this offer snapshot";
                return (
                  <article key={agreement.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-start sm:justify-between md:p-6">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-extrabold">Commission offer · Version {agreement.agreement_version}</h3>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide ${statusStyle(agreement.status)}`}>{agreement.status}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">Offered {dateTime(agreement.offered_at)} · Policy v{agreement.policy_version}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-4 py-3 sm:min-w-44 sm:text-right">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Offered terms</p>
                        <p className="mt-1 text-2xl font-black text-[#0b1220]">{isFullSales ? "0%" : moneyPercent(agreement.commission_rate)}</p>
                        <p className="text-xs font-semibold text-slate-600">{isFullSales ? "Full-sales arrangement" : "Food-sales commission"}</p>
                      </div>
                    </div>
                    <div className="grid gap-4 p-5 sm:grid-cols-2 md:p-6">
                      <div className="space-y-1"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Effective from</p><p className="text-sm font-semibold">{dateTime(agreement.effective_from)}</p></div>
                      <div className="space-y-1"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Offer expires / ends</p><p className="text-sm font-semibold">{agreement.effective_to ? dateTime(agreement.effective_to) : "No end date recorded"}</p></div>
                      <div className="space-y-1 sm:col-span-2"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Reason recorded by MKH</p><p className="text-sm leading-6 text-slate-700">{reason}</p></div>
                      {!isFullSales && (
                        <div className="space-y-1 sm:col-span-2"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Rates allowed under this policy snapshot</p><p className="text-sm leading-6 text-slate-700">{allowedRates}</p></div>
                      )}
                      {agreement.accepted_at && <div className="space-y-1 sm:col-span-2"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Accepted on</p><p className="text-sm font-semibold text-emerald-900">{dateTime(agreement.accepted_at)}</p></div>}
                    </div>
                    {isOffered && (
                      <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 p-5 sm:flex-row sm:items-center sm:justify-between md:px-6">
                        <p className="max-w-xl text-xs leading-5 text-slate-600">Review the displayed rate, effective timing, and any separate vendor terms supplied by MKH before making a decision.</p>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => { setActionError(""); setAcceptedAcknowledgement(false); setPendingAction({ action: "decline", agreement }); }} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100">Decline offer</button>
                          <button type="button" onClick={() => { setActionError(""); setAcceptedAcknowledgement(false); setPendingAction({ action: "accept", agreement }); }} className="rounded-xl bg-[#ff6b00] px-4 py-2.5 text-sm font-extrabold text-white shadow-sm hover:bg-[#e65f00]">Review & accept</button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </section>

            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              <AlertTriangle size={19} className="mt-0.5 shrink-0" />
              <div><p className="font-bold">Before accepting</p><p>This screen displays the structured offer details stored by MKH. If a separate signed agreement or fuller terms document was supplied to your business, review it too and ask MKH to clarify any uncertainty before accepting. Your decision is recorded in the commission audit history.</p></div>
            </div>
            {successMessage && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">{successMessage}</div>}
          </>
        )}
      </div>

      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="commission-confirm-title" className="w-full max-w-xl rounded-3xl border border-white/70 bg-white p-5 shadow-2xl sm:p-7">
            <div className="flex items-start gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${pendingAction.action === "accept" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {pendingAction.action === "accept" ? <CheckCircle2 size={23} /> : <AlertTriangle size={23} />}
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="commission-confirm-title" className="text-xl font-black">{pendingAction.action === "accept" ? "Confirm commission agreement" : "Confirm decline of offer"}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {pendingAction.action === "accept"
                    ? `You are about to accept ${pendingAction.agreement.agreement_type === "full_sales" ? "the explicit 0% full-sales arrangement" : `${moneyPercent(pendingAction.agreement.commission_rate)} food-sales commission`} for agreement version ${pendingAction.agreement.agreement_version}. This action will be recorded against your signed-in vendor profile and added to the audit history.`
                    : `You are about to decline commission offer version ${pendingAction.agreement.agreement_version}. Your reason will be stored in the audit history.`}
                </p>
              </div>
              <button type="button" onClick={closeConfirmation} disabled={submitting} aria-label="Close confirmation" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X size={19} /></button>
            </div>

            {pendingAction.action === "accept" ? (
              <label className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800">
                <input type="checkbox" checked={acceptedAcknowledgement} onChange={(event) => setAcceptedAcknowledgement(event.target.checked)} className="mt-1 h-4 w-4 accent-[#ff6b00]" />
                <span>I have reviewed the commission rate and offer details displayed above, and I agree to this offer.</span>
              </label>
            ) : (
              <div className="mt-5 space-y-2">
                <label htmlFor="decline-reason" className="block text-sm font-bold text-slate-800">Reason for declining (required)</label>
                <textarea id="decline-reason" value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} rows={3} maxLength={1000} placeholder="Briefly explain why this offer is not accepted…" className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-[#ff6b00] focus:ring-2 focus:ring-orange-100" />
                <p className="text-xs text-slate-500">Enter at least five characters. This reason is retained for audit.</p>
              </div>
            )}

            {actionError && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{actionError}</p>}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeConfirmation} disabled={submitting} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Cancel</button>
              <button type="button" onClick={closeConfirmation} disabled={submitting} className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-60">No, go back</button>
              <button type="button" onClick={() => void submitAction()} disabled={submitting || (pendingAction.action === "accept" && !acceptedAcknowledgement) || (pendingAction.action === "decline" && declineReason.trim().length < 5)} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50 ${pendingAction.action === "accept" ? "bg-[#ff6b00] hover:bg-[#e65f00]" : "bg-rose-600 hover:bg-rose-700"}`}>
                {submitting && <LoaderCircle className="animate-spin" size={16} />}
                {pendingAction.action === "accept" ? "Yes, accept offer" : "Yes, decline offer"}
              </button>
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs leading-5 text-slate-500"><Clock3 size={14} /> This decision changes the offer record, not the platform-wide commission enforcement setting.</p>
          </section>
        </div>
      )}
    </main>
  );
}
