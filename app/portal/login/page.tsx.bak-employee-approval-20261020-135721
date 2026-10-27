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

  .select("role")

  .eq("id", user.id)

  .single();

if (profileError) {

  alert(profileError.message);

  return;

}

const route = ROLE_ROUTES[profile.role];

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