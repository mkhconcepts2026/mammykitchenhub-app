"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import EmployeeCredentialsModal from "@/components/hr/EmployeeCredentialsModal";
import { createClient } from "@/lib/supabase/client";
import {
  Search,
  UserPlus,
  Eye,
  Pencil,
  KeyRound,
  Power,
  CheckCircle2,
} from "lucide-react";

const supabase = createClient();

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const router = useRouter();
  const [showCredentials, setShowCredentials] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [employeeToDeactivate, setEmployeeToDeactivate] = useState<any>(null);
  const [actionBusyEmployeeId, setActionBusyEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    void loadEmployees();
  }, []);

  async function loadEmployees() {
    const { data, error } = await supabase
      .from("employees")
      .select(`
        *,
        department:department_id (name),
        role:role_id (name),
        state:state_id (name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Unable to load employees:", error);
      alert("Unable to load employees. Please refresh and try again.");
      return;
    }

    // Load linked profiles explicitly by ID so the employee lifecycle checks
    // always receive a predictable profile object instead of relying on an
    // ambiguous embedded relationship shape.
    const profileIds = Array.from(
      new Set(
        (data || [])
          .map((employee: any) => employee.profile_id)
          .filter((profileId: unknown): profileId is string =>
            typeof profileId === "string" && profileId.length > 0
          )
      )
    );

    let profileRows: any[] = [];

    if (profileIds.length > 0) {
      const { data: linkedProfiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, must_change_password, status, role")
        .in("id", profileIds);

      if (profilesError) {
        console.error("Unable to load linked employee profiles:", profilesError);
        alert("Unable to load employee login profiles. Please refresh and try again.");
        return;
      }

      profileRows = linkedProfiles || [];
    }

    const profilesById = new Map<string, any>(
      profileRows.map((profile: any) => [profile.id, profile] as [string, any])
    );

    setEmployees(
      (data || []).map((employee: any) => ({
        ...employee,
        profiles: profilesById.get(employee.profile_id) || null,
      }))
    );
  }

  async function deactivateEmployee() {
    if (!employeeToDeactivate) {
      alert("No employee selected.");
      return;
    }

    const employee = employeeToDeactivate;
    setActionBusyEmployeeId(employee.id);

    try {
      // Keep the existing certified safe-deactivation endpoint unchanged.
      const response = await fetch("/api/hr/employees/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: employee.id }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.message || "The employee account could not be deactivated.");
        return;
      }

      alert(result.message || "Employee account deactivated. Historical records retained.");
      setShowDeactivateDialog(false);
      setEmployeeToDeactivate(null);
      await loadEmployees();
    } catch (error) {
      console.error("Employee deactivation failed:", error);
      alert("The employee account could not be deactivated. Please try again.");
    } finally {
      setActionBusyEmployeeId(null);
    }
  }

  async function activateEmployee(employee: any) {
    const fullName = `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim();
    if (!window.confirm(`Activate the account for ${fullName}?\n\nThis restores the employee account only. It does not reactivate revoked role-access assignments or change operational assignments.`)) {
      return;
    }

    setActionBusyEmployeeId(employee.id);
    try {
      const response = await fetch("/api/hr/employees/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: employee.id }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.message || "The employee account could not be activated.");
        return;
      }

      alert(result.message || "Employee account activated.");
      await loadEmployees();
    } catch (error) {
      console.error("Employee activation failed:", error);
      alert("The employee account could not be activated. Please try again.");
    } finally {
      setActionBusyEmployeeId(null);
    }
  }

  const filteredEmployees = employees.filter((employee) => {
    const name = `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.toLowerCase();
    return (
      name.includes(search.toLowerCase()) ||
      String(employee.employee_number ?? "").toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/hr")}
            className="rounded-xl border bg-white px-4 py-2 font-semibold transition hover:bg-gray-50"
          >
            ← HR Dashboard
          </button>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-orange-600">Employees</h1>
          <p className="text-gray-500">Manage all MKH employees.</p>
        </div>

        <Link
          href="/hr/employees/new"
          className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-white hover:bg-orange-600"
        >
          <UserPlus size={18} />
          New Employee
        </Link>
      </div>

      <div className="mb-6 rounded-2xl bg-white p-4 shadow">
        <div className="flex items-center gap-3">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search employee..."
            className="w-full border-none outline-none"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-orange-50">
              <tr>
                <th className="p-4 text-left">Photo</th>
                <th className="p-4 text-left">Employee No.</th>
                <th className="p-4 text-left">Name</th>
                <th className="p-4 text-left">Department</th>
                <th className="p-4 text-left">Role</th>
                <th className="p-4 text-left">State</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((employee) => {
                const employeeStatus = String(employee.status ?? "").trim().toLowerCase();
                const employmentStatus = String(employee.employment_status ?? "").trim().toLowerCase();
                const profileStatus = String(employee.profiles?.status ?? "").trim().toLowerCase();
                const isActive = employeeStatus === "active" && employmentStatus === "active" && profileStatus === "active";
                const isSafelyDeactivated = employeeStatus === "inactive" && employmentStatus === "terminated" && profileStatus === "inactive";
                const isOnboarding = ["onboarding", "pending", "pending_activation", "pending approval"].includes(employeeStatus) || ["pending activation", "pending", "pending approval"].includes(employmentStatus) || profileStatus === "pending";
                const isBusy = actionBusyEmployeeId === employee.id;

                return (
                  <tr key={employee.id} className="border-t">
                    <td className="p-4">
                      {employee.photo_url ? (
                        <img src={employee.photo_url} alt="Employee" className="h-12 w-12 rounded-full object-cover" />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-gray-200" />
                      )}
                    </td>
                    <td className="p-4">{employee.employee_number}</td>
                    <td className="p-4">{employee.first_name} {employee.last_name}</td>
                    <td className="p-4">{employee.department?.name ?? "-"}</td>
                    <td className="p-4">{employee.role?.name ?? "-"}</td>
                    <td className="p-4">{employee.state?.name ?? "-"}</td>
                    <td className="p-4">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          isActive
                            ? "bg-emerald-100 text-emerald-800"
                            : isSafelyDeactivated
                              ? "bg-red-100 text-red-800"
                              : isOnboarding
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-700"
                        }`}>
                          {employee.status || "Unknown"}
                        </span>
                        <span className="text-xs text-gray-500">
                          {employee.employment_status || "Employment status unavailable"}
                        </span>
                        {profileStatus && profileStatus !== employeeStatus && (
                          <span className="text-xs text-gray-400">Login profile: {employee.profiles?.status}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap items-center justify-center gap-3">
                        <button type="button" title="View Employee" aria-label="View Employee">
                          <Eye size={18} />
                        </button>
                        <button type="button" title="Edit Employee" aria-label="Edit Employee">
                          <Pencil size={18} />
                        </button>
                        <button
                          type="button"
                          title="Login Credentials"
                          aria-label="Login Credentials"
                          onClick={() => {
                            setSelectedEmployee({
                              employeeNumber: employee.employee_number,
                              fullName: `${employee.first_name} ${employee.last_name}`,
                              username: employee.username,
                              loginId: employee.email,
                              profileId: employee.profile_id,
                              temporaryPassword: employee.profiles?.must_change_password
                                ? "First Login Pending"
                                : "Password Already Changed",
                            });
                            setShowCredentials(true);
                          }}
                        >
                          <KeyRound size={18} />
                        </button>

                        {isActive && (
                          <button
                            type="button"
                            title="Deactivate Account"
                            disabled={isBusy || actionBusyEmployeeId !== null}
                            onClick={() => {
                              setEmployeeToDeactivate(employee);
                              setShowDeactivateDialog(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Power size={15} />
                            Deactivate Account
                          </button>
                        )}

                        {isSafelyDeactivated && (
                          <button
                            type="button"
                            title="Activate Account"
                            disabled={isBusy || actionBusyEmployeeId !== null}
                            onClick={() => void activateEmployee(employee)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            <CheckCircle2 size={15} />
                            {isBusy ? "Activating…" : "Activate Account"}
                          </button>
                        )}

                        {isOnboarding && (
                          <span className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                            HR approval workflow
                          </span>
                        )}

                        {!isActive && !isSafelyDeactivated && !isOnboarding && (
                          <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                            Status review required
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-gray-500">
                    No employees found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EmployeeCredentialsModal
        open={showCredentials}
        credentials={selectedEmployee}
        profileId={selectedEmployee?.profileId}
        onPasswordReset={(newPassword) => {
          setSelectedEmployee((previous: any) => ({
            ...previous,
            temporaryPassword: newPassword,
          }));
        }}
        onClose={() => setShowCredentials(false)}
      />

      {showDeactivateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
            <h2 className="mb-4 text-2xl font-bold text-red-600">Deactivate Account</h2>
            <p className="mb-6 text-gray-600">
              This will remove the employee from the active roster and revoke account access using MKH&apos;s existing safe-deactivation workflow. The employee record, audit history and existing operational assignment records will be retained; assignments will not be recreated by a later account activation.
              <br /><br />
              <strong>{employeeToDeactivate?.first_name} {employeeToDeactivate?.last_name}</strong>
              <br /><br />
              Do you want to continue?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeactivateDialog(false);
                  setEmployeeToDeactivate(null);
                }}
                disabled={actionBusyEmployeeId !== null}
                className="rounded-xl border px-5 py-2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void deactivateEmployee()}
                disabled={actionBusyEmployeeId !== null}
                className="rounded-xl bg-red-600 px-5 py-2 font-semibold text-white disabled:opacity-50"
              >
                {actionBusyEmployeeId ? "Deactivating…" : "Deactivate Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
