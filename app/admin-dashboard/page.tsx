"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard,
  Store,
  Bike,
  ShoppingBag,
  Wallet,
  ClipboardCheck,
  ChevronRight,
  ShieldCheck,
  LogOut
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export default function AdminDashboard() {
 const router = useRouter();
  const [activeTab, setActiveTab] =
  useState("dashboard");

 useEffect(() => {

   async function verifyAdminAccess() {

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
     

    const role = String(
  profile?.role || ""
).toUpperCase();

const allowedAdminRoles = [
  "ADMIN",
  "COO",
];

if (
  error ||
  !allowedAdminRoles.includes(role)
) {
  router.replace("/login");
  return;
}

   }

   verifyAdminAccess();

 }, [router]);

 async function handleLogout() {
  await supabase.auth.signOut();
  router.push("/login");
}

const [applications, setApplications] =
  useState<any[]>([]);

const [selectedApplication, setSelectedApplication] =
  useState<any>(null);

const [selectedVendor, setSelectedVendor] =
  useState<any>(null);

  const loadZonesForTerritory = async (
  territoryId: string
) => {
  setSelectedTerritoryId(territoryId);
  setSelectedZoneId("");
  setZones([]);

  if (!territoryId) {
    return;
  }

  const { data, error } = await supabase
    .from("zones")
    .select(`
      id,
      name,
      code,
      territory_id,
      is_active
    `)
    .eq("territory_id", territoryId)
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error(
      "Zones load error:",
      error
    );
    alert("Unable to load Zones");
    return;
  }

  setZones(data || []);
};

const loadTerritoryStates = async () => {

  const { data, error } = await supabase
    .from("states")
    .select("id, name")
    .order("name");

  if (error) {
    console.error(
      "Territory States load error:",
      error
    );

    alert("Unable to load States");
    return;
  }

  setTerritoryStates(data || []);
};


const loadTerritoryLgas = async (
  stateId: string
) => {

  setSelectedTerritoryStateId(stateId);
  setSelectedTerritoryLgaId("");
  setTerritoryLgas([]);

  if (!stateId) {
    return;
  }

  const { data, error } = await supabase
    .from("local_governments")
    .select("id, name, state_id")
    .eq("state_id", stateId)
    .order("name");

  if (error) {
    console.error(
      "Territory LGAs load error:",
      error
    );

    alert("Unable to load Local Government Areas");
    return;
  }

  setTerritoryLgas(data || []);
};


const openTerritoryModal = async () => {

  setTerritoryForm({
    name: "",
    description: "",
    maxVendors: "10",
    maxRiders: "30",
    isActive: true,
  });

  setSelectedTerritoryStateId("");
  setSelectedTerritoryLgaId("");
  setTerritoryLgas([]);

  await loadTerritoryStates();

  setShowTerritoryModal(true);
};


const saveTerritory = async () => {

  const name = territoryForm.name.trim();

  if (!selectedTerritoryStateId) {
    alert("Please select a State.");
    return;
  }

  if (!selectedTerritoryLgaId) {
    alert("Please select a Local Government Area.");
    return;
  }

  if (!name) {
    alert("Please enter a Territory name.");
    return;
  }

  const maxVendors =
    Number(territoryForm.maxVendors);

  const maxRiders =
    Number(territoryForm.maxRiders);

  if (
    !Number.isInteger(maxVendors) ||
    maxVendors < 1
  ) {
    alert("Maximum Vendors must be a valid positive number.");
    return;
  }

  if (
    !Number.isInteger(maxRiders) ||
    maxRiders < 1
  ) {
    alert("Maximum Riders must be a valid positive number.");
    return;
  }

  setSavingTerritory(true);

  try {

    const { data: existing } = await supabase
      .from("territories")
      .select("id")
      .eq("lga_id", selectedTerritoryLgaId)
      .ilike("name", name)
      .maybeSingle();

    if (existing) {
      alert(
        "A Territory with this name already exists in the selected LGA."
      );

      return;
    }

    const { data, error } = await supabase
      .from("territories")
      .insert({
        lga_id: selectedTerritoryLgaId,
        name,
        description:
          territoryForm.description.trim() || null,
        max_vendors: maxVendors,
        max_riders: maxRiders,
        is_active: territoryForm.isActive,
      })
      .select()
      .single();

    if (error) {
      console.error(
        "Territory creation error:",
        error
      );

      alert(
        error.message ||
        "Unable to create Territory."
      );

      return;
    }

// Refresh Territories from Supabase
await loadTerritories();

setShowTerritoryModal(false);

alert(
  "Territory created successfully."
);

  } finally {

    setSavingTerritory(false);

  }
};

const loadManagedZones = async () => {

  const {
    data,
    error,
  } = await supabase
    .from("zones")
    .select(`
      id,
      name,
      code,
      description,
      territory_id,
      is_active,
      created_at
    `)
    .order("name");

  if (error) {
    console.error(
      "Zones load error:",
      error
    );

    alert(
      "Unable to load Zones."
    );

    return;
  }

  setManagedZones(data || []);
};


const openZoneModal = () => {

  setZoneTerritoryId("");

  setZoneForm({
    name: "",
    code: "",
    description: "",
    isActive: true,
  });

  setShowZoneModal(true);
};


const saveZone = async () => {

  const name = zoneForm.name.trim();
  const code = zoneForm.code.trim();

  if (!zoneTerritoryId) {
    alert(
      "Please select a Territory."
    );
    return;
  }

  if (!name) {
    alert(
      "Please enter a Zone name."
    );
    return;
  }

  setSavingZone(true);

  try {

    const {
      data: existing,
      error: existingError,
    } = await supabase
      .from("zones")
      .select("id")
      .eq(
        "territory_id",
        zoneTerritoryId
      )
      .ilike("name", name)
      .maybeSingle();

    if (existingError) {
      console.error(
        "Zone duplicate check error:",
        existingError
      );

      alert(
        "Unable to validate Zone."
      );

      return;
    }

    if (existing) {
      alert(
        "A Zone with this name already exists in this Territory."
      );

      return;
    }

    const {
      data,
      error,
    } = await supabase
      .from("zones")
      .insert({
        territory_id:
          zoneTerritoryId,
        name,
        code: code || null,
        description:
          zoneForm.description.trim() ||
          null,
        is_active:
          zoneForm.isActive,
      })
      .select()
      .single();

    if (error) {
      console.error(
        "Zone creation error:",
        error
      );

      alert(
        error.message ||
        "Unable to create Zone."
      );

      return;
    }

    await loadManagedZones();

    setShowZoneModal(false);

    alert(
      "Zone created successfully."
    );

  } finally {

    setSavingZone(false);

  }
};

const [territories, setTerritories] = useState<any[]>([]);

const loadTerritories = async () => {

  const {
    data,
    error,
  } = await supabase
    .from("territories")
    .select(`
      id,
      name,
      lga_id,
      description,
      max_vendors,
      max_riders,
      is_active,
      created_at,
      local_governments (
        id,
        name
      )
    `)
    .order("name");

  if (error) {
    console.error(
      "Territories load error:",
      error
    );

    alert(
      "Unable to load Territories."
    );

    return;
  }

  setTerritories(data || []);
};

const [zones, setZones] = useState<any[]>([]);

const [territoryStates, setTerritoryStates] =
  useState<any[]>([]);

const [territoryLgas, setTerritoryLgas] =
  useState<any[]>([]);

const [selectedTerritoryStateId, setSelectedTerritoryStateId] =
  useState("");

const [selectedTerritoryLgaId, setSelectedTerritoryLgaId] =
  useState("");

const [showTerritoryModal, setShowTerritoryModal] =
  useState(false);

const [territoryForm, setTerritoryForm] = useState({
  name: "",
  description: "",
  maxVendors: "10",
  maxRiders: "30",
  isActive: true,
});

const [savingTerritory, setSavingTerritory] =
  useState(false);

  const [managedZones, setManagedZones] =
  useState<any[]>([]);

const [zoneTerritoryId, setZoneTerritoryId] =
  useState("");

const [showZoneModal, setShowZoneModal] =
  useState(false);

const [savingZone, setSavingZone] =
  useState(false);

const [zoneForm, setZoneForm] = useState({
  name: "",
  code: "",
  description: "",
  isActive: true,
});

const [selectedTerritoryId, setSelectedTerritoryId] = useState("");
const [selectedZoneId, setSelectedZoneId] = useState("");
const [currentVendorZone, setCurrentVendorZone] = useState<any>(null);
const [showAssignZone, setShowAssignZone] = useState(false);
const [loadingZoneAssignment, setLoadingZoneAssignment] = useState(false);

  const [selectedRider, setSelectedRider] =
  useState<any>(null);

const [riders, setRiders] =
  useState<any[]>([]);

  const [riderDeliveries, setRiderDeliveries] =
  useState(0);

const [riderEarnings, setRiderEarnings] =
  useState(0);

const [loadingRiderDetails, setLoadingRiderDetails] =
  useState(false);

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

const openVendorDetails = async (vendorApplication: any) => {
  try {
    setSelectedVendor(vendorApplication);
    setCurrentVendorZone(null);
    setSelectedTerritoryId("");
    setSelectedZoneId("");

    // Resolve the real vendor record.
    const { data: vendor, error: vendorError } =
      await supabase
        .from("vendors")
        .select("*")
        .eq("email", vendorApplication.email)
        .maybeSingle();

    if (vendorError) {
      console.error("Vendor lookup error:", vendorError);
      return;
    }

    if (!vendor) {
      console.error(
        "Approved application has no matching vendor record:",
        vendorApplication.email
      );
      return;
    }

    setSelectedVendor({
      ...vendorApplication,
      vendor_id: vendor.id,
      vendor_record: vendor,
    });

    // Load the vendor's current active Zone assignment.
    const { data: assignment, error: assignmentError } =
      await supabase
        .from("zone_vendors")
        .select(`
          id,
          vendor_id,
          zone_id,
          status,
          assigned_at,
          zones (
            id,
            name,
            territory_id,
            territories (
              id,
              name
            )
          )
        `)
        .eq("vendor_id", vendor.id)
        .eq("status", "active")
        .maybeSingle();

    if (assignmentError) {
      console.error(
        "Vendor Zone lookup error:",
        assignmentError
      );
      return;
    }

    setCurrentVendorZone(assignment || null);
  } catch (error) {
    console.error(
      "Open Vendor Details error:",
      error
    );
  }
};

const openAssignZone = async () => {
  setLoadingZoneAssignment(true);

  const { data, error } = await supabase
    .from("territories")
    .select(`
      id,
      name,
      lga_id,
      is_active
    `)
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error(
      "Territories load error:",
      error
    );
    alert("Unable to load Territories");
    setLoadingZoneAssignment(false);
    return;

  }

    setTerritories(data || []);

const existingTerritoryId =
  currentVendorZone?.zones?.territory_id || "";

const existingZoneId =
  currentVendorZone?.zone_id || "";

setSelectedTerritoryId(existingTerritoryId);
setSelectedZoneId(existingZoneId);

if (existingTerritoryId) {
  const { data: existingZones, error: zonesError } =
    await supabase
      .from("zones")
      .select(`
        id,
        name,
        code,
        territory_id,
        is_active
      `)
      .eq("territory_id", existingTerritoryId)
      .eq("is_active", true)
      .order("name");

  if (zonesError) {
    console.error(
      "Existing Zones load error:",
      zonesError
    );
    alert("Unable to load existing Zones");
    setLoadingZoneAssignment(false);
    return;
  }

  setZones(existingZones || []);
} else {
  setZones([]);
}

setShowAssignZone(true);

  setLoadingZoneAssignment(false);
};

const saveVendorZone = async () => {
  if (!selectedVendor?.vendor_id) {
    alert("Vendor record not found.");
    return;
  }

  if (!selectedTerritoryId || !selectedZoneId) {
    alert("Please select a Territory and Zone.");
    return;
  }

  setLoadingZoneAssignment(true);

  try {
    // Verify the selected Zone belongs to the selected Territory
    const { data: zone, error: zoneError } = await supabase
      .from("zones")
      .select("id, territory_id, is_active")
      .eq("id", selectedZoneId)
      .eq("territory_id", selectedTerritoryId)
      .eq("is_active", true)
      .maybeSingle();

    if (zoneError) throw zoneError;

    if (!zone) {
      alert("Invalid or inactive Zone selected.");
      return;
    }

    // Deactivate existing active Vendor → Zone assignment
    if (currentVendorZone?.id) {
      const { error: deactivateError } = await supabase
        .from("zone_vendors")
        .update({
          status: "inactive",
          unassigned_at: new Date().toISOString(),
        })
        .eq("id", currentVendorZone.id);

      if (deactivateError) throw deactivateError;
    }

    // Create the new active assignment
    const { data: newAssignment, error: insertError } = await supabase
      .from("zone_vendors")
      .insert({
        vendor_id: selectedVendor.vendor_id,
        zone_id: selectedZoneId,
        status: "active",
        assigned_at: new Date().toISOString(),
      })
      .select(`
        id,
        vendor_id,
        zone_id,
        status,
        assigned_at,
        zones (
          id,
          name,
          territory_id,
          territories (
            id,
            name
          )
        )
      `)
      .single();

    if (insertError) throw insertError;

    setCurrentVendorZone(newAssignment);
    setShowAssignZone(false);

    alert("Vendor Zone assignment saved successfully.");
  } catch (error: any) {
    console.error("saveVendorZone error:", error);
    alert(error?.message || "Failed to save Vendor Zone assignment.");
  } finally {
    setLoadingZoneAssignment(false);
  }
};

const openRiderDetails = async (rider: any) => {
  setSelectedRider(rider);

  setRiderDeliveries(0);
  setRiderEarnings(0);
  setLoadingRiderDetails(true);

  try {

    // =========================================================
    // LOAD RIDER DELIVERED ORDERS
    // orders is the financial source of truth
    // =========================================================

    const {
      data: riderOrders,
      error: riderOrdersError,
    } = await supabase
      .from("orders")
      .select("id, rider_amount")
      .eq("rider_id", rider.id)
      .eq("status", "delivered");

    if (riderOrdersError) {
      console.error(
        "Rider orders load error:",
        riderOrdersError
      );

      setRiderDeliveries(0);
      setRiderEarnings(0);

      return;
    }

    // Number of completed deliveries
    const deliveryCount =
      riderOrders?.length || 0;

    setRiderDeliveries(
      deliveryCount
    );

    // =========================================================
    // CALCULATE RIDER EARNINGS
    // Sum rider_amount from delivered orders
    // =========================================================

    const totalEarnings =
      (riderOrders || []).reduce(
        (sum, order) =>
          sum +
          Number(
            order.rider_amount || 0
          ),
        0
      );

    setRiderEarnings(
      totalEarnings
    );

  } catch (error) {

    console.error(
      "Open Rider Details error:",
      error
    );

    setRiderDeliveries(0);
    setRiderEarnings(0);

  } finally {

    setLoadingRiderDetails(false);

  }
};

 const assignRider = async () => {

  // Prevent reassignment of delivered orders
  if (selectedOrder?.status === "delivered") {
    alert("A delivered order cannot be assigned to another rider.");
    return;
  }

  // Make sure a rider has been selected
  if (!selectedRiderId) {
    alert("Select a rider first");
    return;
  }

  const { error } = await supabase
    .from("orders")
    .update({
      rider_id: selectedRiderId,
      status: "assigned"
    })
    .eq("id", selectedOrder.id);

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
  loadTerritories();
  loadManagedZones();

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
}
 
};

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">

        {/* =========================================================
            MKH ADMIN SIDEBAR
            ========================================================= */}
        <aside className="hidden lg:flex lg:w-72 xl:w-80 shrink-0 flex-col bg-[#0b1220] text-white">

          <div className="border-b border-white/10 px-6 py-7">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white px-1 shadow-lg">
                <Image
                  src="/logo.png"
                  alt="MKH Logo"
                  width={180}
                  height={52}
                  priority
                />
              </div>

              <div>
                <p className="text-xl font-black tracking-tight">MKH</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-400">
                  Mammy Kitchen Hub
                </p>
              </div>
            </div>

            <div className="mt-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-400">
                Administration
              </p>
              <h1 className="mt-1 text-lg font-bold">
                Platform Control Center
              </h1>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                System Active
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-6">
            <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Control Modules
            </p>

            <div className="space-y-1.5">
              {[
                ["dashboard", "Dashboard", LayoutDashboard],
                ["applications", "Applications", ClipboardCheck],
                ["vendors", "Vendors", Store],
                ["riders", "Riders", Bike],
                ["orders", "Orders", ShoppingBag],
                ["revenue", "Revenue", Wallet],
              ].map(([key, label, Icon]: any) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`group flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-sm font-semibold transition-all ${
                    activeTab === key
                      ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={19} />
                  <span>{label}</span>
                  {activeTab === key && (
                    <ChevronRight size={16} className="ml-auto" />
                  )}
                </button>
              ))}

              <div className="my-4 border-t border-white/10" />

              <button
                onClick={() => setActiveTab("territories")}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-sm font-semibold transition-all ${
                  activeTab === "territories"
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="text-base">🌍</span>
                <span>Territories</span>
                {activeTab === "territories" && (
                  <ChevronRight size={16} className="ml-auto" />
                )}
              </button>

              <button
                onClick={() => setActiveTab("zones")}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-sm font-semibold transition-all ${
                  activeTab === "zones"
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="text-base">📍</span>
                <span>Zones</span>
                {activeTab === "zones" && (
                  <ChevronRight size={16} className="ml-auto" />
                )}
              </button>
            </div>
          </nav>

          <div className="border-t border-white/10 p-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
                  <ShieldCheck size={20} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">Admin Access</p>
                  <p className="text-xs text-slate-400">COO / Administrator</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-slate-400">Pending Reviews</span>
                <span className="rounded-full bg-orange-500/15 px-2.5 py-1 font-bold text-orange-300">
                  {stats.pending}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
            >
              <LogOut size={17} />
              Logout
            </button>
          </div>
        </aside>

        {/* =========================================================
            MAIN WORKSPACE
            ========================================================= */}
        <div className="min-w-0 flex-1">

          <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
            <div className="px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-orange-500">
                    Mammy Kitchen Hub
                  </p>
                  <div className="mt-1 flex items-center gap-3">
                    <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                      Admin Control Center
                    </h2>
                    <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 sm:inline-flex">
                      Platform Operations
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600 md:flex">
                    <ShieldCheck size={17} className="text-orange-500" />
                    Secure Admin Access
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white shadow-sm">
                    AD
                  </div>
                </div>
              </div>

              {/* Mobile module navigation */}
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
                {[
                  ["dashboard", "Dashboard"],
                  ["applications", "Applications"],
                  ["vendors", "Vendors"],
                  ["riders", "Riders"],
                  ["orders", "Orders"],
                  ["revenue", "Revenue"],
                  ["territories", "Territories"],
                  ["zones", "Zones"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                      activeTab === key
                        ? "bg-orange-500 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </header>

          <div className="p-4 sm:p-6 lg:p-8">
          {activeTab === "territories" && (


  <div>

    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between mb-8">

      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-orange-500">
          Geographic Operations
        </p>

        <h2 className="text-3xl font-bold mt-1">
          Territory Management
        </h2>

        <p className="text-gray-500 mt-2">
          Create and manage MKH operational Territories by State and LGA.
        </p>
      </div>

      <button
        onClick={openTerritoryModal}
        className="
          inline-flex
          items-center
          justify-center
          gap-2
          rounded-2xl
          bg-orange-500
          px-6
          py-4
          font-semibold
          text-white
          shadow-lg
          transition-all
          hover:bg-orange-600
          hover:shadow-xl
          active:scale-[0.98]
        "
      >
        <span className="text-xl">+</span>
        Create Territory
      </button>

    </div>


    <div className="grid gap-6 md:grid-cols-3 mb-8">

      <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100">
        <p className="text-sm text-gray-500">
          Total Territories
        </p>

        <h3 className="mt-2 text-4xl font-bold">
          {territories.length}
        </h3>
      </div>


      <div className="rounded-3xl bg-white p-6 shadow-sm border-l-4 border-green-500">
        <p className="text-sm text-gray-500">
          Active Territories
        </p>

        <h3 className="mt-2 text-4xl font-bold">
          {
            territories.filter(
              (territory) =>
                territory.is_active === true
            ).length
          }
        </h3>
      </div>


      <div className="rounded-3xl bg-white p-6 shadow-sm border-l-4 border-gray-400">
        <p className="text-sm text-gray-500">
          Inactive Territories
        </p>

        <h3 className="mt-2 text-4xl font-bold">
          {
            territories.filter(
              (territory) =>
                territory.is_active === false
            ).length
          }
        </h3>
      </div>

    </div>


    <div className="rounded-3xl bg-white shadow-sm border border-gray-100 overflow-hidden">

      <div className="border-b px-6 py-5">
        <h3 className="text-xl font-bold">
          Operational Territories
        </h3>

        <p className="text-sm text-gray-500 mt-1">
          Territories currently configured for MKH operations.
        </p>
      </div>


      {territories.length === 0 ? (

        <div className="px-6 py-16 text-center">

          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-3xl">
            🌍
          </div>

          <h4 className="text-lg font-bold">
            No Territories configured
          </h4>

          <p className="mt-2 text-sm text-gray-500">
            Create the first operational Territory to begin geographic setup.
          </p>

        </div>

      ) : (

        <div className="overflow-x-auto">

          <table className="w-full">

            <thead className="bg-gray-50 text-left text-sm text-gray-500">

              <tr>
                <th className="px-6 py-4">
                  Territory
                </th>

                <th className="px-6 py-4">
                  LGA
                </th>

                <th className="px-6 py-4">
                  Vendor Capacity
                </th>

                <th className="px-6 py-4">
                  Rider Capacity
                </th>

                <th className="px-6 py-4">
                  Status
                </th>
              </tr>

            </thead>


            <tbody className="divide-y">

              {territories
                .slice()
                .sort((a, b) =>
                  String(a.name).localeCompare(
                    String(b.name)
                  )
                )
                .map((territory) => (

                  <tr
                    key={territory.id}
                    className="hover:bg-orange-50/40"
                  >

                    <td className="px-6 py-5">
                      <p className="font-semibold">
                        {territory.name}
                      </p>

                      {territory.description && (
                        <p className="text-sm text-gray-500 mt-1">
                          {territory.description}
                        </p>
                      )}
                    </td>


                   <td className="px-6 py-5 text-gray-600">
  {territory.local_governments?.name ||
    "LGA unavailable"}
</td>


                    <td className="px-6 py-5 font-semibold">
                      {territory.max_vendors}
                    </td>


                    <td className="px-6 py-5 font-semibold">
                      {territory.max_riders}
                    </td>


                    <td className="px-6 py-5">

                      <span
                        className={`
                          inline-flex
                          rounded-full
                          px-3
                          py-1
                          text-xs
                          font-semibold

                          ${
                            territory.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }
                        `}
                      >
                        {territory.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>

                    </td>

                  </tr>

                ))}

            </tbody>

          </table>

        </div>

      )}

    </div>

  </div>

)}

{activeTab === "zones" && (

  <div>

    {/* Zone Management Header */}
    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between mb-8">

      <div>

        <p className="text-sm font-semibold uppercase tracking-widest text-orange-500">
          Geographic Operations
        </p>

        <h2 className="text-3xl font-bold mt-1">
          Zone Management
        </h2>

        <p className="text-gray-500 mt-2">
          Create and manage operational Zones within MKH Territories.
        </p>

      </div>

      <button
        onClick={openZoneModal}
        className="
          inline-flex
          items-center
          justify-center
          gap-2
          rounded-2xl
          bg-orange-500
          px-6
          py-4
          font-semibold
          text-white
          shadow-lg
          transition-all
          hover:bg-orange-600
          hover:shadow-xl
          active:scale-[0.98]
        "
      >
        <span className="text-xl">+</span>
        Create Zone
      </button>

    </div>


    {/* Zone KPI Cards */}
    <div className="grid gap-6 md:grid-cols-3 mb-8">

      <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100">

        <p className="text-sm text-gray-500">
          Total Zones
        </p>

        <h3 className="mt-2 text-4xl font-bold">
          {managedZones.length}
        </h3>

      </div>


      <div className="rounded-3xl bg-white p-6 shadow-sm border-l-4 border-green-500">

        <p className="text-sm text-gray-500">
          Active Zones
        </p>

        <h3 className="mt-2 text-4xl font-bold">
          {
            managedZones.filter(
              (zone) =>
                zone.is_active === true
            ).length
          }
        </h3>

      </div>


      <div className="rounded-3xl bg-white p-6 shadow-sm border-l-4 border-gray-400">

        <p className="text-sm text-gray-500">
          Inactive Zones
        </p>

        <h3 className="mt-2 text-4xl font-bold">
          {
            managedZones.filter(
              (zone) =>
                zone.is_active === false
            ).length
          }
        </h3>

      </div>

    </div>


    {/* Zone Table */}
    <div className="rounded-3xl bg-white shadow-sm border border-gray-100 overflow-hidden">

      <div className="border-b px-6 py-5">

        <h3 className="text-xl font-bold">
          Operational Zones
        </h3>

        <p className="text-sm text-gray-500 mt-1">
          Zones currently configured within MKH Territories.
        </p>

      </div>


      {managedZones.length === 0 ? (

        <div className="px-6 py-16 text-center">

          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-3xl">
            📍
          </div>

          <h4 className="text-lg font-bold">
            No Zones configured
          </h4>

          <p className="mt-2 text-sm text-gray-500">
            Create the first operational Zone to begin Territory-level service management.
          </p>

        </div>

      ) : (

        <div className="overflow-x-auto">

          <table className="w-full">

            <thead className="bg-gray-50 text-left text-sm text-gray-500">

              <tr>

                <th className="px-6 py-4">
                  Zone
                </th>

                <th className="px-6 py-4">
                  Code
                </th>

                <th className="px-6 py-4">
                  Territory
                </th>

                <th className="px-6 py-4">
                  Description
                </th>

                <th className="px-6 py-4">
                  Status
                </th>

              </tr>

            </thead>


            <tbody className="divide-y">

              {managedZones.map((zone) => {

                const territory =
                  territories.find(
                    (item) =>
                      item.id ===
                      zone.territory_id
                  );

                return (

                  <tr
                    key={zone.id}
                    className="hover:bg-gray-50 transition-colors"
                  >

                    <td className="px-6 py-5">

                      <div className="font-semibold text-gray-900">
                        {zone.name}
                      </div>

                    </td>


                    <td className="px-6 py-5">

                      <span className="inline-flex rounded-xl bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                        {zone.code || "—"}
                      </span>

                    </td>


                    <td className="px-6 py-5">

                      <div className="font-medium text-gray-800">
                        {territory?.name ||
                          "Territory unavailable"}
                      </div>

                    </td>


                    <td className="px-6 py-5">

                      <div className="max-w-xs text-sm text-gray-500">
                        {zone.description ||
                          "No description"}
                      </div>

                    </td>


                    <td className="px-6 py-5">

                      <span
                        className={`
                          inline-flex
                          rounded-full
                          px-3
                          py-1
                          text-xs
                          font-semibold
                          ${
                            zone.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }
                        `}
                      >
                        {zone.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>

                    </td>

                  </tr>

                );

              })}

            </tbody>

          </table>

        </div>

      )}

    </div>

  </div>

)}

         {activeTab === "dashboard" && (

  <div className="space-y-8">

    {/* Dashboard hero */}
    <section className="overflow-hidden rounded-[2rem] bg-[#0b1220] p-6 text-white shadow-xl sm:p-8 lg:p-10">
      <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-400">
            Platform Administration
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            Executive Admin Dashboard
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
            Central control for marketplace applications, vendors, riders, orders,
            revenue, territories and operational zones across MKH.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_0_5px_rgba(52,211,153,0.10)]" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">
              System Status
            </p>
            <p className="mt-0.5 text-sm font-bold text-white">
              Operational
            </p>
          </div>
        </div>
      </div>
    </section>

    {/* Core KPIs */}
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500">
            At a Glance
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Marketplace Overview
          </h2>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Applications</p>
          <p className="mt-3 text-4xl font-black text-slate-950">{stats.applications}</p>
          <div className="mt-4 h-1.5 rounded-full bg-orange-100">
            <div className="h-full w-full rounded-full bg-orange-500" />
          </div>
        </div>

        <div className="rounded-3xl bg-orange-500 p-5 text-white shadow-lg shadow-orange-500/20">
          <p className="text-sm font-semibold text-orange-100">Pending Review</p>
          <p className="mt-3 text-4xl font-black">{stats.pending}</p>
          <p className="mt-4 text-xs font-semibold text-orange-100">Requires attention</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Vendors</p>
          <p className="mt-3 text-4xl font-black text-slate-950">{stats.vendors}</p>
          <div className="mt-4 h-1.5 rounded-full bg-emerald-100">
            <div className="h-full w-full rounded-full bg-emerald-500" />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Riders</p>
          <p className="mt-3 text-4xl font-black text-slate-950">{stats.riders}</p>
          <div className="mt-4 h-1.5 rounded-full bg-orange-100">
            <div className="h-full w-full rounded-full bg-orange-500" />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Orders</p>
          <p className="mt-3 text-4xl font-black text-slate-950">{stats.orders}</p>
          <div className="mt-4 h-1.5 rounded-full bg-orange-100">
            <div className="h-full w-full rounded-full bg-orange-500" />
          </div>
        </div>
      </div>
    </section>

    {/* Administrative priorities */}
    <section>
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500">
          Administrative Priorities
        </p>
        <h2 className="mt-1 text-2xl font-black text-slate-950">
          Command Overview
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-orange-200 bg-orange-50 p-5">
          <p className="text-sm font-semibold text-orange-700">Pending Applications</p>
          <p className="mt-3 text-4xl font-black text-slate-950">{stats.pending}</p>
          <button
            onClick={() => setActiveTab("applications")}
            className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-orange-600 transition hover:text-orange-700"
          >
            Open review queue <ChevronRight size={16} />
          </button>
        </div>

        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-semibold text-emerald-700">Active Vendors</p>
          <p className="mt-3 text-4xl font-black text-slate-950">{stats.vendors}</p>
          <p className="mt-4 text-xs font-semibold text-emerald-700">Marketplace operations</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Territories</p>
          <p className="mt-3 text-4xl font-black text-slate-950">{territories.length}</p>
          <button
            onClick={() => setActiveTab("territories")}
            className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-orange-600 transition hover:text-orange-700"
          >
            Manage territories <ChevronRight size={16} />
          </button>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Zones</p>
          <p className="mt-3 text-4xl font-black text-slate-950">{managedZones.length}</p>
          <button
            onClick={() => setActiveTab("zones")}
            className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-orange-600 transition hover:text-orange-700"
          >
            Manage zones <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>

    {/* Recent applications */}
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500">Applications</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">Recent Vendor Applications</h2>
        </div>
        <button
          onClick={() => setActiveTab("applications")}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-bold text-orange-600 transition hover:bg-orange-100 sm:self-auto"
        >
          View all <ChevronRight size={16} />
        </button>
      </div>

      <div className="mt-6 divide-y divide-slate-100">
        {applications.slice(0, 5).map((app) => (
          <div key={app.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h4 className="truncate font-bold text-slate-950">{app.kitchen_name}</h4>
              <p className="mt-1 text-sm text-slate-500">{app.vendor_type}</p>
            </div>
            <span
              className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-bold ${
                app.status === "approved"
                  ? "bg-emerald-100 text-emerald-700"
                  : app.status === "rejected"
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {app.status}
            </span>
          </div>
        ))}

        {applications.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
            No recent vendor applications.
          </div>
        )}
      </div>
    </section>

    {/* Quick actions — intentionally full-width, not cramped beside applications */}
    <section className="rounded-[2rem] bg-[#0b1220] p-5 text-white shadow-xl sm:p-7">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-400">Operations</p>
        <h2 className="mt-1 text-2xl font-black">Quick Actions</h2>
        <p className="mt-2 text-sm text-slate-400">
          Jump directly into the areas that require administrative attention.
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <button
          onClick={() => setActiveTab("applications")}
          className="rounded-2xl border border-orange-400/20 bg-orange-500 px-5 py-4 text-left font-bold text-white shadow-lg shadow-orange-500/10 transition hover:bg-orange-600"
        >
          <span className="block text-sm text-orange-100">01</span>
          <span className="mt-1 block">Review Applications</span>
        </button>

        <button
          onClick={() => setActiveTab("vendors")}
          className="rounded-2xl border border-emerald-400/20 bg-emerald-500 px-5 py-4 text-left font-bold text-white transition hover:bg-emerald-600"
        >
          <span className="block text-sm text-emerald-100">02</span>
          <span className="mt-1 block">Manage Vendors</span>
        </button>

        <button
          onClick={() => setActiveTab("riders")}
          className="rounded-2xl border border-orange-400/20 bg-orange-500 px-5 py-4 text-left font-bold text-white transition hover:bg-orange-600"
        >
          <span className="block text-sm text-orange-100">03</span>
          <span className="mt-1 block">Manage Riders</span>
        </button>

        <button
          onClick={() => setActiveTab("orders")}
          className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-left font-bold text-white transition hover:bg-white/15"
        >
          <span className="block text-sm text-slate-400">04</span>
          <span className="mt-1 block">View Orders</span>
        </button>
      </div>
    </section>

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
  openVendorDetails(vendor)

  }
  className="
    bg-orange-500
    text-white
    px-4
    py-2
    rounded-lg
    text-sm
  "
>
  View
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
  openRiderDetails(rider)
}
                    className="
                      bg-orange-500
                      text-white
                      px-4
                      py-2
                      rounded-lg
                    "
                  >
                    View
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
  setSelectedOrder(order);
}}
                  className="
                    bg-orange-500
                    text-white
                    px-4
                    py-2
                    rounded-lg
                    hover:bg-orange-600
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

        </div>

      </div>

      {selectedApplication && (

        <div
          className="
            fixed
            inset-0
            bg-black/60 backdrop-blur-sm
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

            <div className="-mx-8 -mt-8 mb-8 flex items-center justify-between rounded-t-3xl bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-6 text-white">

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-100">
                  Vendor Operations
                </p>
                <h2 className="mt-1 text-2xl font-black">
                  Vendor Application Review
                </h2>
              </div>

              <button
                onClick={() =>
                  setSelectedApplication(null)
                }
                className="rounded-xl bg-white/10 px-3 py-2 text-2xl transition hover:bg-white/20"
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

          <div className="mt-8 grid gap-3 sm:grid-cols-3">

            <button
              onClick={async () => {
                await approveVendor(selectedApplication);
                setSelectedApplication(null);
              }}
              className="rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white transition hover:bg-orange-600"
            >
              Approve Application
            </button>

            <button
              onClick={async () => {
                await rejectVendor(selectedApplication.id);
                setSelectedApplication(null);
              }}
              className="rounded-xl bg-red-500 px-4 py-3 font-semibold text-white transition hover:bg-red-600"
            >
              Reject Application
            </button>

            <button
              onClick={() => setSelectedApplication(null)}
              className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Close
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
            bg-black/60 backdrop-blur-sm
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

          <div className="flex flex-wrap gap-4 mt-8">

  <button
    onClick={openAssignZone}
    disabled={loadingZoneAssignment}
    className="
      bg-orange-500
      text-white
      px-6
      py-3
      rounded-xl
      font-medium
      disabled:opacity-50
    "
  >
    {loadingZoneAssignment
      ? "Loading..."
      : currentVendorZone
        ? "Change Zone"
        : "Assign Zone"}
  </button>

<div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">

  <p className="text-gray-500 text-sm">
    Operational Zone
  </p>

  {currentVendorZone ? (
    <>
      <p className="font-bold text-lg text-orange-700 mt-1">
        {currentVendorZone.zones?.name || "Assigned Zone"}
      </p>

      <p className="text-sm text-gray-500 mt-1">
        Territory:{" "}
        {currentVendorZone.zones?.territories?.name ||
          "Unknown"}
      </p>
    </>
  ) : (
    <p className="font-semibold text-gray-500 mt-1">
      No Zone assigned
    </p>
  )}

</div>

</div>

          </div>

        </div>

      )}

{showZoneModal && (

  <div
    className="
      fixed
      inset-0
      z-[100]
      flex
      items-center
      justify-center
      bg-black/60
      p-4
      backdrop-blur-sm
      sm:p-6
    "
  >

    <div
      className="
        flex
        w-full
        max-w-2xl
        max-h-[92vh]
        flex-col
        overflow-hidden
        rounded-[2rem]
        bg-white
        shadow-2xl
      "
    >

      {/* Modal Header */}

      <div
        className="
          relative
          overflow-hidden
          bg-gradient-to-br
          from-orange-500
          via-orange-500
          to-orange-600
          px-6
          py-6
          text-white
          sm:px-8
        "
      >

        <div
          className="
            absolute
            -right-10
            -top-10
            h-32
            w-32
            rounded-full
            bg-white/10
          "
        />

        <div
          className="
            absolute
            -bottom-16
            -left-10
            h-36
            w-36
            rounded-full
            bg-white/10
          "
        />

        <div className="relative flex items-start justify-between gap-4">

          <div>

            <div
              className="
                mb-3
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-2xl
                bg-white/15
                text-2xl
                shadow-inner
              "
            >
              📍
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-100">
              Geographic Operations
            </p>

            <h2 className="mt-1 text-2xl font-bold sm:text-3xl">
              Create Zone
            </h2>

            <p className="mt-2 max-w-lg text-sm text-orange-50">
              Define a new operational service area within an existing MKH Territory.
            </p>

          </div>


          <button
            type="button"
            onClick={() =>
              setShowZoneModal(false)
            }
            className="
              relative
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-full
              bg-white/15
              text-xl
              text-white
              transition
              hover:bg-white/25
              focus:outline-none
              focus:ring-2
              focus:ring-white/60
            "
            aria-label="Close Create Zone modal"
          >
            ×
          </button>

        </div>

      </div>


      {/* Modal Body */}

      <div className="flex-1 overflow-y-auto px-6 py-7 sm:px-8">

        <div className="space-y-6">

          {/* Territory */}

          <div>

            <label
              htmlFor="zone-territory"
              className="
                mb-2
                block
                text-sm
                font-semibold
                text-gray-800
              "
            >
              Territory
              <span className="ml-1 text-orange-500">
                *
              </span>
            </label>

            <select
              id="zone-territory"
              value={zoneTerritoryId}
              onChange={(e) =>
                setZoneTerritoryId(
                  e.target.value
                )
              }
              className="
                w-full
                rounded-2xl
                border
                border-gray-200
                bg-gray-50
                px-4
                py-4
                text-sm
                font-medium
                text-gray-900
                outline-none
                transition
                focus:border-orange-400
                focus:bg-white
                focus:ring-4
                focus:ring-orange-100
              "
            >

              <option value="">
                Select Territory
              </option>

              {territories
                .filter(
                  (territory) =>
                    territory.is_active === true
                )
                .sort((a, b) =>
                  a.name.localeCompare(
                    b.name
                  )
                )
                .map((territory) => (

                  <option
                    key={territory.id}
                    value={territory.id}
                  >
                    {territory.name}
                  </option>

                ))}

            </select>

            <p className="mt-2 text-xs text-gray-500">
              The Zone must belong to an active Territory.
            </p>

          </div>


          {/* Zone Name + Code */}

          <div className="grid gap-5 md:grid-cols-2">

            <div>

              <label
                htmlFor="zone-name"
                className="
                  mb-2
                  block
                  text-sm
                  font-semibold
                  text-gray-800
                "
              >
                Zone Name
                <span className="ml-1 text-orange-500">
                  *
                </span>
              </label>

              <input
                id="zone-name"
                type="text"
                value={zoneForm.name}
                onChange={(e) =>
                  setZoneForm({
                    ...zoneForm,
                    name: e.target.value,
                  })
                }
                placeholder="e.g. Anthony Central"
                className="
                  w-full
                  rounded-2xl
                  border
                  border-gray-200
                  bg-gray-50
                  px-4
                  py-4
                  text-sm
                  font-medium
                  text-gray-900
                  outline-none
                  transition
                  placeholder:text-gray-400
                  focus:border-orange-400
                  focus:bg-white
                  focus:ring-4
                  focus:ring-orange-100
                "
              />

            </div>


            <div>

              <label
                htmlFor="zone-code"
                className="
                  mb-2
                  block
                  text-sm
                  font-semibold
                  text-gray-800
                "
              >
                Zone Code
              </label>

              <input
                id="zone-code"
                type="text"
                value={zoneForm.code}
                onChange={(e) =>
                  setZoneForm({
                    ...zoneForm,
                    code:
                      e.target.value.toUpperCase(),
                  })
                }
                placeholder="e.g. ANC-01"
                className="
                  w-full
                  rounded-2xl
                  border
                  border-gray-200
                  bg-gray-50
                  px-4
                  py-4
                  text-sm
                  font-medium
                  uppercase
                  text-gray-900
                  outline-none
                  transition
                  placeholder:normal-case
                  placeholder:text-gray-400
                  focus:border-orange-400
                  focus:bg-white
                  focus:ring-4
                  focus:ring-orange-100
                "
              />

            </div>

          </div>


          {/* Description */}

          <div>

            <label
              htmlFor="zone-description"
              className="
                mb-2
                block
                text-sm
                font-semibold
                text-gray-800
              "
            >
              Description
            </label>

            <textarea
              id="zone-description"
              value={zoneForm.description}
              onChange={(e) =>
                setZoneForm({
                  ...zoneForm,
                  description:
                    e.target.value,
                })
              }
              rows={4}
              placeholder="Briefly describe the operational coverage of this Zone..."
              className="
                w-full
                resize-none
                rounded-2xl
                border
                border-gray-200
                bg-gray-50
                px-4
                py-4
                text-sm
                font-medium
                text-gray-900
                outline-none
                transition
                placeholder:text-gray-400
                focus:border-orange-400
                focus:bg-white
                focus:ring-4
                focus:ring-orange-100
              "
            />

          </div>


          {/* Active Status */}

          <div
            className="
              flex
              items-center
              justify-between
              gap-4
              rounded-2xl
              border
              border-orange-100
              bg-orange-50/70
              p-4
            "
          >

            <div>

              <p className="font-semibold text-gray-900">
                Zone Status
              </p>

              <p className="mt-1 text-xs text-gray-500">
                Active Zones can be used for operational assignments.
              </p>

            </div>


            <button
              type="button"
              onClick={() =>
                setZoneForm({
                  ...zoneForm,
                  isActive:
                    !zoneForm.isActive,
                })
              }
              className={`
                relative
                h-7
                w-12
                shrink-0
                rounded-full
                transition-colors
                ${
                  zoneForm.isActive
                    ? "bg-green-500"
                    : "bg-gray-300"
                }
              `}
              aria-label="Toggle Zone status"
            >

              <span
                className={`
                  absolute
                  top-1
                  h-5
                  w-5
                  rounded-full
                  bg-white
                  shadow
                  transition-transform
                  ${
                    zoneForm.isActive
                      ? "translate-x-6"
                      : "translate-x-1"
                  }
                `}
              />

            </button>

          </div>

        </div>

      </div>


      {/* Sticky Footer */}

      <div
        className="
          flex
          flex-col-reverse
          gap-3
          border-t
          bg-white
          px-6
          py-5
          sm:flex-row
          sm:justify-end
          sm:px-8
        "
      >

        <button
          type="button"
          onClick={() =>
            setShowZoneModal(false)
          }
          className="
            rounded-2xl
            border
            border-gray-200
            bg-white
            px-6
            py-3
            font-semibold
            text-gray-700
            transition
            hover:bg-gray-50
          "
        >
          Cancel
        </button>


        <button
          type="button"
          onClick={saveZone}
          disabled={savingZone}
          className="
            rounded-2xl
            bg-orange-500
            px-7
            py-3
            font-semibold
            text-white
            shadow-lg
            transition
            hover:bg-orange-600
            hover:shadow-xl
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          {savingZone
            ? "Creating Zone..."
            : "Create Zone"}
        </button>

      </div>

    </div>

  </div>

)}

{showTerritoryModal && (

  <div
    className="
      fixed
      inset-0
      z-[100]
      flex
      items-center
      justify-center
      bg-black/60
      p-4
      backdrop-blur-sm
    "
  >

   <div
  className="
    flex
    w-full
    max-w-2xl
    max-h-[90vh]
    flex-col
    overflow-hidden
    rounded-[2rem]
    bg-white
    shadow-2xl
  "
>

      {/* Header */}

      <div
        className="
          relative
          overflow-hidden
          bg-gradient-to-br
          from-orange-500
          via-orange-500
          to-orange-600
          px-7
          py-7
          text-white
        "
      >

        <div className="relative z-10">

          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-100">
            MKH Geographic Control
          </p>

          <h2 className="mt-2 text-2xl font-bold">
            Create Territory
          </h2>

          <p className="mt-2 max-w-lg text-sm text-orange-50">
            Establish a new operational Territory under a specific State and LGA.
          </p>

        </div>

        <button
          onClick={() =>
            setShowTerritoryModal(false)
          }
          className="
            absolute
            right-5
            top-5
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-full
            bg-white/15
            text-xl
            transition
            hover:bg-white/25
          "
        >
          ×
        </button>

      </div>


      {/* Form */}

      <div className="flex-1 overflow-y-auto p-7">
  <div className="space-y-6">

          <div>

            <label className="mb-2 block text-sm font-semibold text-gray-700">
              State
            </label>

            <select
              value={selectedTerritoryStateId}
              onChange={(e) =>
                loadTerritoryLgas(
                  e.target.value
                )
              }
              className="
                w-full
                rounded-2xl
                border
                border-gray-200
                bg-gray-50
                px-4
                py-3.5
                outline-none
                transition
                focus:border-orange-500
                focus:bg-white
                focus:ring-4
                focus:ring-orange-100
              "
            >

              <option value="">
                Select State
              </option>

              {territoryStates.map(
                (state) => (

                  <option
                    key={state.id}
                    value={state.id}
                  >
                    {state.name}
                  </option>

                )
              )}

            </select>

          </div>


          <div>

            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Local Government Area
            </label>

            <select
              value={selectedTerritoryLgaId}
              onChange={(e) =>
                setSelectedTerritoryLgaId(
                  e.target.value
                )
              }
              disabled={
                !selectedTerritoryStateId
              }
              className="
                w-full
                rounded-2xl
                border
                border-gray-200
                bg-gray-50
                px-4
                py-3.5
                outline-none
                transition
                disabled:cursor-not-allowed
                disabled:opacity-50
                focus:border-orange-500
                focus:bg-white
                focus:ring-4
                focus:ring-orange-100
              "
            >

              <option value="">
                {
                  selectedTerritoryStateId
                    ? "Select LGA"
                    : "Select State first"
                }
              </option>

              {territoryLgas.map(
                (lga) => (

                  <option
                    key={lga.id}
                    value={lga.id}
                  >
                    {lga.name}
                  </option>

                )
              )}

            </select>

          </div>

        </div>


        <div>

          <label className="mb-2 block text-sm font-semibold text-gray-700">
            Territory Name
          </label>

          <input
            value={territoryForm.name}
            onChange={(e) =>
              setTerritoryForm((prev) => ({
                ...prev,
                name: e.target.value,
              }))
            }
            placeholder="e.g. Lekki Central"
            className="
              w-full
              rounded-2xl
              border
              border-gray-200
              bg-gray-50
              px-4
              py-3.5
              outline-none
              transition
              focus:border-orange-500
              focus:bg-white
              focus:ring-4
              focus:ring-orange-100
            "
          />

        </div>


        <div>

          <label className="mb-2 block text-sm font-semibold text-gray-700">
            Description
          </label>

          <textarea
            value={territoryForm.description}
            onChange={(e) =>
              setTerritoryForm((prev) => ({
                ...prev,
                description: e.target.value,
              }))
            }
            rows={3}
            placeholder="Describe the operational responsibility of this Territory..."
            className="
              w-full
              resize-none
              rounded-2xl
              border
              border-gray-200
              bg-gray-50
              px-4
              py-3.5
              outline-none
              transition
              focus:border-orange-500
              focus:bg-white
              focus:ring-4
              focus:ring-orange-100
            "
          />

        </div>


        <div className="grid gap-5 md:grid-cols-2">

          <div>

            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Maximum Vendors
            </label>

            <input
              type="number"
              min="1"
              value={territoryForm.maxVendors}
              onChange={(e) =>
                setTerritoryForm((prev) => ({
                  ...prev,
                  maxVendors: e.target.value,
                }))
              }
              className="
                w-full
                rounded-2xl
                border
                border-gray-200
                bg-gray-50
                px-4
                py-3.5
                outline-none
                focus:border-orange-500
                focus:bg-white
                focus:ring-4
                focus:ring-orange-100
              "
            />

          </div>


          <div>

            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Maximum Riders
            </label>

            <input
              type="number"
              min="1"
              value={territoryForm.maxRiders}
              onChange={(e) =>
                setTerritoryForm((prev) => ({
                  ...prev,
                  maxRiders: e.target.value,
                }))
              }
              className="
                w-full
                rounded-2xl
                border
                border-gray-200
                bg-gray-50
                px-4
                py-3.5
                outline-none
                focus:border-orange-500
                focus:bg-white
                focus:ring-4
                focus:ring-orange-100
              "
            />

          </div>

        </div>


        <div
          className="
            flex
            items-center
            justify-between
            rounded-2xl
            border
            border-orange-100
            bg-orange-50
            px-5
            py-4
          "
        >

          <div>

            <p className="font-semibold text-gray-800">
              Territory Status
            </p>

            <p className="text-sm text-gray-500">
              Activate this Territory immediately after creation.
            </p>

          </div>

          <button
            type="button"
            onClick={() =>
              setTerritoryForm((prev) => ({
                ...prev,
                isActive: !prev.isActive,
              }))
            }
            className={`
              relative
              h-7
              w-12
              rounded-full
              transition
              ${
                territoryForm.isActive
                  ? "bg-orange-500"
                  : "bg-gray-300"
              }
            `}
          >

            <span
              className={`
                absolute
                top-1
                h-5
                w-5
                rounded-full
                bg-white
                shadow
                transition
                ${
                  territoryForm.isActive
                    ? "left-6"
                    : "left-1"
                }
              `}
            />

          </button>

        </div>


             <div
          className="
            sticky
            bottom-0
            -mx-7
            mt-2
            flex
            flex-col-reverse
            gap-3
            border-t
            border-gray-100
            bg-white
            px-7
            py-5
            sm:flex-row
            sm:justify-end
          "
        >

          <button
            type="button"
            onClick={() =>
              setShowTerritoryModal(false)
            }
            className="
              rounded-2xl
              border
              border-gray-200
              px-6
              py-3.5
              font-semibold
              text-gray-600
              transition
              hover:bg-gray-50
            "
          >
            Cancel
          </button>


          <button
            type="button"
            onClick={saveTerritory}
            disabled={savingTerritory}
            className="
              rounded-2xl
              bg-orange-500
              px-7
              py-3.5
              font-semibold
              text-white
              shadow-lg
              transition
              hover:bg-orange-600
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            {savingTerritory
              ? "Creating Territory..."
              : "Create Territory"}
          </button>

        </div>

      </div>

    </div>

  </div>

)}

{showAssignZone && selectedVendor && (
  <div
    className="
      fixed
      inset-0
      bg-black/60 backdrop-blur-sm
      flex
      items-center
      justify-center
      z-[60]
      p-6
    "
  >
    <div
      className="
        bg-white
        rounded-3xl
        w-full
        max-w-xl
        p-8
        shadow-2xl
      "
    >

      <div className="flex justify-between items-center mb-8">

        <div>
          <h2 className="text-2xl font-bold">
            Assign Vendor Zone
          </h2>

          <p className="text-gray-500 mt-1">
            {selectedVendor.kitchen_name}
          </p>
        </div>

        <button
          onClick={() =>
            setShowAssignZone(false)
          }
          className="text-2xl"
        >
          ✕
        </button>

      </div>

      <div className="space-y-6">

        <div>

          <label className="block font-medium mb-2">
            Territory
          </label>

          <select
            value={selectedTerritoryId}
            onChange={(e) =>
              loadZonesForTerritory(
                e.target.value
              )
            }
            className="w-full rounded-2xl border p-4"
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

          <label className="block font-medium mb-2">
            Zone
          </label>

          <select
            value={selectedZoneId}
            onChange={(e) =>
              setSelectedZoneId(
                e.target.value
              )
            }
            disabled={
              !selectedTerritoryId
            }
            className="w-full rounded-2xl border p-4 disabled:bg-gray-100"
          >

            <option value="">
              {selectedTerritoryId
                ? "Select Zone"
                : "Select Territory first"}
            </option>

            {zones.map((zone) => (
              <option
                key={zone.id}
                value={zone.id}
              >
                {zone.name}
                {zone.code
                  ? ` (${zone.code})`
                  : ""}
              </option>
            ))}

          </select>

        </div>

        {selectedTerritoryId &&
          zones.length === 0 && (
            <div className="rounded-2xl bg-yellow-50 border border-yellow-200 p-4 text-yellow-800">
              No active Zones currently exist
              in this Territory.
            </div>
          )}

        <div className="flex gap-4 pt-4">

          <button
            onClick={() =>
              setShowAssignZone(false)
            }
            className="
              flex-1
              border
              py-3
              rounded-xl
              font-medium
            "
          >
            Cancel
          </button>

          <button
            onClick={saveVendorZone}
            disabled={
              !selectedTerritoryId ||
              !selectedZoneId
            }
            className="
              flex-1
              bg-orange-500
              text-white
              py-3
              rounded-xl
              font-medium
              disabled:opacity-50
            "
          >
            Save Assignment
          </button>

        </div>

      </div>

    </div>
  </div>
)}

      {selectedRider && (

  <div
    className="
      fixed
      inset-0
      bg-black/60 backdrop-blur-sm
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
          bg-orange-500
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
  {loadingRiderDetails
    ? "..."
    : riderDeliveries}
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
  {loadingRiderDetails
    ? "..."
    : `₦${riderEarnings.toLocaleString()}`}
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



    </div>

  </div>

)}
{selectedOrder && (

  <div
    className="
      fixed
      inset-0
      bg-black/60 backdrop-blur-sm
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
          bg-orange-500
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
  onClick={() => {
    if (selectedOrder?.status === "delivered") return;
    setShowAssignRider(true);
  }}
  disabled={selectedOrder?.status === "delivered"}
  className={`
    py-3
    rounded-xl
    font-semibold
    ${
      selectedOrder?.status === "delivered"
        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
        : "bg-orange-500 text-white hover:bg-orange-600"
    }
  `}
>
  {selectedOrder?.status === "delivered"
    ? "Rider Assigned"
    : "Assign Rider"}
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
      bg-black/60 backdrop-blur-sm
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
            bg-orange-500
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

          </div>
    </main>
  );
}
