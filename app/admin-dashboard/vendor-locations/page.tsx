"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type VerifiedLocation = {
  vendor_id?: string;
  business_address: string;
  google_place_id: string | null;
  latitude: number | null;
  longitude: number | null;
  locality_id: string | null;
  address_verification_status?: "verified" | "pending" | "rejected";
  verification_source?: "google_maps" | "nipost_l1" | "manual_admin" | "none";
  locality_match_status?: "matched" | "pending";
  nipost_postcode?: string | null;
  nipost_validation_status?: "not_checked" | "validated" | "invalid" | "unavailable";
  recorded_by?: string | null;
  locality_name_snapshot?: string | null;
  lcda_name_snapshot?: string | null;
  lga_name_snapshot?: string | null;
  verified_at?: string | null;
  updated_at?: string | null;
};

type VendorRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  legacyLocation: string;
  applicationBusinessAddress: string;
  verifiedLocation: VerifiedLocation | null;
};

type GoogleSuggestion = {
  placeId: string;
  label: string;
  mainText: string;
  secondaryText: string;
};

type GooglePlace = {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  countryCode: string;
  localityText: string;
  adminAreaText: string;
};

type MkhLocality = {
  id: string;
  name: string;
  localityType: string;
  lgaId: string | null;
  lgaName: string;
  lcdaId: string | null;
  lcdaName: string;
  latitude: number | null;
  longitude: number | null;
  geocodingStatus: string | null;
};

async function readJson(response: Response): Promise<any> {
  const value = await response.json().catch(() => ({}));
  if (!response.ok || value?.success !== true) {
    throw new Error(typeof value?.message === "string" ? value.message : `Request failed (${response.status}).`);
  }
  return value;
}

export default function VendorLocationsAdminPage() {
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [pageError, setPageError] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");

  const [addressQuery, setAddressQuery] = useState("");
  const [nipostPostcode, setNipostPostcode] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [suggestions, setSuggestions] = useState<GoogleSuggestion[]>([]);
  const [searchingGoogle, setSearchingGoogle] = useState(false);
  const [resolvingPlace, setResolvingPlace] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<GooglePlace | null>(null);

  const [localitySearch, setLocalitySearch] = useState("");
  const [localities, setLocalities] = useState<MkhLocality[]>([]);
  const [selectedLocalityId, setSelectedLocalityId] = useState("");
  const [searchingLocalities, setSearchingLocalities] = useState(false);

  const [changeReason, setChangeReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const selectedVendor = vendors.find((vendor) => vendor.id === selectedVendorId) ?? null;
  const selectedLocality = localities.find((locality) => locality.id === selectedLocalityId) ?? null;

  const filteredVendors = useMemo(() => {
    const needle = vendorSearch.trim().toLowerCase();
    if (!needle) return vendors;
    return vendors.filter((vendor) =>
      `${vendor.name} ${vendor.email}`.toLowerCase().includes(needle),
    );
  }, [vendors, vendorSearch]);

  async function loadVendors() {
    setLoadingVendors(true);
    setPageError("");
    try {
      const result = await readJson(await fetch("/api/admin/vendor-business-locations", { cache: "no-store" }));
      const rows = (result.vendors ?? []) as VendorRow[];
      setVendors(rows);
      setSelectedVendorId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? "");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to load vendors.");
    } finally {
      setLoadingVendors(false);
    }
  }

  async function searchLocalities(query = localitySearch, selectedId = selectedVendor?.verifiedLocation?.locality_id ?? "") {
    setSearchingLocalities(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("search", query.trim());
      if (selectedId) params.set("selectedId", selectedId);
      const result = await readJson(await fetch(`/api/admin/vendor-business-locations/localities?${params.toString()}`, { cache: "no-store" }));
      setLocalities((result.localities ?? []) as MkhLocality[]);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to load MKH localities.");
    } finally {
      setSearchingLocalities(false);
    }
  }

  useEffect(() => {
    void loadVendors();
    void searchLocalities("");
  }, []);

  useEffect(() => {
    if (!selectedVendor) return;
    const saved = selectedVendor.verifiedLocation;
    setAddressQuery(saved?.business_address || selectedVendor.applicationBusinessAddress || selectedVendor.legacyLocation || "");
    setSelectedPlace(saved && saved.google_place_id && saved.latitude != null && saved.longitude != null ? {
      placeId: saved.google_place_id,
      displayName: saved.business_address,
      formattedAddress: saved.business_address,
      latitude: Number(saved.latitude),
      longitude: Number(saved.longitude),
      countryCode: "NG",
      localityText: saved.locality_name_snapshot || "",
      adminAreaText: saved.lcda_name_snapshot || saved.lga_name_snapshot || "",
    } : null);
    setNipostPostcode(saved?.nipost_postcode ?? "");
    setSelectedLocalityId(saved?.locality_id ?? "");
    setLocalitySearch(saved?.locality_name_snapshot ?? "");
    setSuggestions([]);
    setSessionToken("");
    setChangeReason("");
    setConfirmed(false);
    setSuccessMessage("");
    void searchLocalities("", saved?.locality_id ?? "");
  // Reload the form only when the selected vendor changes; saving a verified location updates vendors
  // and must not clear the success notice or reset the form immediately.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVendorId]);

  function handleAddressChange(value: string) {
    setAddressQuery(value);
    setSelectedPlace(null);
    setSuggestions([]);
    setConfirmed(false);
    setSuccessMessage("");
  }

  async function searchGooglePlaces() {
    setPageError("");
    setSuccessMessage("");
    if (addressQuery.trim().length < 3) {
      setPageError("Enter at least three characters of the business address to search Google Maps.");
      return;
    }
    setSearchingGoogle(true);
    try {
      const token = sessionToken || crypto.randomUUID();
      setSessionToken(token);
      const result = await readJson(await fetch("/api/admin/vendor-business-locations/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "autocomplete", input: addressQuery.trim(), sessionToken: token }),
      }));
      setSuggestions((result.suggestions ?? []) as GoogleSuggestion[]);
      if (!(result.suggestions ?? []).length) setPageError("Google Maps returned no matching places. Add a street number, road, estate or landmark and search again.");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Google Maps address search failed.");
    } finally {
      setSearchingGoogle(false);
    }
  }

  async function chooseGooglePlace(suggestion: GoogleSuggestion) {
    setPageError("");
    setSuccessMessage("");
    setResolvingPlace(true);
    try {
      const result = await readJson(await fetch("/api/admin/vendor-business-locations/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", placeId: suggestion.placeId, sessionToken }),
      }));
      const place = result.place as GooglePlace;
      setSelectedPlace(place);
      setAddressQuery(place.formattedAddress);
      setSuggestions([]);
      setSessionToken("");
      setConfirmed(false);
      // A new Google Place requires a fresh MKH-locality confirmation. Do not silently carry
      // forward the previous saved locality when an Admin corrects a vendor address.
      setSelectedLocalityId("");
      if (place.localityText) setLocalitySearch(place.localityText);
      void searchLocalities(place.localityText || localitySearch, "");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to verify the Google Maps selection.");
    } finally {
      setResolvingPlace(false);
    }
  }

  async function saveLocation(source: "google_maps" | "nipost_l1" = "google_maps") {
    setPageError("");
    setSuccessMessage("");
    if (!selectedVendor) return setPageError("Select a vendor first.");
    if (changeReason.trim().length < 10) return setPageError("Enter a change reason of at least 10 characters.");
    if (!confirmed) return setPageError("Confirm the address evidence and any MKH locality selected below.");

    if (source === "google_maps" && !selectedPlace) {
      return setPageError("Select the exact Google Maps business address first, or use the NIPOST L1 path below.");
    }
    if (source === "nipost_l1") {
      if (addressQuery.trim().length < 8) return setPageError("Enter the vendor's full business address (at least 8 characters).");
      if (!nipostPostcode.trim()) return setPageError("Enter the vendor's NIPOST Digital Postcode.");
    }

    setSaving(true);
    try {
      const result = await readJson(await fetch("/api/admin/vendor-business-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          source,
          vendorId: selectedVendor.id,
          businessAddress: source === "google_maps" ? selectedPlace!.formattedAddress : addressQuery.trim(),
          placeId: source === "google_maps" ? selectedPlace!.placeId : null,
          localityId: selectedLocalityId || null,
          confirmed,
          nipostPostcode: source === "nipost_l1" ? nipostPostcode.trim() : null,
          reason: changeReason.trim(),
        }),
      }));

      const saved = result.location as VerifiedLocation;
      setVendors((current) => current.map((vendor) => vendor.id === selectedVendor.id ? { ...vendor, verifiedLocation: saved } : vendor));
      setAddressQuery(saved.business_address);
      setSelectedPlace(saved.google_place_id && saved.latitude != null && saved.longitude != null ? {
        placeId: saved.google_place_id,
        displayName: saved.business_address,
        formattedAddress: saved.business_address,
        latitude: Number(saved.latitude),
        longitude: Number(saved.longitude),
        countryCode: "NG",
        localityText: saved.locality_name_snapshot || "",
        adminAreaText: saved.lcda_name_snapshot || saved.lga_name_snapshot || "",
      } : null);
      setSelectedLocalityId(saved.locality_id ?? "");
      setNipostPostcode(saved.nipost_postcode ?? "");
      setSuccessMessage(source === "google_maps"
        ? (saved.locality_match_status === "matched"
            ? `Google Maps address verified and MKH locality matched for ${result.vendorName}. Audit record saved.`
            : `Google Maps address evidence saved for ${result.vendorName}; MKH locality matching is still pending. This location is not yet eligible for delivery quotes.`)
        : `NIPOST L1 result recorded for ${result.vendorName} (${saved.nipost_validation_status ?? "not checked"}). L1 does not verify the exact street address or coordinates; the address remains pending and cannot be used as a delivery origin.`);
      setConfirmed(false);
      setChangeReason("");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to save the vendor location.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-orange-700">MKH Admin</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">Vendor Business Locations</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">Verify each active vendor's actual business address using Google Maps, then explicitly match it to an active MKH locality. Quotes will use the saved verified origin instead of geocoding a generic location label.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void loadVendors()} disabled={loadingVendors} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">{loadingVendors ? "Refreshing…" : "Refresh vendors"}</button>
            <Link href="/admin-dashboard" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Back to Admin</Link>
          </div>
        </div>

        {pageError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{pageError}</div>}
        {successMessage && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{successMessage}</div>}

        <div className="grid gap-5 lg:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Active vendors</h2>
            <input aria-label="Search active vendors" value={vendorSearch} onChange={(event) => setVendorSearch(event.target.value)} placeholder="Search vendor name or email" className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500" />
            {loadingVendors ? <p className="py-6 text-sm text-slate-500">Loading vendors…</p> : filteredVendors.length === 0 ? <p className="py-6 text-sm text-slate-500">No active vendors found.</p> : (
              <div className="mt-3 space-y-2">
                {filteredVendors.map((vendor) => (
                  <button key={vendor.id} type="button" onClick={() => setSelectedVendorId(vendor.id)} className={`w-full rounded-xl border p-3 text-left ${selectedVendorId === vendor.id ? "border-orange-400 bg-orange-50" : "border-slate-200 hover:bg-slate-50"}`}>
                    <span className="block font-semibold text-slate-900">{vendor.name}</span>
                    <span className="mt-1 block truncate text-xs text-slate-500">{vendor.email}</span>
                    <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${vendor.verifiedLocation ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{vendor.verifiedLocation?.address_verification_status === "verified" && vendor.verifiedLocation?.locality_match_status === "matched" ? "Origin verified" : vendor.verifiedLocation?.address_verification_status === "verified" ? "Address verified · locality pending" : vendor.verifiedLocation ? "Verification pending" : "Origin not verified"}</span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            {!selectedVendor ? <p className="text-sm text-slate-500">Select an active vendor to review its registered address.</p> : <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h2 className="text-xl font-bold text-slate-900">{selectedVendor.name}</h2>
                <p className="mt-1 text-sm text-slate-500">{selectedVendor.email}</p>
                {selectedVendor.verifiedLocation ? (
                  <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-800">Saved address: {selectedVendor.verifiedLocation.business_address}<br />Address status: {selectedVendor.verifiedLocation.address_verification_status ?? "verified (legacy record)"} · Source: {selectedVendor.verifiedLocation.verification_source ?? "Google Maps (legacy record)"}<br />MKH locality: {selectedVendor.verifiedLocation.locality_name_snapshot || "Pending match"}{selectedVendor.verifiedLocation.lcda_name_snapshot ? ` · ${selectedVendor.verifiedLocation.lcda_name_snapshot}` : ""}{selectedVendor.verifiedLocation.lga_name_snapshot ? ` · ${selectedVendor.verifiedLocation.lga_name_snapshot}` : ""}<br />NIPOST postcode: {selectedVendor.verifiedLocation.nipost_postcode || "not recorded"} · Status: {selectedVendor.verifiedLocation.nipost_validation_status ?? "not checked"}</div>
                ) : (
                  <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">No Admin-verified business location is saved yet. Existing address sources are shown below as starting hints only; they are not treated as precise coordinates.</div>
                )}
              </div>

              <div>
                <label htmlFor="vendor-address-query" className="block text-sm font-semibold text-slate-800">Registered business address / Google Maps search</label>
                <p className="mt-1 text-xs text-slate-500">Application address: {selectedVendor.applicationBusinessAddress || "not available"}<br />Legacy vendor location: {selectedVendor.legacyLocation || "not available"}</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input id="vendor-address-query" value={addressQuery} onChange={(event) => handleAddressChange(event.target.value)} maxLength={250} placeholder="Street number, street, estate or business name" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-orange-500" />
                  <button type="button" onClick={() => void searchGooglePlaces()} disabled={searchingGoogle || resolvingPlace} className="rounded-lg bg-orange-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{searchingGoogle ? "Searching…" : "Search Google Maps"}</button>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500"><img src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png" alt="Powered by Google" width={120} height={14} /><span>Google Maps suggestions · Select the exact business address, not just a locality or city name.</span></div>
                {suggestions.length > 0 && <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                  {suggestions.map((suggestion) => <button key={suggestion.placeId} type="button" onClick={() => void chooseGooglePlace(suggestion)} disabled={resolvingPlace} className="block w-full border-b border-slate-100 p-3 text-left last:border-b-0 hover:bg-orange-50 disabled:opacity-50">
                    <span className="block text-sm font-semibold text-slate-900">{suggestion.mainText}</span><span className="mt-1 block text-xs text-slate-600">{suggestion.secondaryText || suggestion.label}</span>
                  </button>)}
                </div>}
                {resolvingPlace && <p className="mt-2 text-sm text-slate-500">Verifying the selected Google Maps result…</p>}
              </div>

              {selectedPlace && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-bold text-emerald-900">Google Maps result selected</p>
                <p className="mt-1 text-sm text-emerald-900">{selectedPlace.formattedAddress}</p>
                <p className="mt-2 text-xs text-emerald-800">Google locality/area: {selectedPlace.localityText || "not specified by Google"}{selectedPlace.adminAreaText ? ` · ${selectedPlace.adminAreaText}` : ""}</p>
                <p className="mt-1 text-xs text-emerald-800">Coordinates: {Number(selectedPlace.latitude).toFixed(6)}, {Number(selectedPlace.longitude).toFixed(6)} · Place ID selected</p>
              </div>}

              <div className="border-t border-slate-200 pt-5">
                <label htmlFor="nipost-postcode" className="block text-sm font-semibold text-slate-800">NIPOST L1 postcode fallback</label>
                <p className="mt-1 text-xs text-slate-500">Use this when Google Maps cannot resolve the business address. MKH will validate the postcode with NIPOST L1, then save the address and postcode result separately. L1 does not verify exact street address or provide verified coordinates.</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input id="nipost-postcode" value={nipostPostcode} onChange={(event) => setNipostPostcode(event.target.value.toUpperCase())} maxLength={24} placeholder="e.g. FC-01-A01-KP-27" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-orange-500" />
                  <button type="button" onClick={() => void saveLocation("nipost_l1")} disabled={saving || addressQuery.trim().length < 8 || !nipostPostcode.trim() || !confirmed || changeReason.trim().length < 10} className="rounded-lg border border-orange-400 px-4 py-3 text-sm font-bold text-orange-800 disabled:opacity-50">{saving ? "Checking/saving…" : "Validate L1 & save pending address"}</button>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <label htmlFor="mkh-locality-search" className="block text-sm font-semibold text-slate-800">Match to MKH locality database</label>
                <p className="mt-1 text-xs text-slate-500">Google's locality label is a hint. The chosen MKH locality must be confirmed against the actual business location and the database's LGA/LCDA context.</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input id="mkh-locality-search" value={localitySearch} onChange={(event) => setLocalitySearch(event.target.value)} maxLength={100} placeholder="Search active MKH localities" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-orange-500" />
                  <button type="button" onClick={() => void searchLocalities(localitySearch, selectedLocalityId)} disabled={searchingLocalities} className="rounded-lg border border-orange-400 px-4 py-3 text-sm font-bold text-orange-700 disabled:opacity-50">{searchingLocalities ? "Searching…" : "Find locality"}</button>
                </div>
                <select aria-label="Selected MKH locality" value={selectedLocalityId} onChange={(event) => { setSelectedLocalityId(event.target.value); setConfirmed(false); }} className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 outline-none focus:border-orange-500">
                  <option value="">Select an active MKH locality</option>
                  {localities.map((locality) => <option key={locality.id} value={locality.id}>{locality.name} ({locality.localityType}){locality.lcdaName ? ` · ${locality.lcdaName}` : ""}{locality.lgaName ? ` · ${locality.lgaName}` : ""}{locality.geocodingStatus ? ` · ${locality.geocodingStatus}` : ""}</option>)}
                </select>
                {selectedLocality && <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><span className="font-semibold">Selected MKH record:</span> {selectedLocality.name}{selectedLocality.lcdaName ? ` · ${selectedLocality.lcdaName}` : ""}{selectedLocality.lgaName ? ` · ${selectedLocality.lgaName}` : ""}<br /><span className="text-xs text-slate-500">Coordinate status: {selectedLocality.geocodingStatus || "not recorded"}. The vendor's precise Google coordinates, not an approximate locality centroid, will be used as the delivery origin.</span></div>}
              </div>

              <div className="border-t border-slate-200 pt-5">
                <label htmlFor="address-change-reason" className="block text-sm font-semibold text-slate-800">Reason for verification / correction</label>
                <textarea id="address-change-reason" value={changeReason} onChange={(event) => setChangeReason(event.target.value)} rows={3} maxLength={500} placeholder="E.g. Confirmed the vendor's operating premises against the approved application and Google Maps result." className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-orange-500" />
                <label className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
                  <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />
                  <span>I confirm the address evidence entered above belongs to the vendor's actual operating premises. If I selected an MKH locality, I also confirm it matches the premises against MKH's locality/LGA/LCDA records. I understand the result and reason will be recorded in the audit trail.</span>
                </label>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" onClick={() => void saveLocation("google_maps")} disabled={saving || !selectedPlace || !confirmed || changeReason.trim().length < 10} className="rounded-lg bg-emerald-700 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving location…" : selectedLocalityId ? "Save verified address & locality" : "Save verified address · locality pending"}</button>
                  <button type="button" onClick={() => { if (!selectedVendor) return; setAddressQuery(selectedVendor.verifiedLocation?.business_address || selectedVendor.applicationBusinessAddress || selectedVendor.legacyLocation || ""); setSelectedPlace(null); setSuggestions([]); setNipostPostcode(""); setConfirmed(false); setChangeReason(""); setPageError(""); setSuccessMessage(""); }} disabled={saving} className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700">Reset changes</button>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">Saving this form does not change vendor KYC approval, the original application, vendor bank details, customer orders, payments, wallets, payout allocations, or settlement history. It creates/updates the operational location record and appends an audit entry.</p>
              </div>
            </div>}
          </section>
        </div>
      </div>
    </main>
  );
}
