"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Locality = {
  id: string;
  name: string;
  localityType: string;
  lgaId: string | null;
  lgaName: string;
  lcdaName: string;
};
type Territory = { id: string; name: string; lgaId: string | null; lgaName: string };
type Mapping = {
  id: string;
  localityId: string;
  localityName: string;
  localityType: string;
  territoryId: string;
  territoryName: string;
  lgaName: string;
  assignedAt: string | null;
};

async function readJson(response: Response): Promise<any> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success !== true) {
    throw new Error(typeof payload?.message === "string" ? payload.message : "The request could not be completed.");
  }
  return payload;
}

export default function TerritoryLocalityMappingPage() {
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [localitySearch, setLocalitySearch] = useState("");
  const [mappingSearch, setMappingSearch] = useState("");
  const [selectedLocalityId, setSelectedLocalityId] = useState("");
  const [selectedTerritoryId, setSelectedTerritoryId] = useState("");
  const [changeReason, setChangeReason] = useState("");

  const selectedLocality = localities.find((row) => row.id === selectedLocalityId) ?? null;
  const validTerritories = useMemo(() => {
    if (!selectedLocality?.lgaId) return [];
    return territories.filter((territory) => territory.lgaId === selectedLocality.lgaId);
  }, [selectedLocality, territories]);

  const filteredLocalities = useMemo(() => {
    const term = localitySearch.trim().toLowerCase();
    const rows = !term ? localities : localities.filter((row) =>
      [row.name, row.localityType, row.lgaName, row.lcdaName].join(" ").toLowerCase().includes(term),
    );
    return rows.slice(0, 100);
  }, [localities, localitySearch]);

  const filteredMappings = useMemo(() => {
    const term = mappingSearch.trim().toLowerCase();
    if (!term) return mappings;
    return mappings.filter((row) =>
      [row.localityName, row.localityType, row.territoryName, row.lgaName].join(" ").toLowerCase().includes(term),
    );
  }, [mappings, mappingSearch]);

  const mappedLocalityCount = useMemo(() => new Set(mappings.map((row) => row.localityId)).size, [mappings]);

  const loadCoverage = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const payload = await readJson(await fetch("/api/admin/territory-locality-mappings", { cache: "no-store" }));
      setLocalities((payload.localities ?? []) as Locality[]);
      setTerritories((payload.territories ?? []) as Territory[]);
      setMappings((payload.mappings ?? []) as Mapping[]);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to load MKH territory coverage.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadCoverage(); }, [loadCoverage]);

  async function changeMapping(action: "assign" | "unassign", localityId: string, territoryId: string) {
    if (changeReason.trim().length < 10) {
      setPageError("Enter a reason of at least 10 characters before saving a coverage change.");
      return;
    }
    setPageError("");
    setNotice("");
    setSaving(true);
    try {
      const payload = await readJson(await fetch("/api/admin/territory-locality-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          action,
          localityId,
          territoryId,
          reason: changeReason.trim(),
        }),
      }));
      setNotice(payload.message || "MKH locality coverage saved.");
      setChangeReason("");
      await loadCoverage();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to save the locality coverage change.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-orange-700">MKH Admin · Geography</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">Territory Locality Mapping</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Define which MKH territories cover each active MKH locality. These links—not Google Maps area labels—control which territories are available when Admin assigns a vendor to a zone.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void loadCoverage()} disabled={loading || saving} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <Link href="/admin-dashboard/vendor-locations" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Vendor address verification</Link>
            <Link href="/admin-dashboard" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Back to Admin</Link>
          </div>
        </header>

        {pageError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{pageError}</div>}
        {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Active MKH localities</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{loading ? "—" : localities.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Localities with coverage</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{loading ? "—" : mappedLocalityCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Active coverage links</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{loading ? "—" : mappings.length}</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Map MKH locality to territory</h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              Select the MKH locality that matches the vendor’s verified premises, then choose an MKH territory from the same LGA. A locality may be covered by more than one territory where MKH’s operational boundaries require it.
            </p>

            <label className="mt-5 block text-sm font-semibold text-slate-700" htmlFor="coverage-locality-search">Find an MKH locality</label>
            <input id="coverage-locality-search" value={localitySearch} onChange={(event) => setLocalitySearch(event.target.value)} placeholder="Search locality, LCDA or LGA" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none focus:border-orange-500" />

            <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="coverage-locality">Active MKH locality</label>
            <select id="coverage-locality" value={selectedLocalityId} onChange={(event) => { setSelectedLocalityId(event.target.value); setSelectedTerritoryId(""); setPageError(""); setNotice(""); }} disabled={loading || saving} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-orange-500 disabled:bg-slate-100">
              <option value="">Select an MKH locality</option>
              {filteredLocalities.map((row) => <option key={row.id} value={row.id}>{row.name} · {row.lgaName || "LGA not labelled"}{row.lcdaName ? " · " + row.lcdaName : ""}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-500">{filteredLocalities.length} matching localities shown (up to 100 per search).</p>

            {selectedLocality && (
              <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                <p><span className="font-semibold">Selected MKH record:</span> {selectedLocality.name}</p>
                <p className="mt-1 text-xs text-slate-500">Type: {selectedLocality.localityType || "not specified"} · LGA: {selectedLocality.lgaName || "not available"} · LCDA: {selectedLocality.lcdaName || "not available"}</p>
              </div>
            )}

            <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="coverage-territory">MKH territory in the same LGA</label>
            <select id="coverage-territory" value={selectedTerritoryId} onChange={(event) => setSelectedTerritoryId(event.target.value)} disabled={!selectedLocality || validTerritories.length === 0 || saving} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-orange-500 disabled:bg-slate-100">
              <option value="">Select an eligible territory</option>
              {validTerritories.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
            {selectedLocality && validTerritories.length === 0 && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">No active MKH territory shares this locality’s LGA. Check the locality and territory records; this page will not override the LGA integrity rule.</p>}

            <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="coverage-reason">Reason for this coverage change</label>
            <textarea id="coverage-reason" value={changeReason} onChange={(event) => setChangeReason(event.target.value)} rows={3} maxLength={500} placeholder="Explain why this MKH locality belongs to the selected territory." className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none focus:border-orange-500" />
            <button type="button" onClick={() => void changeMapping("assign", selectedLocalityId, selectedTerritoryId)} disabled={saving || !selectedLocalityId || !selectedTerritoryId || changeReason.trim().length < 10} className="mt-4 w-full rounded-lg bg-orange-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? "Saving coverage…" : "Save MKH locality coverage"}
            </button>
            <p className="mt-3 text-xs leading-5 text-slate-500">The server re-checks both records and their LGA IDs. Each change is recorded with the Admin/COO identity and reason. No Google locality label is used.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Current MKH territory coverage</h2>
              <p className="mt-1 text-sm text-slate-500">Only active locality-to-territory links appear here. Removing a link marks it inactive; it is not deleted.</p>
            </div>
            <input value={mappingSearch} onChange={(event) => setMappingSearch(event.target.value)} placeholder="Search mapped locality or territory" aria-label="Search active territory coverage" className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none focus:border-orange-500" />
            {loading ? <p className="py-8 text-sm text-slate-500">Loading MKH coverage…</p> : filteredMappings.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-center">
                <p className="font-semibold text-slate-800">No active locality coverage links yet</p>
                <p className="mt-2 text-sm leading-5 text-slate-500">Create the first explicit MKH mappings on the left. Existing vendor assignments will remain as they are until a new assignment is deliberately saved.</p>
              </div>
            ) : (
              <div className="mt-4 max-h-[650px] space-y-2 overflow-y-auto pr-1">
                {filteredMappings.map((row) => (
                  <div key={row.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{row.localityName}</p>
                        <p className="mt-1 text-xs text-slate-500">{row.localityType || "Locality"} · {row.lgaName || "LGA not labelled"}</p>
                        <p className="mt-2 text-sm text-slate-700"><span className="font-semibold">Territory:</span> {row.territoryName}</p>
                      </div>
                      <button type="button" onClick={() => void changeMapping("unassign", row.localityId, row.territoryId)} disabled={saving || changeReason.trim().length < 10} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40">Remove coverage link</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
          <strong>Important separation:</strong> Google Maps remains limited to exact vendor address verification and customer destination geocoding/road-route calculations. This screen uses MKH locality, LGA and territory records only. A vendor cannot be assigned to a zone until the vendor’s existing address-verification checks are complete and the verified locality is actively mapped to that zone’s territory.
        </div>
      </div>
    </main>
  );
}
