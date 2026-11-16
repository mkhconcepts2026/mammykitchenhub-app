"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Users, MapPin, Store, AlertTriangle, ShieldCheck } from "lucide-react";

type Rider = {
  id:string; full_name:string|null; email:string|null; status:string;
  home_zone_id:string|null; home_zone_name:string|null; territory_id:string|null;
  availability_status:string|null; gps_status:string; gps_age_seconds:number|null;
  vendor_coverage:{vendor_id:string;vendor_name:string}[];
};
type Vendor = {
  id:string; name:string; zone_id:string|null; zone_name:string|null;
  territory_id:string|null; active_zone_link_count:number; coverage_count:number;
  riders:{id:string;full_name:string;email:string|null}[];
};
type Zone = {
  id:string;name:string;territory_id:string;territory_name:string;is_active:boolean;
  active_vendor_count:number;capacity_exception:boolean;active_zone_count_for_territory:number;
  vendors:string[];
};
type Payload = {success:boolean;message?:string;riders:Rider[];vendors:Vendor[];zones:Zone[];home_zone_audit:any[];vendor_coverage_audit:any[]};

export default function RiderOperationsPage() {
  const [data,setData]=useState<Payload|null>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [selectedRider,setSelectedRider]=useState("");
  const [selectedZone,setSelectedZone]=useState("");
  const [homeReason,setHomeReason]=useState("");
  const [coverageRider,setCoverageRider]=useState<Record<string,string>>({});
  const [coverageReason,setCoverageReason]=useState<Record<string,string>>({});

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const response=await fetch("/api/admin/rider-operations",{cache:"no-store"});
      const result=await response.json().catch(()=>null);
      if(!response.ok||result?.success!==true)throw new Error(result?.message||"Unable to load rider operations.");
      setData(result as Payload);
    }catch(e){setError(e instanceof Error?e.message:"Unable to load rider operations.");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);

  const activeRiders=useMemo(()=>data?.riders.filter(r=>r.status.toLowerCase()==="active")??[],[data]);
  const overCapacityZones=useMemo(()=>data?.zones.filter(z=>z.capacity_exception)??[],[data]);
  const coverageLinks=useMemo(()=>data?.vendors.reduce((n,v)=>n+v.coverage_count,0)??0,[data]);

  async function submit(body:Record<string,unknown>,successText:string){
    setSaving(true);setError("");setNotice("");
    try{
      const response=await fetch("/api/admin/rider-operations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const result=await response.json().catch(()=>null);
      if(!response.ok||result?.success!==true)throw new Error(result?.message||"The assignment could not be saved.");
      setNotice(successText);
      await load();
      return true;
    }catch(e){setError(e instanceof Error?e.message:"The assignment could not be saved.");return false;}
    finally{setSaving(false);}
  }

  async function assignHomeZone(){
    if(!selectedRider||!selectedZone||homeReason.trim().length<10){setError("Select a rider and zone, then enter a reason of at least 10 characters.");return;}
    const ok=await submit({action:"assign_home_zone",riderId:selectedRider,zoneId:selectedZone,reason:homeReason},"Permanent rider home zone saved.");
    if(ok){setHomeReason("");}
  }

  async function addCoverage(vendor:Vendor){
    const riderId=coverageRider[vendor.id]||"";
    const reason=coverageReason[vendor.id]||"";
    if(!riderId||reason.trim().length<10){setError("Select an eligible rider and enter a reason of at least 10 characters.");return;}
    const ok=await submit({action:"add_vendor_coverage",vendorId:vendor.id,riderId,reason},"Vendor rider coverage updated.");
    if(ok){setCoverageRider(s=>({...s,[vendor.id]:""}));setCoverageReason(s=>({...s,[vendor.id]:""}));}
  }

  async function removeCoverage(vendor:Vendor,rider:{id:string;full_name:string}){
    const reason=window.prompt(`Reason for removing ${rider.full_name} from ${vendor.name} coverage:`);
    if(!reason||reason.trim().length<10){setError("Enter a reason of at least 10 characters. No change was made.");return;}
    await submit({action:"remove_vendor_coverage",vendorId:vendor.id,riderId:rider.id,reason},"Vendor rider coverage removed. The rider's home zone was not changed.");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#0f172a] px-6 py-6 text-white shadow-lg">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-400">MKH Administration · Rider Operations</p>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">Rider Zone & Vendor Coverage</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Assign each rider one permanent home zone, then designate up to four riders for each vendor. Cross-zone pickup overrides are managed by the TRM—not by changing a rider's home zone.</p>
          </div>
          <button type="button" onClick={()=>void load()} disabled={loading||saving} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/>Refresh</button>
        </header>

        {error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        {notice&&<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

        {overCapacityZones.length>0&&<section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0"/><div>
            <strong>Existing zone capacity exception</strong>
            {overCapacityZones.map(z=><p key={z.id} className="mt-1">{z.name}, {z.territory_name}: {z.active_vendor_count} active vendors against the approved maximum of 5. Existing vendor assignments have been preserved. Resolve the exception through an approved vendor-zone move; this page will not move vendors automatically.</p>)}
          </div></div>
        </section>}

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-500">Active riders</p><p className="mt-2 text-3xl font-black">{loading?"—":activeRiders.length}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-500">Vendor coverage links</p><p className="mt-2 text-3xl font-black">{loading?"—":coverageLinks}</p><p className="mt-1 text-xs text-slate-500">Target: 4 per active vendor</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-500">Zones above vendor capacity</p><p className="mt-2 text-3xl font-black">{loading?"—":overCapacityZones.length}</p></div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><MapPin className="h-5 w-5 text-orange-600"/><h2 className="text-xl font-bold">Permanent home-zone assignment</h2></div>
          <p className="mt-1 text-sm text-slate-500">Every active rider must have one home zone. A rider's home zone does not change when the TRM temporarily dispatches them to another zone.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="text-sm font-semibold">Active rider
              <select value={selectedRider} onChange={e=>setSelectedRider(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 font-normal">
                <option value="">Select rider</option>
                {activeRiders.map(r=><option key={r.id} value={r.id}>{r.full_name||r.email} · {r.email}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">Permanent home zone
              <select value={selectedZone} onChange={e=>setSelectedZone(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 font-normal">
                <option value="">Select zone</option>
                {data?.zones.filter(z=>z.is_active!==false).map(z=><option key={z.id} value={z.id}>{z.name} · {z.territory_name}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">Reason (required)
              <input value={homeReason} onChange={e=>setHomeReason(e.target.value)} placeholder="e.g. Initial rider zone assignment" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 font-normal"/>
            </label>
          </div>
          <button type="button" onClick={()=>void assignHomeZone()} disabled={saving||!selectedRider||!selectedZone||homeReason.trim().length<10} className="mt-4 rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50">{saving?"Saving…":"Assign / Update Home Zone"}</button>
        </section>

        <section className="space-y-3">
          <div><h2 className="text-xl font-bold">Rider home-zone register</h2><p className="text-sm text-slate-500">GPS Live means the latest location was saved within 60 seconds. Wallet figures are not shown in this assignment screen.</p></div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Rider</th><th className="px-4 py-3">Home zone</th><th className="px-4 py-3">Vendor coverage</th><th className="px-4 py-3">Availability</th><th className="px-4 py-3">GPS</th></tr></thead>
              <tbody>{loading?<tr><td colSpan={5} className="p-6 text-center text-slate-500">Loading riders…</td></tr>:activeRiders.length===0?<tr><td colSpan={5} className="p-6 text-center text-slate-500">No active rider profiles.</td></tr>:activeRiders.map(r=><tr key={r.id} className="border-t border-slate-100"><td className="px-4 py-3"><strong>{r.full_name||"Rider"}</strong><p className="text-xs text-slate-500">{r.email}</p></td><td className="px-4 py-3">{r.home_zone_name||<span className="font-semibold text-amber-700">Not assigned</span>}</td><td className="px-4 py-3">{r.vendor_coverage.length? r.vendor_coverage.map(x=>x.vendor_name).join(", "):"No vendor group"}</td><td className="px-4 py-3 capitalize">{r.availability_status||"Not configured"}</td><td className="px-4 py-3"><span className={r.gps_status==="live"?"font-semibold text-emerald-700":"font-semibold text-amber-700"}>{r.gps_status==="live"?"GPS Live":"GPS Stale"}</span>{r.gps_age_seconds!==null&&<p className="text-xs text-slate-500">{r.gps_age_seconds}s ago</p>}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <div><h2 className="text-xl font-bold">Vendor four-rider coverage groups</h2><p className="text-sm text-slate-500">Each vendor may have up to four designated riders. A rider can be added only when their permanent home zone matches the vendor's current zone.</p></div>
          <div className="grid gap-4 xl:grid-cols-2">
            {loading?<div className="rounded-xl bg-white p-6 text-slate-500">Loading vendor coverage…</div>:data?.vendors.map(v=><article key={v.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-bold">{v.name}</h3><p className="text-xs text-slate-500">{v.zone_name||"No single active zone"} · {v.active_zone_link_count} active zone links</p></div><span className={v.coverage_count===4?"rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800":"rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800"}>{v.coverage_count}/4 riders</span></div>
              <div className="mt-3 space-y-2">
                {v.riders.map(r=><div key={r.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"><span className="text-sm">{r.full_name}<span className="ml-2 text-xs text-slate-500">{r.email}</span></span><button type="button" onClick={()=>void removeCoverage(v,r)} disabled={saving} className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50">Remove</button></div>)}
                {v.riders.length===0&&<p className="text-sm text-slate-500">No designated riders have been assigned.</p>}
              </div>
              <div className="mt-4 grid gap-2">
                <select value={coverageRider[v.id]||""} onChange={e=>setCoverageRider(s=>({...s,[v.id]:e.target.value}))} disabled={!v.zone_id||v.coverage_count>=4} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Select rider with {v.zone_name||"this"} home zone</option>
                  {activeRiders.filter(r=>r.home_zone_id===v.zone_id&&!v.riders.some(x=>x.id===r.id)).map(r=><option key={r.id} value={r.id}>{r.full_name||r.email} · {r.gps_status==="live"?"GPS Live":"GPS Stale"}</option>)}
                </select>
                <input value={coverageReason[v.id]||""} onChange={e=>setCoverageReason(s=>({...s,[v.id]:e.target.value}))} placeholder="Reason for adding this rider (10+ characters)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" disabled={v.coverage_count>=4}/>
                <button type="button" onClick={()=>void addCoverage(v)} disabled={saving||!v.zone_id||v.coverage_count>=4||!coverageRider[v.id]||(coverageReason[v.id]||"").trim().length<10} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Add designated rider</button>
              </div>
              {!v.zone_id&&<p className="mt-2 text-xs text-amber-700">Resolve this vendor's active zone mapping before assigning rider coverage.</p>}
            </article>)}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Assignment audit</h2>
          <p className="mt-1 text-sm text-slate-500">Latest home-zone and vendor-coverage changes.</p>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <div><h3 className="mb-2 text-sm font-semibold">Home-zone history</h3>{(data?.home_zone_audit??[]).slice(0,8).map(a=><p key={a.id} className="border-t border-slate-100 py-2 text-xs text-slate-600">{a.action} · {new Date(a.created_at).toLocaleString("en-NG")} · {a.reason}</p>)}</div>
            <div><h3 className="mb-2 text-sm font-semibold">Vendor coverage history</h3>{(data?.vendor_coverage_audit??[]).slice(0,8).map(a=><p key={a.id} className="border-t border-slate-100 py-2 text-xs text-slate-600">{a.action} · {new Date(a.created_at).toLocaleString("en-NG")} · {a.reason}</p>)}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
