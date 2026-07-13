"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  generateEmployeeEmail,
  generateUsername,
} from "@/lib/employees/emailGenerator";

export default function EmployeeProvisioningWizard() {
const supabase = createClient();
const [employeePhoto, setEmployeePhoto] = useState<File | null>(null);
const [step, setStep] = useState(1);
const router = useRouter();
const [departments, setDepartments] = useState<any[]>([]);
const [roles, setRoles] = useState<any[]>([]);
const [states, setStates] = useState<any[]>([]);
const [lgas, setLgas] = useState<any[]>([]);
const [territories, setTerritories] = useState<any[]>([]);
const [selectedState, setSelectedState] = useState("");
const [selectedLga, setSelectedLga] = useState("");
const hasCheckedDraft = useRef(false);
const [formData, setFormData] = useState({
  firstName: "",
  lastName: "",
  phone: "",
  gender: "",
  nationality: "",
  address: "",
  photo: null as File | null,
photoUrl: "",

  employmentType: "Full Time",
  departmentId: "",
  roleId: "",
  reportsTo: "",

  stateId: "",
  lgaId: "",
  territoryId: "",

  officeLocation: "",

  email: "",
  username: "",
});

const selectedRole = roles.find(
  (role) => role.id === formData.roleId
);

const isTerritoryManager =
  selectedRole?.name ===
  "Territory Relationship Manager";

useEffect(() => {

  if (!formData.firstName || !formData.lastName) return;

  setFormData((prev) => ({

    ...prev,

    email: generateEmployeeEmail(
      prev.firstName,
      prev.lastName
    ),

    username: generateUsername(
      prev.firstName,
      prev.lastName
    ),

  }));

}, [

  formData.firstName,

  formData.lastName,

]);

useEffect(() => {

  async function checkForDraft() {

    if (hasCheckedDraft.current) return;

hasCheckedDraft.current = true;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("employee_drafts")
      .select("*")
      .eq("created_by", user.id)
      .eq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return;

    const resume = window.confirm(
      "An incomplete employee onboarding was found.\n\nWould you like to resume it?"
    );

    if (!resume) return;

    setFormData(data.form_data);

    if (data.step) {
      setStep(data.step);
    }

  }

  checkForDraft();

}, []);

function validateCurrentStep() {

  switch (step) {

   case 1: {

 if (!formData.photoUrl) {

  alert("Employee photo is required.");

  return false;

}

  if (!formData.firstName.trim()) {

    alert("First Name is required.");

    return false;

  }

  if (!formData.lastName.trim()) {

    alert("Last Name is required.");

    return false;

  }

  if (!formData.phone.trim()) {

    alert("Phone Number is required.");

    return false;

  }

  if (!formData.gender) {

    alert("Gender is required.");

    return false;

  }

  if (!formData.nationality.trim()) {

    alert("Nationality is required.");

    return false;

  }

  return true;

}

    case 2:

      return true;

    case 3:

      return true;

    case 4:

      return true;

    case 5:

      return true;

    default:

      return true;

  }

}

  const nextStep = () => {

  if (!validateCurrentStep()) return;

  // Skip Territory for non-Territory Managers

  if (
    step === 3 &&
    !isTerritoryManager
  ) {

    setStep(5);

    return;

  }

  if (step < 6) {

    setStep(step + 1);

  }

};

  const previousStep = () => {

    if (step > 1) {

      setStep(step - 1);

    }

  };

useEffect(() => {
  loadMasterData();
}, []);

async function handlePhotoUpload(
  file: File
) {

  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {

    alert("Image must be smaller than 5MB.");

    return;

  }

  const fileName = `${Date.now()}-${file.name}`;

  const { error } = await supabase.storage

    .from("employee-photos")

    .upload(fileName, file);

  if (error) {

    alert(error.message);

    return;

  }

  const {
    data: { publicUrl },
  } = supabase.storage

    .from("employee-photos")

    .getPublicUrl(fileName);

 setFormData((prev) => ({
  ...prev,
  photo: null,
  photoUrl: publicUrl,
}));

}
async function createEmployee() {

  // =====================================================
  // REQUIRED FIELD VALIDATION
  // =====================================================

  const requiredFields = [

    { key: "firstName", label: "First Name" },

    { key: "lastName", label: "Last Name" },

    { key: "phone", label: "Phone Number" },

    { key: "gender", label: "Gender" },

    { key: "nationality", label: "Nationality" },

    { key: "address", label: "Residential Address" },

    { key: "departmentId", label: "Department" },

    { key: "roleId", label: "Employee Role" },

    { key: "stateId", label: "State" },

  ];

  for (const field of requiredFields) {

    if (!formData[field.key as keyof typeof formData]) {

      alert(`${field.label} is required.`);

      return;

    }

  }

  if (!formData.photoUrl) {

    alert("Employee photograph is required.");

    return;

  }

  try {

const {
  data: { user },
} = await supabase.auth.getUser();

    const response = await fetch(

      "/api/admin/employees/create",

      {

        method: "POST",

        headers: {

          "Content-Type": "application/json",

        },

        body: JSON.stringify({
  ...formData,
  createdBy: user?.id,
}),

      }

    );

    const result = await response.json();

    if (!result.success) {

      alert(result.message);

      return;

    }

   alert("✅ Employee created successfully.");

router.push("/hr/employees");

  } catch (error) {

    console.error(error);

    alert("Unable to create employee.");

  }

}
async function loadLGAs(stateId: string) {

  setSelectedState(stateId);

  setSelectedLga("");

  setTerritories([]);

  if (!stateId) {

    setLgas([]);

    return;

  }

  const { data } = await supabase

    .from("local_governments")

    .select("*")

    .eq("state_id", stateId)

    .order("name");

  setLgas(data || []);

}

async function loadMasterData() {

  const {
  data: { user },
} = await supabase.auth.getUser();

console.log("CURRENT USER:", user);

  const { data: departmentData } = await supabase
    .from("departments")
    .select("*")
    .order("name");

  const { data: roleData } = await supabase
    .from("employee_roles")
    .select("*")
    .order("name");

  const { data: stateData } = await supabase
    .from("states")
    .select("*")
    .order("name");

  console.log("Departments:", departmentData);
console.log("Roles:", roleData);
console.log("States:", stateData);

setDepartments(departmentData || []);
setRoles(roleData || []);
setStates(stateData || []);

}

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
  onClick={() => router.push("/hr")}
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

      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full font-bold text-white transition-all
        ${
          step === 1
            ? "bg-orange-500"
            : step > 1
            ? "bg-green-500"
            : "bg-gray-300"
        }`}
      >
        1
      </div>

      <span
        className={`mt-2 text-sm font-semibold
        ${
          step === 1
            ? "text-orange-600"
            : step > 1
            ? "text-green-600"
            : "text-gray-500"
        }`}
      >
        Personal
      </span>

    </div>

    <div
      className={`h-1 flex-1 transition-all ${
        step > 1 ? "bg-green-500" : "bg-gray-200"
      }`}
    />

    {/* STEP 2 */}

    <div className="flex flex-col items-center">

      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full font-bold text-white transition-all
        ${
          step === 2
            ? "bg-orange-500"
            : step > 2
            ? "bg-green-500"
            : "bg-gray-300"
        }`}
      >
        2
      </div>

      <span
        className={`mt-2 text-sm font-semibold
        ${
          step === 2
            ? "text-orange-600"
            : step > 2
            ? "text-green-600"
            : "text-gray-500"
        }`}
      >
        Employment
      </span>

    </div>

    <div
      className={`h-1 flex-1 transition-all ${
        step > 2 ? "bg-green-500" : "bg-gray-200"
      }`}
    />

    {/* STEP 3 */}

    <div className="flex flex-col items-center">

      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full font-bold text-white transition-all
        ${
          step === 3
            ? "bg-orange-500"
            : step > 3
            ? "bg-green-500"
            : "bg-gray-300"
        }`}
      >
        3
      </div>

      <span
        className={`mt-2 text-sm font-semibold
        ${
          step === 3
            ? "text-orange-600"
            : step > 3
            ? "text-green-600"
            : "text-gray-500"
        }`}
      >
        Location
      </span>

    </div>

    <div
      className={`h-1 flex-1 transition-all ${
        step > 3 ? "bg-green-500" : "bg-gray-200"
      }`}
    />

    {/* STEP 4 */}

    <div className="flex flex-col items-center">

      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full font-bold text-white transition-all
        ${
          step === 4
            ? "bg-orange-500"
            : step > 4
            ? "bg-green-500"
            : "bg-gray-300"
        }`}
      >
        4
      </div>

      <span
        className={`mt-2 text-sm font-semibold
        ${
          step === 4
            ? "text-orange-600"
            : step > 4
            ? "text-green-600"
            : "text-gray-500"
        }`}
      >
        Account
      </span>

    </div>

    <div
      className={`h-1 flex-1 transition-all ${
        step > 4 ? "bg-green-500" : "bg-gray-200"
      }`}
    />

    {/* STEP 5 */}

    <div className="flex flex-col items-center">

      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full font-bold text-white transition-all
        ${
          step === 5
            ? "bg-orange-500"
            : step > 5
            ? "bg-green-500"
            : "bg-gray-300"
        }`}
      >
        5
      </div>

      <span
        className={`mt-2 text-sm font-semibold
        ${
          step === 5
            ? "text-orange-600"
            : step > 5
            ? "text-green-600"
            : "text-gray-500"
        }`}
      >
        Review
      </span>

    </div>

    <div
      className={`h-1 flex-1 transition-all ${
        step > 5 ? "bg-green-500" : "bg-gray-200"
      }`}
    />

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

  {step === 3 && "Location/Assignment"}

  {step === 4 && "Account Setup"}

  {step === 5 && "Review & Create"}

</h2>

<p className="mt-2 text-gray-500">

  {step === 1 && "Enter the employee's personal information."}

  {step === 2 && "Employment details."}

  {step === 3 && "Assign employee location."}

  {step === 4 && "Generate employee account."}

  {step === 5 && "Review all information before creating the employee."}

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
  value={formData.firstName}
  onChange={(e) =>
    setFormData((prev) => ({
      ...prev,
      firstName: e.target.value,
    }))
  }
  className="w-full rounded-2xl border p-4 focus:border-orange-500 focus:outline-none"
  required
/>

              </div>

              <div>

                <label className="mb-2 block font-medium">
                  Last Name
                </label>

                <input
  type="text"
  placeholder="Doe"
  value={formData.lastName}
  onChange={(e) =>
    setFormData((prev) => ({
      ...prev,
      lastName: e.target.value,
    }))
  }
  className="w-full rounded-2xl border p-4 focus:border-orange-500 focus:outline-none"
  required
/>

              </div>

              <div>

                <label className="mb-2 block font-medium">
                  Phone Number
                </label>

                <input
  type="text"
  placeholder="+234..."
  value={formData.phone}
  onChange={(e) =>
    setFormData((prev) => ({
      ...prev,
      phone: e.target.value,
    }))
  }
  className="w-full rounded-2xl border p-4 focus:border-orange-500 focus:outline-none"
  required
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
  value={formData.gender}
  onChange={(e) =>
    setFormData((prev) => ({
      ...prev,
      gender: e.target.value,
    }))
  }
  className="
    w-full
    rounded-2xl
    border
    p-4
    focus:border-orange-500
    focus:outline-none
  "
  required
>
  <option value="">
    Select Gender
  </option>

  <option value="Male">
    Male
  </option>

  <option value="Female">
    Female
  </option>
</select>

</div>

<div>

  <label className="mb-2 block font-medium">

    Nationality

  </label>

 <input
  type="text"
  placeholder="Nigerian"
  value={formData.nationality}
  onChange={(e) =>
    setFormData((prev) => ({
      ...prev,
      nationality: e.target.value,
    }))
  }
  className="
    w-full
    rounded-2xl
    border
    p-4
    focus:border-orange-500
    focus:outline-none
  "
  required
/>

</div>

<div className="md:col-span-2">

  <label className="mb-2 block font-medium">

    Residential Address

  </label>

 <textarea
  rows={4}
  placeholder="Employee Address..."
  value={formData.address}
  onChange={(e) =>
    setFormData((prev) => ({
      ...prev,
      address: e.target.value,
    }))
  }
  className="
    w-full
    rounded-2xl
    border
    p-4
    focus:border-orange-500
    focus:outline-none
  "
  required
/>

</div>

<div className="md:col-span-2">

  <label className="mb-3 block font-medium">

    Employee Photograph
    <span className="ml-1 text-red-500">*</span>

  </label>

  <div
    className="
      rounded-2xl
      border-2
      border-dashed
      border-gray-300
      bg-gray-50
      p-8
      text-center
    "
  >

    <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gray-200 text-4xl">

      👤

    </div>

    <p className="font-semibold">

      Upload Employee Passport Photograph

    </p>

    <p className="mt-2 text-sm text-gray-500">

      JPG, PNG or WEBP

    </p>

    <p className="text-sm text-gray-500">

      Maximum file size: 5MB

    </p>

   <input

  type="file"

  accept="image/png,image/jpeg,image/webp"

  onChange={(e) => {

    const file = e.target.files?.[0];

    if (file) {

      handlePhotoUpload(file);

    }

  }}

  className="mt-6 block w-full"

/>
{formData.photoUrl && (

  <div className="mt-6">

    <img

      src={formData.photoUrl}

      alt="Employee"

      className="mx-auto h-40 w-40 rounded-full object-cover border"

    />

  </div>

)}
  </div>

</div>

</div>

)}



{step === 2 && (

<div className="grid gap-8 md:grid-cols-2">

  <div>

    <label className="mb-2 block font-medium">

      Employment Type

    </label>

    <select
  value={formData.employmentType}
  onChange={(e) =>
    setFormData((prev) => ({
      ...prev,
      employmentType: e.target.value,
    }))
  }
  className="w-full rounded-2xl border p-4"
  required
>
  <option value="Full Time">Full Time</option>
  <option value="Part Time">Part Time</option>
  <option value="Contract">Contract</option>
  <option value="Intern">Intern</option>
</select>

  </div>

  <div>

    <label className="mb-2 block font-medium">

      Department

    </label>

    <select
  value={formData.departmentId}
  onChange={(e) =>
    setFormData((prev) => ({
      ...prev,
      departmentId: e.target.value,
    }))
  }
  className="w-full rounded-2xl border p-4"
  required
>

  <option value="">
    Select Department
  </option>

  {departments.map((department) => (

    <option
      key={department.id}
      value={department.id}
    >
      {department.name}
    </option>

  ))}

</select>

  </div>
<div>

  <label className="mb-2 block font-medium">

    Employee Role

  </label>

 <select
  value={formData.roleId}
  onChange={(e) =>
    setFormData((prev) => ({
      ...prev,
      roleId: e.target.value,
    }))
  }
  className="w-full rounded-2xl border p-4"
  required
>

  <option value="">
    Select Role
  </option>

  {roles.map((role) => (

    <option
      key={role.id}
      value={role.id}
    >
      {role.name}
    </option>

  ))}

</select>

</div>
  <div>

    <label className="mb-2 block font-medium">

      Reports To

    </label>

   <input
  value={formData.reportsTo}
  onChange={(e) =>
    setFormData((prev) => ({
      ...prev,
      reportsTo: e.target.value,
    }))
  }
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

{!isTerritoryManager && (

  <>
    <div>

      <label className="mb-2 block font-medium">
        State
      </label>

      <select
        value={formData.stateId}
        onChange={(e) =>
          setFormData((prev) => ({
            ...prev,
            stateId: e.target.value,
          }))
        }
        className="w-full rounded-2xl border p-4"
      >
        <option value="">
          Select State
        </option>

        {states.map((state) => (
          <option
            key={state.id}
            value={state.id}
          >
            {state.name}
          </option>
        ))}

      </select>

    </div>

    <div>

      <label className="mb-2 block font-medium">
        Office Location
      </label>

      <input
        value={formData.officeLocation}
        onChange={(e) =>
          setFormData((prev) => ({
            ...prev,
            officeLocation: e.target.value,
          }))
        }
        placeholder="Office / Hub"
        className="w-full rounded-2xl border p-4"
      />

    </div>

  </>

)}


</div>

)}

{step === 3 && (

<div className="grid gap-8 md:grid-cols-2">

  <div>

    <label className="mb-2 block font-medium">

      State

    </label>

  <select
  value={formData.stateId}
  onChange={(e) => {

    const stateId = e.target.value;

    setFormData((prev) => ({
      ...prev,
      stateId,
      lgaId: "",
      territoryId: "",
    }));

    loadLGAs(stateId);

  }}
  className="w-full rounded-2xl border p-4"
  required
>

  <option value="">

    Select State

  </option>

  {states.map((state) => (

    <option

      key={state.id}

      value={state.id}

    >

      {state.name}

    </option>

  ))}

</select>

  </div>

  <div>

    <label className="mb-2 block font-medium">

      Local Government Area

    </label>

  <select

  value={formData.lgaId}

  onChange={async (e) => {

    const lgaId = e.target.value;

    setFormData((prev) => ({
      ...prev,
      lgaId,
      territoryId: "",
    }));

    setSelectedLga(lgaId);

    if (!lgaId) {

      setTerritories([]);

      return;

    }

    const { data, error } = await supabase

      .from("territories")

      .select("*")

      .eq("lga_id", lgaId)

      .order("name");

    if (error) {

      console.error(error);

      setTerritories([]);

      return;

    }

    setTerritories(data || []);

  }}

  className="w-full rounded-2xl border p-4"

  required

>

  <option value="">

    Select Local Government

  </option>

  {lgas.map((lga) => (

    <option

      key={lga.id}

      value={lga.id}

    >

      {lga.name}

    </option>

  ))}

</select>

  </div>

 <div>

  <label className="mb-2 block font-medium">

    Territory

  </label>

 <select

  value={formData.territoryId}

  onChange={(e) =>
    setFormData((prev) => ({
      ...prev,
      territoryId: e.target.value,
    }))
  }

  className="w-full rounded-2xl border p-4"

  required

>

    <option value="">
      Select Territory
    </option>

    {territories.map((territory) => (

      <option
        key={territory.id}
        value={territory.id}
      >
        {territory.name}
      </option>

    ))}

  </select>

</div>

  <div>

    <label className="mb-2 block font-medium">

      Office Location

    </label>

  <input

  value={formData.officeLocation}

  onChange={(e) =>
    setFormData((prev) => ({
      ...prev,
      officeLocation: e.target.value,
    }))
  }

  placeholder="Office / Hub"

  className="w-full rounded-2xl border p-4"

  required

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

  value={formData.email}

  className="w-full rounded-2xl border bg-gray-100 p-4 font-semibold text-orange-600"

/>

  </div>

  <div>

    <label className="mb-2 block font-medium">

      Username

    </label>

    <input

      disabled

      value={formData.username}

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

        <p>

<strong>Name:</strong>{" "}

{formData.firstName} {formData.lastName}

</p>

        <p>

<strong>Phone:</strong>{" "}

{formData.phone}

</p>

        <p>

<strong>Nationality:</strong>{" "}

{formData.nationality}

</p>

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

       <p>

<strong>Email:</strong>{" "}

{formData.email}

</p>

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

  <div className="flex flex-wrap items-center justify-between gap-4">

    {/* LEFT */}

    <div className="flex gap-3">

      <button
        onClick={previousStep}
        disabled={step === 1}
        className="
          rounded-xl
          border
          px-6
          py-3
          font-semibold
          transition
          hover:bg-gray-50
          disabled:cursor-not-allowed
          disabled:opacity-40
        "
      >
        ← Back
      </button>

    <button
  onClick={async () => {

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("You must be logged in.");
      return;
    }

   // --------------------------------------
// CHECK IF A DRAFT ALREADY EXISTS
// --------------------------------------

const { data: existingDraft } =
  await supabase
    .from("employee_drafts")
    .select("id")
    .eq("created_by", user.id)
    .eq("status", "draft")
    .maybeSingle();

let error;

if (existingDraft) {

  ({ error } = await supabase

    .from("employee_drafts")

    .update({

      step,

      form_data: formData,

      updated_at: new Date(),

    })

    .eq("id", existingDraft.id));

}

else {

  ({ error } = await supabase

    .from("employee_drafts")

    .insert({

      created_by: user.id,

      step,

      form_data: formData,

      status: "draft",

    }));

}

    if (error) {
      console.error(error);
      alert("Unable to save draft.");
      return;
    }

    alert("Draft saved successfully.");

  }}
  className="
    rounded-xl
    border
    border-orange-300
    bg-orange-50
    px-6
    py-3
    font-semibold
    text-orange-600
    transition
    hover:bg-orange-100
  "
>
  💾 Save Draft
</button>

    </div>

    {/* CENTER */}

    <div className="text-center">

      <p className="text-sm text-gray-500">

        Step {step} of 6

      </p>

      <p className="text-xs text-gray-400">

        Your progress is being recorded.

      </p>

    </div>

    {/* RIGHT */}

    <button
      onClick={step === 5 ? createEmployee : nextStep}
      className="
        rounded-xl
        bg-orange-500
        px-8
        py-3
        font-semibold
        text-white
        transition
        hover:bg-orange-600
      "
    >
      {step === 5 ? "Create Employee" : "Save & Continue →"}
    </button>

  </div>

</footer>

      </div>

    </div>
  );
}