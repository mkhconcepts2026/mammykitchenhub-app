"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import WorkspaceLoader from "@/components/WorkspaceLoader";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Users,
  UserPlus,
  Building2,
  Briefcase,
  ClipboardCheck,
  Bell,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

export default function HRDashboard() {

const supabase = createClient();

const router = useRouter();

const [drafts, setDrafts] = useState<any[]>([]);

const [employeeCount, setEmployeeCount] = useState(0);

const [loading, setLoading] = useState(false);

useEffect(() => {

  async function verifyHRAccess() {

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {

      router.replace("/login");

      return;

    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (error || profile?.role !== "hr") {

      router.replace("/login");


      
      return;

    }

  }

  verifyHRAccess();

}, [router, supabase]);

const hour = new Date().getHours();

useEffect(() => {
const firstVisit =
  sessionStorage.getItem("hrWorkspaceLoaded");

if (!firstVisit) {

  setLoading(true);

}
  async function loadDashboard() {

    try {

      await loadDrafts();

    } finally {

setTimeout(() => {

  sessionStorage.setItem(
    "hrWorkspaceLoaded",
    "true"
  );

  setLoading(false);

}, 1800);

    }

  }

  async function loadDrafts() {

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("employee_drafts")
      .select("*")
      .eq("created_by", user.id)
      .eq("status", "draft")
      .order("updated_at", {
        ascending: false,
      });

    if (error) {

      console.error(error);

      return;

    }

const { count } = await supabase
  .from("employees")
  .select("*", {
    count: "exact",
    head: true,
  });

setEmployeeCount(count || 0);

    setDrafts(data || []);

  }

  loadDashboard();

}, []);

async function handleLogout() {

 sessionStorage.removeItem(
  "hrWorkspaceLoaded"
);

await supabase.auth.signOut();

router.replace("/login");

}

const greeting =
  hour < 12
    ? "Good Morning"
    : hour < 17
    ? "Good Afternoon"
    : "Good Evening";

if (loading) {

  return (

    <WorkspaceLoader

      title="Human Resources Workspace"

      subtitle="Preparing Employee Management Portal..."

    />

  );

}

  return (
    <div className="min-h-screen bg-orange-50 p-8">

      {/* ====================================================== */}
      {/* HEADER */}
      {/* ====================================================== */}

      <div className="mb-10 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-lg">

        <div className="h-2 bg-orange-500" />

        <div className="flex flex-col justify-between gap-8 p-8 lg:flex-row lg:items-center">

          {/* LEFT */}

          <div className="flex items-center gap-6">

            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-orange-50">

              <Image
                    src="/logo.png"
                alt="MKH Logo"
                width={60}
                height={60}
                priority
              />

            </div>

            <div>

              <h1 className="text-4xl font-bold text-orange-600">

                MKH Human Resources

              </h1>

              <p className="mt-1 text-lg font-semibold text-gray-700">

                Employee Management Workspace

              </p>

              <p className="mt-2 max-w-2xl text-gray-500">

               Manage employee onboarding, roles, departments and workforce operations across MKH.

              </p>

            </div>

          </div>

          {/* RIGHT */}

          <div className="rounded-2xl border bg-gray-50 p-6 text-right">

            <div className="mb-3 flex items-center justify-end gap-2">

              <Bell
                size={18}
                className="text-orange-500"
              />

              <span className="text-sm text-gray-500">

                Logged in as

              </span>

            </div>

          <div>

 <p className="text-sm text-gray-500">

  👋 {greeting},

</p>

  <h3 className="text-xl font-bold">
    HR Administrator
  </h3>

</div>

            <p className="mt-1 text-sm text-gray-500">

              Employee Management Portal

            </p>

           <button
  onClick={handleLogout}
  className="mt-4 rounded-xl border border-red-200 bg-red-50 px-5 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
>
  Logout
</button>

          </div>

        </div>

      </div>

      {/* ====================================================== */}
      {/* DASHBOARD KPI */}
      {/* ====================================================== */}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">

        {/* Employees */}

        <Link
          href="/hr/employees"
          className="group rounded-3xl border bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
        >

          <div className="mb-6 flex items-center justify-between">

            <div className="rounded-2xl bg-orange-100 p-4">

              <Users
                size={40}
                className="text-orange-600"
              />

            </div>

            <ArrowRight
              className="text-gray-300 transition group-hover:text-orange-500"
            />

          </div>

          <h2 className="text-4xl font-bold">

            {employeeCount}

          </h2>

          <p className="mt-2 text-lg font-semibold">

            Employees

          </p>

          <p className="mt-2 text-sm text-gray-500">

            Manage employee records and profiles.

          </p>

        </Link>

        {/* Pending */}

        <Link
          href="/hr/pending"
          className="group rounded-3xl border bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
        >

          <div className="mb-6 flex items-center justify-between">

            <div className="rounded-2xl bg-yellow-100 p-4">

              <ClipboardCheck
                size={40}
                className="text-yellow-600"
              />

            </div>

            <ArrowRight
              className="text-gray-300 transition group-hover:text-yellow-600"
            />

          </div>

          <h2 className="text-4xl font-bold">

            0

          </h2>

          <p className="mt-2 text-lg font-semibold">

            Pending Approval

          </p>

          <p className="mt-2 text-sm text-gray-500">

            Employees awaiting onboarding approval.

          </p>

        </Link>

        {/* Departments */}

        <Link
          href="/hr/departments"
          className="group rounded-3xl border bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
        >

          <div className="mb-6 flex items-center justify-between">

            <div className="rounded-2xl bg-blue-100 p-4">

              <Building2
                size={40}
                className="text-blue-600"
              />

            </div>

            <ArrowRight
              className="text-gray-300 transition group-hover:text-blue-600"
            />

          </div>

          <h2 className="text-4xl font-bold">

            0

          </h2>

          <p className="mt-2 text-lg font-semibold">

            Departments

          </p>

          <p className="mt-2 text-sm text-gray-500">

            Organize employees across departments.

          </p>

        </Link>

        {/* Roles */}

        <Link
          href="/hr/roles"
          className="group rounded-3xl border bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
        >

          <div className="mb-6 flex items-center justify-between">

            <div className="rounded-2xl bg-green-100 p-4">

              <Briefcase
                size={40}
                className="text-green-600"
              />

            </div>

            <ArrowRight
              className="text-gray-300 transition group-hover:text-green-600"
            />

          </div>

          <h2 className="text-4xl font-bold text-gray-700">

  --

</h2>

          <p className="mt-2 text-lg font-semibold">

            Employee Roles

          </p>

          <p className="mt-2 text-sm text-gray-500">

            Configure permissions and responsibilities.

          </p>

        </Link>

      </div>


            {/* ====================================================== */}
      {/* QUICK ACTIONS */}
      {/* ====================================================== */}

      <div className="mt-10 rounded-3xl border bg-white p-8 shadow-sm">

        <div className="mb-8 flex items-center justify-between">

          <div>

            <h2 className="text-3xl font-bold">
              Quick Actions
            </h2>

            <p className="mt-2 text-gray-500">
              Frequently used Human Resources operations.
            </p>

          </div>

          <div className="rounded-full bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-600">
            HR Tools
          </div>

        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">

          {/* NEW EMPLOYEE */}

          <Link
            href="/hr/employees/new"
            className="group rounded-3xl bg-orange-500 p-6 text-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:bg-orange-600 hover:shadow-xl"
          >

            <UserPlus
              size={42}
              className="mb-6"
            />

            <h3 className="text-xl font-bold">
              New Employee
            </h3>

            <p className="mt-3 text-sm text-orange-100">
              Create and onboard a new employee into the MKH ecosystem.
            </p>

          </Link>

          {/* EMPLOYEES */}

          <Link
            href="/hr/employees"
            className="group rounded-3xl border bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-orange-300 hover:shadow-lg"
          >

            <Users
              size={42}
              className="mb-6 text-orange-500"
            />

            <h3 className="text-xl font-bold">
              Employees
            </h3>

            <p className="mt-3 text-sm text-gray-500">
              View, search and manage employee records.
            </p>

          </Link>

          {/* DEPARTMENTS */}

          <Link
            href="/hr/departments"
            className="group rounded-3xl border bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg"
          >

            <Building2
              size={42}
              className="mb-6 text-blue-500"
            />

            <h3 className="text-xl font-bold">
              Departments
            </h3>

            <p className="mt-3 text-sm text-gray-500">
              Organize and maintain organizational departments.
            </p>

          </Link>

          {/* ROLES */}

          <Link
            href="/hr/roles"
            className="group rounded-3xl border bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-green-300 hover:shadow-lg"
          >

            <ShieldCheck
              size={42}
              className="mb-6 text-green-500"
            />

            <h3 className="text-xl font-bold">
              Employee Roles
            </h3>

            <p className="mt-3 text-sm text-gray-500">
              Configure employee roles and permissions.
            </p>

          </Link>

        </div>

      </div>

      {/* ====================================================== */}
      {/* RECENT ACTIVITY */}
      {/* ====================================================== */}

      <div className="mt-10 rounded-3xl border bg-white p-8 shadow-sm">

        <div className="mb-8 flex items-center justify-between">

          <div>

            <h2 className="text-3xl font-bold">
              Recent Activity
            </h2>

            <p className="mt-2 text-gray-500">
              Employee onboarding and HR actions will appear here.
            </p>

          </div>

        </div>

     <div className="rounded-3xl border border-orange-200 bg-orange-50 p-8">

  <h3 className="mb-6 text-2xl font-bold text-orange-700">

    Incomplete Employee Onboardings

  </h3>

  {drafts.length === 0 ? (

    <div className="py-10 text-center">

      <Users
        size={72}
        className="mx-auto mb-6 text-orange-300"
      />

      <h3 className="text-2xl font-bold">

        No Saved Drafts

      </h3>

      <p className="mt-3 text-gray-500">

        HR onboarding drafts will appear here.

      </p>

    </div>

  ) : (

    <div className="space-y-4">

      {drafts.map((draft) => (

        <div
          key={draft.id}
          className="flex items-center justify-between rounded-2xl border bg-white p-5 shadow-sm"
        >

          <div>

            <h4 className="text-lg font-bold">

              {draft.form_data.firstName} {draft.form_data.lastName}

            </h4>

            <p className="text-sm text-gray-500">

              Step {draft.step} of 6

            </p>

          </div>

          <Link
            href="/hr/employees/new"
            className="rounded-xl bg-orange-500 px-5 py-2 font-semibold text-white hover:bg-orange-600"
          >

            Resume →

          </Link>

        </div>

      ))}

    </div>

  )}

</div>

      </div>

      {/* ====================================================== */}
      {/* FOOTER */}
      {/* ====================================================== */}

      <footer className="mt-10 rounded-3xl border bg-white px-8 py-6 shadow-sm">

        <div className="flex flex-col items-center justify-between gap-4 text-center text-sm text-gray-500 lg:flex-row">

          <div>

            © 2026 Mammy Kitchen Hub

          </div>

         <div>

  <p className="font-semibold">

    MKH Human Resources Workspace

  </p>

  <p className="text-xs text-gray-500">

    Empowering people. Strengthening the MKH ecosystem.

  </p>

</div>

          <div className="rounded-full bg-orange-100 px-4 py-2 font-semibold text-orange-600">

            Version 1.0

          </div>

        </div>

      </footer>

    </div>
  );
}