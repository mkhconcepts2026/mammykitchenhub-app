"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Save, Users, MapPin, Store } from "lucide-react";

type Employee = {
  id: string; display_name: string; email?: string | null; role_name: string; system_role: string;
  zone_id: string | null; assigned_vendor_id: string | null;
};
type Zone = { id: string; name: string; code?: string | null };
type Vendor = { id: string; name: string; status?: string | null };

export default function OperationalAssignments() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [zoneDrafts, setZoneDrafts] = useState<Record<string, string>>({});
  const [vendorDrafts, setVendorDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/operational-assignments", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load assignments.");
      setEmployees(result.employees ?? []); setZones(result.zones ?? []); setVendors(result.vendors ?? []);
      setZoneDrafts(Object.fromEntries((result.employees ?? []).map((e: Employee) => [e.id, e.zone_id ?? ""])));
      setVendorDrafts(Object.fromEntries((result.employees ?? []).map((e: Employee) => [e.id, e.assigned_vendor_id ?? ""])));
    } catch (e) { setNotice({ type: "error", text: e instanceof Error ? e.message : "Unable to load assignments." }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save(employee: Employee, type: "zone" | "vendor") {
    const targetId = type === "zone" ? zoneDrafts[employee.id] ?? "" : vendorDrafts[employee.id] ?? "";
    setSaving(`${type}:${employee.id}`); setNotice(null);
    try {
      const response = await fetch("/api/admin/operational-assignments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: employee.id, assignment_type: type, target_id: targetId || null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save assignment.");
      setNotice({ type: "success", text: `${employee.display_name}: ${type === "zone" ? "Zone" : "Vendor"} assignment saved.` });
      await load();
    } catch (e) { setNotice({ type: "error", text: e instanceof Error ? e.message : "Unable to save assignment." }); }
    finally { setSaving(null); }
  }

  const zmEmployees = employees.filter((e) => { const r = String(e.system_role).toUpperCase().replace(/[^A-Z0-9]/g, ""); return r.includes("ZM") || r.includes("ZONEMANAGER") || r.includes("ZONALMANAGER"); });
  const vhaEmployees = employees.filter((e) => { const r = String(e.system_role).toUpperCase().replace(/[^A-Z0-9]/g, ""); return r.includes("VHA") || r.includes("VENDORHUBAGENT"); });

  function AssignmentTable({ rows, type }: { rows: Employee[]; type: "zone" | "vendor" }) {
    const options = type === "zone" ? zones : vendors;
    const drafts = type === "zone" ? zoneDrafts : vendorDrafts;
    const setDrafts = type === "zone" ? setZoneDrafts : setVendorDrafts;
    return <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3 font-semibold">Employee</th><th className="px-4 py-3 font-semibold">Role</th><th className="px-4 py-3 font-semibold">{type === "zone" ? "Zone" : "Vendor"} assignment</th><th className="px-4 py-3 font-semibold">Action</th></tr></thead><tbody className="divide-y divide-slate-100 bg-white">{rows.map((employee) => <tr key={employee.id}><td className="px-4 py-3"><div className="font-semibold text-slate-900">{employee.display_name}</div><div className="text-xs text-slate-500">{employee.email || ""}</div></td><td className="px-4 py-3 text-slate-600">{employee.role_name || employee.system_role}</td><td className="px-4 py-3"><select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" value={drafts[employee.id] ?? ""} onChange={(e) => setDrafts((old) => ({ ...old, [employee.id]: e.target.value }))}><option value="">Unassigned</option>{options.map((option: any) => <option key={option.id} value={option.id}>{type === "zone" ? `${option.name}${option.code ? ` (${option.code})` : ""}` : option.name}</option>)}</select></td><td className="px-4 py-3"><button type="button" onClick={() => void save(employee, type)} disabled={saving !== null || (drafts[employee.id] ?? "") === (type === "zone" ? employee.zone_id ?? "" : employee.assigned_vendor_id ?? "")} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40"><Save size={15} />{saving === `${type}:${employee.id}` ? "Saving..." : "Save"}</button></td></tr>)}{rows.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No matching employees found for this assignment type. Zonal Manager matching supports ZONAL_MANAGER. VHA assignments require an existing VHA/Vendor Hub Agent role and employee account.</td></tr>}</tbody></table></div>;
  }

  return <section className="space-y-6 p-4 md:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">Staff & operational assignments</p><h2 className="mt-1 text-2xl font-black text-slate-900">Admin Reassignment Workflow</h2><p className="mt-1 max-w-3xl text-sm text-slate-600">Assign existing HR-created Zone Managers to zones and Vendor Hub Agents to vendors. This does not create employee accounts or change their access roles.</p></div><button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"><RefreshCw size={15} /> Refresh</button></div>
    {notice && <div role="status" className={`rounded-lg border px-4 py-3 text-sm ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{notice.text}</div>}
    {loading ? <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">Loading employees and assignments...</div> : <>
      <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5"><div className="mb-4 flex items-center gap-3"><span className="rounded-lg bg-blue-50 p-2 text-blue-700"><MapPin size={20} /></span><div><h3 className="font-bold text-slate-900">Zone Manager to Zone</h3><p className="text-sm text-slate-500">Choose the zone this Zone Manager is responsible for.</p></div></div><AssignmentTable rows={zmEmployees} type="zone" /></div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5"><div className="mb-4 flex items-center gap-3"><span className="rounded-lg bg-orange-50 p-2 text-orange-700"><Store size={20} /></span><div><h3 className="font-bold text-slate-900">Vendor Hub Agent to Vendor</h3><p className="text-sm text-slate-500">Choose the vendor this Vendor Hub Agent is attached to.</p></div></div><AssignmentTable rows={vhaEmployees} type="vendor" /></div>
      <p className="text-xs text-slate-500"><Users size={13} className="mr-1 inline" /> Changes are restricted to Admin/COO sessions and recorded in employee audit logs.</p>
    </>}
  </section>;
}

