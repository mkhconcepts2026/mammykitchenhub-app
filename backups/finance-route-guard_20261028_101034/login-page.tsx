"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {

  const router =
    useRouter();

  const supabase =
    createClient();

  const [email,
    setEmail] =
    useState("");

  const [password,
    setPassword] =
    useState("");

const [showPassword,
  setShowPassword] =
  useState(false);

  const [loading,
    setLoading] =
    useState(false);

  const [error,
    setError] =
    useState("");

    function delay(ms: number) {

  return new Promise((resolve) =>

    setTimeout(resolve, ms)

  );

}

  async function handleLogin() {

    try {

      setLoading(true);

      setError("");



      
      const {

        data,
        error:loginError

      } =
      await supabase
        .auth
        .signInWithPassword({

          email,
          password

        });

      if (loginError) {

        setError(
          loginError.message
        );

        return;

      }

      if (!data.user) {

        setError(
          "User not found."
        );

        return;

      }

      const {

        data:profile,
        error:profileError

      } =
      await supabase
        .from("profiles")
        .select("role, must_change_password, status")
        .eq(
          "id",
          data.user.id
        )
        .single();

      console.log(
        "PROFILE:",
        profile
      );

      if (profileError) {

        setError(
          "Profile lookup failed."
        );

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

        setError(
          ["pending", "pending activation", "pending approval"].includes(accountStatus)
            ? "Your account is awaiting HR approval. Please contact MKH Human Resources."
            : "Your account is not active. Please contact MKH Human Resources."
        );

        return;
      }

     if (profile?.must_change_password) {

  await delay(700);

  router.push("/change-password");

  return;

}

const { data: effectiveRole, error: effectiveRoleError } =
  await (supabase as any).rpc("current_effective_app_role");
console.log("LOGIN EFFECTIVE ROLE:", effectiveRole, effectiveRoleError);
if (effectiveRoleError) {
  await supabase.auth.signOut();
  setError("Unable to verify your dashboard access. Please try signing in again.");
  return;
}

const role = String(effectiveRole ?? "").trim().toUpperCase();

if (!role || role === "NONE") {
  await supabase.auth.signOut();
  setError("Your account has no active dashboard access. Please contact MKH support.");
  return;
}

switch (role) {

  case "CUSTOMER":

  await delay(700);
    router.push("/dashboard");
    break;

  case "VENDOR":

  await delay(700);
    router.push("/vendor-dashboard-v2");
    break;

  case "RIDER":

  await delay(700);
    router.push("/rider-dashboard");
    break;

  case "ADMIN":

  await delay(700);
    router.push("/admin-dashboard");
    break;

  case "HR":

  await delay(700);
    router.push("/hr");
    break;

  case "FINANCE":

  await delay(700);
    router.push("/finance");
    break;

  case "EXECUTIVE":

  await delay(700);
    router.push("/admin-dashboard");
    break;

  case "COO":

  await delay(700);
    router.push("/admin-dashboard");
    break;

  case "OPERATIONS":

  await delay(700);
    router.push("/admin-dashboard");
    break;

  case "DIVISION":

  await delay(700);
    router.push("/admin-dashboard");
    break;

  case "TERRITORY":

  await delay(700);
    router.push("territory-relationship-manager");
    break;

  case "SUPPORT":

  await delay(700);
    router.push("/admin-dashboard");
    break;

  case "GROWTH":

  await delay(700);
    router.push("/admin-dashboard");
    break;

  case "NONE":

  await delay(700);
    router.push("/dashboard");
    break;

  default:

  await delay(700);
    router.push("/dashboard");

}

    }

    catch(err) {

      console.error(err);

      setError(
        "Something went wrong."
      );

    }

    finally {

      setLoading(false);

    }

  }

  return (

    <main className="
      min-h-screen
      flex
      items-center
      justify-center
      bg-gray-100
      p-6
    ">

      <div className="
        bg-white
        p-8
        rounded-2xl
        shadow-sm
        w-full
        max-w-md
      ">

        <h1 className="
          text-3xl
          font-bold
          mb-6
        ">

          Login

        </h1>

        <div className="
          space-y-4
        ">

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e)=>

              setEmail(
                e.target.value
              )

            }
            className="
              w-full
              border
              rounded-xl
              p-4
            "
          />

         <div className="relative">

  <input
    type={
      showPassword
        ? "text"
        : "password"
    }
    placeholder="Password"
    value={password}
    onChange={(e) =>

      setPassword(
        e.target.value
      )

    }
    className="
      w-full
      border
      rounded-xl
      p-4
      pr-12
    "
  />

  <button
    type="button"
    onClick={() =>

      setShowPassword(
        !showPassword
      )

    }
    className="
      absolute
      right-4
      top-1/2
      -translate-y-1/2
      text-gray-500
      hover:text-gray-700
    "
  >

    {

      showPassword

        ? <EyeOff size={20} />

        : <Eye size={20} />

    }

  </button>

</div>

          {

            error &&

            <p className="
              text-red-500
              text-sm
            ">

              {error}

            </p>

          }

          <button
            onClick={
              handleLogin
            }
            disabled={
              loading
            }
            className="
              w-full
              bg-black
              text-white
              rounded-xl
              p-4
            "
          >

            {

              loading
              ? "Signing in..."
              : "Login"

            }

          </button>

        </div>

      </div>

    </main>

  );

}