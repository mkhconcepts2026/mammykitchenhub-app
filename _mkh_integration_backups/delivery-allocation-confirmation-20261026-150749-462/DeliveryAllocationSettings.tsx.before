"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  History,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";

type AllocationRole =
  | "rider_base"
  | "trm"
  | "zm"
  | "mkh_main"
  | "sg_global_alliance"
  | "vha";

type Version = {
  id: number;
  version_number: number;
  status: "active" | "draft" | "superseded" | "cancelled";
  currency: "NGN";
  base_delivery_fee: number;
  platform_fee_default: number;
  effective_from: string | null;
  created_at: string;
  activated_at: string | null;
  change_reason: string | null;
};

type Item = {
  id: number;
  config_version_id: number;
  allocation_role: AllocationRole;
  amount: number;
  beneficiary_label: string;
  destination_if_unassigned: string | null;
};

type Snapshot = { version: Version; items: Item[] } | null;
type AuditRow = {
  id: number;
  config_version_id: number;
  action: string;
  action_at: string;
  reason: string | null;
  details: Record<string, unknown> | null;
};

type SettingsPayload = { active: Snapshot; draft: Snapshot; audit: AuditRow[] };

type AmountDraft = Record<AllocationRole, number>;

const ROLE_ORDER: AllocationRole[] = [
  "rider_base",
  "trm",
  "zm",
  "mkh_main",
  "sg_global_alliance",
  "vha",
];

const ROLE_LABELS: Record<AllocationRole, string> = {
  rider_base: "Rider base payout",
  trm: "Territory Relationship Manager (TRM)",
  zm: "Zone Manager (ZM)",
  mkh_main: "MKH main allocation",
  sg_global_alliance: "SG Global Alliance",
  vha: "Vendor Hub Agent (VHA)",
};

const NAIRA = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 2,
});

const EMPTY_AMOUNTS: AmountDraft = {
  rider_base: 800,
  trm: 30,
  zm: 50,
  mkh_main: 400,
  sg_global_alliance: 50,
  vha: 170,
};

async function readResponse(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Request failed.");
  return payload;
}

export default function DeliveryAllocationSettings() {
  const [payload, setPayload] = useState<SettingsPayload | null>(null);
  const [amounts, setAmounts] = useState<AmountDraft>(EMPTY_AMOUNTS);
  const [baseFee, setBaseFee] = useState(1500);
  const [platformFee, setPlatformFee] = useState(300);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const active = payload?.active ?? null;
  const draft = payload?.draft ?? null;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/delivery-allocation", {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const data = (await readResponse(response)) as SettingsPayload;
      setPayload(data);

      const source = data.draft ?? data.active;
      if (source) {
        const nextAmounts = { ...EMPTY_AMOUNTS };
        for (const item of source.items) {
          if (ROLE_ORDER.includes(item.allocation_role)) {
            nextAmounts[item.allocation_role] = Number(item.amount);
          }
        }
        setAmounts(nextAmounts);
        setBaseFee(Number(source.version.base_delivery_fee));
        setPlatformFee(Number(source.version.platform_fee_default));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load allocation settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const allocationTotal = useMemo(
    () => ROLE_ORDER.reduce((sum, role) => sum + (Number(amounts[role]) || 0), 0),
    [amounts],
  );
  const balanced = Math.round((allocationTotal - Number(baseFee)) * 100) === 0;
  const reasonReady = reason.trim().length >= 5;

  const postAction = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetch("/api/admin/delivery-allocation", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    return readResponse(response);
  }, []);

  const createDraft = async () => {
    if (!reasonReady) {
      setError("Enter a change reason of at least 5 characters before creating a draft.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await postAction({ action: "create_draft", reason: reason.trim() });
      setNotice("Draft created. The active configuration has not changed.");
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to create draft.");
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    if (!reasonReady) {
      setError("Enter a change reason of at least 5 characters before saving.");
      return;
    }
    if (!balanced) {
      setError("The six allocations must add up exactly to the base delivery fee before you save/activate.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await postAction({
        action: "set_fees",
        config_version_id: draft.version.id,
        base_delivery_fee: Number(baseFee),
        platform_fee_default: Number(platformFee),
        reason: reason.trim(),
      });
      for (const role of ROLE_ORDER) {
        await postAction({
          action: "set_item",
          config_version_id: draft.version.id,
          allocation_role: role,
          amount: Number(amounts[role]),
          reason: reason.trim(),
        });
      }
      setNotice("Draft saved and audited. Live settings are unchanged until activation.");
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to save draft.");
    } finally {
      setBusy(false);
    }
  };

  const activateDraft = async () => {
    if (!draft) return;
    if (!reasonReady) {
      setError("Enter an activation reason of at least 5 characters.");
      return;
    }
    if (!balanced) {
      setError("Activation is blocked because the allocations do not balance to the base delivery fee.");
      return;
    }
    const approved = window.confirm(
      `Activate allocation version ${draft.version.version_number} for future allocation snapshots?\n\n` +
      `Base delivery fee: ${NAIRA.format(Number(baseFee))}\n` +
      `Six-part allocation total: ${NAIRA.format(allocationTotal)}\n\n` +
      "This does not execute payouts, credit wallets, or change commission enforcement. Continue?",
    );
    if (!approved) return;

    setBusy(true);
    setError("");
    setNotice("");
    try {
      // Save the values first, then invoke the database's atomic activation guard.
      await postAction({
        action: "set_fees",
        config_version_id: draft.version.id,
        base_delivery_fee: Number(baseFee),
        platform_fee_default: Number(platformFee),
        reason: reason.trim(),
      });
      for (const role of ROLE_ORDER) {
        await postAction({
          action: "set_item",
          config_version_id: draft.version.id,
          allocation_role: role,
          amount: Number(amounts[role]),
          reason: reason.trim(),
        });
      }
      await postAction({
        action: "activate",
        config_version_id: draft.version.id,
        reason: reason.trim(),
      });
      setNotice("Allocation version activated. No payout or wallet movement was triggered.");
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to activate configuration.");
    } finally {
      setBusy(false);
    }
  };

  const formattedDate = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
  };

  return (
    <section className="space-y-6 text-slate-900">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-orange-600">
            <SlidersHorizontal size={20} />
            <p className="text-xs font-bold uppercase tracking-[0.2em]">Finance Configuration</p>
          </div>
          <h2 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">Delivery Allocation Settings</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Configure the split of the base delivery fee. Changes are prepared as a draft, validated, and audited before activation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading || busy}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <ShieldCheck className="mt-0.5 shrink-0" size={19} />
        <div>
          <p className="font-bold">Protected configuration workflow</p>
          <p className="mt-1 leading-5">
            Saving a draft does not change live settings. Activation applies to future allocation snapshots only. This screen has no payout, wallet-credit, settlement, or food-sales commission controls.
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" /> <span>{error}</span>
        </div>
      )}
      {notice && (
        <div role="status" className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> <span>{notice}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
          <LoaderCircle className="animate-spin" size={20} /> Loading allocation settings…
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Active version</p>
              <p className="mt-2 text-2xl font-black">{active ? `v${active.version.version_number}` : "Not found"}</p>
              <p className="mt-1 text-xs text-slate-500">Activated {formattedDate(active?.version.activated_at)}</p>
              <span className="mt-3 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Live configuration</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Draft version</p>
              <p className="mt-2 text-2xl font-black">{draft ? `v${draft.version.version_number}` : "No draft"}</p>
              <p className="mt-1 text-xs text-slate-500">{draft ? `Created ${formattedDate(draft.version.created_at)}` : "Create a draft to propose changes"}</p>
              <span className="mt-3 inline-flex rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-700">Not live</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Draft balance</p>
              <p className="mt-2 text-2xl font-black">{NAIRA.format(allocationTotal)}</p>
              <p className="mt-1 text-xs text-slate-500">Base delivery fee: {NAIRA.format(Number(baseFee))}</p>
              <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${balanced ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {balanced ? "Balanced" : `Out by ${NAIRA.format(Math.abs(allocationTotal - Number(baseFee)))}`}
              </span>
            </div>
          </div>

          {!draft && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-bold">Start a proposed change</h3>
              <p className="mt-1 text-sm text-slate-600">Creating a draft copies the active configuration. It does not modify current settings.</p>
              <label className="mt-4 block text-sm font-semibold" htmlFor="mkh-allocation-reason">Reason for change</label>
              <textarea
                id="mkh-allocation-reason"
                rows={2}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain why this allocation change is being proposed…"
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
              <button
                type="button"
                onClick={() => void createDraft()}
                disabled={busy || !reasonReady}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />} Create draft
              </button>
            </div>
          )}

          {draft && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-black">Edit draft version {draft.version.version_number}</h3>
                  <p className="mt-1 text-xs text-slate-500">Live version v{active?.version.version_number ?? "—"} remains unchanged until activation.</p>
                </div>
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1.5 text-xs font-bold text-orange-800"><Clock3 size={14} /> Draft only</span>
              </div>

              <div className="grid gap-4 border-b border-slate-200 p-5 md:grid-cols-2">
                <label className="block text-sm font-semibold">
                  Base delivery fee (₦)
                  <input
                    type="number" min="0" step="50" value={baseFee}
                    onChange={(event) => setBaseFee(Number(event.target.value))}
                    disabled={busy}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:bg-slate-100"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Separate platform fee (₦)
                  <input
                    type="number" min="0" step="50" value={platformFee}
                    onChange={(event) => setPlatformFee(Number(event.target.value))}
                    disabled={busy}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:bg-slate-100"
                  />
                  <span className="mt-1 block text-xs font-normal text-slate-500">Kept separate; not included in the delivery-fee split.</span>
                </label>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="bg-white text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-bold">Allocation</th>
                      <th className="px-5 py-3 font-bold">Amount (₦)</th>
                      <th className="px-5 py-3 text-right font-bold">Share of fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROLE_ORDER.map((role) => (
                      <tr key={role} className="border-t border-slate-100">
                        <td className="px-5 py-3.5 font-semibold">{ROLE_LABELS[role]}</td>
                        <td className="px-5 py-3.5">
                          <input
                            type="number" min="0" step="10" value={amounts[role]}
                            onChange={(event) => setAmounts((current) => ({ ...current, [role]: Number(event.target.value) }))}
                            disabled={busy}
                            aria-label={`${ROLE_LABELS[role]} amount in naira`}
                            className="w-44 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:bg-slate-100"
                          />
                          {role === "vha" && (
                            <p className="mt-1 text-xs text-slate-500">If no VHA is attached at order time, current rule routes this share to MKH Pool.</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums text-slate-600">
                          {baseFee > 0 ? `${((Number(amounts[role]) / Number(baseFee)) * 100).toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                    <tr>
                      <td className="px-5 py-4 font-black">Total allocation</td>
                      <td className="px-5 py-4 font-black tabular-nums">{NAIRA.format(allocationTotal)}</td>
                      <td className="px-5 py-4 text-right">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${balanced ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                          {balanced ? "100% balanced" : "Balance mismatch"}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="space-y-3 border-t border-slate-200 p-5">
                <label className="block text-sm font-semibold" htmlFor="mkh-allocation-draft-reason">Change / activation reason</label>
                <textarea
                  id="mkh-allocation-draft-reason"
                  rows={2}
                  maxLength={500}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Record the reason for this proposed allocation…"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button" onClick={() => void saveDraft()}
                    disabled={busy || !reasonReady || !balanced}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />} Save draft
                  </button>
                  <button
                    type="button" onClick={() => void activateDraft()}
                    disabled={busy || !reasonReady || !balanced}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Activate version
                  </button>
                </div>
                {!balanced && <p className="text-xs font-semibold text-red-700">Activation is disabled until the six allocations equal the base delivery fee exactly.</p>}
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
              <History size={18} className="text-slate-500" />
              <h3 className="font-black">Allocation audit history</h3>
            </div>
            {!payload?.audit?.length ? (
              <p className="p-5 text-sm text-slate-500">No audit actions found.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {payload.audit.map((row) => (
                  <div key={row.id} className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-bold capitalize">{row.action.replaceAll("_", " ")} · version ID {row.config_version_id}</p>
                      <p className="mt-1 text-sm text-slate-600">{row.reason || "No reason recorded"}</p>
                    </div>
                    <time className="shrink-0 text-xs text-slate-500">{formattedDate(row.action_at)}</time>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
