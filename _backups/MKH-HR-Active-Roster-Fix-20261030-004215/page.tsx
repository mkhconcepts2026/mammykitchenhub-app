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
  Trash2,
} from "lucide-react";

const supabase = createClient();

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const router = useRouter();
  const [showCredentials, setShowCredentials] = useState(false);
const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

const [employeeToDelete, setEmployeeToDelete] = useState<any>(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  async function loadEmployees() {
   const { data } = await supabase
  .from("employees")
  .select(`
    *,
    department:department_id (
      name
    ),
    role:role_id (
      name
    ),
    state:state_id (
      name
    ),
    profiles:profile_id (
      must_change_password
    )
  `)
  .order("created_at", {
    ascending: false,
  });

setEmployees(data || []);
  }

 async function deleteEmployee() {

  if (!employeeToDelete) {

    alert("No employee selected.");

    return;

  }

  console.log("Deleting employee:", employeeToDelete);

  const response = await fetch(
    "/api/hr/employees/delete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        employeeId: employeeToDelete.id,
      }),
    }
  );

  console.log("HTTP Status:", response.status);

  const result = await response.json();

  console.log("API Result:", result);

  if (!response.ok || !result.success) {

    alert(result.message);

    return;

  }

  alert("Employee deleted successfully.");

  setShowDeleteDialog(false);

  setEmployeeToDelete(null);

  await loadEmployees();

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

<div className="flex items-center gap-3">

  <button
    onClick={() => router.push("/hr")}
    className="
      rounded-xl
      border
      bg-white
      px-4
      py-2
      font-semibold
      transition
      hover:bg-gray-50
    "
  >
    ← HR Dashboard
  </button>

</div>

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

               <th className="p-4 text-left">Role</th>

               <th className="p-4 text-left">State</th>

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
  {employee.department?.name ?? "-"}
             </td>

             <td className="p-4">
  {employee.role?.name ?? "-"}
</td>


<td className="p-4">
  {employee.state?.name ?? "-"}
</td>

                <td className="p-4">
                  {employee.status}
                </td>

            
                <td className="p-4">

                 <div className="flex justify-center gap-4">

  <button
    title="View Employee"
  >
    <Eye size={18} />
  </button>

  <button
    title="Edit Employee"
  >
    <Pencil size={18} />
  </button>

 <button
  title="Login Credentials"
  onClick={() => {

    setSelectedEmployee({

      employeeNumber:
        employee.employee_number,

      fullName:
        `${employee.first_name} ${employee.last_name}`,

      username:
        employee.username,

      loginId:
        employee.email,

       profileId:
    employee.profile_id,

      temporaryPassword:
  employee.profiles?.must_change_password
    ? "First Login Pending"
    : "Password Already Changed",

    });

    setShowCredentials(true);

  }}
>
  <KeyRound size={18} />
</button>

<button
  title="Delete Employee"
 onClick={() => {

  setEmployeeToDelete(employee);

  setShowDeleteDialog(true);

}}
>
  <Trash2
    size={18}
    className="text-red-600"
  />
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
<EmployeeCredentialsModal

  open={showCredentials}

  credentials={selectedEmployee}

  profileId={
    selectedEmployee?.profileId
  }

  onPasswordReset={(newPassword) => {

    setSelectedEmployee((prev: any) => ({

      ...prev,

      temporaryPassword: newPassword,

    }));

  }}

  onClose={() => {

    setShowCredentials(false);

  }}

/>

{showDeleteDialog && (

  <div
    className="
      fixed
      inset-0
      z-50
      flex
      items-center
      justify-center
      bg-black/50
    "
  >

    <div
      className="
        w-full
        max-w-md
        rounded-2xl
        bg-white
        p-8
        shadow-xl
      "
    >

      <h2 className="mb-4 text-2xl font-bold text-red-600">

        Delete Employee

      </h2>

      <p className="mb-6 text-gray-600">

        You are about to permanently delete this employee record.

        <br /><br />

        <strong>

          {employeeToDelete?.first_name}{" "}
          {employeeToDelete?.last_name}

        </strong>

        <br /><br />

        This action cannot be undone.

        <br /><br />

        Do you want to continue?

      </p>

      <div className="flex justify-end gap-3">

        <button

          onClick={() => {

            setShowDeleteDialog(false);

            setEmployeeToDelete(null);

          }}

          className="
            rounded-xl
            border
            px-5
            py-2
          "

        >

          Cancel

        </button>

        <button

         onClick={deleteEmployee}

          className="
            rounded-xl
            bg-red-600
            px-5
            py-2
            text-white
          "

        >

          Delete Employee

        </button>

      </div>

    </div>

  </div>

)}
    </div>
  );
}