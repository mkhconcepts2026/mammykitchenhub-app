
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CustomerWallet from "@/components/customer/CustomerWallet";
import Image from "next/image";
import {
  ShoppingBag,
  UserRound,
  Mail,
  Phone,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

export default function CustomerDashboard() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        setProfile(null);
        setError("Please sign in to view your customer profile.");
        return;
      }

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!data) {
        setProfile({
          full_name: user.user_metadata?.full_name ?? null,
          email: user.email ?? null,
          phone: user.user_metadata?.phone ?? null,
        });
        return;
      }

      setProfile({
        full_name: data.full_name ?? user.user_metadata?.full_name ?? null,
        email: data.email ?? user.email ?? null,
        phone: data.phone ?? user.user_metadata?.phone ?? null,
      });
    } catch (err) {
      console.error("CUSTOMER PROFILE LOAD ERROR:", err);
      setError("We couldn't load your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const displayName =
    profile?.full_name?.trim() || "Welcome, Customer";

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      {/* MKH brand header */}
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => router.push("/customer-dashboard")}
            className="flex items-center gap-3 text-left"
            aria-label="Mammy Kitchen Hub home"
          >
          <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white">
  <Image
    src="/logo.png"
    alt="Mammy Kitchen Hub logo"
    fill
    sizes="64px"
    className="object-contain"
    priority
  />
</span>

                      </button>

          <button
            type="button"
            onClick={() => router.push("/cart")}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>My Cart</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Welcome section */}
        <section className="mb-8 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white shadow-sm sm:p-8">
          <p className="mb-2 text-sm font-semibold text-orange-50">
            YOUR MKH ACCOUNT
          </p>

          <h1 className="text-2xl font-extrabold sm:text-3xl">
            {loading ? "Welcome to MKH" : displayName}
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-6 text-orange-50 sm:text-base">
            Good food is closer than ever. Discover vendors and explore meals
            available on Mammy Kitchen Hub.
          </p>

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-orange-600 shadow-sm transition hover:bg-orange-50"
          >
            Browse Vendors
            <ArrowRight className="h-4 w-4" />
          </button>
        </section>

        {/* Page heading */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight">
            Customer Dashboard
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage your account details and continue ordering your favourite meals.
          </p>
        </div>

        {/* Profile card */}
        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-5 sm:px-7">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <UserRound className="h-5 w-5" />
            </span>

            <div>
              <h3 className="font-bold text-gray-900">
                My Profile
              </h3>
              <p className="text-sm text-gray-500">
                Your registered contact information
              </p>
            </div>
          </div>

          <div className="p-5 sm:p-7">
            {loading ? (
              <div
                className="flex items-center gap-3 py-6 text-sm text-gray-500"
                role="status"
              >
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                Loading your profile...
              </div>
            ) : error ? (
              <div
                className="rounded-xl border border-red-100 bg-red-50 p-5"
                role="alert"
              >
                <p className="text-sm font-medium text-red-700">
                  {error}
                </p>

                <button
                  type="button"
                  onClick={() => {
                    if (error.startsWith("Please sign in")) {
                      router.push("/login");
                    } else {
                      void loadProfile();
                    }
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  {error.startsWith("Please sign in")
                    ? "Sign In"
                    : "Try Again"}
                </button>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-500">
                    <UserRound className="h-4 w-4 text-orange-500" />
                    Full Name
                  </div>

                  <p className="break-words font-semibold text-gray-900">
                    {profile?.full_name || "Not provided"}
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-500">
                    <Mail className="h-4 w-4 text-orange-500" />
                    Email Address
                  </div>

                  <p className="break-words font-semibold text-gray-900">
                    {profile?.email || "Not provided"}
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 p-4 sm:col-span-2">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-500">
                    <Phone className="h-4 w-4 text-orange-500" />
                    Phone Number
                  </div>

                  <p className="break-words font-semibold text-gray-900">
                    {profile?.phone || "Not provided"}
                  </p>
                </div>
              </div>
            )}
          </div>

          <CustomerWallet />
        </section>

        {/* Quick action */}
        <section className="mt-6 flex flex-col justify-between gap-4 rounded-2xl border border-orange-100 bg-orange-50 p-5 sm:flex-row sm:items-center sm:p-6">
          <div>
            <h3 className="font-bold text-gray-900">
              Ready for your next meal?
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Explore vendors and find something delicious.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-bold text-white transition hover:bg-orange-600"
          >
            Explore Meals
            <ArrowRight className="h-4 w-4" />
          </button>
        </section>

        <footer className="py-8 text-center text-xs text-gray-400">
          Mammy Kitchen Hub · Good food, delivered with care.
        </footer>
      </div>
    </main>
  );
}
