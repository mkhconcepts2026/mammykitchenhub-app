"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Snapshot = {
  territories?: any[];
  zones?: any[];
  riders?: any[];
  vendors?: any[];
};

export default function RiderAssignmentPolicyPanel() {
  const [supabase] = useState(() => createClient());
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [homeZoneChoices, setHomeZoneChoices] = useState<Record<string, string>>({});
  const [homeZoneReasons, setHomeZoneReasons] = useState<Record<string, string>>({});
  const [coverageChoices, setCoverageChoices] = useState<Record<string, string>>({});
  const [coverageReasons, setCoverageReasons] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState("");

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    const { data, error } = await supabase.rpc("mkh_admin_get_rider_assignment_snapshot");
    if (error) {
      setSnapshot(null);
      setErrorMessage(error.message || "Unable to load rider assignment records.");
    } else {
      setSnapshot((data || {}) as Snapshot);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const zones = snapshot?.zones ?? [];
  const riders = snapshot?.riders ?? [];
  const vendors = snapshot?.vendors ?? [];
  const allActiveLinks = useMemo(
    () => vendors.flatMap((vendor: any) => vendor.coverage_riders ?? []),
    [vendors]
  );
  const underCoveredCount = vendors.filter(
    (vendor: any) => Number(vendor.coverage_count ?? 0) < 4
  ).length;
  const legacyCount = vendors.reduce(
    (count: number, vendor: any) => count + Number(vendor.legacy_unverified_count ?? 0),
    0
  );

  async function assignHomeZone(rider: any) {
    const zoneId = homeZoneChoices[rider.id] || rider.home_zone_id || "";
    const reason = (homeZoneReasons[rider.id] || "").trim();
    if (!zoneId) {
      alert("Select an active MKH home zone.");
      return;
    }
    if (reason.length < 10) {
      alert("Enter a reason of at least 10 characters.");
      return;
    }

    setSavingKey(`home-${rider.id}`);
    const { error } = await supabase.rpc("mkh_admin_set_rider_home_zone", {
      p_rider_id: rider.id,
      p_home_zone_id: zoneId,
      p_reason: reason,
    });
    setSavingKey("");
    if (error) {
      alert(error.message);
      return;
    }
    setHomeZoneReasons((current) => ({ ...current, [rider.id]: "" }));
    await loadSnapshot();
  }

  async function updateCoverage(vendor: any, riderId: string, action: "add" | "verify" | "remove") {
    const reason = (coverageReasons[vendor.id] || "").trim();
    if (reason.length < 10) {
      alert("Enter a reason of at least 10 characters.");
      return;
    }

    setSavingKey(`coverage-${vendor.id}-${riderId}`);
    const { error } = await supabase.rpc("mkh_admin_set_vendor_rider_coverage", {
      p_vendor_id: vendor.id,
      p_rider_id: riderId,
      p_action: action,
      p_reason: reason,
    });
    setSavingKey("");
    if (error) {
      alert(error.message);
      return;
    }
    setCoverageReasons((current) => ({ ...current, [vendor.id]: "" }));
    await loadSnapshot();
  }

  function availableRidersFor(vendor: any) {
    return riders.filter((rider: any) => {
      if (!rider.home_zone_id || rider.home_zone_id !== vendor.zone_id) return false;
      const otherActiveLink = allActiveLinks.some(
        (link: any) => link.rider_id === rider.id && link.vendor_id !== vendor.id
      );
      const currentVerified = (vendor.coverage_riders ?? []).some(
        (link: any) => link.rider_id === rider.id && link.verified
      );
      return !otherActiveLink && !currentVerified;
    });
  }

  return (
    <section className="mb-8 space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Approved operating policy · Admin / Operations</p>
          <h3 className="mt-2 text-2xl font-black text-slate-900">Rider home zones & vendor coverage</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Maintain each rider's permanent home zone and each vendor's four designated riders. These records are separate from temporary order dispatch.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadSnapshot()}
          disabled={loading}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh records"}
        </button>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div>
      )}

      {loading && !snapshot ? (
        <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">Loading assignment records…</div>
      ) : snapshot ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active rider accounts</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{riders.length}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vendors below four riders</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{underCoveredCount} / {vendors.length}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Legacy links needing review</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{legacyCount}</p>
            </div>
          </div>

          {(snapshot.territories ?? []).map((territory: any) => (
            <p key={territory.id} className="text-sm text-slate-600">
              **{territory.name}** · {territory.active_zone_count} / 6 active zones
            </p>
          ))}

          {(zones.some((zone: any) => zone.capacity_exception) || legacyCount > 0) && (
            <div className="space-y-1 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {zones.filter((zone: any) => zone.capacity_exception).map((zone: any) => (
                <p key={zone.id}><strong>Capacity exception:</strong> {zone.name} has {zone.active_vendor_count} active vendors; the approved limit is five. Existing records are retained and no vendor is automatically moved or deactivated.</p>
              ))}
              {legacyCount > 0 && <p><strong>Legacy coverage:</strong> {legacyCount} active legacy link(s) are excluded from automatic dispatch until Admin verifies or removes them deliberately.</p>}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <h4 className="text-lg font-bold text-slate-900">1. Permanent rider home-zone assignments</h4>
              <p className="text-sm text-slate-500">One active home zone per rider. A home-zone change is an Admin/Operations action and requires a reason.</p>
            </div>
            {riders.map((rider: any) => (
              <div key={rider.id} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1.1fr_1fr_1.4fr_auto] md:items-end">
                <div>
                  <p className="font-semibold text-slate-900">{rider.full_name || "Rider account"}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {rider.home_zone_name ? `Current home zone: ${rider.home_zone_name}` : "No permanent home zone"}
                  </p>
                </div>
                <label className="text-xs font-semibold text-slate-600">
                  Home zone
                  <select
                    value={homeZoneChoices[rider.id] ?? rider.home_zone_id ?? ""}
                    onChange={(event) => setHomeZoneChoices((current) => ({ ...current, [rider.id]: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                  >
                    <option value="">Select active zone</option>
                    {zones.map((zone: any) => <option key={zone.id} value={zone.id}>{zone.name} · {zone.territory_name}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Reason for assignment / change
                  <input
                    value={homeZoneReasons[rider.id] ?? ""}
                    onChange={(event) => setHomeZoneReasons((current) => ({ ...current, [rider.id]: event.target.value }))}
                    placeholder="At least 10 characters"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void assignHomeZone(rider)}
                  disabled={savingKey === `home-${rider.id}`}
                  className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {savingKey === `home-${rider.id}` ? "Saving…" : "Save zone"}
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <h4 className="text-lg font-bold text-slate-900">2. Vendor four-rider coverage groups</h4>
              <p className="text-sm text-slate-500">Only verified riders count toward the four-person group. Riders must have their permanent home zone in the same zone as the vendor.</p>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {vendors.map((vendor: any) => {
                const verified = (vendor.coverage_riders ?? []).filter((link: any) => link.verified);
                const legacy = (vendor.coverage_riders ?? []).filter((link: any) => !link.verified);
                const candidates = availableRidersFor(vendor);
                return (
                  <article key={vendor.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h5 className="font-bold text-slate-900">{vendor.name}</h5>
                        <p className="mt-1 text-xs text-slate-500">{vendor.zone_name} · {vendor.territory_name}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${verified.length === 4 ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                        {verified.length}/4 covered
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-4 gap-2">
                      {[0, 1, 2, 3].map((slot) => (
                        <div key={slot} className={`rounded-lg border p-2 text-center text-xs ${slot < verified.length ? "border-green-200 bg-green-50 text-green-800" : "border-dashed border-slate-300 bg-slate-50 text-slate-400"}`}>
                          {slot < verified.length ? `Rider ${slot + 1}` : `Slot ${slot + 1}`}
                        </div>
                      ))}
                    </div>
                    {verified.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {verified.map((link: any) => (
                          <div key={link.link_id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                            <span>{link.rider_name}</span>
                            <button
                              type="button"
                              onClick={() => void updateCoverage(vendor, link.rider_id, "remove")}
                              disabled={Boolean(savingKey)}
                              className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {legacy.length > 0 && (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-bold text-amber-900">Legacy link — not counted or dispatched</p>
                        {legacy.map((link: any) => (
                          <div key={link.link_id} className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-amber-900">
                            <span>{link.rider_name}</span>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => void updateCoverage(vendor, link.rider_id, "verify")} disabled={Boolean(savingKey)} className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Verify link</button>
                              <button type="button" onClick={() => void updateCoverage(vendor, link.rider_id, "remove")} disabled={Boolean(savingKey)} className="text-xs font-semibold underline disabled:opacity-50">Remove legacy link</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {verified.length < 4 && (
                      <div className="mt-4 space-y-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          Add a rider from {vendor.zone_name}
                          <select
                            value={coverageChoices[vendor.id] ?? ""}
                            onChange={(event) => setCoverageChoices((current) => ({ ...current, [vendor.id]: event.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                          >
                            <option value="">Select an eligible rider</option>
                            {candidates.map((rider: any) => <option key={rider.id} value={rider.id}>{rider.full_name || rider.id}</option>)}
                          </select>
                        </label>
                        <label className="block text-xs font-semibold text-slate-600">
                          Reason / verification note
                          <input
                            value={coverageReasons[vendor.id] ?? ""}
                            onChange={(event) => setCoverageReasons((current) => ({ ...current, [vendor.id]: event.target.value }))}
                            placeholder="At least 10 characters"
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const riderId = coverageChoices[vendor.id];
                            if (!riderId) return alert("Select a rider first.");
                            void updateCoverage(vendor, riderId, "add");
                          }}
                          disabled={!candidates.length || Boolean(savingKey)}
                          className="w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Add to vendor coverage
                        </button>
                        {!candidates.length && <p className="text-xs text-slate-500">No unassigned active rider with a matching home zone is currently available for this vendor.</p>}
                      </div>
                    )}
                    {verified.length === 4 && <p className="mt-3 text-sm font-semibold text-green-700">Full four-rider coverage recorded.</p>}
                  </article>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
