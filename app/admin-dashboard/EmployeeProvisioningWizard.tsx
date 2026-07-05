"use client";

import { useState } from "react";
import { X } from "lucide-react";

export default function EmployeeProvisioningWizard() {

  const [step, setStep] = useState(1);

  const nextStep = () => {

    if (step < 6) {

      setStep(step + 1);

    }

  };

  const previousStep = () => {

    if (step > 1) {

      setStep(step - 1);

    }

  };
  return (
    <div className="fixed inset-0 z-50 bg-gray-100">

      {/* Main Container */}

      <div className="mx-auto flex h-screen max-w-7xl flex-col">

        {/* =======================================================
            HEADER
        ======================================================= */}

        <header className="flex items-center justify-between border-b bg-white px-10 py-6 shadow-sm">

          <div>

            <div>

  <h1 className="text-3xl font-bold text-orange-600">

    MKH Employee Onboarding

  </h1>

  <p className="mt-2 text-lg font-medium">

    Human Resources Management Portal

  </p>

  <p className="text-sm text-gray-500">

    Create and manage employee accounts across the MKH ecosystem.

  </p>

</div>

            <p className="mt-1 text-gray-500">
              Human Resources Management System
            </p>

          </div>

         <button
  className="
    rounded-xl
    border
    px-4
    py-3
    transition
    hover:bg-red-50
    hover:text-red-600
  "
>

  <div className="flex items-center gap-2">

    <X size={18} />

    <span>

      Close

    </span>

  </div>

</button>

        </header>

        {/* =======================================================
            PROGRESS BAR
        ======================================================= */}

        <div className="border-b bg-white px-10 py-8">

          <div className="flex items-center">

            {/* STEP 1 */}

            <div className="flex flex-col items-center">

              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 font-bold text-white">
                1
              </div>

              <span className="mt-2 text-sm font-semibold text-orange-600">
                Personal
              </span>

            </div>

            <div className="h-1 flex-1 bg-orange-500"></div>

            {/* STEP 2 */}

            <div className="flex flex-col items-center">

              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 font-bold">
                2
              </div>

              <span className="mt-2 text-sm text-gray-500">
                Employment
              </span>

            </div>

            <div className="h-1 flex-1 bg-gray-200"></div>

            {/* STEP 3 */}

            <div className="flex flex-col items-center">

              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 font-bold">
                3
              </div>

              <span className="mt-2 text-sm text-gray-500">
                Role
              </span>

            </div>

            <div className="h-1 flex-1 bg-gray-200"></div>

            {/* STEP 4 */}

            <div className="flex flex-col items-center">

              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 font-bold">
                4
              </div>

              <span className="mt-2 text-sm text-gray-500">
                Territory
              </span>

            </div>

            <div className="h-1 flex-1 bg-gray-200"></div>

            {/* STEP 5 */}

            <div className="flex flex-col items-center">

              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 font-bold">
                5
              </div>

              <span className="mt-2 text-sm text-gray-500">
                Account
              </span>

            </div>

            <div className="h-1 flex-1 bg-gray-200"></div>

            {/* STEP 6 */}

            <div className="flex flex-col items-center">

              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 font-bold">
                6
              </div>

              <span className="mt-2 text-sm text-gray-500">
                Review
              </span>

            </div>

          </div>

        </div>

        {/* =======================================================
            CONTENT
        ======================================================= */}

        <main className="flex-1 overflow-y-auto px-10 py-10">

          <div className="rounded-3xl bg-white p-10 shadow-sm">

            <div className="mb-10">

              <h2 className="text-3xl font-bold">

  {step === 1 && "Personal Information"}

  {step === 2 && "Employment Details"}

  {step === 3 && "Role & Department"}

  {step === 4 && "Territory Assignment"}

  {step === 5 && "Account Setup"}

  {step === 6 && "Review & Create"}

</h2>

<p className="mt-2 text-gray-500">

  {step === 1 && "Enter the employee's personal information."}

  {step === 2 && "Employment details and start date."}

  {step === 3 && "Assign department and employee role."}

  {step === 4 && "Assign territory where applicable."}

  {step === 5 && "Generate the employee account."}

  {step === 6 && "Review all information before creating the employee."}

</p>

            </div>
{step === 1 && (
            <div className="grid gap-8 md:grid-cols-2">

              <div>

                <label className="mb-2 block font-medium">
                  First Name
                </label>

                <input
                  type="text"
                  placeholder="John"
                  className="w-full rounded-2xl border p-4 focus:border-orange-500 focus:outline-none"
                />

              </div>

              <div>

                <label className="mb-2 block font-medium">
                  Last Name
                </label>

                <input
                  type="text"
                  placeholder="Doe"
                  className="w-full rounded-2xl border p-4 focus:border-orange-500 focus:outline-none"
                />

              </div>

              <div>

                <label className="mb-2 block font-medium">
                  Phone Number
                </label>

                <input
                  type="text"
                  placeholder="+234..."
                  className="w-full rounded-2xl border p-4 focus:border-orange-500 focus:outline-none"
                />

              </div>

              <div>

                <label className="mb-2 block font-medium">
                  Date Joined
                </label>

                <input
                  type="date"
                  className="w-full rounded-2xl border p-4 focus:border-orange-500 focus:outline-none"
                />

              </div>

           
<div>

  <label className="mb-2 block font-medium">

    Gender

  </label>

  <select
    className="
      w-full
      rounded-2xl
      border
      p-4
      focus:border-orange-500
      focus:outline-none
    "
  >

    <option>Select Gender</option>

    <option>Male</option>

    <option>Female</option>

  </select>

</div>

<div>

  <label className="mb-2 block font-medium">

    Nationality

  </label>

  <input
    type="text"
    placeholder="Nigerian"
    className="
      w-full
      rounded-2xl
      border
      p-4
      focus:border-orange-500
      focus:outline-none
    "
  />

</div>

<div className="md:col-span-2">

  <label className="mb-2 block font-medium">

    Residential Address

  </label>

  <textarea
    rows={4}
    placeholder="Employee Address..."
    className="
      w-full
      rounded-2xl
      border
      p-4
      focus:border-orange-500
      focus:outline-none
    "
  />

</div>

</div>

)}

{step === 2 && (

<div className="grid gap-8 md:grid-cols-2">

  <div>

    <label className="mb-2 block font-medium">

      Employment Type

    </label>

    <select className="w-full rounded-2xl border p-4">

      <option>Full Time</option>

      <option>Part Time</option>

      <option>Contract</option>

      <option>Intern</option>

    </select>

  </div>

  <div>

    <label className="mb-2 block font-medium">

      Department

    </label>

    <select className="w-full rounded-2xl border p-4">

      <option>Operations</option>

      <option>Finance</option>

      <option>Human Resources</option>

      <option>Customer Support</option>

      <option>Corporate Services</option>

      <option>Executive</option>

    </select>

  </div>
<div>

  <label className="mb-2 block font-medium">

    Employee Role

  </label>

 <select className="w-full rounded-2xl border p-4">

  <option value="">Select Role</option>

  <option value="managing-director">
    Managing Director
  </option>

  <option value="admin">
    Admin
  </option>

  <option value="operations-manager">
    Operations Manager
  </option>

  <option value="relationship-manager">
    Territory Relationship Manager
  </option>

  <option value="finance">
    Finance
  </option>

  <option value="human-resources">
    Human Resources
  </option>

  <option value="customer-support">
    Customer Support
  </option>

</select>

</div>
  <div>

    <label className="mb-2 block font-medium">

      Reports To

    </label>

    <input

      className="w-full rounded-2xl border p-4"

      placeholder="Managing Director"

    />

  </div>

  <div>

    <label className="mb-2 block font-medium">

      Employee Number

    </label>

   <input

  disabled

  value="MKH-EMP-000001"

  className="w-full rounded-2xl border bg-gray-100 p-4 font-semibold text-orange-600"

/>
  </div>

</div>

)}

{step === 3 && (

<div className="grid gap-8 md:grid-cols-2">

  <div>

    <label className="mb-2 block font-medium">

      State

    </label>

    <select className="w-full rounded-2xl border p-4">

      <option>Select State</option>

      <option>Lagos</option>

      <option>Abuja (FCT)</option>

      <option>Rivers</option>

      <option>Oyo</option>

      <option>Kano</option>

      <option>Enugu</option>

    </select>

  </div>

  <div>

    <label className="mb-2 block font-medium">

      Local Government Area

    </label>

    <select className="w-full rounded-2xl border p-4">

      <option>Select Local Government</option>

    </select>

  </div>

  <div>

    <label className="mb-2 block font-medium">

      Territory

    </label>

    <select className="w-full rounded-2xl border p-4">

      <option>Select Territory</option>

    </select>

  </div>

  <div>

    <label className="mb-2 block font-medium">

      Office Location

    </label>

    <input

      placeholder="Office / Hub"

      className="w-full rounded-2xl border p-4"

    />

  </div>

  <div>

    <label className="mb-2 block font-medium">

      Vendor Capacity

    </label>

    <input

      disabled

      value="10 Vendors"

      className="w-full rounded-2xl border bg-gray-100 p-4"

    />

  </div>

  <div>

    <label className="mb-2 block font-medium">

      Rider Capacity

    </label>

    <input

      disabled

      value="30 Riders"

      className="w-full rounded-2xl border bg-gray-100 p-4"

    />

  </div>

  <div className="md:col-span-2">

    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6">

      <h3 className="font-bold text-orange-700">

        Relationship Manager Territory Assignment

      </h3>

      <p className="mt-3 text-gray-700">

This section applies only to
<strong> Territory Relationship Managers.</strong>

Relationship Managers are assigned to a specific
<strong> State</strong>,
<strong> Local Government Area (LGA)</strong>
and
<strong> Territory.</strong>

</p>

<p className="mt-3 text-gray-700">

Other employee roles such as
<strong> Finance</strong>,
<strong> Human Resources</strong>,
<strong> Customer Support</strong>
and
<strong> Operations</strong>

will only require a State assignment.

</p>

      <p className="mt-2 text-gray-700">

        Each Territory Relationship Manager manages up to
        <strong> 10 Vendors</strong> and
        <strong> 30 Riders</strong>
        within their assigned territory.

      </p>

    </div>

  </div>

</div>

)}

{step === 4 && (

<div className="grid gap-8 md:grid-cols-2">

  <div>

    <label className="mb-2 block font-medium">

      Official MKH Email

    </label>

    <input

      disabled

      value="john.doe@mammykitchenhub.com"

      className="w-full rounded-2xl border bg-gray-100 p-4 font-semibold text-orange-600"

    />

  </div>

  <div>

    <label className="mb-2 block font-medium">

      Username

    </label>

    <input

      disabled

      value="john.doe"

      className="w-full rounded-2xl border bg-gray-100 p-4"

    />

  </div>

  <div>

    <label className="mb-2 block font-medium">

      Temporary Password

    </label>

    <input

      disabled

      value="MKH@2026!"

      className="w-full rounded-2xl border bg-gray-100 p-4"

    />

  </div>

  <div>

    <label className="mb-2 block font-medium">

      Account Status

    </label>

    <input

      disabled

      value="Pending First Login"

      className="w-full rounded-2xl border bg-yellow-50 p-4 font-semibold text-yellow-700"

    />

  </div>

  <div className="md:col-span-2">

    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">

      <h3 className="font-bold text-blue-700">

        Account Preview

      </h3>

      <ul className="mt-3 space-y-2 text-sm text-gray-700">

        <li>✅ Official MKH email will be generated automatically.</li>

        <li>✅ Employee must change password on first login.</li>

        <li>✅ Role permissions will be assigned automatically.</li>

        <li>✅ Employee activity will be tracked in the Audit Trail.</li>

      </ul>

    </div>

  </div>

</div>

)}

{step === 5 && (

<div className="space-y-8">

  <div className="rounded-3xl border bg-white p-8">

    <h3 className="text-2xl font-bold">

      Employee Summary

    </h3>

    <p className="mt-2 text-gray-500">

      Review the employee information before creating the account.

    </p>

  </div>

  <div className="grid gap-6 md:grid-cols-2">

    <div className="rounded-2xl border p-6">

      <h4 className="mb-4 font-bold">

        Personal Information

      </h4>

      <div className="space-y-2 text-sm">

        <p><strong>Name:</strong> John Doe</p>

        <p><strong>Phone:</strong> +234 xxx xxx xxxx</p>

        <p><strong>Nationality:</strong> Nigerian</p>

      </div>

    </div>

    <div className="rounded-2xl border p-6">

      <h4 className="mb-4 font-bold">

        Employment

      </h4>

      <div className="space-y-2 text-sm">

        <p><strong>Department:</strong> Operations</p>

        <p><strong>Role:</strong> Territory Relationship Manager</p>

        <p><strong>Reports To:</strong> Operations Manager</p>

      </div>

    </div>

    <div className="rounded-2xl border p-6">

      <h4 className="mb-4 font-bold">

        Territory

      </h4>

      <div className="space-y-2 text-sm">

        <p><strong>State:</strong> Lagos</p>

        <p><strong>LGA:</strong> Eti-Osa</p>

        <p><strong>Territory:</strong> Lekki Phase 1</p>

      </div>

    </div>

    <div className="rounded-2xl border p-6">

      <h4 className="mb-4 font-bold">

        Account

      </h4>

      <div className="space-y-2 text-sm">

        <p><strong>Email:</strong> john.doe@mammykitchenhub.com</p>

        <p><strong>Employee No:</strong> MKH-EMP-000001</p>

        <p><strong>Status:</strong> Ready to Create</p>

      </div>

    </div>

  </div>

  <div className="rounded-3xl border border-green-200 bg-green-50 p-8">

    <h3 className="text-xl font-bold text-green-700">

      Ready to Create Employee

    </h3>

    <p className="mt-3 text-gray-700">

      Clicking <strong>Create Employee</strong> will generate the employee account,
      assign permissions, create the official MKH email profile and make the employee
      available for first login.

    </p>

  </div>

</div>

)}
          </div>

        </main>

        {/* =======================================================
            FOOTER
        ======================================================= */}

        <footer className="border-t bg-white px-10 py-5 shadow-lg">

  <div className="flex items-center justify-between">

    <button

      onClick={previousStep}

      disabled={step === 1}

      className="
        rounded-xl
        border
        px-6
        py-3
        font-semibold
        disabled:opacity-40
      "

    >

      ← Back

    </button>

    <div className="text-sm text-gray-500">

      Step {step} of 6

    </div>

    <button

      onClick={nextStep}

      className="
        rounded-xl
        bg-orange-500
        px-8
        py-3
        font-semibold
        text-white
        hover:bg-orange-600
      "

    >

     {step === 5 ? "Create Employee" : "Continue →"}

    </button>

  </div>

</footer>

      </div>

    </div>
  );
}