"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  LayoutDashboard,
  Store,
  Bike,
  ShoppingBag,
  Wallet,
  ClipboardCheck
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
import EmployeeManagement from "./EmployeeManagement";


export default function AdminDashboard() {
 const [activeTab, setActiveTab] =
  useState("dashboard");

const [applications, setApplications] =
  useState<any[]>([]);

const [selectedApplication, setSelectedApplication] =
  useState<any>(null);

const [selectedVendor, setSelectedVendor] =
  useState<any>(null);

  const [selectedRider, setSelectedRider] =
  useState<any>(null);

const [riders, setRiders] =
  useState<any[]>([]);

  const [orders, setOrders] =
  useState<any[]>([]);

  const [selectedOrder, setSelectedOrder] =
  useState<any>(null);

  const [showAssignRider, setShowAssignRider] =
  useState(false);

const [selectedRiderId, setSelectedRiderId] =
  useState("");

const [stats, setStats] = useState({
  applications: 0,
  pending: 0,
  vendors: 0,
  riders: 0,
  orders: 0,
  mkhRevenue: 0,
  platformRevenue: 0,
  deliveryRevenue: 0
});
  
  
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
  const assignRider = async () => {

  if (!selectedRiderId) {
    alert("Select a rider first");
    return;
  }

  console.log(
    "SELECTED RIDER ID:",
    selectedRiderId
  );

  console.log(
    "SELECTED ORDER:",
    selectedOrder
  );

  const { error } = await supabase
    .from("orders")
    .update({
      rider_id: selectedRiderId,
      status: "assigned"
    })
    .eq(
      "id",
      selectedOrder.id
    );

  console.log(
    "UPDATE ERROR:",
    error
  );

  if (error) {
    console.error(error);
    alert("Assignment failed");
    return;
  }

  alert("Rider assigned");

  setShowAssignRider(false);
  setSelectedOrder(null);

  loadDashboardStats();

};
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

      const {
  data: revenueOrders
} =
await supabase
  .from("orders")
  .select(`
    mkh_amount,
    platform_fee
  `)
  .eq(
    "status",
    "delivered"
  );

const mkhRevenue =
  (revenueOrders || [])
    .reduce(

      (sum, order) =>

        sum +
        Number(
          order.mkh_amount || 0
        ),

      0

    );

const platformRevenue =
  (revenueOrders || [])
    .reduce(

      (sum, order) =>

        sum +
        Number(
          order.platform_fee || 0
        ),

      0

    );

const deliveryRevenue =
  mkhRevenue -
  platformRevenue;

 setStats({
  applications: applications || 0,
  pending: pendingApplications || 0,
  vendors: vendors || 0,
  riders: riders || 0,
  orders: orders || 0,
  mkhRevenue: mkhRevenue || 0,
  platformRevenue: platformRevenue || 0,
  deliveryRevenue: deliveryRevenue || 0
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
const {
  data: ridersData
} = await supabase
  .from("profiles")
  .select("*")
  .eq("role", "rider");

setRiders(ridersData || []);

console.log(
  "RIDERS LOADED:",
  ridersData
);

const {
  data: ordersData,
  error: ordersError
} = await supabase
  .from("orders")
  .select(`
    *,
    profiles:user_id (
      full_name,
      email
    ),
    vendors:vendor_id (
      name
    )
  `)
  .order("created_at", {
    ascending: false
  });

if (ordersError) {
  console.error(
    "Orders Load Error:",
    ordersError
  );
}

if (ordersData) {

  const ordersWithItems =
    await Promise.all(

      ordersData.map(
        async (order) => {

         const {
  data: items,
  error: itemsError
} = await supabase
  .from("order_items")
  .select("*")
  .eq(
    "order_id",
    order.id
  );

console.log(
  "ORDER ID:",
  order.id
);

console.log(
  "FOUND ITEMS:",
  items
);

console.log(
  "ITEM ERROR:",
  itemsError
);
          return {
            ...order,
            order_items:
              items || []
          };

        }
      )

    );

  setOrders(
    ordersWithItems
  );
console.log(
  "ORDERS WITH ITEMS:",
  ordersWithItems
);
}
 
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
    flex
    flex-col
  "
>

 <div
  className="
    mb-10
    flex
    flex-col
    items-center
    text-center
  "
>

 <Image
  src="/logo.png"
  alt="MKH Logo"
  width={180}
  height={52}
  priority
  style={{
    width: "180px",
    height: "auto"
  }}
/>

  <h2
    className="
      text-2xl
      font-bold
      mt-3
    "
  >
    Admin Panel
  </h2>

  <p
    className="
      text-gray-500
      text-sm
    "
  >
    Platform Control
  </p>

</div>

  <div className="space-y-2">

    <button
      onClick={() =>
        setActiveTab("dashboard")
      }
      className={`
        w-full
        flex
        items-center
        gap-3
        px-4
        py-3
        rounded-2xl
        transition-all

        ${
          activeTab === "dashboard"
            ? "bg-orange-500 text-white shadow-md"
            : "hover:bg-gray-100"
        }
      `}
    >
      <LayoutDashboard size={20} />
      Dashboard
    </button>

    <button
      onClick={() =>
        setActiveTab("applications")
      }
      className={`
        w-full
        flex
        items-center
        gap-3
        px-4
        py-3
        rounded-2xl
        transition-all

        ${
          activeTab === "applications"
            ? "bg-orange-500 text-white shadow-md"
            : "hover:bg-gray-100"
        }
      `}
    >
      <ClipboardCheck size={20} />
      Applications
    </button>

    <button
      onClick={() =>
        setActiveTab("vendors")
      }
      className={`
        w-full
        flex
        items-center
        gap-3
        px-4
        py-3
        rounded-2xl
        transition-all

        ${
          activeTab === "vendors"
            ? "bg-orange-500 text-white shadow-md"
            : "hover:bg-gray-100"
        }
      `}
    >
      <Store size={20} />
      Vendors
    </button>

    <button
      onClick={() =>
        setActiveTab("riders")
      }
      className={`
        w-full
        flex
        items-center
        gap-3
        px-4
        py-3
        rounded-2xl
        transition-all

        ${
          activeTab === "riders"
            ? "bg-orange-500 text-white shadow-md"
            : "hover:bg-gray-100"
        }
      `}
    >
      <Bike size={20} />
      Riders
    </button>

    <button
      onClick={() =>
        setActiveTab("orders")
      }
      className={`
        w-full
        flex
        items-center
        gap-3
        px-4
        py-3
        rounded-2xl
        transition-all

        ${
          activeTab === "orders"
            ? "bg-orange-500 text-white shadow-md"
            : "hover:bg-gray-100"
        }
      `}
    >
      <ShoppingBag size={20} />
      Orders
    </button>

    <button
      onClick={() =>
        setActiveTab("revenue")
      }
      className={`
        w-full
        flex
        items-center
        gap-3
        px-4
        py-3
        rounded-2xl
        transition-all

        ${
          activeTab === "revenue"
            ? "bg-orange-500 text-white shadow-md"
            : "hover:bg-gray-100"
        }
      `}
    >
      <Wallet size={20} />
      Revenue
    </button>

<button
  onClick={() =>
    setActiveTab("employees")
  }
  className={`
    w-full
    flex
    items-center
    gap-3
    px-4
    py-3
    rounded-2xl
    transition-all

    ${
      activeTab === "employees"
        ? "bg-orange-500 text-white shadow-md"
        : "hover:bg-gray-100"
    }
  `}
>
  👥 Employees
</button>

  </div>

  <div className="mt-auto pt-10">

    <div
      className="
        bg-orange-50
        border
        border-orange-200
        rounded-2xl
        p-4
      "
    >

      <p
        className="
          text-sm
          text-gray-500
        "
      >
        Pending Reviews
      </p>

      <h3
        className="
          text-3xl
          font-bold
          text-orange-500
        "
      >
        {stats.pending}
      </h3>

    </div>

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
    lg:grid-cols-5
    gap-6
  "
>

  <div
    className="
      bg-white
      rounded-3xl
      p-6
      shadow-sm
      border-l-4
      border-orange-500
    "
  >
    <p className="text-gray-500">
      Applications
    </p>

    <h3 className="text-5xl font-bold mt-2">
      {stats.applications}
    </h3>
  </div>

  <div
    className="
      bg-orange-500
      text-white
      rounded-3xl
      p-6
      shadow-sm
    "
  >
    <p className="opacity-80">
      Pending Review
    </p>

    <h3 className="text-5xl font-bold mt-2">
      {stats.pending}
    </h3>
  </div>

  <div
    className="
      bg-white
      rounded-3xl
      p-6
      shadow-sm
      border-l-4
      border-green-500
    "
  >
    <p className="text-gray-500">
      Vendors
    </p>

    <h3 className="text-5xl font-bold mt-2">
      {stats.vendors}
    </h3>
  </div>

  <div
    className="
      bg-white
      rounded-3xl
      p-6
      shadow-sm
      border-l-4
      border-blue-500
    "
  >
    <p className="text-gray-500">
      Riders
    </p>

    <h3 className="text-5xl font-bold mt-2">
      {stats.riders}
    </h3>
  </div>

  <div
    className="
      bg-white
      rounded-3xl
      p-6
      shadow-sm
      border-l-4
      border-purple-500
    "
  >
    <p className="text-gray-500">
      Orders
    </p>

    <h3 className="text-5xl font-bold mt-2">
      {stats.orders}
    </h3>


    
  </div>

       </div>

    <div className="mt-10">

      <h3
        className="
          text-2xl
          font-bold
          mb-6
        "
      >
        Admin Action Center
      </h3>

      <div
        className="
          grid
          md:grid-cols-3
          gap-6
        "
      >

        <div
          className="
            bg-white
            rounded-3xl
            p-6
            shadow-sm
            border-l-4
            border-orange-500
          "
        >

          <p className="text-gray-500">
            Pending Applications
          </p>

          <h3
            className="
              text-4xl
              font-bold
              mt-2
            "
          >
            {stats.pending}
          </h3>

          <button
            onClick={() =>
              setActiveTab(
                "applications"
              )
            }
            className="
              mt-4
              text-orange-500
              font-medium
            "
          >
            Review Queue →
          </button>

        </div>

        <div
          className="
            bg-white
            rounded-3xl
            p-6
            shadow-sm
            border-l-4
            border-blue-500
          "
        >

          <p className="text-gray-500">
            Pending KYC
          </p>

          <h3
            className="
              text-4xl
              font-bold
              mt-2
            "
          >
            0
          </h3>

          <p
            className="
              text-gray-400
              mt-4
            "
          >
            Coming Soon
          </p>

        </div>

        <div
          className="
            bg-white
            rounded-3xl
            p-6
            shadow-sm
            border-l-4
            border-green-500
          "
        >

          <p className="text-gray-500">
            Active Vendors
          </p>

          <h3
            className="
              text-4xl
              font-bold
              mt-2
            "
          >
            {stats.vendors}
          </h3>

          <p
            className="
              text-green-500
              mt-4
            "
          >
            Marketplace Growing
          </p>

        </div>

<div
  className="
    mt-8
    grid
    lg:grid-cols-2
    gap-6
  "
>

  {/* Recent Applications */}

  <div
    className="
      bg-white
      rounded-3xl
      p-6
      shadow-sm
    "
  >

    <div
      className="
        flex
        justify-between
        items-center
        mb-6
      "
    >

      <h3
        className="
          text-2xl
          font-bold
        "
      >
        Recent Applications
      </h3>

      <button
        onClick={() =>
          setActiveTab("applications")
        }
        className="
          text-orange-500
          font-medium
        "
      >
        View All →
      </button>

    </div>

    <div className="space-y-4">

      {applications
        .slice(0, 5)
        .map((app) => (

          <div
            key={app.id}
            className="
              flex
              justify-between
              items-center
              border-b
              pb-4
            "
          >

            <div>

              <h4 className="font-semibold">
                {app.kitchen_name}
              </h4>

              <p className="text-gray-500 text-sm">
                {app.vendor_type}
              </p>

            </div>

            <span
              className={`
                px-3
                py-1
                rounded-full
                text-xs
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
              {app.status}
            </span>

          </div>

        ))}

    </div>

  </div>

  {/* Quick Actions */}

  <div
    className="
      bg-white
      rounded-3xl
      p-6
      shadow-sm
    "
  >

    <h3
      className="
        text-2xl
        font-bold
        mb-6
      "
    >
      Quick Actions
    </h3>

    <div className="space-y-4">

      <button
        onClick={() =>
          setActiveTab("applications")
        }
        className="
          w-full
          bg-orange-500
          text-white
          py-4
          rounded-2xl
          font-medium
        "
      >
        Review Applications
      </button>

      <button
        onClick={() =>
          setActiveTab("vendors")
        }
        className="
          w-full
          bg-green-500
          text-white
          py-4
          rounded-2xl
          font-medium
        "
      >
        Manage Vendors
      </button>

      <button
        onClick={() =>
          setActiveTab("riders")
        }
        className="
          w-full
          bg-blue-500
          text-white
          py-4
          rounded-2xl
          font-medium
        "
      >
        Manage Riders
      </button>

      <button
        onClick={() =>
          setActiveTab("orders")
        }
        className="
          w-full
          bg-purple-500
          text-white
          py-4
          rounded-2xl
          font-medium
        "
      >
        View Orders
      </button>

    </div>

  </div>

</div>

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
      text-2xl
      font-bold
      mb-2
    "
  >
    {app.kitchen_name}
  </h3>

  <p className="text-orange-500 font-medium">
    {app.vendor_type}
  </p>

  <p className="text-gray-600 mt-2">
    📧 {app.email}
  </p>

  <p className="text-gray-600">
    👤 {app.owner_name || "Owner"}
  </p>

  <p className="text-gray-400 text-sm mt-2">
    Submitted Application
  </p>

<div className="mt-4">

  {app.status === "pending" && (

    <button
      onClick={() =>
        setSelectedApplication(app)
      }
      className="
        bg-orange-500
        text-white
        px-5
        py-2
        rounded-xl
        font-medium
        hover:bg-orange-600
      "
    >
      Review Application
    </button>

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

  <div>

    <div className="flex justify-between items-center mb-8">

      <div>

        <h2 className="text-3xl font-bold">
          Vendor Management
        </h2>

        <p className="text-gray-500">
          Manage approved marketplace vendors
        </p>

      </div>

    </div>

    <div
      className="
        bg-white
        rounded-3xl
        shadow-sm
        overflow-hidden
      "
    >

      <div
        className="
          grid
          grid-cols-5
          gap-4
          px-6
          py-4
          border-b
          font-semibold
          text-gray-500
        "
      >

        <div>Kitchen</div>
        <div>Owner</div>
        <div>Email</div>
        <div>Status</div>
        <div>Actions</div>

      </div>

      {applications
        .filter(
          (app) =>
            app.status === "approved"
        )
        .map((vendor) => (

          <div
            key={vendor.id}
            className="
              grid
              grid-cols-5
              gap-4
              px-6
              py-5
              border-b
              items-center
            "
          >

            <div>

              <p className="font-semibold">
                {vendor.kitchen_name}
              </p>

              <p className="text-sm text-gray-500">
                {vendor.vendor_type}
              </p>

            </div>

            <div>
              {vendor.owner_name}
            </div>

            <div>
              {vendor.email}
            </div>

            <div>

              <span
                className="
                  bg-green-100
                  text-green-700
                  px-3
                  py-1
                  rounded-full
                  text-sm
                "
              >
                Active
              </span>

            </div>

            <div className="flex gap-2">

             <button
  onClick={() =>
    setSelectedVendor(vendor)
  }
  className="
    bg-blue-500
    text-white
    px-4
    py-2
    rounded-lg
    text-sm
  "
>
  View
</button>

              <button
                className="
                  bg-red-500
                  text-white
                  px-4
                  py-2
                  rounded-lg
                  text-sm
                "
              >
                Suspend
              </button>

            </div>

          </div>

        ))}

    </div>

  </div>

)}

         {activeTab === "riders" && (

  <div>

    <h2
      className="
        text-4xl
        font-bold
        mb-2
      "
    >
      Rider Management
    </h2>

    <p
      className="
        text-gray-500
        mb-8
      "
    >
      Manage delivery partners
    </p>

    <div
      className="
        bg-white
        rounded-3xl
        overflow-hidden
        shadow-sm
      "
    >

      <table className="w-full">

        <thead>

          <tr
            className="
              border-b
              text-left
            "
          >

            <th className="p-6">
              Rider
            </th>

            <th className="p-6">
              Email
            </th>

            <th className="p-6">
              Phone
            </th>

            <th className="p-6">
              Status
            </th>

            <th className="p-6">
              Actions
            </th>

          </tr>

        </thead>

        <tbody>

          {riders.map((rider) => (

            <tr
              key={rider.id}
              className="border-b"
            >

              <td className="p-6">

                <div>

                  <p className="font-bold">
                    {rider.full_name}
                  </p>

                  <p className="text-gray-500">
                    Rider
                  </p>

                </div>

              </td>

              <td className="p-6">
                {rider.email}
              </td>

              <td className="p-6">
                {rider.phone}
              </td>

              <td className="p-6">

                <span
                  className="
                    bg-green-100
                    text-green-700
                    px-3
                    py-1
                    rounded-full
                  "
                >
                  Active
                </span>

              </td>

              <td className="p-6">

                <div className="flex gap-2">

                  <button
                    onClick={() =>
                      setSelectedRider(
                        rider
                      )
                    }
                    className="
                      bg-blue-500
                      text-white
                      px-4
                      py-2
                      rounded-lg
                    "
                  >
                    View
                  </button>

                  <button
                    className="
                      bg-red-500
                      text-white
                      px-4
                      py-2
                      rounded-lg
                    "
                  >
                    Suspend
                  </button>

                </div>

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  </div>

)}

    {activeTab === "orders" && (

  <div>

    <h2
      className="
        text-4xl
        font-bold
        mb-2
      "
    >
      Orders Management
    </h2>

    <p
      className="
        text-gray-500
        mb-8
      "
    >
      Monitor marketplace orders
    </p>

    <div
      className="
        bg-white
        rounded-3xl
        overflow-hidden
        shadow-sm
      "
    >

      <table className="w-full">

        <thead>

          <tr
            className="
              border-b
              text-left
            "
          >

            <th className="p-6">
              Order ID
            </th>

            <th className="p-6">
              Customer
            </th>

            <th className="p-6">
              Vendor
            </th>

            <th className="p-6">
              Amount
            </th>

            <th className="p-6">
              Status
            </th>

            <th className="p-6">
              Actions
            </th>

          </tr>

        </thead>

        <tbody>

          {orders.map((order) => (

            <tr
              key={order.id}
              className="border-b"
            >

              <td className="p-6 font-semibold">
                #{order.id.slice(0, 8)}
              </td>

              <td className="p-6">
                {order.profiles?.full_name || "Customer"}
              </td>

              <td className="p-6">
                {order.vendors?.name || "Vendor"}
              </td>

              <td className="p-6">
                ₦{order.total?.toLocaleString()}
              </td>

              <td className="p-6">

                <span
                  className={`
                    px-3
                    py-1
                    rounded-full
                    text-sm

                    ${
                      order.status === "delivered"
                        ? "bg-green-100 text-green-700"
                        : order.status === "picked_up"
                        ? "bg-blue-100 text-blue-700"
                        : order.status === "pending"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-gray-100 text-gray-700"
                    }
                  `}
                >
                  {order.status}
                </span>

              </td>

              <td className="p-6">

                <button
                  onClick={() => {
  console.log(
  "FULL ORDER OBJECT",
  JSON.stringify(order, null, 2)
);

setSelectedOrder(order);
}}
                  className="
                    bg-blue-500
                    text-white
                    px-4
                    py-2
                    rounded-lg
                  "
                >
                  View
                </button>

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  </div>

)}

      {activeTab === "revenue" && (

  <div>

    <h2
      className="
        text-3xl
        font-bold
        mb-8
      "
    >
      MKH Finance Center
    </h2>

    <div
      className="
        grid
        md:grid-cols-3
        gap-6
      "
    >

      <div
        className="
          bg-white
          rounded-3xl
          p-6
          shadow-sm
          border-l-4
          border-yellow-500
        "
      >

        <p className="text-gray-500">
          Total MKH Revenue
        </p>

        <h3
          className="
            text-4xl
            font-bold
            mt-2
            text-yellow-600
          "
        >
          ₦{stats.mkhRevenue.toLocaleString()}
        </h3>

      </div>

      <div
        className="
          bg-white
          rounded-3xl
          p-6
          shadow-sm
          border-l-4
          border-orange-500
        "
      >

        <p className="text-gray-500">
          Platform Fee Revenue
        </p>

       <h3
  className="
    text-4xl
    font-bold
    mt-2
    text-orange-600
  "
>
  ₦{stats.platformRevenue.toLocaleString()}
</h3>

      </div>

      <div
        className="
          bg-white
          rounded-3xl
          p-6
          shadow-sm
          border-l-4
          border-green-500
        "
      >

        <p className="text-gray-500">
          Delivery Commission
        </p>

       <h3
  className="
    text-4xl
    font-bold
    mt-2
    text-green-600
  "
>
  ₦{stats.deliveryRevenue.toLocaleString()}
</h3>

      </div>

    </div>

  </div>

)}

{activeTab === "employees" && (

  <EmployeeManagement />

)}

        </div>

      </div>

      {selectedApplication && (

        <div
          className="
            fixed
            inset-0
            bg-black/50
            flex
            items-center
            justify-center
            z-50
            p-6
          "
        >

          <div
           className="
  bg-white
  rounded-3xl
  w-full
  max-w-3xl
  p-8
  shadow-2xl
"
          >

            <div className="flex justify-between items-center mb-8">

              <h2 className="text-3xl font-bold">
                Vendor Application Review
              </h2>

              <button
                onClick={() =>
                  setSelectedApplication(null)
                }
                className="text-2xl"
              >
                ✕
              </button>

            </div>

            <div className="space-y-6">

              <div>
                <p className="text-gray-500">
                  Kitchen Name
                </p>

                <p className="font-bold text-xl">
                  {selectedApplication.kitchen_name}
                </p>
              </div>

              <div>
                <p className="text-gray-500">
                  Vendor Type
                </p>

                <p>
                  {selectedApplication.vendor_type}
                </p>
              </div>

              <div>
                <p className="text-gray-500">
                  Email
                </p>

                <p>
                  {selectedApplication.email}
                </p>
              </div>

              <div>
                <p className="text-gray-500">
                  Phone
                </p>

                <p>
                  {selectedApplication.phone}
                </p>
              </div>

              <div>
                <p className="text-gray-500">
                  Owner Name
                </p>

                <p>
                  {selectedApplication.owner_name}
                </p>
              </div>

            </div>

          <div
  className="
    grid
    grid-cols-3
    gap-4
    mt-8
  "
>

  <button
    className="
      bg-blue-500
      text-white
      py-3
      rounded-xl
      font-semibold
    "
  >
    Edit Vendor
  </button>

  <button
    className="
      bg-yellow-500
      text-white
      py-3
      rounded-xl
      font-semibold
    "
  >
    View Orders
  </button>

  <button
    className="
      bg-red-500
      text-white
      py-3
      rounded-xl
      font-semibold
    "
  >
    Suspend Vendor
  </button>

</div>

          </div>

        </div>

          )}

      {selectedVendor && (

        <div
          className="
            fixed
            inset-0
            bg-black/50
            flex
            items-center
            justify-center
            z-50
            p-6
          "
        >

          <div
            className="
              bg-white
              rounded-3xl
              w-full
              max-w-2xl
              p-8
              max-h-[90vh]
              overflow-y-auto
              shadow-2xl
            "
          >

            <div className="flex justify-between items-center mb-8">

              <h2 className="text-3xl font-bold">
                Vendor Details
              </h2>

              <button
                onClick={() =>
                  setSelectedVendor(null)
                }
                className="text-2xl"
              >
                ✕
              </button>

            </div>

          <div className="space-y-8">

  <div
    className="
      bg-gradient-to-r
      from-orange-500
      to-orange-600
      rounded-3xl
      p-6
      text-white
    "
  >

    <div className="flex items-center gap-4">

      <div
        className="
          w-20
          h-20
          rounded-full
          bg-white/20
          flex
          items-center
          justify-center
          text-3xl
          font-bold
        "
      >
        {selectedVendor.kitchen_name?.charAt(0).toUpperCase()}
      </div>

      <div>

        <h3 className="text-3xl font-bold">
          {selectedVendor.kitchen_name}
        </h3>

        <p className="text-white/80">
          {selectedVendor.vendor_type}
        </p>

      </div>

    </div>

  </div>

  <div
    className="
      grid
      grid-cols-3
      gap-4
    "
  >

    <div
      className="
        bg-gray-50
        rounded-2xl
        p-4
      "
    >
      <p className="text-gray-500 text-sm">
        Orders
      </p>

      <h3 className="text-3xl font-bold">
        245
      </h3>
    </div>

    <div
      className="
        bg-gray-50
        rounded-2xl
        p-4
      "
    >
      <p className="text-gray-500 text-sm">
        Revenue
      </p>

      <h3 className="text-3xl font-bold">
        ₦450k
      </h3>
    </div>

    <div
      className="
        bg-green-50
        rounded-2xl
        p-4
      "
    >
      <p className="text-gray-500 text-sm">
        Status
      </p>

      <h3 className="text-green-600 font-bold">
        Active
      </h3>
    </div>

  </div>

  <div
    className="
      bg-gray-50
      rounded-2xl
      p-6
      space-y-5
    "
  >

    <div>

      <p className="text-gray-500 text-sm">
        Owner Name
      </p>

      <p className="font-semibold">
        {selectedVendor.owner_name}
      </p>

    </div>

    <div>

      <p className="text-gray-500 text-sm">
        Email Address
      </p>

      <p className="font-semibold">
        {selectedVendor.email}
      </p>

    </div>

    <div>

      <p className="text-gray-500 text-sm">
        Phone Number
      </p>

      <p className="font-semibold">
        {selectedVendor.phone}
      </p>

    </div>

  </div>

</div>

            <div className="flex gap-4 mt-8">

              <button
                className="
                  bg-blue-500
                  text-white
                  px-6
                  py-3
                  rounded-xl
                  font-medium
                "
              >
                Edit Vendor
              </button>

              <button
                className="
                  bg-red-500
                  text-white
                  px-6
                  py-3
                  rounded-xl
                  font-medium
                "
              >
                Suspend Vendor
              </button>

            </div>

          </div>

        </div>

      )}

      {selectedRider && (

  <div
    className="
      fixed
      inset-0
      bg-black/50
      flex
      items-center
      justify-center
      z-50
      p-6
    "
  >

    <div
      className="
        bg-white
        rounded-3xl
        w-full
        max-w-3xl
        p-8
        shadow-2xl
      "
    >

      <div className="flex justify-between items-center">

        <h2 className="text-4xl font-bold">
          Rider Details
        </h2>

        <button
          onClick={() =>
            setSelectedRider(null)
          }
          className="text-3xl"
        >
          ✕
        </button>

      </div>

      <div
        className="
          mt-8
          bg-blue-500
          text-white
          rounded-3xl
          p-8
          flex
          items-center
          gap-6
        "
      >

        <div
          className="
            w-20
            h-20
            rounded-full
            bg-white/20
            flex
            items-center
            justify-center
            text-4xl
            font-bold
          "
        >
          {selectedRider.full_name
            ?.charAt(0)
            ?.toUpperCase()}
        </div>

        <div>

          <h3 className="text-4xl font-bold">
            {selectedRider.full_name}
          </h3>

          <p className="text-white/80">
            Delivery Rider
          </p>

        </div>

      </div>

      <div
        className="
          grid
          md:grid-cols-3
          gap-4
          mt-6
        "
      >

        <div
          className="
            bg-gray-50
            rounded-2xl
            p-5
          "
        >
          <p className="text-gray-500">
            Deliveries
          </p>

          <h3 className="text-4xl font-bold">
            0
          </h3>
        </div>

        <div
          className="
            bg-gray-50
            rounded-2xl
            p-5
          "
        >
          <p className="text-gray-500">
            Earnings
          </p>

          <h3 className="text-4xl font-bold">
            ₦0
          </h3>
        </div>

        <div
          className="
            bg-green-50
            rounded-2xl
            p-5
          "
        >
          <p className="text-gray-500">
            Status
          </p>

          <h3
            className="
              text-2xl
              font-bold
              text-green-600
            "
          >
            Active
          </h3>
        </div>

      </div>

      <div
        className="
          bg-gray-50
          rounded-3xl
          p-6
          mt-6
        "
      >

        <div className="mb-6">

          <p className="text-gray-500">
            Rider Name
          </p>

          <p className="font-bold text-xl">
            {selectedRider.full_name}
          </p>

        </div>

        <div className="mb-6">

          <p className="text-gray-500">
            Email Address
          </p>

          <p className="font-bold text-xl">
            {selectedRider.email}
          </p>

        </div>

        <div>

          <p className="text-gray-500">
            Phone Number
          </p>

          <p className="font-bold text-xl">
            {selectedRider.phone}
          </p>

        </div>

      </div>

      <div
        className="
          grid
          grid-cols-3
          gap-4
          mt-8
        "
      >

        <button
          className="
            bg-blue-500
            text-white
            py-3
            rounded-xl
            font-semibold
          "
        >
          Edit Rider
        </button>

        <button
          className="
            bg-orange-500
            text-white
            py-3
            rounded-xl
            font-semibold
          "
        >
          Coming Soon
        </button>

        <button
          className="
            bg-red-500
            text-white
            py-3
            rounded-xl
            font-semibold
          "
        >
          Suspend Rider
        </button>

      </div>

    </div>

  </div>

)}
{selectedOrder && (

  <div
    className="
      fixed
      inset-0
      bg-black/50
      flex
      items-center
      justify-center
      z-50
      p-6
    "
  >

    <div
      className="
        bg-white
        rounded-3xl
        w-full
        max-w-3xl
        p-8
        shadow-2xl
        max-h-[90vh]
        overflow-y-auto
      "
    >

      <div className="flex justify-between items-center">

        <h2 className="text-4xl font-bold">
          Order Details
        </h2>

        <button
          onClick={() =>
            setSelectedOrder(null)
          }
          className="text-3xl"
        >
          ✕
        </button>

      </div>

      <div
        className="
          mt-8
          bg-purple-500
          text-white
          rounded-3xl
          p-8
        "
      >

        <h3 className="text-3xl font-bold">
          #{selectedOrder.id?.slice(0, 8)}
        </h3>

        <p className="text-white/80">
          Order Information
        </p>

      </div>

      <div
        className="
          grid
          md:grid-cols-3
          gap-4
          mt-6
        "
      >

        <div
          className="
            bg-gray-50
            rounded-2xl
            p-5
          "
        >
          <p className="text-gray-500">
            Total Amount
          </p>

          <h3 className="text-3xl font-bold">
            ₦{selectedOrder.total?.toLocaleString()}
          </h3>
        </div>

       <div
  className="
    bg-gray-50
    rounded-2xl
    p-5
  "
>
  <p className="text-gray-500">
    Items
  </p>

 <h3 className="text-3xl font-bold">
  {selectedOrder.order_items?.length || 0}
</h3>

</div>

        <div
          className="
            bg-green-50
            rounded-2xl
            p-5
          "
        >
          <p className="text-gray-500">
            Status
          </p>

          <h3 className="font-bold text-green-600">
            {selectedOrder.status}
          </h3>
        </div>

      </div>

      <div
        className="
          bg-gray-50
          rounded-3xl
          p-6
          mt-6
        "
      >

        <div className="mb-5">

          <p className="text-gray-500">
            Customer Name
          </p>

          <p className="font-bold text-xl">
            {selectedOrder.profiles?.full_name}
          </p>

        </div>

        <div className="mb-5">

          <p className="text-gray-500">
            Email Address
          </p>

          <p className="font-bold text-xl">
            {selectedOrder.profiles?.email}
          </p>

        </div>

        <div className="mb-5">

          <p className="text-gray-500">
            Phone Number
          </p>

          <p className="font-bold text-xl">
            {selectedOrder.customer_phone || "N/A"}
          </p>

        </div>

        <div>

          <p className="text-gray-500">
            Delivery Address
          </p>
<div className="mt-8">

  <h3
    className="
      text-xl
      font-bold
      mb-4
    "
  >
    Ordered Items
  </h3>

  <div className="space-y-3">

    {selectedOrder.order_items?.map(
      (item: any) => (

        <div
          key={item.id}
          className="
            flex
            justify-between
            items-center
            bg-gray-50
            rounded-xl
            p-4
          "
        >

          <div>

            <p className="font-semibold">
              {item.name}
            </p>

            <p className="text-sm text-gray-500">
              Qty: {item.quantity}
            </p>

          </div>

          <p className="font-bold">
            ₦{item.price?.toLocaleString()}
          </p>

        </div>

      )
    )}

  </div>

</div>
          <p className="font-bold text-xl">
            {selectedOrder.delivery_address || "N/A"}
          </p>

        </div>
<div className="mt-8">

  <p className="text-gray-500 mb-4">
    Ordered Items
  </p>

  <div className="space-y-3">

    {selectedOrder.order_items?.map(
      (item: any) => (
        <div
          key={item.id}
          className="
            flex
            justify-between
            items-center
            bg-gray-50
            rounded-xl
            p-4
          "
        >

          <div>

            <p className="font-semibold">
              {item.name}
            </p>

            <p className="text-sm text-gray-500">
              Qty: {item.quantity}
            </p>

          </div>

          <p className="font-bold">
            ₦{item.price?.toLocaleString()}
          </p>

        </div>
      )
    )}

  </div>

</div>
      </div>

      <div
        className="
          bg-white
          border
          rounded-3xl
          p-6
          mt-6
        "
      >

        <h3
          className="
            text-2xl
            font-bold
            mb-4
          "
        >
          Ordered Items
        </h3>

        <div className="space-y-3">

          {selectedOrder.order_items?.map(
            (item: any) => (

              <div
                key={item.id}
                className="
                  flex
                  justify-between
                  border-b
                  pb-3
                "
              >

                <div>

                  <p className="font-semibold">
                    {item.name}
                  </p>

                  <p className="text-gray-500">
                    Qty: {item.quantity}
                  </p>

                </div>

                <p className="font-bold">
                  ₦{item.price?.toLocaleString()}
                </p>

              </div>

            )
          )}

        </div>

      </div>

      <div
        className="
          grid
          grid-cols-3
          gap-4
          mt-8
        "
      >

       <button
  onClick={() =>
    setShowAssignRider(true)
  }
  className="
    bg-blue-500
    text-white
    py-3
    rounded-xl
    font-semibold
  "
>
  Assign Rider
</button>

        <button
          className="
            bg-orange-500
            text-white
            py-3
            rounded-xl
            font-semibold
          "
        >
          Update Status
        </button>

        <button
          onClick={() =>
            setSelectedOrder(null)
          }
          className="
            bg-gray-500
            text-white
            py-3
            rounded-xl
            font-semibold
          "
        >
          Close
        </button>

      </div>

    </div>

  </div>

)}
{showAssignRider && (

  <div
    className="
      fixed
      inset-0
      bg-black/50
      flex
      items-center
      justify-center
      z-50
    "
  >

    <div
      className="
        bg-white
        p-8
        rounded-3xl
        w-full
        max-w-md
      "
    >

      <h2 className="text-2xl font-bold mb-6">
        Assign Rider
      </h2>

      <select
        value={selectedRiderId}
        onChange={(e) =>
          setSelectedRiderId(
            e.target.value
          )
        }
        className="
          w-full
          border
          p-3
          rounded-xl
          mb-6
        "
      >

        <option value="">
          Select Rider
        </option>

        {riders.map(
          (rider: any) => (

            <option
              key={rider.id}
              value={rider.id}
            >
              {rider.full_name}
            </option>

          )
        )}

      </select>

      <div className="flex gap-3">

        <button
          onClick={assignRider}
          className="
            flex-1
            bg-blue-500
            text-white
            py-3
            rounded-xl
          "
        >
          Assign
        </button>

        <button
          onClick={() =>
            setShowAssignRider(false)
          }
          className="
            flex-1
            bg-gray-500
            text-white
            py-3
            rounded-xl
          "
        >
          Cancel
        </button>

      </div>

    </div>

  </div>

)}
   </main>
  );
}