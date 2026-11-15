import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { authorizeKycAdmin } from "@/lib/server/kyc-admin-auth";

function requiresCac(vendorType: unknown): boolean {
  // Mirrors Vendor Onboarding: CAC is required for Kitchen / Restaurant.
  return String(vendorType ?? "").trim().toLowerCase() === "kitchen / restaurant";
}
const FINAL_STATUSES = new Set(["approved", "verified", "rejected"]);
const REVIEWABLE_STATUSES = new Set([
  "",
  "pending",
  "pending_review",
  "under_review",
  "in_review",
  "requires_attention",
]);

function normalizedStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const auth = await authorizeKycAdmin();
  if ("response" in auth) return auth.response;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const source = body?.source;
  const id = String(body?.id ?? "").trim();
  const decision = String(body?.decision ?? "").toLowerCase();
  const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 2000) : "";

  if (
    !id ||
    (source !== "application" && source !== "vendor_kyc") ||
    !["approved", "rejected"].includes(decision)
  ) {
    return jsonError("Choose a valid KYC record and approve/reject decision.", 400);
  }

  try {
    const reviewedAt = new Date().toISOString();

    if (source === "application") {
      const { data: current, error: readError } = await adminClient
        .from("vendor_applications")
        .select("id,kyc_status,vendor_type,cac_url,id_url,selfie_url")
        .eq("id", id)
        .maybeSingle();

      if (readError) {
        console.error("KYC application lookup failed:", readError.message);
        return jsonError("Unable to load the KYC application.", 500);
      }
      if (!current) return jsonError("KYC record not found.", 404);

      const status = normalizedStatus(current.kyc_status);
      if (FINAL_STATUSES.has(status)) {
        return jsonError("This KYC record already has a final decision. It was not overwritten.", 409);
      }
      if (!REVIEWABLE_STATUSES.has(status)) {
        return jsonError("This KYC record is not in a reviewable status.", 409);
      }
      if (decision === "approved" && (!current.id_url || !current.selfie_url || (requiresCac(current.vendor_type) && !current.cac_url))) {
        return jsonError(
          requiresCac(current.vendor_type)
            ? "Cannot approve KYC until the CAC, National ID and selfie are recorded."
            : "Cannot approve KYC until the National ID and selfie are recorded.",
          400,
        );
      }
      if (decision === "approved" && !String(current.vendor_type ?? "").trim() && !current.cac_url) {
        return jsonError("Cannot determine whether CAC is required because the vendor type is missing. Review the application details first.", 409);
      }

      const update = adminClient
        .from("vendor_applications")
        .update({
          kyc_status: decision === "approved" ? "verified" : decision,
          kyc_reviewed_at: reviewedAt,
          kyc_reviewed_by: auth.user.id,
          kyc_review_notes: notes || null,
        })
        .eq("id", id);
      const { data: updated, error: updateError } = current.kyc_status == null
        ? await update.is("kyc_status", null).select("id").maybeSingle()
        : await update.eq("kyc_status", current.kyc_status).select("id").maybeSingle();

      if (updateError) {
        console.error("KYC application decision save failed:", updateError.message);
        return jsonError("The KYC decision could not be saved.", 500);
      }
      if (!updated) return jsonError("This KYC record changed during review. Refresh the queue and try again.", 409);
    } else {
      const { data: current, error: readError } = await adminClient
        .from("vendor_kyc")
        .select("id,vendor_id,status,cac_url,national_id_url,selfie_url")
        .eq("id", id)
        .maybeSingle();

      if (readError) {
        console.error("Vendor KYC lookup failed:", readError.message);
        return jsonError("Unable to load the KYC submission.", 500);
      }
      if (!current) return jsonError("KYC record not found.", 404);

      const status = normalizedStatus(current.status);
      if (FINAL_STATUSES.has(status)) {
        return jsonError("This KYC record already has a final decision. It was not overwritten.", 409);
      }
      if (!REVIEWABLE_STATUSES.has(status)) {
        return jsonError("This KYC record is not in a reviewable status.", 409);
      }
      let vendorType = "";
      if (decision === "approved") {
        const { data: profile, error: profileError } = await adminClient
          .from("profiles")
          .select("id,vendor_id")
          .eq("id", current.vendor_id)
          .maybeSingle();
        if (profileError || !profile) {
          return jsonError("Unable to verify the vendor profile before approval.", 409);
        }
        if (profile.vendor_id) {
          const { data: vendor, error: vendorError } = await adminClient
            .from("vendors")
            .select("vendor_type,cuisine")
            .eq("id", profile.vendor_id)
            .maybeSingle();
          if (vendorError) return jsonError("Unable to verify the vendor type before approval.", 409);
          vendorType = String(vendor?.vendor_type || vendor?.cuisine || "");
        }
        const needsCac = requiresCac(vendorType);
        if (!current.national_id_url || !current.selfie_url || (needsCac && !current.cac_url)) {
          return jsonError(
            needsCac
              ? "Cannot approve KYC until the CAC, National ID and selfie are recorded."
              : "Cannot approve KYC until the National ID and selfie are recorded.",
            400,
          );
        }
        if (!vendorType.trim() && !current.cac_url) {
          return jsonError("Cannot confirm whether CAC is required for this vendor type. Review the vendor profile first.", 409);
        }
      }

      const update = adminClient
        .from("vendor_kyc")
        .update({
          status: decision,
          reviewed_at: reviewedAt,
          reviewed_by: auth.user.id,
          review_notes: notes || null,
        })
        .eq("id", id);
      const { data: updated, error: updateError } = current.status == null
        ? await update.is("status", null).select("id").maybeSingle()
        : await update.eq("status", current.status).select("id").maybeSingle();

      if (updateError) {
        console.error("Vendor KYC decision save failed:", updateError.message);
        return jsonError("The KYC decision could not be saved.", 500);
      }
      if (!updated) return jsonError("This KYC record changed during review. Refresh the queue and try again.", 409);
    }

    // A KYC decision does not change the separate business-application/vendor status.
    return NextResponse.json(
      { success: true, decision, reviewedAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("KYC decision route error:", error);
    return jsonError("The KYC decision could not be saved.", 500);
  }
}
