"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  History,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Store,
} from "lucide-react";

type Settings = {
  id: boolean;
  commission_enforcement_enabled: boolean;
  minimum_rate: number | string;
  maximum_rate: number | string;
  allowed_rates: (number | string)[];
  policy_version: number;
  updated_at: string;
};

type Vendor = { id: string; name: string | null; email: string | null; status: string | null };
type Agreement = {
  id: string;
  vendor_id: string;
  agreement_version: number;
  agreement_type: "percentage" | "full_sales";
  commission_rate: number | string;
  policy_version: number;
  status: string;
  offered_at: string;
  accepted_at: string | null;
  effective_from: string | null;
  effective_to: string | null;
  terms_snapshot?: Record<string, unknown> | null;
};
type Rollout = { vendor_id: string; rollout_mode: string; reason: string; updated_at: string };
type Audit = {
  id: number;
  vendor_id: string | null;
  agreement_id: string | null;
  action: string;
  reason: string | null;
  created_at: string;
  before_state?: Record<string, unknown> | null;
  after_state?: Record<string, unknown> | null;
};
type PageData = {
  settings: Settings;
  activeVendorCount: number;
  offeredCount: number;
  acceptedCount: number;
  audit: Audit[];
  auditVendors: Vendor[];
  warnings?: string[];
};
type VendorPageData = {
  vendors: Vendor[];
  agreements: Agreement[];
  rollout: Rollout[];
  totalCount: number;
  page: number;
  pageSize: number;
  queryTooShort?: boolean;
  warnings?: string[];
};
type Confirmation =
  | { kind: "policy"; title: string; body: string }
  | { kind: "offer"; title: string; body: string };

const RATE_CHOICES = [5, 6, 7, 8, 9, 10];
const VENDOR_PAGE_SIZE = 20;

function percent(value: number | string | null | undefined): string {
  const number = Number(value ?? 0);
  return `${Number.isFinite(number) ? (number * 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0"}%`;
}

function moneyRate(value: number | string | null | undefined): string {
  return Number(value ?? 0).toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function niceDate(value: string | null | undefined): string {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not set"
    : date.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

function readable(value: string | null | undefined): string {
  return String(value ?? "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StatusPill({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const styles = normalized === "accepted" || normalized === "commission_active"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : normalized === "offered" || normalized === "agreement_required"
      ? "bg-amber-50 text-amber-800 ring-amber-200"
      : normalized === "legacy_zero"
        ? "bg-slate-100 text-slate-700 ring-slate-200"
        : "bg-slate-50 text-slate-600 ring-slate-200";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles}`}>{readable(value)}</span>;
}

export default function VendorCommissionSettings() {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [offering, setOffering] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [policyRates, setPolicyRates] = useState<number[]>(RATE_CHOICES);
  const [policyReason, setPolicyReason] = useState("");
  const [offerVendorId, setOfferVendorId] = useState("");
  const [selectedOfferVendor, setSelectedOfferVendor] = useState<Vendor | null>(null);
  const [offerVendorQuery, setOfferVendorQuery] = useState("");
  const [offerVendorPage, setOfferVendorPage] = useState(1);
  const [offerVendorResults, setOfferVendorResults] = useState<VendorPageData | null>(null);
  const [offerPickerOpen, setOfferPickerOpen] = useState(false);
  const [searchingOfferVendors, setSearchingOfferVendors] = useState(false);
  const [statusQuery, setStatusQuery] = useState("");
  const [statusPage, setStatusPage] = useState(1);
  const [statusResult, setStatusResult] = useState<VendorPageData | null>(null);
  const [loadingStatusVendors, setLoadingStatusVendors] = useState(false);
  const [vendorRefreshKey, setVendorRefreshKey] = useState(0);
  const [agreementType, setAgreementType] = useState<"percentage" | "full_sales">("percentage");
  const [offerRate, setOfferRate] = useState(10);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [offerReason, setOfferReason] = useState("");
  const [auditExpanded, setAuditExpanded] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/vendor-commission", {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Could not load vendor commission settings.");
      }
      const nextData = payload as PageData & { success: boolean };
      setData(nextData);
      const configured = (nextData.settings.allowed_rates ?? [])
        .map((rate) => Math.round(Number(rate) * 100))
        .filter((rate) => RATE_CHOICES.includes(rate));
      setPolicyRates(configured.length ? configured : RATE_CHOICES);
      setOfferRate((old) => {
        const allowed = configured.length ? configured : RATE_CHOICES;
        return allowed.includes(old) ? old : allowed[allowed.length - 1];
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load vendor commission settings.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const requestVendorPage = useCallback(async (query: string, page: number, activeOnly: boolean) => {
    const params = new URLSearchParams({ view: "vendors", page: String(page), activeOnly: String(activeOnly) });
    if (query.trim()) params.set("q", query.trim());
    const response = await fetch(`/api/admin/vendor-commission?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || "Vendor search failed. Please try again.");
    }
    return payload as VendorPageData & { success: boolean };
  }, []);

  useEffect(() => {
    const query = offerVendorQuery.trim();
    if (!offerPickerOpen || query.length < 2) {
      setOfferVendorResults(null);
      setSearchingOfferVendors(false);
      return;
    }
    let cancelled = false;
    setSearchingOfferVendors(true);
    setOfferVendorResults(null);
    const timer = window.setTimeout(async () => {
      try {
        const result = await requestVendorPage(query, offerVendorPage, true);
        if (!cancelled) setOfferVendorResults(result);
      } catch (searchError) {
        if (!cancelled) setError(searchError instanceof Error ? searchError.message : "Vendor search failed.");
      } finally {
        if (!cancelled) setSearchingOfferVendors(false);
      }
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [offerVendorQuery, offerVendorPage, offerPickerOpen, requestVendorPage]);

  useEffect(() => {
    const query = statusQuery.trim();
    if (query.length === 1) {
      setStatusResult({ vendors: [], agreements: [], rollout: [], totalCount: 0, page: 1, pageSize: VENDOR_PAGE_SIZE, queryTooShort: true });
      setLoadingStatusVendors(false);
      return;
    }
    let cancelled = false;
    setLoadingStatusVendors(true);
    setStatusResult(null);
    const timer = window.setTimeout(async () => {
      try {
        const result = await requestVendorPage(query, statusPage, false);
        if (!cancelled) setStatusResult(result);
      } catch (searchError) {
        if (!cancelled) setError(searchError instanceof Error ? searchError.message : "Vendor list could not be loaded.");
      } finally {
        if (!cancelled) setLoadingStatusVendors(false);
      }
    }, 200);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [statusQuery, statusPage, vendorRefreshKey, requestVendorPage]);

  const vendorsById = useMemo(() => {
    const vendors = [
      ...(data?.auditVendors ?? []),
      ...(statusResult?.vendors ?? []),
      ...(offerVendorResults?.vendors ?? []),
      ...(selectedOfferVendor ? [selectedOfferVendor] : []),
    ];
    return new Map(vendors.map((vendor) => [vendor.id, vendor]));
  }, [data?.auditVendors, statusResult?.vendors, offerVendorResults?.vendors, selectedOfferVendor]);
  const rolloutByVendor = useMemo(() => {
    return new Map((statusResult?.rollout ?? []).map((entry) => [entry.vendor_id, entry]));
  }, [statusResult?.rollout]);

  const requestJson = async (body: Record<string, unknown>) => {
    const response = await fetch("/api/admin/vendor-commission", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || "The requested vendor commission action failed.");
    }
    return payload;
  };

  const openPolicyConfirmation = () => {
    setError("");
    setNotice("");
    if (policyRates.length === 0) {
      setError("Select at least one permitted percentage rate.");
      return;
    }
    if (policyReason.trim().length < 5) {
      setError("Enter a reason for the policy change (at least five characters).");
      return;
    }
    setConfirmation({
      kind: "policy",
      title: "Are you sure you want to save the commission policy?",
      body: `This will create policy version ${(data?.settings.policy_version ?? 0) + 1} with allowed rates ${policyRates.slice().sort((a, b) => a - b).map((rate) => `${rate}%`).join(", ")}. It will not enable commission enforcement or change already offered/accepted vendor terms.`,
    });
  };

  const openOfferConfirmation = () => {
    setError("");
    setNotice("");
    if (!offerVendorId || !selectedOfferVendor || selectedOfferVendor.id !== offerVendorId) {
      setError("Search for and select an active vendor before creating an offer.");
      return;
    }
    if (offerReason.trim().length < 5) {
      setError("Enter a meaningful reason for the vendor commission offer (at least five characters).");
      return;
    }
    if (agreementType === "percentage" && !(data?.settings.allowed_rates ?? []).map((rate) => Math.round(Number(rate) * 100)).includes(offerRate)) {
      setError("The selected rate is not in the current allowed-rate policy. Refresh or update the policy first.");
      return;
    }
    const vendorName = selectedOfferVendor?.name || selectedOfferVendor?.email || "the selected vendor";
    const terms = agreementType === "full_sales" ? "0% commission (full-sales arrangement)" : `${offerRate}% commission`;
    setConfirmation({
      kind: "offer",
      title: "Are you sure you want to send this vendor offer?",
      body: `An auditable offer for ${terms} will be created for ${vendorName}. The offer will not become effective until the vendor explicitly accepts it. Global commission enforcement will remain OFF.`,
    });
  };

  const confirmAction = async () => {
    const current = confirmation;
    if (!current) return;
    setConfirmation(null);
    setError("");
    setNotice("");

    if (current.kind === "policy") {
      setSavingPolicy(true);
      try {
        await requestJson({
          action: "update_policy",
          allowedPercentages: policyRates.slice().sort((a, b) => a - b),
          reason: policyReason.trim(),
        });
        setNotice("Vendor commission policy saved. Global enforcement remains OFF.");
        setPolicyReason("");
        await load(true);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Policy update failed.");
      } finally {
        setSavingPolicy(false);
      }
      return;
    }

    setOffering(true);
    try {
      const payload = await requestJson({
        action: "offer_agreement",
        vendorId: offerVendorId,
        agreementType,
        ratePercent: agreementType === "full_sales" ? 0 : offerRate,
        effectiveFrom: effectiveFrom || null,
        reason: offerReason.trim(),
      });
      setNotice(`Vendor offer created successfully. Agreement reference: ${payload.agreementId}`);
      setOfferReason("");
      await load(true);
      setVendorRefreshKey((value) => value + 1);
    } catch (offerError) {
      setError(offerError instanceof Error ? offerError.message : "Vendor offer could not be created.");
    } finally {
      setOffering(false);
    }
  };

  if (loading) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">Loading vendor commission settings…</div>;
  }

  if (!data) {
    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
          <h2 className="font-bold">Vendor commission settings unavailable</h2>
          <p className="mt-1 text-sm">{error || "The vendor commission data could not be loaded."}</p>
          <button onClick={() => void load()} className="mt-4 rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white">Retry</button>
        </div>
      </section>
    );
  }

  const activePolicyRates = (data.settings.allowed_rates ?? []).map((rate) => Math.round(Number(rate) * 100));
  const currentMin = percent(data.settings.minimum_rate);
  const currentMax = percent(data.settings.maximum_rate);

  return (
    <section className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Commercial settings</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Vendor Commission & Adjustments</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">Maintain the allowed sales-commission rates and issue versioned offers to individual vendors. Offers require explicit vendor acceptance.</p>
        </div>
        <button onClick={() => { void load(true); setVendorRefreshKey((value) => value + 1); }} disabled={refreshing} className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
        <ShieldCheck className="mt-0.5 shrink-0" size={22} />
        <div>
          <p className="font-bold">Global commission enforcement is OFF</p>
          <p className="mt-1 text-sm leading-6">This screen does not contain an enable switch. Saving a policy or creating an offer does not turn commission deductions on. Do not enable enforcement until vendor acceptance UI, checkout/discount integration, and settlement/reporting tests are complete.</p>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{notice}</div>}
      {data.warnings?.map((warning) => <div key={warning} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{warning}</div>)}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<SlidersHorizontal size={19} />} label="Policy version" value={`v${data.settings.policy_version}`} detail={`${currentMin}–${currentMax} currently permitted`} />
        <MetricCard icon={<Store size={19} />} label="Active vendors" value={String(data.activeVendorCount)} detail="Eligible for new offers · searched on demand" />
        <MetricCard icon={<Clock3 size={19} />} label="Offers awaiting acceptance" value={String(data.offeredCount)} detail="Not effective yet" />
        <MetricCard icon={<BadgeCheck size={19} />} label="Accepted agreement records" value={String(data.acceptedCount)} detail="Review effective dates per vendor" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-orange-50 p-3 text-orange-700"><SlidersHorizontal size={21} /></div>
            <div>
              <h3 className="text-lg font-bold text-slate-950">Allowed commission policy</h3>
              <p className="mt-1 text-sm text-slate-600">Policy changes only affect future offers. Existing agreement terms are not silently rewritten.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {RATE_CHOICES.map((rate) => {
              const checked = policyRates.includes(rate);
              return (
                <label key={rate} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${checked ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                  <input type="checkbox" checked={checked} onChange={(event) => setPolicyRates((current) => event.target.checked ? [...new Set([...current, rate])].sort((a, b) => a - b) : current.filter((entry) => entry !== rate))} className="h-4 w-4 accent-orange-600" />
                  <span className="text-sm font-semibold text-slate-800">{rate}% commission</span>
                  {activePolicyRates.includes(rate) && <span className="ml-auto text-[11px] font-semibold text-emerald-700">Current</span>}
                </label>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-500">Select at least one rate. The minimum and maximum are derived from your selected rates. Full-sales agreements at 0% are a separate explicit vendor agreement type.</p>
          <label className="mt-5 block text-sm font-semibold text-slate-800">Reason for policy change
            <textarea value={policyReason} onChange={(event) => setPolicyReason(event.target.value)} maxLength={500} rows={3} placeholder="Explain why the permitted commission rates are changing…" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100" />
          </label>
          <button type="button" disabled={savingPolicy || policyRates.length === 0} onClick={openPolicyConfirmation} className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50">
            {savingPolicy ? "Saving policy…" : "Review & Save Policy"}
          </button>
          <p className="mt-3 text-xs text-slate-500">Last updated: {niceDate(data.settings.updated_at)}. Current policy version: {data.settings.policy_version}.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-sky-50 p-3 text-sky-700"><FileText size={21} /></div>
            <div>
              <h3 className="text-lg font-bold text-slate-950">Offer a commission agreement</h3>
              <p className="mt-1 text-sm text-slate-600">This creates an auditable offer; it does not apply a commission until the vendor explicitly accepts and the terms become effective.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="relative text-sm font-semibold text-slate-800">
              <label htmlFor="vendor-commission-search" className="block">Find active vendor</label>
              <div className="relative mt-2">
                <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="vendor-commission-search"
                  type="search"
                  value={offerVendorQuery}
                  autoComplete="off"
                  onFocus={() => setOfferPickerOpen(true)}
                  onChange={(event) => {
                    setOfferVendorQuery(event.target.value);
                    setOfferVendorId("");
                    setSelectedOfferVendor(null);
                    setOfferVendorResults(null);
                    setOfferVendorPage(1);
                    setOfferPickerOpen(true);
                  }}
                  placeholder="Type vendor name or email, e.g. ma or Mama's Kitchen"
                  aria-expanded={offerPickerOpen && offerVendorQuery.trim().length >= 2}
                  aria-controls="vendor-commission-search-results"
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
              </div>
              <p className="mt-1.5 text-xs font-normal leading-5 text-slate-500">Search matches by vendor name or email. Type at least two characters; results are fetched from the server 20 at a time, not loaded as a 5,000-item dropdown.</p>
              {selectedOfferVendor && !offerPickerOpen && offerVendorId && (
                <div className="mt-2 flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <div><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Selected active vendor</p><p className="mt-1 font-bold text-slate-900">{selectedOfferVendor.name || "Unnamed vendor"}</p><p className="mt-0.5 text-xs font-normal text-slate-600">{selectedOfferVendor.email || "No email on record"}</p></div>
                  <button type="button" onClick={() => { setOfferVendorId(""); setSelectedOfferVendor(null); setOfferVendorQuery(""); setOfferPickerOpen(true); setOfferVendorPage(1); }} className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-emerald-100">Change</button>
                </div>
              )}
              {offerPickerOpen && offerVendorQuery.trim().length < 2 && (
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-normal text-slate-600">Enter at least two characters to search active vendors.</div>
              )}
              {offerPickerOpen && offerVendorQuery.trim().length >= 2 && (
                <div id="vendor-commission-search-results" className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  {searchingOfferVendors ? <p className="p-4 text-sm font-normal text-slate-500">Searching active vendors…</p> : (
                    <>
                      <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-normal text-slate-600">{offerVendorResults ? `${offerVendorResults.totalCount.toLocaleString()} matching active vendor(s)` : "Search results"}{offerVendorResults && offerVendorResults.totalCount > offerVendorResults.pageSize ? ` · showing page ${offerVendorResults.page}` : ""}</div>
                      <div className="max-h-64 overflow-y-auto">
                        {(offerVendorResults?.vendors ?? []).map((vendor) => (
                          <button key={vendor.id} type="button" onClick={() => { setOfferVendorId(vendor.id); setSelectedOfferVendor(vendor); setOfferVendorQuery(vendor.name || vendor.email || ""); setOfferPickerOpen(false); setOfferVendorResults(null); }} className="flex w-full items-start justify-between gap-3 border-b border-slate-100 px-3 py-3 text-left last:border-0 hover:bg-orange-50 focus:bg-orange-50 focus:outline-none">
                            <span><span className="block font-semibold text-slate-900">{vendor.name || "Unnamed vendor"}</span><span className="mt-0.5 block text-xs font-normal text-slate-500">{vendor.email || "No email on record"}</span></span><span className="mt-0.5 shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">Active</span>
                          </button>
                        ))}
                        {!offerVendorResults?.vendors.length && <p className="p-4 text-sm font-normal text-slate-500">No active vendors match this search. Try another part of the name or email.</p>}
                      </div>
                      {offerVendorResults && offerVendorResults.totalCount > offerVendorResults.pageSize && (
                        <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
                          <button type="button" disabled={offerVendorPage <= 1 || searchingOfferVendors} onClick={() => setOfferVendorPage((page) => Math.max(1, page - 1))} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40"><ChevronLeft size={14} /> Previous</button>
                          <span className="text-xs font-normal text-slate-500">Page {offerVendorResults.page} of {Math.max(1, Math.ceil(offerVendorResults.totalCount / offerVendorResults.pageSize))}</span>
                          <button type="button" disabled={offerVendorResults.page >= Math.ceil(offerVendorResults.totalCount / offerVendorResults.pageSize) || searchingOfferVendors} onClick={() => setOfferVendorPage((page) => page + 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40">Next <ChevronRight size={14} /></button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            <label className="block text-sm font-semibold text-slate-800">Agreement type
              <select value={agreementType} onChange={(event) => setAgreementType(event.target.value as "percentage" | "full_sales")} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100">
                <option value="percentage">Percentage commission</option>
                <option value="full_sales">Full-sales arrangement — 0%</option>
              </select>
            </label>
            {agreementType === "percentage" ? (
              <label className="block text-sm font-semibold text-slate-800">Commission rate
                <select value={offerRate} onChange={(event) => setOfferRate(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100">
                  {activePolicyRates.map((rate) => <option key={rate} value={rate}>{rate}%</option>)}
                </select>
              </label>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Explicit 0% commission: vendor keeps all eligible food-sales proceeds under this agreement type. This is not the same as a missing or unaccepted agreement.</div>
            )}
            <label className="block text-sm font-semibold text-slate-800">Optional effective date
              <input type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" />
              <span className="mt-1 block text-xs font-normal text-slate-500">Leave blank to use the default effective timing when the vendor accepts.</span>
            </label>
            <label className="block text-sm font-semibold text-slate-800">Reason / agreement note
              <textarea value={offerReason} onChange={(event) => setOfferReason(event.target.value)} maxLength={500} rows={3} placeholder="e.g. New signed vendor commission terms; reference the agreement…" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100" />
            </label>
            <button type="button" disabled={offering || !offerVendorId || (agreementType === "percentage" && activePolicyRates.length === 0)} onClick={openOfferConfirmation} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
              {offering ? "Creating offer…" : "Review & Offer to Vendor"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-50 p-3 text-violet-700"><Building2 size={21} /></div>
          <div>
            <h3 className="text-lg font-bold text-slate-950">Vendor commission status</h3>
            <p className="mt-1 text-sm text-slate-600">Offers and accepted terms are tracked per vendor. No active agreement is inferred from a missing rate.</p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="block w-full max-w-xl text-sm font-semibold text-slate-800">Search vendor commission status
            <div className="relative mt-2"><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="search" value={statusQuery} onChange={(event) => { setStatusQuery(event.target.value); setStatusPage(1); }} placeholder="Type at least two characters: vendor name or email" className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></div>
          </label>
          <p className="text-xs text-slate-500">20 vendors per page · server-side search</p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="py-3 pr-4">Vendor</th><th className="py-3 pr-4">Vendor status</th><th className="py-3 pr-4">Rollout classification</th><th className="py-3 pr-4">Latest offer / agreement</th><th className="py-3 pr-4">Rate</th><th className="py-3 pr-4">Agreement status</th><th className="py-3 pr-4">Effective from</th></tr></thead>
            <tbody>
              {(statusResult?.vendors ?? []).map((vendor) => {
                const latestAgreement = (statusResult?.agreements ?? []).find((agreement) => agreement.vendor_id === vendor.id);
                const rollout = rolloutByVendor.get(vendor.id);
                return <tr key={vendor.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 pr-4"><div className="font-semibold text-slate-900">{vendor.name || "Unnamed vendor"}</div><div className="mt-0.5 text-xs text-slate-500">{vendor.email || "No email on record"}</div></td>
                  <td className="py-3 pr-4"><StatusPill value={vendor.status || "unknown"} /></td>
                  <td className="py-3 pr-4"><StatusPill value={rollout?.rollout_mode || "not_classified"} /></td>
                  <td className="py-3 pr-4">{latestAgreement ? `v${latestAgreement.agreement_version} · ${latestAgreement.agreement_type === "full_sales" ? "Full sales" : "Percentage"}` : <span className="text-slate-400">No agreement</span>}</td>
                  <td className="py-3 pr-4 font-semibold">{latestAgreement ? percent(latestAgreement.commission_rate) : "—"}</td>
                  <td className="py-3 pr-4">{latestAgreement ? <StatusPill value={latestAgreement.status} /> : <StatusPill value="no_agreement" />}</td>
                  <td className="py-3 pr-4 text-slate-600">{latestAgreement ? niceDate(latestAgreement.effective_from) : "—"}</td>
                </tr>;
              })}
              {loadingStatusVendors && <tr><td colSpan={7} className="py-8 text-center text-slate-500">Searching vendors…</td></tr>}
              {!loadingStatusVendors && statusResult?.queryTooShort && <tr><td colSpan={7} className="py-8 text-center text-slate-500">Type at least two characters to search, or clear the search to browse all vendors.</td></tr>}
              {!loadingStatusVendors && !statusResult?.queryTooShort && (statusResult?.vendors.length ?? 0) === 0 && <tr><td colSpan={7} className="py-8 text-center text-slate-500">No vendors found for this search.</td></tr>}
            </tbody>
          </table>
        </div>
        {statusResult && !statusResult.queryTooShort && statusResult.totalCount > 0 && (
          <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">Showing {((statusResult.page - 1) * statusResult.pageSize) + 1}–{Math.min(statusResult.page * statusResult.pageSize, statusResult.totalCount)} of {statusResult.totalCount.toLocaleString()} vendor(s)</p>
            <div className="flex items-center gap-2"><button type="button" disabled={statusResult.page <= 1 || loadingStatusVendors} onClick={() => setStatusPage((page) => Math.max(1, page - 1))} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40"><ChevronLeft size={14} /> Previous</button><span className="text-xs text-slate-500">Page {statusResult.page} of {Math.max(1, Math.ceil(statusResult.totalCount / statusResult.pageSize))}</span><button type="button" disabled={statusResult.page >= Math.ceil(statusResult.totalCount / statusResult.pageSize) || loadingStatusVendors} onClick={() => setStatusPage((page) => page + 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40">Next <ChevronRight size={14} /></button></div>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <button type="button" onClick={() => setAuditExpanded((value) => !value)} className="flex w-full items-center justify-between gap-4 text-left">
          <span className="flex items-center gap-3"><span className="rounded-xl bg-slate-100 p-3 text-slate-700"><History size={21} /></span><span><span className="block text-lg font-bold text-slate-950">Commission audit history</span><span className="mt-1 block text-sm text-slate-600">Latest recorded policy and agreement actions.</span></span></span>
          <span className="text-sm font-semibold text-orange-700">{auditExpanded ? "Hide" : `View ${data.audit.length} records`}</span>
        </button>
        {auditExpanded && <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[700px] border-collapse text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="py-3 pr-4">Date</th><th className="py-3 pr-4">Action</th><th className="py-3 pr-4">Vendor</th><th className="py-3 pr-4">Reason</th></tr></thead><tbody>{data.audit.map((entry) => <tr key={entry.id} className="border-b border-slate-100 last:border-0"><td className="py-3 pr-4 text-slate-600">{niceDate(entry.created_at)}</td><td className="py-3 pr-4 font-semibold text-slate-800">{readable(entry.action)}</td><td className="py-3 pr-4">{entry.vendor_id ? vendorsById.get(entry.vendor_id)?.name || entry.vendor_id.slice(0, 8) : "Policy / global"}</td><td className="py-3 pr-4 text-slate-600">{entry.reason || "—"}</td></tr>)}{data.audit.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-slate-500">No audit entries available.</td></tr>}</tbody></table></div>}
      </div>

      {confirmation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="vendor-commission-confirm-title" className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl sm:p-7">
            <div className="flex items-start gap-3"><div className="rounded-xl bg-amber-50 p-3 text-amber-800"><AlertTriangle size={22} /></div><div><h3 id="vendor-commission-confirm-title" className="text-xl font-black text-slate-950">{confirmation.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{confirmation.body}</p></div></div>
            <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"><p className="flex items-center gap-2 font-semibold"><CheckCircle2 size={17} className="text-emerald-600" />Global enforcement remains OFF</p><p className="mt-1 text-xs leading-5 text-slate-500">This confirmation cannot activate the feature flag or run order settlement.</p></div>
            <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <button type="button" onClick={() => setConfirmation(null)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={() => { setConfirmation(null); setNotice("Action not performed. Your form values were kept."); }} className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-200">No, go back</button>
              <button type="button" onClick={() => void confirmAction()} className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700">Yes, confirm</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function MetricCard({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><span className="text-sm font-semibold text-slate-500">{label}</span><span className="rounded-xl bg-slate-100 p-2 text-slate-700">{icon}</span></div><p className="mt-3 text-3xl font-black tracking-tight text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}
