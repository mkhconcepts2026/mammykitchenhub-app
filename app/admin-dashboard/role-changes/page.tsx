"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, Send, Clock3 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type EmployeeOption = {
  employee_id: string;
  employee_number: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  current_employee_role_id: string | null;
  current_employee_role: string | null;
  profile_role: string | null;
  current_access_role: string | null;
};

type RoleOption = {
  role_id: string;
  role_name: string;
  description: string | null;
  dashboard: string | null;
  system_role: string | null;
};

type RequestRow = {
  request_id: string;
  employee_name: string;
  employee_number: string | null;
  previous_employee_role: string | null;
  requested_job_role: string;
  requested_access_role: string | null;
  previous_access_role: string;
  reason: string;
  status: string;
  requested_at: string;
  processing_notes: string | null;
};

export default function EmployeeRoleChangeRequestsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [jobRoleId, setJobRoleId] = useState("");
  const [accessRoleId, setAccessRoleId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const accessRoles = roles.filter(
    (role) =>
      role.system_role &&
      !["", "NONE"].includes(role.system_role.toUpperCase())
  );

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data: effectiveRole, error: roleError } =
        await (supabase as any).rpc("current_effective_app_role");

      if (roleError) throw roleError;

      if (!["ADMIN", "COO"].includes(String(effectiveRole ?? "").toUpperCase())) {
        router.replace("/login");
        return;
      }

      const [employeeResult, roleResult, requestResult] = await Promise.all([
        (supabase as any).rpc("admin_list_employees_for_role_change"),
        (supabase as any).rpc("list_employee_role_change_role_catalogue"),
        (supabase as any).rpc("list_employee_role_change_requests", {
          p_status: null,
        }),
      ]);

      const firstError =
        employeeResult.error || roleResult.error || requestResult.error;

      if (firstError) throw firstError;

      setEmployees(employeeResult.data ?? []);
      setRoles(roleResult.data ?? []);
      setRequests(requestResult.data ?? []);
    } catch (err: any) {
      setError(err?.message || "Unable to load role-change information.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // The page loads once per mounted session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!employeeId || !jobRoleId || !accessRoleId || !reason.trim()) {
      setError("Complete all fields and provide a reason for the change.");
      return;
    }

    setSaving(true);

    try {
      const { error: rpcError } = await (supabase as any).rpc(
        "submit_employee_role_change_request",
        {
          p_employee_id: employeeId,
          p_requested_role_id: jobRoleId,
          p_requested_access_role_id: accessRoleId,
          p_reason: reason.trim(),
        }
      );

      if (rpcError) throw rpcError;

      setReason("");
      setNotice("Request submitted. HR must process it before access changes.");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Unable to submit this request.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <Link
          href="/admin-dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-orange-600"
        >
          <ArrowLeft size={17} />
          Back to Admin Dashboard
        </Link>

        <header className="flex flex-wrap items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
            <ShieldCheck size={28} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-orange-600">
              Human Resources Workflow
            </p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              Staff Role Changes
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Admin/COO submits the change request. HR reviews and implements
              approved access changes.
            </p>
          </div>
        </header>

        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {notice && (
          <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {notice}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-lg font-bold">Submit a role-change request</h2>
          <p className="mt-1 text-sm text-slate-500">
            Select the employee's job position and dashboard access separately.
          </p>

          {loading ? (
            <p className="py-8 text-sm text-slate-500">Loading employees and rolesâ€¦</p>
          ) : (
            <form onSubmit={submitRequest} className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="text-sm font-semibold">
                Employee
                <select
                  className={inputClass}
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  required
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option key={employee.employee_id} value={employee.employee_id}>
                      {[
                        employee.first_name,
                        employee.last_name,
                      ].filter(Boolean).join(" ")}{" "}
                      â€” {employee.employee_number || employee.email || employee.employee_id}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-semibold">
                Requested job position
                <select
                  className={inputClass}
                  value={jobRoleId}
                  onChange={(e) => setJobRoleId(e.target.value)}
                  required
                >
                  <option value="">Select job position</option>
                  {roles.map((role) => (
                    <option key={role.role_id} value={role.role_id}>
                      {role.role_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-semibold md:col-span-2">
                Requested dashboard access
                <select
                  className={inputClass}
                  value={accessRoleId}
                  onChange={(e) => setAccessRoleId(e.target.value)}
                  required
                >
                  <option value="">Select access role</option>
                  {accessRoles.map((role) => (
                    <option key={role.role_id} value={role.role_id}>
                      {role.role_name} â€” {role.system_role}
                      {role.dashboard ? ` (${role.dashboard})` : ""}
                    </option>
                  ))}
                </select>
                <span className="mt-2 block text-xs font-normal text-slate-500">
                  Only configured system roles are listed for dashboard access.
                </span>
              </label>

              <label className="text-sm font-semibold md:col-span-2">
                Reason for the change
                <textarea
                  className={inputClass}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Explain the staff role change and why the requested access is needed."
                  required
                />
              </label>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={saving || loading}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={17} />
                  {saving ? "Submittingâ€¦" : "Submit request to HR"}
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-3">
            <Clock3 size={22} className="text-slate-500" />
            <div>
              <h2 className="text-lg font-bold">Your request history</h2>
              <p className="text-sm text-slate-500">
                Requests submitted by your account.
              </p>
            </div>
          </div>

          {loading ? (
            <p className="py-6 text-sm text-slate-500">Loading request historyâ€¦</p>
          ) : requests.length === 0 ? (
            <p className="py-6 text-sm text-slate-500">No requests found.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {requests.map((request) => (
                <article key={request.request_id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold">{request.employee_name}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {request.previous_employee_role || "Unspecified position"}
                        {" â†’ "}
                        {request.requested_job_role}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Access: {request.previous_access_role} â†’ {request.requested_access_role || "Unspecified"}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-700">
                      {request.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{request.reason}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    Submitted: {new Date(request.requested_at).toLocaleString()}
                  </p>
                  {request.processing_notes && (
                    <p className="mt-2 text-sm text-slate-600">
                      HR notes: {request.processing_notes}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="text-xs leading-5 text-slate-500">
          Submitting a request does not change anyone's access immediately.
          HR must process the request. Existing profile identity fields are not
          modified by this workflow.
        </p>
      </div>
    </main>
  );
}