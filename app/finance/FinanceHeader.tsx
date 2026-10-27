"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function FinanceHeader() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setLogoutError("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Finance logout failed:", error);
      setLogoutError("Unable to sign out. Please try again.");
      setLoggingOut(false);
    }
  }

  return (
    <header className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="h-1.5 bg-emerald-600" />

      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-2">
          <Image
            src="/logo.png"
            alt="Mammy Kitchen Hub"
            width={64}
            height={64}
            priority
            className="h-full w-full object-contain"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
            Mammy Kitchen Hub
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Finance &amp; Accounts
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Manage MKH revenue, settlements and payouts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
          <span className="inline-flex w-fit items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
            Finance Operations
          </span>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loggingOut ? "Signing out..." : "Logout"}
          </button>
        </div>
      </div>

      {logoutError && (
        <p
          role="alert"
          className="border-t border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800 sm:px-6"
        >
          {logoutError}
        </p>
      )}
    </header>
  );
}