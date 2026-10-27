import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function displayStatus(value: unknown): string {
  const status = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["approved", "verified"].includes(status)) return "Verified";
  if (status === "rejected") return "Rejected";
  if (status === "requires_attention") return "Requires Attention";
  if (["pending", "pending_review", "under_review", "in_review"].includes(status)) return "Pending Review";
  return "Not Submitted";
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { success: false, message: "Authentication required." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const [kycResult, applicationResult] = await Promise.all([
      adminClient
        .from("vendor_kyc")
        .select("id,status,created_at,reviewed_at,review_notes")
        .eq("vendor_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1),
      user.email
        ? adminClient
            .from("vendor_applications")
            .select("id,kyc_status,created_at,kyc_reviewed_at,kyc_review_notes")
            .ilike("email", user.email)
            .order("created_at", { ascending: false })
            .limit(1)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (kycResult.error || applicationResult.error) {
      console.error("Vendor KYC status lookup failed:", kycResult.error?.message, applicationResult.error?.message);
      return NextResponse.json(
        { success: false, message: "Unable to load KYC status." },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }

    const kyc = kycResult.data?.[0] as any;
    const application = applicationResult.data?.[0] as any;
    const kycTime = kyc ? new Date(kyc.created_at || 0).getTime() : -1;
    const applicationTime = application
      ? new Date(application.created_at || 0).getTime()
      : -1;
    const useApplication = applicationTime > kycTime;
    const selectedStatus = useApplication
      ? application?.kyc_status
      : kyc?.status ?? application?.kyc_status;
    const selectedReviewNotes = useApplication
      ? application?.kyc_review_notes
      : kyc?.review_notes ?? application?.kyc_review_notes;
    const selectedSource = useApplication || !kyc ? "application" : "vendor_kyc";
    const selectedRecordId = selectedSource === "application" ? application?.id : kyc?.id;

    return NextResponse.json(
      { success: true, status: displayStatus(selectedStatus), reviewNotes: String(selectedReviewNotes ?? "").trim(), source: selectedRecordId ? selectedSource : null, sourceRecordId: selectedRecordId ?? null },
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (error) {
    console.error("Vendor KYC status route error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load KYC status." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

