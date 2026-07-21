"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Building2,
  Plus,
  Search,
  ArrowLeft,
  Pencil,
  Power,
} from "lucide-react";

export default function DepartmentsPage() {
  const supabase = createClient();

  const [departments, setDepartments] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState("");

const [showModal, setShowModal] = useState(false);

const [editingDepartment, setEditingDepartment] = useState<any>(null);

const [departmentName, setDepartmentName] = useState("");

const [departmentDescription, setDepartmentDescription] = useState("");

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    setFiltered(
      departments.filter((dept) =>
        dept.name.toLowerCase().includes(search.toLowerCase())
      )
    );
  }, [search, departments]);

  async function loadDepartments() {
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .order("name");

    if (error) {
      console.error(error);
      return;
    }

    setDepartments(data || []);
    setFiltered(data || []);
  }

async function saveDepartment() {

  if (!departmentName.trim()) {
    alert("Department name is required.");
    return;
  }

  let error;

  if (editingDepartment) {

    ({ error } = await supabase
      .from("departments")
      .update({
        name: departmentName,
        description: departmentDescription,
      })
      .eq("id", editingDepartment.id));

  } else {

    ({ error } = await supabase
      .from("departments")
      .insert({
        name: departmentName,
        description: departmentDescription,
        status: "active",
      }));

  }

  if (error) {
    alert(error.message);
    return;
  }

  setDepartmentName("");
  setDepartmentDescription("");
  setEditingDepartment(null);
  setShowModal(false);

  loadDepartments();

}

  return (
    <div className="min-h-screen bg-orange-50 p-8">

      {/* Header */}

      <div className="mb-8 flex items-center justify-between">

        <div>

          <div className="flex items-center gap-3">

            <Building2 className="text-orange-600" size={38} />

            <div>

              <h1 className="text-4xl font-bold text-orange-600">

                Departments

              </h1>

              <p className="mt-1 text-gray-500">

                Manage MKH organizational departments.

              </p>

            </div>

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
  onClick={() => setShowModal(true)}
  className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white hover:bg-orange-600"
          >
            <Plus size={18} />
            Add Department
          </button>

        </div>

      </div>

      {/* Search */}

      <div className="mb-6 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">

        <Search className="text-gray-400" />

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search departments..."
          className="w-full border-none outline-none"
        />

      </div>

      {/* Table */}

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm">

        <table className="w-full">

          <thead className="bg-orange-100">

            <tr>

              <th className="p-5 text-left">Department</th>

              <th className="p-5 text-left">Description</th>

              <th className="p-5 text-left">Status</th>

              <th className="p-5 text-center">Actions</th>

            </tr>

          </thead>

          <tbody>

            {filtered.map((dept) => (

              <tr
                key={dept.id}
                className="border-t"
              >

                <td className="p-5 font-semibold">

                  {dept.name}

                </td>

                <td className="p-5">

                  {dept.description}

                </td>

                <td className="p-5">

                  <span className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-700">

                    {dept.status}

                  </span>

                </td>

                <td className="p-5">

                  <div className="flex justify-center gap-2">

                    <button
  onClick={() => {
    setEditingDepartment(dept);
    setDepartmentName(dept.name);
    setDepartmentDescription(dept.description || "");
    setShowModal(true);
  }}
  className="rounded-xl bg-blue-50 p-2 hover:bg-blue-100"
>
  <Pencil size={18} />
</button>

                    <button
  onClick={async () => {
    const newStatus =
      dept.status === "active"
        ? "inactive"
        : "active";

    const { error } = await supabase
      .from("departments")
      .update({
        status: newStatus,
      })
      .eq("id", dept.id);

    if (!error) {
      loadDepartments();
    }
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
                  colSpan={4}
                  className="p-12 text-center text-gray-500"
                >

                  No departments found.

                </td>

              </tr>

            )}

          </tbody>

        </table>

      </div>

{showModal && (

<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">

  <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl">

   <h2 className="mb-6 text-3xl font-bold">

  {editingDepartment ? "Edit Department" : "Add Department"}

</h2>

    <div className="space-y-5">

      <input
        value={departmentName}
        onChange={(e) =>
          setDepartmentName(e.target.value)
        }
        placeholder="Department Name"
        className="w-full rounded-xl border p-4"
      />

      <textarea
        value={departmentDescription}
        onChange={(e) =>
          setDepartmentDescription(e.target.value)
        }
        placeholder="Description"
        rows={4}
        className="w-full rounded-xl border p-4"
      />

    </div>

    <div className="mt-8 flex justify-end gap-3">

      <button
        onClick={() => setShowModal(false)}
        className="rounded-xl border px-5 py-3"
      >

        Cancel

      </button>

      <button
        onClick={saveDepartment}
        className="rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white hover:bg-orange-600"
      >

        {editingDepartment ? "Update Department" : "Save Department"}

      </button>

    </div>

  </div>

</div>

)}

    </div>
  );
}