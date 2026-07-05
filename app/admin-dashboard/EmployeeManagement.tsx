"use client";
import { useState } from "react";
import EmployeeProvisioningWizard from "./EmployeeProvisioningWizard";

export default function EmployeeManagement() {
const [showWizard, setShowWizard] = useState(false);
  return (

    <div className="space-y-8">

      {/* Header */}

      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-4xl font-bold">

            👥 Employee Management

          </h1>

          <p className="mt-2 text-gray-500">

            Create, manage and monitor every MKH employee.

          </p>

        </div>

        <button

         onClick={() =>

  setShowWizard(true)

}

          className="rounded-2xl bg-orange-500 px-6 py-3 font-semibold text-white transition hover:bg-orange-600"

        >

          + Add Employee

        </button>

      </div>

      {/* Statistics */}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">

        <div className="rounded-3xl bg-orange-50 p-6">

          <p className="text-sm text-gray-500">

            Total Employees

          </p>

          <h2 className="mt-3 text-4xl font-bold">

            0

          </h2>

        </div>

        <div className="rounded-3xl bg-green-50 p-6">

          <p className="text-sm text-gray-500">

            Active

          </p>

          <h2 className="mt-3 text-4xl font-bold text-green-600">

            0

          </h2>

        </div>

        <div className="rounded-3xl bg-yellow-50 p-6">

          <p className="text-sm text-gray-500">

            On Leave

          </p>

          <h2 className="mt-3 text-4xl font-bold text-yellow-600">

            0

          </h2>

        </div>

        <div className="rounded-3xl bg-red-50 p-6">

          <p className="text-sm text-gray-500">

            Suspended

          </p>

          <h2 className="mt-3 text-4xl font-bold text-red-600">

            0

          </h2>

        </div>

      </div>

      {/* Employee Directory */}

      <div className="rounded-3xl bg-white shadow-sm">

        <div className="flex items-center justify-between border-b px-8 py-6">

          <h2 className="text-2xl font-bold">

            Employee Directory

          </h2>

          <span className="text-sm text-gray-500">

            0 Employees

          </span>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full">

            <thead className="bg-gray-50">

              <tr>

                <th className="px-6 py-4 text-left">

                  Employee

                </th>

                <th className="px-6 py-4 text-left">

                  Department

                </th>

                <th className="px-6 py-4 text-left">

                  Role

                </th>

                <th className="px-6 py-4 text-left">

                  Territory

                </th>

                <th className="px-6 py-4 text-left">

                  Status

                </th>

                <th className="px-6 py-4 text-center">

                  Actions

                </th>

              </tr>

            </thead>

            <tbody>

              <tr>

                <td

                  colSpan={6}

                  className="py-20 text-center text-gray-400"

                >

                  No employees created yet.

                </td>

              </tr>

            </tbody>

          </table>

        </div>

      </div>
{showWizard && (

  <EmployeeProvisioningWizard />

)}
    </div>

  );

}