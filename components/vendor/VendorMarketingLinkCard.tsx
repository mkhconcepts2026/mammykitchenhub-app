"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Copy, ExternalLink, Store } from "lucide-react";

const supabase = createClient();
const STORE_BASE_URL = "https://mammykitchenhub.com/store/";

type LinkState = "loading" | "live" | "pending" | "unavailable" | "error";

export default function VendorMarketingLinkCard() {
  const [state, setState] = useState<LinkState>("loading");
  const [storeName, setStoreName] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadStoreLink() {
      try {
        const { data: authResult, error: authError } = await supabase.auth.getUser();
        const user = authResult?.user;
        if (authError || !user) {
          if (!cancelled) setState("error");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("vendor_id,role")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError || !profile || String(profile.role ?? "").toLowerCase() !== "vendor" || !profile.vendor_id) {
          if (!cancelled) setState("pending");
          return;
        }

        const { data: vendor, error: vendorError } = await supabase
          .from("vendors")
          .select("id,name,slug,status")
          .eq("id", profile.vendor_id)
          .maybeSingle();

        if (vendorError) {
          if (!cancelled) setState("error");
          return;
        }
        if (!vendor || String(vendor.status ?? "").toLowerCase() !== "active" || !String(vendor.slug ?? "").trim()) {
          if (!cancelled) setState("pending");
          return;
        }

        const safeSlug = String(vendor.slug).trim();
        if (!cancelled) {
          setStoreName(String(vendor.name ?? "Your store"));
          setStoreUrl(`${STORE_BASE_URL}${encodeURIComponent(safeSlug)}`);
          setState("live");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    }

    void loadStoreLink();
    return () => { cancelled = true; };
  }, []);

  async function copyStoreLink() {
    if (!storeUrl) return;
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopyMessage("Store link copied. Share it on your social channels.");
    } catch {
      setCopyMessage("Copy was blocked by your browser. Select and copy the link above.");
    }
  }

  return (
    <section className="mt-7 overflow-hidden rounded-[24px] border border-[#D4AF37]/35 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.07)]">
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-[#FFF5E9] via-white to-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0F172A] text-[#D4AF37]"><Store size={20} /></span>
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#F97316]">Vendor marketing</p>
            <h2 className="mt-1 text-lg font-extrabold text-[#0F172A]">My Store &amp; Marketing Link</h2>
          </div>
        </div>
        <span className={`inline-flex w-fit items-center rounded-full px-3 py-1.5 text-xs font-bold ${state === "live" ? "bg-emerald-50 text-emerald-700" : state === "loading" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-800"}`}>
          {state === "live" ? "Live store" : state === "loading" ? "Checking store" : state === "error" ? "Unable to verify" : "Pending approval"}
        </span>
      </div>

      <div className="p-5 sm:p-6">
        {state === "live" ? (
          <>
            <p className="text-sm text-slate-600">Share {storeName}'s public store link with customers through WhatsApp, Instagram, Facebook and your other marketing channels.</p>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Your public store URL</p>
              <p className="mt-2 break-all text-sm font-bold text-[#0F172A]">{storeUrl}</p>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => void copyStoreLink()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#F97316] to-[#D4AF37] px-5 py-3.5 text-sm font-extrabold text-white shadow-sm transition hover:brightness-105">
                <Copy size={17} /> Copy marketing link
              </button>
              <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-[#0F172A] transition hover:bg-slate-50">
                <ExternalLink size={17} /> View public store
              </a>
            </div>
            {copyMessage && <p role="status" className="mt-3 text-sm text-emerald-700">{copyMessage}</p>}
          </>
        ) : (
          <p className="text-sm leading-6 text-slate-600">
            {state === "loading" ? "Confirming your active vendor record and public store address..." : state === "error" ? "We could not verify your store link just now. Refresh the dashboard and try again." : "Your marketing link will appear here once MKH has approved your vendor account, activated your vendor record and assigned its store URL."}
          </p>
        )}
      </div>
    </section>
  );
}