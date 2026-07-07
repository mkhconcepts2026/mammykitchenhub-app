"use client";

import Link from "next/link";
import {
  Users,
  UserPlus,
  Building2,
  Briefcase,
  ClipboardCheck,
} from "lucide-react";

export default function HRDashboard() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">

      <div className="mb-10">

        <h1 className="text-4xl font-bold text-orange-600">
          Human Resources
        </h1>

        <p className="mt-2 text-gray-600">
          Manage employees and onboarding across the MKH ecosystem.
        </p>

      </div>

      {/* Statistics */}

      <div className="grid gap-6 md:grid-cols-4">

        <div className="rounded-3xl bg-white p-6 shadow">

          <Users className="mb-4 text-orange-500" size={32} />

          <h2 className="text-3xl font-bold">0</h2>

          <p className="text-gray-500">
            Employees
          </p>

        </div>

        <div className="rounded-3xl bg-white p-6 shadow">

          <ClipboardCheck className="mb-4 text-yellow-500" size={32} />

          <h2 className="text-3xl font-bold">0</h2>

          <p className="text-gray-500">
            Pending Approval
          </p>

        </div>

        <div className="rounded-3xl bg-white p-6 shadow">

          <Building2 className="mb-4 text-blue-500" size={32} />

          <h2 className="text-3xl font-bold">0</h2>

          <p className="text-gray-500">
            Departments
          </p>

        </div>

        <div className="rounded-3xl bg-white p-6 shadow">

          <Briefcase className="mb-4 text-green-500" size={32} />

          <h2 className="text-3xl font-bold">0</h2>

          <p className="text-gray-500">
            Employee Roles
          </p>

        </div>

      </div>

      {/* Quick Actions */}

      <div className="mt-10 rounded-3xl bg-white p-8 shadow">

        <h2 className="mb-6 text-2xl font-bold">
          Quick Actions
        </h2>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

          <Link
            href="/hr/employees/new"
            className="rounded-2xl bg-orange-500 p-5 text-center font-semibold text-white hover:bg-orange-600"
          >
            <UserPlus className="mx-auto mb-3" />
            New Employee
          </Link>

          <Link
            href="/hr/employees"
            className="rounded-2xl border p-5 text-center hover:bg-gray-50"
          >
            Employees
          </Link>

          <Link
            href="/hr/departments"
            className="rounded-2xl border p-5 text-center hover:bg-gray-50"
          >
            Departments
          </Link>

          <Link
            href="/hr/roles"
            className="rounded-2xl border p-5 text-center hover:bg-gray-50"
          >
            Employee Roles
          </Link>

        </div>

      </div>

      {/* Recent Activity */}

      <div className="mt-10 rounded-3xl bg-white p-8 shadow">

        <h2 className="mb-6 text-2xl font-bold">
          Recent Activity
        </h2>

        <div className="space-y-4 text-gray-600">

          <p>No recent activity.</p>

        </div>

      </div>

    </div>
  );
}