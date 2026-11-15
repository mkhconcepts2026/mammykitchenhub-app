"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  MapPin,
  RefreshCw,
  Save,
  Search,
  Store,
  Users,
  XCircle,
} from "lucide-react";

type AssignmentType = "territory" | "zone" | "vendor";
type Notice = { type: "success" | "error" | "info"; text: string } | null;

type Employee = {
  id: string;
  profile_id: string;
  display_name: string;
  email: string | null;
  role_name: string;
  system_role: string;
  profile_role: string;
  employee_status: string | null;
  employment_status: string | null;
  role_consistent: boolean;
  current_territory_id: string | null;
  current_zone_id: string | null;
  current_vendor_id: string | null;
  assignment_conflict: string | null;
};

type Choice = { id: string; name: string; code?: string | null; territory_id?: string | null };
type AssignmentData = {
  employees: Employee[];
  territories: Choice[];
  zones: Choice[];
  vendors: Choice[];
};

const EMPTY_DATA: AssignmentData = { employees: [], territories: [], zones: [], vendors: [] };

function normalizeRole(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function assignmentKind(value: unknown): AssignmentType | null {
  const role = normalizeRole(value);
  if (["territory", "trm", "territoryrelationshipmanager", "territorymanager"].includes(role)) return "territory";
  if (["zm", "zonemanager", "zonalmanager"].includes(role)) return "zone";
  if (["vha", "vendorhubagent"].includes(role)) return "vendor";
  return null;
}

export default function OperationalAssignments() {
  const [data, setData] = useState<AssignmentData>(EMPTY_DATA);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/admin/operational-assignments", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load operational assignments.");
      const nextData: AssignmentData = {
        employees: Array.isArray(result.employees) ? result.employees : [],
        territories: Array.isArray(result.territories) ? result.territories : [],
        zones: Array.isArray(result.zones) ? result.zones : [],
        vendors: Array.isArray(result.vendors) ? result.vendors : [],
      };
      setData(nextData);
      setDrafts(Object.fromEntries(nextData.employees.map((employee) => {
        const employeeKind = assignmentKind(employee.system_role);
        const current = employeeKind === "territory"
          ? employee.current_territory_id
          : employeeKind === "zone"
            ? employee.current_zone_id
            : employeeKind === "vendor"
              ? employee.current_vendor_id
              : null;
        return [employee.id, current ?? ""];
      })));
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to load operational assignments." });
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save(employee: Employee, type: AssignmentType, unassign = false) {
    const targetId = unassign ? null : (drafts[employee.id] || null);
    if (!unassign && !targetId) {
      setNotice({ type: "error", text: "Select a destination before saving the assignment." });
      return;
    }
    if (!employee.role_consistent || employee.assignment_conflict) {
      setNotice({ type: "error", text: employee.assignment_conflict || "Employee role records conflict. Resolve the role mismatch through the approved role-change workflow." });
      return;
    }
    const currentId = type === "territory"
      ? employee.current_territory_id
      : type === "zone"
        ? employee.current_zone_id
        : employee.current_vendor_id;
    if ((unassign && !currentId) || (!unassign && targetId === currentId)) return;

    setSaving(`${type}:${employee.id}`);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/operational-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employee.id,
          assignment_type: type,
          target_id: targetId,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Assignment could not be saved.");
      await load(false);
      setNotice({
        type: "success",
        text: unassign
          ? `${employee.display_name} has been unassigned. Assignment history was retained.`
          : `${employee.display_name}: ${type === "territory" ? "territory" : type === "zone" ? "zone" : "vendor"} assignment saved.`,
      });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Assignment could not be saved." });
    } finally {
      setSaving(null);
    }
  }

  const kind = (employee: Employee): AssignmentType | null => assignmentKind(employee.system_role);

  const filterRows = (type: AssignmentType) => {
    const query = search.trim().toLowerCase();
    return data.employees.filter((employee) => kind(employee) === type).filter((employee) => {
      if (!query) return true;
      return [employee.display_name, employee.email ?? "", employee.role_name, employee.system_role]
        .some((value) => value.toLowerCase().includes(query));
    });
  };

  const counts = {
    trm: data.employees.filter((employee) => kind(employee) === "territory").length,
    zm: data.employees.filter((employee) => kind(employee) === "zone").length,
    vha: data.employees.filter((employee) => kind(employee) === "vendor").length,
  };

  function AssignmentTable({ type, rows }: { type: AssignmentType; rows: Employee[] }) {
    const isTerritory = type === "territory";
    const isZone = type === "zone";
    const options = isTerritory ? data.territories : isZone ? data.zones : data.vendors;
    const title = isTerritory ? "Territory" : isZone ? "Zone" : "Vendor";
    const currentValue = (employee: Employee) => isTerritory
      ? employee.current_territory_id ?? ""
      : isZone
        ? employee.current_zone_id ?? ""
        : employee.current_vendor_id ?? "";
    const currentLabel = (employee: Employee) => {
      const id = currentValue(employee);
      const option = options.find((candidate) => candidate.id === id);
      if (!option) return id ? "Current assignment not found in active choices" : "Unassigned";
      if (isZone && option.territory_id) {
        const territory = data.territories.find((candidate) => candidate.id === option.territory_id);
        return `${option.name}${territory ? ` · ${territory.name}` : ""}`;
      }
      return option.name;
    };

    return (
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Employee</th>
              <th className="px-4 py-3 font-semibold">Current assignment</th>
              <th className="px-4 py-3 font-semibold">Assign to {title}</th>
              <th className="px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((employee) => {
              const draft = drafts[employee.id] ?? currentValue(employee);
              const rowBusy = saving === `${type}:${employee.id}`;
              const blocked = !employee.role_consistent || Boolean(employee.assignment_conflict);
              const current = currentValue(employee);
              return (
                <tr key={employee.id}>
                  <td className="px-4 py-3 align-top">
                    <div className="font-semibold text-slate-900">{employee.display_name}</div>
                    <div className="text-xs text-slate-500">{employee.email || "No email recorded"}</div>
                    <div className="mt-1 text-xs text-slate-500">{employee.role_name || employee.system_role}</div>
                    {(employee.employee_status || employee.employment_status) && (
                      <div className="mt-1 text-xs text-slate-500">{[employee.employee_status, employee.employment_status].filter(Boolean).join(" · ")}</div>
                    )}
                    {blocked && (
                      <div className="mt-2 flex max-w-xs items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                        <span>{employee.assignment_conflict || `Role mismatch: employee role is ${employee.system_role}, profile role is ${employee.profile_role}.`}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-slate-700">{currentLabel(employee)}</td>
                  <td className="px-4 py-3 align-top">
                    <select
                      aria-label={`${employee.display_name} assign to ${title}`}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 disabled:bg-slate-100"
                      value={draft}
                      disabled={blocked || rowBusy}
                      onChange={(event) => setDrafts((previous) => ({ ...previous, [employee.id]: event.target.value }))}
                    >
                      <option value="">Select {title.toLowerCase()}</option>
                      {options.map((option) => (
                        <option key={option.id} value={option.id}>
                          {isZone && option.territory_id
                            ? `${option.name}${option.code ? ` (${option.code})` : ""} · ${data.territories.find((territory) => territory.id === option.territory_id)?.name ?? "Territory not found"}`
                            : `${option.name}${option.code && isTerritory ? ` (${option.code})` : ""}`}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void save(employee, type)}
                        disabled={blocked || rowBusy || !draft || draft === current}
                        className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Save size={15} />{rowBusy ? "Saving…" : "Save"}
                      </button>
                      {current && (
                        <button
                          type="button"
                          onClick={() => void save(employee, type, true)}
                          disabled={blocked || rowBusy}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          title="Unassign; historical assignment remains recorded"
                        >
                          <XCircle size={15} />Clear
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No matching employees found for this role.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <section className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">Staff & operational assignments</p>
          <h2 className="mt-1 text-2xl font-black text-slate-900">Role-Aware Employee Assignment</h2>
          <p className="mt-1 max-w-4xl text-sm text-slate-600">
            Assign existing employees according to their approved role. This screen does not create accounts or change roles.
            Backend roles cannot be assigned to frontline operations, and these assignments do not themselves activate payout eligibility.
          </p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />Refresh
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="relative min-w-[260px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee name, email or role…" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-orange-500" />
        </div>
        <span className="text-xs text-slate-500">TRM: {counts.trm} · ZM: {counts.zm} · VHA: {counts.vha}</span>
      </div>

      {notice && <div role="status" className={`rounded-lg border px-4 py-3 text-sm ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : notice.type === "info" ? "border-blue-200 bg-blue-50 text-blue-800" : "border-red-200 bg-red-50 text-red-800"}`}>{notice.text}</div>}

      {loading ? <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">Loading employees and assignments…</div> : (
        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-lg bg-blue-50 p-2 text-blue-700"><MapPin size={20} /></span>
              <div><h3 className="font-bold text-slate-900">TRM → Territory</h3><p className="text-sm text-slate-500">One current territory per TRM. Resolve existing duplicate territory references before assigning.</p></div>
            </div>
            <AssignmentTable rows={filterRows("territory")} type="territory" />
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-lg bg-purple-50 p-2 text-purple-700"><Users size={20} /></span>
              <div><h3 className="font-bold text-slate-900">ZM → Zone</h3><p className="text-sm text-slate-500">The selected zone determines the ZM's territory. A TRM must be assigned to that territory first. The ZM's beneficiary/wallet identity is preserved.</p></div>
            </div>
            <AssignmentTable rows={filterRows("zone")} type="zone" />
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-lg bg-orange-50 p-2 text-orange-700"><Store size={20} /></span>
              <div><h3 className="font-bold text-slate-900">VHA → Vendor</h3><p className="text-sm text-slate-500">Vendor must have a valid zone, ZM and TRM. Reassigning a VHA may leave the previous vendor unassigned until replacement; that vendor’s new unassigned VHA share routes to Commission Pool 2.</p></div>
            </div>
            <AssignmentTable rows={filterRows("vendor")} type="vendor" />
          </section>
          <p className="text-xs text-slate-500">Assignment changes are recorded in operational assignment history. Beneficiary verification, wallet mapping and employee activation remain separate payout-readiness requirements.</p>
        </div>
      )}
    </section>
  );
}
