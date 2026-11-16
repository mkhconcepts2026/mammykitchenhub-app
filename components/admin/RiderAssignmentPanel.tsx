"use client";

import { useCallback, useEffect, useState } from "react";

type Rider = {
  id:string; full_name:string|null; email:string|null; phone:string|null;
  status:string; home_zone_id:string|null; availability_status:string;
  gps_status:"live"|"stale"; gps_age_seconds:number|null;
  vendor_coverage_ids:string[]; active_dispatch_offer:any;
};
type Zone = {id:string;name:string;territory_id:string;territories?:{id:string;name:string;is_active:boolean}|null};
type Vendor = {id:string;name:string;status:string};
type Coverage = {id:string;vendor_id:string;vendor_name:string;rider_id:string;rider_name:string;rider_email:string|null};

export default function RiderAssignmentPanel(){
  const [riders,setRiders]=useState<Rider[]>([]);
  const [zones,setZones]=useState<Zone[]>([]);
  const [vendors,setVendors]=useState<Vendor[]>([]);
  const [coverage,setCoverage]=useState<Coverage[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  const [homeRiderId,setHomeRiderId]=useState("");
  const [homeZoneId,setHomeZoneId]=useState("");
  const [homeReason,setHomeReason]=useState("");

  const [coverageVendorId,setCoverageVendorId]=useState("");
  const [coverageRiderId,setCoverageRiderId]=useState("");
  const [coverageReason,setCoverageReason]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const response=await fetch("/api/admin/rider-dispatch",{cache:"no-store"});
      const data=await response.json().catch(()=>null);
      if(!response.ok||data?.success!==true)throw new Error(data?.message||"Unable to load rider assignments.");
      setRiders(data.riders??[]);setZones(data.zones??[]);setVendors(data.vendors??[]);setCoverage(data.coverage??[]);
    }catch(e){setError(e instanceof Error?e.message:"Unable to load rider assignments.");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);

  const selectedHomeRider=riders.find(r=>r.id===homeRiderId);
  const selectedVendor=vendors.find(v=>v.id===coverageVendorId);
  const selectedVendorZoneId=(selectedVendor as any)?.zone_id??null;
  const selectedVendorZone=zones.find(z=>z.id===selectedVendorZoneId);
  const selectedCoverageCount=coverage.filter(c=>c.vendor_id===coverageVendorId).length;
  const eligibleCoverageRiders=riders.filter(r=>
    r.status==="active" &&
    selectedVendorZoneId &&
    r.home_zone_id===selectedVendorZoneId &&
    !coverage.some(c=>c.vendor_id===coverageVendorId&&c.rider_id===r.id)
  );

  async function submit(action:string,body:Record<string,unknown>){
    setSaving(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/admin/rider-dispatch",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action,...body})
      });
      const data=await response.json().catch(()=>null);
      if(!response.ok||data?.success!==true)throw new Error(data?.message||"The assignment could not be saved.");
      setMessage(action==="assign_home_zone"?"Rider home zone saved.":action==="add_vendor_rider"?"Vendor coverage rider added.":"Vendor coverage rider removed.");
      await load();
      return true;
    }catch(e){setError(e instanceof Error?e.message:"The assignment could not be saved.");return false;}
    finally{setSaving(false);}
  }

  async function saveHomeZone(){
    if(!homeRiderId||!homeZoneId||homeReason.trim().length<10){setError("Choose a rider, home zone and enter a reason of at least 10 characters.");return;}
    const ok=await submit("assign_home_zone",{riderId:homeRiderId,zoneId:homeZoneId,reason:homeReason.trim()});
    if(ok){setHomeReason("");}
  }
  async function addCoverage(){
    if(!coverageVendorId||!coverageRiderId||coverageReason.trim().length<10){setError("Choose a vendor, rider and enter a reason of at least 10 characters.");return;}
    if(selectedCoverageCount>=4){setError("This vendor already has four designated riders.");return;}
    const ok=await submit("add_vendor_rider",{vendorId:coverageVendorId,riderId:coverageRiderId,reason:coverageReason.trim()});
    if(ok)setCoverageReason("");
  }
  async function removeCoverage(row:Coverage){
    const reason=window.prompt("Reason for removing this rider from vendor coverage (minimum 10 characters):");
    if(!reason||reason.trim().length<10)return;
    await submit("remove_vendor_rider",{vendorId:row.vendor_id,riderId:row.rider_id,reason:reason.trim()});
  }

  return (
    <section className="mb-8 space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-orange-600">MKH Rider Assignment & Dispatch</p>
          <h3 className="mt-1 text-2xl font-bold text-slate-900">Home Zones & Vendor Coverage</h3>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">A rider has one permanent home zone. Each vendor may designate up to four riders from that same zone. TRM cross-zone deployments do not change home-zone assignments.</p>
        </div>
        <button type="button" onClick={()=>void load()} disabled={loading} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Refresh</button>
      </div>

      {error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {message&&<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-4">
          <h4 className="font-bold text-slate-900">1. Assign permanent home zone</h4>
          <p className="mt-1 text-xs text-slate-500">New home-zone assignments are audited. A rider already covered by a vendor in another zone must have that coverage reconciled before moving.</p>
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-semibold text-slate-700">Active rider
              <select value={homeRiderId} onChange={e=>setHomeRiderId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">
                <option value="">Select rider</option>
                {riders.filter(r=>r.status==="active").map(r=><option key={r.id} value={r.id}>{r.full_name||r.email} · {r.email}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">Permanent home zone
              <select value={homeZoneId} onChange={e=>setHomeZoneId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">
                <option value="">Select zone</option>
                {zones.map(z=><option key={z.id} value={z.id}>{z.name} · {z.territories?.name||"Territory"}</option>)}
              </select>
            </label>
            {selectedHomeRider&&<p className="text-xs text-slate-500">Current home zone: {zones.find(z=>z.id===selectedHomeRider.home_zone_id)?.name||"Not assigned"} · GPS: {selectedHomeRider.gps_status==="live"?"Live":"Stale"} · Availability: {selectedHomeRider.availability_status}</p>}
            <label className="block text-sm font-semibold text-slate-700">Reason for assignment
              <textarea value={homeReason} onChange={e=>setHomeReason(e.target.value)} maxLength={500} rows={2} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" placeholder="Explain why this rider is assigned to the selected zone."/>
            </label>
            <button type="button" onClick={()=>void saveHomeZone()} disabled={saving||loading} className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{saving?"Saving…":"Save home-zone assignment"}</button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4">
          <h4 className="font-bold text-slate-900">2. Manage vendor four-rider coverage</h4>
          <p className="mt-1 text-xs text-slate-500">A vendor's designated riders must have the same permanent home zone as the vendor. Maximum four active riders per vendor.</p>
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-semibold text-slate-700">Active vendor
              <select value={coverageVendorId} onChange={e=>setCoverageVendorId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">
                <option value="">Select vendor</option>
                {vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
            {coverageVendorId&&<p className="text-xs font-semibold text-slate-600">Designated riders: {selectedCoverageCount}/4 {selectedVendorZone?`· ${selectedVendorZone.name}`:"· vendor has no active zone assignment"}</p>}
            <label className="block text-sm font-semibold text-slate-700">Rider to add
              <select value={coverageRiderId} onChange={e=>setCoverageRiderId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">
                <option value="">Select rider</option>
                {eligibleCoverageRiders.map(r=><option key={r.id} value={r.id}>{r.full_name||r.email} · {zones.find(z=>z.id===r.home_zone_id)?.name}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">Reason for coverage
              <textarea value={coverageReason} onChange={e=>setCoverageReason(e.target.value)} maxLength={500} rows={2} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" placeholder="Explain the rider's vendor coverage assignment."/>
            </label>
            <button type="button" onClick={()=>void addCoverage()} disabled={saving||loading||!coverageVendorId||selectedCoverageCount>=4} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Add designated rider</button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <div className="border-b border-slate-200 px-4 py-3 font-bold text-slate-900">Current vendor rider coverage</div>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Vendor</th><th className="px-4 py-3">Rider</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {coverage.map(row=><tr key={row.id}><td className="px-4 py-3 font-semibold">{row.vendor_name}</td><td className="px-4 py-3">{row.rider_name}<span className="block text-xs text-slate-500">{row.rider_email}</span></td><td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Active</span></td><td className="px-4 py-3"><button type="button" onClick={()=>void removeCoverage(row)} disabled={saving} className="text-sm font-semibold text-red-600 disabled:opacity-50">Remove</button></td></tr>)}
            {coverage.length===0&&<tr><td colSpan={4} className="px-4 py-7 text-center text-slate-500">No vendor coverage assignments yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs leading-5 text-slate-500">Capacity is enforced by MKH-PRODUCTION: 6 active zones per territory, 5 active vendors per zone and 4 designated riders per vendor. Existing capacity exceptions are retained; new assignments are blocked until capacity is available.</p>
    </section>
  );
}
