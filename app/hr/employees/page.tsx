"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Search, UserPlus, Eye, Pencil } from "lucide-react";

const supabase = createClient();

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadEmployees();
  }, []);

  async function loadEmployees() {
    const { data } = await supabase
      .from("employees")
      .select("*")
      .order("created_at", { ascending: false });

    setEmployees(data || []);
  }

  const filteredEmployees = employees.filter((employee) => {
    const name =
      `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.toLowerCase();

    return (
      name.includes(search.toLowerCase()) ||
      (employee.employee_number ?? "")
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  });

  return (
    <div className="min-h-screen bg-gray-100 p-8">

      <div className="mb-8 flex items-center justify-between">

        <div>

          <h1 className="text-4xl font-bold text-orange-600">
            Employees
          </h1>

          <p className="text-gray-500">
            Manage all MKH employees.
          </p>

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
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee..."
            className="w-full border-none outline-none"
          />

        </div>

      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow">

        <table className="w-full">

          <thead className="bg-orange-50">

            <tr>

              <th className="p-4 text-left">Photo</th>

              <th className="p-4 text-left">Employee No.</th>

              <th className="p-4 text-left">Name</th>

              <th className="p-4 text-left">Department</th>

              <th className="p-4 text-left">Status</th>

              <th className="p-4 text-center">Actions</th>

            </tr>

          </thead>

          <tbody>

            {filteredEmployees.map((employee) => (

              <tr
                key={employee.id}
                className="border-t"
              >

                <td className="p-4">

                  {employee.photo_url ? (

                    <img
                      src={employee.photo_url}
                      className="h-12 w-12 rounded-full object-cover"
                    />

                  ) : (

                    <div className="h-12 w-12 rounded-full bg-gray-200" />

                  )}

                </td>

                <td className="p-4">
                  {employee.employee_number}
                </td>

                <td className="p-4">
                  {employee.first_name} {employee.last_name}
                </td>

                <td className="p-4">
                  {employee.department_id}
                </td>

                <td className="p-4">
                  {employee.status}
                </td>

                <td className="p-4">

                  <div className="flex justify-center gap-4">

                    <button>
                      <Eye size={18} />
                    </button>

                    <button>
                      <Pencil size={18} />
                    </button>

                  </div>

                </td>

              </tr>

            ))}

            {filteredEmployees.length === 0 && (

              <tr>

                <td
                  colSpan={6}
                  className="p-10 text-center text-gray-500"
                >
                  No employees found.
                </td>

              </tr>

            )}

          </tbody>

        </table>

      </div>

    </div>
  );
}