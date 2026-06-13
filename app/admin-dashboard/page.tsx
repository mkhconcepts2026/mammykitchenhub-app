"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] =
    useState("dashboard");
    const [applications, setApplications] =
  useState<any[]>([]);
  const approveVendor = async (app: any) => {

  console.log("========== APPROVE START ==========");
  console.log("Application:", app);

  const { error: vendorError } =
    await supabase
      .from("vendors")
      .insert([
        {
          name: app.kitchen_name,
          slug: app.kitchen_name
            .toLowerCase()
            .replaceAll(" ", "-"),
          cuisine: app.vendor_type,
          email: app.email,
          phone: app.phone,
          vendor_type: app.vendor_type,
          owner_name: app.owner_name,
          status: "active"
        }
      ]);

  console.log("Vendor Insert Error:", vendorError);

  if (vendorError) {
    return;
  }

  const {
    data: updateData,
    error: updateError
  } =
    await supabase
      .from("vendor_applications")
      .update({
        status: "approved"
      })
      .eq("id", app.id)
      .select();

  console.log(
    "Update Data:",
    updateData
  );

  console.log(
    "Update Error:",
    updateError
  );

  if (updateError) {
    alert("Status update failed");
    return;
  }

  alert(
    `${app.kitchen_name} approved successfully`
  );

  loadDashboardStats();
};
  
  const rejectVendor = async (
  applicationId: string
) => {
  const { error } = await supabase
    .from("vendor_applications")
    .update({
      status: "rejected"
    })
    .eq("id", applicationId);

  if (error) {
    console.error(error);
    return;
  }

  loadDashboardStats();
};
   const [stats, setStats] = useState({
  applications: 0,
  pending: 0,
  vendors: 0,
  riders: 0,
  orders: 0

});
useEffect(() => {

  loadDashboardStats();

}, []);

const loadDashboardStats = async () => {

  const { count: applications } =
    await supabase
      .from("vendor_applications")
      .select("*", {
        count: "exact",
        head: true
      });
      const { count: pendingApplications } =
  await supabase
    .from("vendor_applications")
    .select("*", {
      count: "exact",
      head: true
    })
    .eq("status", "pending");

  const { count: vendors } =
    await supabase
      .from("vendors")
      .select("*", {
        count: "exact",
        head: true
      });

  const { count: riders } =
    await supabase
      .from("profiles")
      .select("*", {
        count: "exact",
        head: true
      })
      .eq("role", "rider");

  const { count: orders } =
    await supabase
      .from("orders")
      .select("*", {
        count: "exact",
        head: true

        
      });

  setStats({
  applications: applications || 0,
  pending: pendingApplications || 0,
  vendors: vendors || 0,
  riders: riders || 0,
  orders: orders || 0
});

const {
  data: applicationData,
  error
} = await supabase
  .from("vendor_applications")
  .select("*");

if (error) {
  console.error(error);
}

setApplications(
  applicationData || []
);
};

  return (
    <main className="min-h-screen bg-gray-100">

      <div className="flex">

        {/* Sidebar */}

        <div
          className="
            w-72
            bg-white
            border-r
            min-h-screen
            p-6
          "
        >

          <h1
            className="
              text-2xl
              font-bold
              mb-10
            "
          >
            MKH Admin
          </h1>

          <div className="space-y-3">

            <button
              onClick={() =>
                setActiveTab("dashboard")
              }
              className="w-full text-left"
            >
              Dashboard
            </button>

            <button
              onClick={() =>
                setActiveTab("applications")
              }
              className="w-full text-left"
            >
              Vendor Applications
            </button>

            <button
              onClick={() =>
                setActiveTab("vendors")
              }
              className="w-full text-left"
            >
              Vendors
            </button>

            <button
              onClick={() =>
                setActiveTab("riders")
              }
              className="w-full text-left"
            >
              Riders
            </button>

            <button
              onClick={() =>
                setActiveTab("orders")
              }
              className="w-full text-left"
            >
              Orders
            </button>

            <button
              onClick={() =>
                setActiveTab("revenue")
              }
              className="w-full text-left"
            >
              Revenue
            </button>

          </div>

        </div>

        {/* Content */}

        <div className="flex-1 p-8">

         {activeTab === "dashboard" && (

  <div>

    <h2
      className="
        text-3xl
        font-bold
        mb-8
      "
    >
      Admin Dashboard
    </h2>

    <div
      className="
        grid
        md:grid-cols-2
        lg:grid-cols-4
        gap-6
      "
    >

      <div
        className="
          bg-white
          rounded-2xl
          p-6
          shadow-sm
        "
      >
        <p className="text-gray-500">
          Applications
        </p>

        <h3 className="text-4xl font-bold">
          {stats.applications}
        </h3>
        <div
  className="
    bg-white
    rounded-2xl
    p-6
    shadow-sm
  "
>
  <p className="text-gray-500">
    Pending Review
  </p>

  <h2
    className="
      text-5xl
      font-bold
      text-orange-500
    "
  >
    {stats.pending}
  </h2>
</div>
      </div>

      <div
        className="
          bg-white
          rounded-2xl
          p-6
          shadow-sm
        "
      >
        <p className="text-gray-500">
          Vendors
        </p>

        <h3 className="text-4xl font-bold">
          {stats.vendors}
        </h3>
      </div>

      <div
        className="
          bg-white
          rounded-2xl
          p-6
          shadow-sm
        "
      >
        <p className="text-gray-500">
          Riders
        </p>

        <h3 className="text-4xl font-bold">
          {stats.riders}
        </h3>
      </div>

      <div
        className="
          bg-white
          rounded-2xl
          p-6
          shadow-sm
        "
      >
        <p className="text-gray-500">
          Orders
        </p>

        <h3 className="text-4xl font-bold">
          {stats.orders}
        </h3>
      </div>

    </div>

  </div>

)}

         {activeTab === "applications" && (

  <div>

    <h2
      className="
        text-3xl
        font-bold
        mb-8
      "
    >
      Vendor Applications
    </h2>

    <div className="space-y-4">

      {applications.map((app) => (

        <div
          key={app.id}
          className="
            bg-white
            rounded-2xl
            p-6
            shadow-sm
          "
        >

          <div
            className="
              flex
              justify-between
              items-start
            "
          >

            <div>

              <h3
                className="
                  text-xl
                  font-bold
                "
              >
                {app.kitchen_name}
              </h3>

              <p className="text-gray-500">
                {app.vendor_type}
              </p>

              <p className="text-gray-500">
                {app.email}
              </p>
<div className="flex gap-3 mt-4">

  {app.status === "pending" && (

  <div className="flex gap-3 mt-4">

    <button
      onClick={() => approveVendor(app)}
      className="
        bg-green-500
        text-white
        px-4
        py-2
        rounded-lg
        font-medium
      "
    >
      Approve
    </button>

    <button
      onClick={() => rejectVendor(app.id)}
      className="
        bg-red-500
        text-white
        px-4
        py-2
        rounded-lg
        font-medium
      "
    >
      Reject
    </button>

  </div>

)}

</div>
            </div>

           <span
  className={`
    px-3
    py-1
    rounded-full
    text-sm
    font-medium

    ${
      app.status === "approved"
        ? "bg-green-100 text-green-700"
        : app.status === "rejected"
        ? "bg-red-100 text-red-700"
        : "bg-yellow-100 text-yellow-700"
    }
  `}
>
  {app.status === "approved"
    ? "Approved"
    : app.status === "rejected"
    ? "Rejected"
    : "Pending Review"}
</span>

          </div>

        </div>

      ))}

    </div>

  </div>

)}

          {activeTab === "vendors" && (
            <h2 className="text-3xl font-bold">
              Vendors
            </h2>
          )}

          {activeTab === "riders" && (
            <h2 className="text-3xl font-bold">
              Riders
            </h2>
          )}

          {activeTab === "orders" && (
            <h2 className="text-3xl font-bold">
              Orders
            </h2>
          )}

          {activeTab === "revenue" && (
            <h2 className="text-3xl font-bold">
              Revenue
            </h2>
          )}

        </div>

      </div>

    </main>
  );
}