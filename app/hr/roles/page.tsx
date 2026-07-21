"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ShieldCheck,
  Plus,
  Search,
  ArrowLeft,
  Pencil,
  Power,
} from "lucide-react";

export default function EmployeeRolesPage() {
  const supabase = createClient();

  const [roles, setRoles] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState("");

const [showModal, setShowModal] = useState(false);

const [editingRole, setEditingRole] = useState<any>(null);

const [roleName, setRoleName] = useState("");

const [roleDescription, setRoleDescription] = useState("");

const [dashboard, setDashboard] = useState("");

const [systemRole, setSystemRole] = useState("");

  useEffect(() => {
    loadRoles();
  }, []);

  useEffect(() => {
    setFiltered(
      roles.filter((role) =>
        role.name.toLowerCase().includes(search.toLowerCase())
      )
    );
  }, [search, roles]);

async function saveRole() {

  if (!roleName.trim()) {

    alert("Role name is required.");

    return;

  }

  let error;

  if (editingRole) {

    ({ error } = await supabase
      .from("employee_roles")
      .update({
        name: roleName,
        description: roleDescription,
        dashboard,
        system_role: systemRole,
      })
      .eq("id", editingRole.id));

  } else {

    ({ error } = await supabase
      .from("employee_roles")
      .insert({
        name: roleName,
        description: roleDescription,
        dashboard,
        system_role: systemRole,
        status: "active",
      }));

  }

  if (error) {

    alert(error.message);

    return;

  }

  setRoleName("");

  setRoleDescription("");

  setDashboard("");

  setSystemRole("");

  setEditingRole(null);

  setShowModal(false);

  loadRoles();

}

  async function loadRoles() {
    const { data, error } = await supabase
      .from("employee_roles")
      .select("*")
      .order("name");

    if (error) {
      console.error(error);
      return;
    }

    setRoles(data || []);
    setFiltered(data || []);
  }

  return (
    <div className="min-h-screen bg-orange-50 p-8">

      {/* Header */}

      <div className="mb-8 flex items-center justify-between">

        <div className="flex items-center gap-3">

          <ShieldCheck
            className="text-orange-600"
            size={38}
          />

          <div>

            <h1 className="text-4xl font-bold text-orange-600">

              Employee Roles

            </h1>

            <p className="mt-1 text-gray-500">

              Manage employee roles and dashboard access.

            </p>

          </div>

        </div>

        <div className="flex gap-3">

          <Link
            href="/hr"
            className="flex items-center gap-2 rounded-xl border bg-white px-5 py-3 hover:bg-gray-50"
          >
            <ArrowLeft size={18} />
            HR Dashboard
          </Link>

         <button
  onClick={() => {
    setEditingRole(null);
    setRoleName("");
    setRoleDescription("");
    setDashboard("");
    setSystemRole("");
    setShowModal(true);
  }}
  className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white hover:bg-orange-600"
>
  <Plus size={18} />
  Add Role
</button>

        </div>

      </div>

      {/* Search */}

      <div className="mb-6 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">

        <Search className="text-gray-400" />

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search roles..."
          className="w-full border-none outline-none"
        />

      </div>

      {/* Table */}

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm">

        <table className="w-full">

          <thead className="bg-orange-100">

            <tr>

              <th className="p-5 text-left">Role</th>

              <th className="p-5 text-left">System Role</th>

              <th className="p-5 text-left">Dashboard</th>

              <th className="p-5 text-left">Status</th>

              <th className="p-5 text-center">Actions</th>

            </tr>

          </thead>

          <tbody>

            {filtered.map((role) => (

              <tr
                key={role.id}
                className="border-t"
              >

                <td className="p-5 font-semibold">

                  {role.name}

                </td>

                <td className="p-5">

                  {role.system_role}

                </td>

                <td className="p-5">

                  {role.dashboard}

                </td>

                <td className="p-5">

                  <span className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-700">

                    {role.status}

                  </span>

                </td>

                <td className="p-5">

                  <div className="flex justify-center gap-2">

                    <button
  onClick={() => {
    setEditingRole(role);
    setRoleName(role.name || "");
    setRoleDescription(role.description || "");
    setDashboard(role.dashboard || "");
    setSystemRole(role.system_role || "");
    setShowModal(true);
  }}
  className="rounded-xl bg-blue-50 p-2 hover:bg-blue-100"
>
  <Pencil size={18} />
</button>

                  <button
  onClick={async () => {
    const newStatus =
      role.status === "active" ? "inactive" : "active";

    console.log("Role ID:", role.id);
    console.log("Changing to:", newStatus);

    const { data, error } = await supabase
      .from("employee_roles")
      .update({ status: newStatus })
      .eq("id", role.id)
      .select();

    console.log("Result:", data);
    console.log("Error:", error);

    if (error) {
      alert(error.message);
      return;
    }

    await loadRoles();
  }}
  className="rounded-xl bg-red-50 p-2 hover:bg-red-100"
>
  <Power size={18} />
</button>

                  </div>

                </td>

              </tr>

            ))}

            {filtered.length === 0 && (

              <tr>

                <td
                  colSpan={5}
                  className="p-12 text-center text-gray-500"
                >

                  No employee roles found.

                </td>

              </tr>

            )}

          </tbody>

        </table>

      </div>

        {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-xl">

            <h2 className="mb-6 text-3xl font-bold">
              {editingRole ? "Edit Role" : "Add Role"}
            </h2>

            <div className="space-y-4">

              <input
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="Role Name"
                className="w-full rounded-xl border p-3"
              />

              <textarea
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
                placeholder="Description"
                className="w-full rounded-xl border p-3"
              />

              <input
                value={dashboard}
                onChange={(e) => setDashboard(e.target.value)}
                placeholder="Dashboard Route"
                className="w-full rounded-xl border p-3"
              />

              <input
                value={systemRole}
                onChange={(e) => setSystemRole(e.target.value)}
                placeholder="System Role"
                className="w-full rounded-xl border p-3"
              />

            </div>

            <div className="mt-8 flex justify-end gap-3">

              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingRole(null);
                }}
                className="rounded-xl border px-5 py-3"
              >
                Cancel
              </button>

              <button
                onClick={saveRole}
                className="rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white hover:bg-orange-600"
              >
                {editingRole ? "Update Role" : "Save Role"}
              </button>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}