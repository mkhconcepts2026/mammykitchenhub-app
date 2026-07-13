"use client";

import { useState } from "react";
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

  const [loading,
    setLoading] =
    useState(false);

  const [error,
    setError] =
    useState("");

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
        .select("role")
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

switch (profile?.role) {

  case "vendor":
    router.push("/vendor-dashboard-v2");
    break;

  case "customer":
    router.push("/dashboard");
    break;

    case "hr":

  router.push(
    "/hr"
  );

  break;

  case "rider":
    router.push("/rider-dashboard");
    break;

  case "manager":
    router.push("/manager");
    break;

  case "admin":
    router.push("/admin-dashboard");
    break;

 case "hr":
case "operations":
case "support":

    router.push("/hr");

    break;

  case "finance":
    router.push("/finance");
    break;

  default:
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

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e)=>

              setPassword(
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