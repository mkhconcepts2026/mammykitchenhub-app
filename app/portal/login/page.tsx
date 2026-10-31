"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_ROUTES } from "@/lib/auth/roleRoutes";

export default function EmployeeLoginPage() {

 const router = useRouter();

const supabase = createClient();

const [email, setEmail] = useState("");

const [password, setPassword] = useState("");

const [loading, setLoading] = useState(false);

async function handleLogin() {

  try {

    setLoading(true);

    const { error } =

      await supabase.auth.signInWithPassword({

        email,

        password

      });

    if (error) {

      alert(error.message);

      return;

    }

    alert("Login Successful");const {

  data: { user }

} = await supabase.auth.getUser();

if (!user) {

  alert("Unable to load user.");

  return;

}

const {

  data: profile,

  error: profileError

} = await supabase

  .from("profiles")

  .select("role, status, must_change_password")

  .eq("id", user.id)

  .single();

if (profileError) {

  alert(profileError.message);

  return;

}

const accountStatus = String(profile?.status ?? "")
  .trim()
  .toLowerCase()
  .replace(/_/g, " ");

if (
  ["pending", "pending activation", "pending approval"].includes(accountStatus) ||
  ["rejected", "inactive", "suspended", "disabled"].includes(accountStatus)
) {
  await supabase.auth.signOut();

  alert(
    ["pending", "pending activation", "pending approval"].includes(accountStatus)
      ? "Your account is awaiting HR approval. Please contact MKH Human Resources."
      : "Your account is not active. Please contact MKH Human Resources."
  );

  return;
}

if (profile?.must_change_password) {
  router.push("/change-password");
  return;
}

const { data: effectiveRole, error: effectiveRoleError } =
  await (supabase as any).rpc("current_effective_app_role");

if (effectiveRoleError) {
  await supabase.auth.signOut();
  alert("Unable to verify your dashboard access. Please try signing in again.");
  return;
}

const rawRole = String(effectiveRole ?? "").trim().toUpperCase();

if (!rawRole || rawRole === "NONE") {
  await supabase.auth.signOut();
  alert("Your account has no active dashboard access. Please contact MKH support.");
  return;
}

const normalizedRole = rawRole.toLowerCase();

const systemRoleRoutes: Record<string, string> = {
  ADMIN: "/admin-dashboard",
  COO: "/admin-dashboard",
  HR: "/hr",
  TERRITORY: "/territory-relationship-manager",
  TRM: "/territory-relationship-manager",
  TERRITORY_RELATIONSHIP_MANAGER: "/territory-relationship-manager",
  "TERRITORY RELATIONSHIP MANAGER": "/territory-relationship-manager",
  TERRITORY_MANAGER: "/territory-relationship-manager",
  "TERRITORY MANAGER": "/territory-relationship-manager",
  ZONAL_MANAGER: "/zonal-manager-dashboard",
  "ZONAL MANAGER": "/zonal-manager-dashboard",
  ZONE_MANAGER: "/zonal-manager-dashboard",
  "ZONE MANAGER": "/zonal-manager-dashboard",
  ZM: "/zonal-manager-dashboard",
  VHA: "/vendor-hub-agent-dashboard",
  VENDOR_HUB_AGENT: "/vendor-hub-agent-dashboard",
  "VENDOR HUB AGENT": "/vendor-hub-agent-dashboard",
  VENDORHUBAGENT: "/vendor-hub-agent-dashboard",
  FINANCE: "/finance",
  RIDER: "/rider-dashboard",
  VENDOR: "/vendor-dashboard-v2",
  OPERATIONS: "/admin-dashboard",
  EXECUTIVE: "/admin-dashboard",
  DIVISION: "/admin-dashboard",
  SUPPORT: "/admin-dashboard",
  GROWTH: "/admin-dashboard",
};

const route =
  rawRole === rawRole.toUpperCase()
    ? systemRoleRoutes[rawRole] || ROLE_ROUTES[normalizedRole]
    : ROLE_ROUTES[normalizedRole] || systemRoleRoutes[rawRole.toUpperCase()];

if (route) {

  router.push(route);

} else {

  alert("No dashboard assigned to this role.");

}
  }

  finally {

    setLoading(false);

  }

}

  return (

    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-orange-50 flex items-center justify-center p-6">

      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-gray-200 p-10">

        <div className="text-center space-y-4">

          <div className="text-6xl">

            👨‍💼

          </div>

          <h1 className="text-4xl font-bold text-slate-800">

            Employee Portal

          </h1>

          <p className="text-gray-500">

            Secure login for authorised MKH employees.

          </p>

        </div>

        <div className="mt-10 space-y-5">

          <input

  type="email"

  value={email}

  onChange={(e) =>

    setEmail(e.target.value)

  }

  placeholder="yourname@mammykitchenhub.com"

  className="w-full rounded-2xl border border-gray-300 px-5 py-4 outline-none focus:border-orange-500"

/>


        <input

  type="password"

  value={password}

  onChange={(e) =>

    setPassword(e.target.value)

  }

  placeholder="Password"

  className="w-full rounded-2xl border border-gray-300 px-5 py-4 outline-none focus:border-orange-500"

/>

          <button

  onClick={handleLogin}

  disabled={loading}

  className="w-full rounded-2xl bg-orange-500 py-4 text-white font-bold hover:bg-orange-600 transition disabled:opacity-50"

>

  {

    loading

      ? "Signing In..."

      : "Sign In"

  }

</button>

        </div>

      </div>

    </main>

  );

}