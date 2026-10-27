"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type EmployeeApproval = {
  employee_id: string;
  employee_number: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  role_name: string | null;
  system_role: string | null;
  employee_status: string | null;
  employment_status: string | null;
  created_at: string | null;
};

export default function PendingEmployeeApprovalsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [approvals, setApprovals] = useState<EmployeeApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionEmployeeId, setActionEmployeeId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPendingApprovals = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError("");

      try {
        const { data, error: rpcError } = await (supabase as any).rpc(
          "hr_list_pending_employee_approvals"
        );

        if (rpcError) {
          setApprovals([]);
          setError(rpcError.message || "Unable to load pending employee approvals.");
          return;
        }

        setApprovals(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Loading employee approvals failed:", err);
        setError("Unable to load pending employee approvals.");
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (
        profileError ||
        String(profile?.role ?? "").toUpperCase() !== "HR" ||
        String(profile?.status ?? "").trim().toLowerCase() !== "active"
      ) {
        router.replace("/login");
        return;
      }

      await loadPendingApprovals();
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [router, supabase, loadPendingApprovals]);

  async function decideApproval(
    employee: EmployeeApproval,
    decision: "approve" | "reject",
    rejectionReason: string | null = null
  ) {
    setError("");
    setNotice("");
    setActionEmployeeId(employee.employee_id);

    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "hr_decide_employee_approval",
        {
          p_employee_id: employee.employee_id,
          p_decision: decision,
          p_rejection_reason: rejectionReason,
        }
      );

      if (rpcError) {
        setError(rpcError.message || "The employee decision could not be saved.");
        return;
      }

      if (!data?.success) {
        setError("The employee decision was not confirmed by the database.");
        return;
      }

      const fullName = `${employee.first_name} ${employee.last_name}`.trim();

      setNotice(
        decision === "approve"
          ? `${fullName} has been approved. The account is now active and requires a password change at first login.`
          : `${fullName} has been rejected. The decision and reason have been recorded.`
      );

      await loadPendingApprovals(true);
    } catch (err) {
      console.error("Saving employee approval failed:", err);
      setError("The employee decision could not be saved. Please refresh and try again.");
    } finally {
      setActionEmployeeId(null);
    }
  }

  function handleApprove(employee: EmployeeApproval) {
    const fullName = `${employee.first_name} ${employee.last_name}`.trim();

    if (
      window.confirm(
        `Approve ${fullName}?\n\nThis activates the employee profile and requires a password change at first login.`
      )
    ) {
      void decideApproval(employee, "approve");
    }
  }

  function handleReject(employee: EmployeeApproval) {
    const fullName = `${employee.first_name} ${employee.last_name}`.trim();
    const reason = window.prompt(
      `Enter the reason for rejecting ${fullName}. A reason is required.`
    );

    if (reason === null) return;

    if (!reason.trim()) {
      setError("A rejection reason is required.");
      return;
    }

    if (window.confirm(`Confirm rejection of ${fullName}?`)) {
      void decideApproval(employee, "reject", reason.trim());
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
              MKH Human Resources
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              Pending Employee Approvals
            </h1>
            <p className="mt-2 text-slate-600">
              Review employee accounts created by Admin/COO before activation.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/hr"
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 hover:bg-slate-100"
            >
              HR Dashboard
            </Link>

            <button
              type="button"
              onClick={() => void loadPendingApprovals()}
              disabled={loading || actionEmployeeId !== null}
              className="rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Refresh List
            </button>
          </div>
        </header>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Awaiting HR decision</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">
            {approvals.length}
          </p>
        </section>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700"
          >
            {notice}
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-slate-500">
              Loading pending approvals…
            </div>
          ) : approvals.length === 0 ? (
            <div className="p-12 text-center">
              <h2 className="text-xl font-semibold text-slate-800">
                No pending employee approvals
              </h2>
              <p className="mt-2 text-slate-500">
                New employee accounts created by Admin/COO will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] border-collapse text-left">
                <thead className="bg-slate-100 text-sm text-slate-600">
                  <tr>
                    <th className="p-4 font-semibold">Employee</th>
                    <th className="p-4 font-semibold">Role</th>
                    <th className="p-4 font-semibold">Created</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold">HR Decision</th>
                  </tr>
                </thead>

                <tbody>
                  {approvals.map((employee) => {
                    const fullName =
                      `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim();

                    return (
                      <tr key={employee.employee_id} className="border-t border-slate-200">
                        <td className="p-4">
                          <p className="font-semibold text-slate-900">{fullName || "Unnamed employee"}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {employee.employee_number || "No employee number"}
                          </p>
                          <p className="text-sm text-slate-500">
                            {employee.email || "No email"}
                          </p>
                        </td>

                        <td className="p-4">
                          <p className="font-medium text-slate-800">
                            {employee.role_name || "Role not set"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {employee.system_role || ""}
                          </p>
                        </td>

                        <td className="p-4 text-sm text-slate-600">
                          {employee.created_at
                            ? new Date(employee.created_at).toLocaleString()
                            : "—"}
                        </td>

                        <td className="p-4">
                          <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                            Pending
                          </span>
                          <p className="mt-2 text-xs text-slate-500">
                            {employee.employment_status || employee.employee_status || "Awaiting review"}
                          </p>
                        </td>

                        <td className="p-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={actionEmployeeId !== null}
                              onClick={() => handleApprove(employee)}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {actionEmployeeId === employee.employee_id
                                ? "Saving…"
                                : "Approve"}
                            </button>

                            <button
                              type="button"
                              disabled={actionEmployeeId !== null}
                              onClick={() => handleReject(employee)}
                              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}