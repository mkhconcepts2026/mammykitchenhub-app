"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  full_name:string;
  email:string;
  phone:string | null;
};

export default function CustomerDashboard(){

  const supabase = createClient();

  const [profile,setProfile] =
    useState<Profile | null>(null);

  async function loadProfile(){

    const {
      data:{ user }
    } =
    await supabase.auth.getUser();

    if(!user) return;

    const {
      data
    } =
    await supabase
      .from("profiles")
      .select(`
        full_name,
        email,
        phone
      `)
      .eq(
        "id",
        user.id
      )
      .single();

    setProfile(data);
  }

  useEffect(()=>{

    loadProfile();

  },[]);

  return(

    <main
      className="
        min-h-screen
        bg-gray-50
        p-6
      "
    >

      <div
        className="
          max-w-5xl
          mx-auto
        "
      >

        <h1
          className="
            text-4xl
            font-bold
          "
        >
          Customer Dashboard
        </h1>

        <p
          className="
            text-gray-500
            mt-2
          "
        >
          Welcome back
        </p>

        <div
          className="
            bg-white
            rounded-2xl
            shadow-sm
            p-6
            mt-6
          "
        >

          <h2
            className="
              text-2xl
              font-semibold
            "
          >
            {profile?.full_name}
          </h2>

          <p>{profile?.email}</p>

          <p>{profile?.phone}</p>

        </div>

      </div>

    </main>

  );

}