import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { authorizeKycAdmin } from "@/lib/server/kyc-admin-auth";

export const dynamic = "force-dynamic";

const terminalStatuses = new Set(["approved", "verified", "rejected"]);
const hasAnyDocument = (row: any) =>
  Boolean(row.cac_url || row.id_url || row.national_id_url || row.selfie_url || row.kitchen_photo_url);

export async function GET() {
  const auth = await authorizeKycAdmin();
  if ("response" in auth) return auth.response;

  try {
    const [applicationsResult, kycResult] = await Promise.all([
      adminClient
        .from("vendor_applications")
        .select(
          "id,kitchen_name,vendor_type,email,phone,owner_name,status,onboarding_status,kyc_status,cac_url,id_url,selfie_url,kitchen_photo_url,created_at",
        )
        .order("created_at", { ascending: false }),
      adminClient
        .from("vendor_kyc")
        .select("id,vendor_id,cac_url,national_id_url,selfie_url,kitchen_photo_url,status,created_at")
        .order("created_at", { ascending: false }),
    ]);

    if (applicationsResult.error || kycResult.error) {
      console.error("Admin KYC queue query failed:", applicationsResult.error?.message, kycResult.error?.message);
      return NextResponse.json(
        { success: false, message: "Unable to load KYC applications." },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }

    const applicationItems = (applicationsResult.data ?? [])
      .filter((row: any) => {
        const status = String(row.kyc_status ?? "").toLowerCase();
        return hasAnyDocument(row) && !terminalStatuses.has(status);
      })
      .map((row: any) => ({
        source: "application" as const,
        id: row.id,
        displayName: row.kitchen_name || row.owner_name || row.email || "Vendor application",
        email: row.email ?? null,
        vendorType: row.vendor_type ?? null,
        applicationStatus: row.status ?? null,
        kycStatus: row.kyc_status || "pending_review",
        createdAt: row.created_at,
        documentAvailability: {
          cac: Boolean(row.cac_url),
          nationalId: Boolean(row.id_url),
          selfie: Boolean(row.selfie_url),
          kitchenPhoto: Boolean(row.kitchen_photo_url),
        },
      }));

    // Keep historical records intact. Only the latest KYC submission per user is actionable.
    const latestKycByVendor = new Map<string, any>();
    for (const row of kycResult.data ?? []) {
      if (!latestKycByVendor.has(row.vendor_id)) latestKycByVendor.set(row.vendor_id, row);
    }
    const latestRows = [...latestKycByVendor.values()];
    const userIds = latestRows.map((row: any) => row.vendor_id).filter(Boolean);

    let profiles: any[] = [];
    if (userIds.length) {
      const { data, error } = await adminClient
        .from("profiles")
        .select("id,full_name,email,vendor_id")
        .in("id", userIds);
      if (error) console.error("KYC vendor profile lookup failed:", error.message);
      profiles = data ?? [];
    }

    const profileById = new Map<string, any>(profiles.map((profile: any) => [profile.id, profile] as [string, any]));
    const vendorIds = [...new Set(profiles.map((profile: any) => profile.vendor_id).filter(Boolean))];
    let vendors: any[] = [];
    if (vendorIds.length) {
      const { data, error } = await adminClient
        .from("vendors")
        .select("id,name")
        .in("id", vendorIds);
      if (error) console.error("KYC vendor-name lookup failed:", error.message);
      vendors = data ?? [];
    }
    const vendorNameById = new Map<string, string>(vendors.map((vendor: any) => [vendor.id, vendor.name] as [string, string]));

    const kycItems = latestRows
      .filter((row: any) => !terminalStatuses.has(String(row.status ?? "").toLowerCase()))
      .filter((row: any) => hasAnyDocument(row))
      .map((row: any) => {
        const profile: any = profileById.get(row.vendor_id);
        return {
          source: "vendor_kyc" as const,
          id: row.id,
          vendorId: row.vendor_id,
          displayName:
            (profile?.vendor_id && vendorNameById.get(profile.vendor_id)) ||
            profile?.full_name || profile?.email || "Vendor KYC submission",
          email: profile?.email ?? null,
          vendorType: null,
          applicationStatus: null,
          kycStatus: row.status || "pending",
          createdAt: row.created_at,
          documentAvailability: {
            cac: Boolean(row.cac_url),
            nationalId: Boolean(row.national_id_url),
            selfie: Boolean(row.selfie_url),
            kitchenPhoto: Boolean(row.kitchen_photo_url),
          },
        };
      });

    const applications = [...applicationItems, ...kycItems].sort(
      (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
    );

    return NextResponse.json(
      { success: true, applications },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Admin KYC queue error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load KYC applications." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
