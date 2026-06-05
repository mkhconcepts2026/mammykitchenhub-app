"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

async function signUp() {

  const supabase = createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    alert("AUTH ERROR: " + error.message);
    return;
  }

  if (!data.user) {
    alert("No user returned.");
    return;
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .insert([
      {
        id: data.user.id,
        email: data.user.email,
        full_name: "New User",
        role: "customer",
      },
    ]);

  if (profileError) {
    alert("PROFILE ERROR: " + profileError.message);
    return;
  }

  alert("Signup successful.");
}

  async function signIn() {

    const supabase = createClient();

    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Login successful.");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">

      <div className="w-full max-w-md p-8 bg-white border rounded-xl shadow">

        <h1 className="text-3xl font-bold mb-6 text-center">
          MKH LOGIN
        </h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border p-3 rounded mb-4"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border p-3 rounded mb-6"
        />

        <div className="flex gap-4">

          <button
            onClick={signIn}
            className="flex-1 bg-orange-500 text-white py-3 rounded"
          >
            Login
          </button>

          <button
            onClick={signUp}
            className="flex-1 border py-3 rounded"
          >
            Sign Up
          </button>

        </div>

      </div>

    </main>
  );
}