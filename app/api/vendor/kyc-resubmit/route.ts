import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function normalizeStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isOwnedObjectPath(value: unknown, folder: string, userId: string): value is string {
  if (typeof value !== "string" || value.length > 1024) return false;
  const segments = value.split("/");
  if (segments.length !== 2 || segments[0] !== folder) return false;
  const name = segments[1];
  return name.startsWith(userId + "-") && !name.includes("..") && !name.includes(String.fromCharCode(92));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return jsonError("Authentication required.", 401);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const source = body?.source;
  const kitchenPhotoPath = body?.kitchenPhotoPath;
  if ((source !== "application" && source !== "vendor_kyc") || typeof body?.sourceRecordId !== "string") {
    return jsonError("A valid KYC submission is required.", 400);
  }

  try {
    const [kycResult, applicationResult] = await Promise.all([
      adminClient
        .from("vendor_kyc")
        .select("id,status,created_at,reviewed_at")
        .eq("vendor_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      user.email
        ? adminClient
            .from("vendor_applications")
            .select("id,kyc_status,created_at,kyc_reviewed_at")
            .ilike("email", user.email)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
    ]);

    if (kycResult.error || applicationResult.error) {
      console.error("KYC resubmission status lookup failed:", kycResult.error?.message, applicationResult.error?.message);
      return jsonError("Unable to verify the current KYC status. Please try again later.", 500);
    }

    const kyc = kycResult.data;
    const application = applicationResult.data;
    const kycTime = kyc ? new Date(kyc.created_at || 0).getTime() : -1;
    const applicationTime = application ? new Date(application.created_at || 0).getTime() : -1;
    const currentSource = applicationTime > kycTime || !kyc ? "application" : "vendor_kyc";
    const currentRecord = currentSource === "application" ? application : kyc;
    const currentStatus = currentSource === "application" ? application?.kyc_status : kyc?.status;

    if (!currentRecord || currentRecord.id !== body.sourceRecordId || source !== currentSource) {
      return jsonError("The KYC submission changed while you were preparing documents. Refresh the dashboard and try again.", 409);
    }
    if (!["rejected", "requires_attention"].includes(normalizeStatus(currentStatus))) {
      return jsonError("Resubmission is only available when your latest KYC decision is Rejected or Requires Attention.", 409);
    }

    const expected = source === "application"
      ? { bucket: "vendor-documents", cac: "cac", id: "ids", selfie: "selfies" }
      : { bucket: "kyc-documents", cac: "cac", id: "id", selfie: "selfie" };
    if (
      !isOwnedObjectPath(body?.cacPath, expected.cac, user.id) ||
      !isOwnedObjectPath(body?.idPath, expected.id, user.id) ||
      !isOwnedObjectPath(body?.selfiePath, expected.selfie, user.id)
    ) {
      return jsonError("The corrected document references are invalid. Please upload the documents again.", 400);
    }
    if (source === "application") {
      const validKitchenPath =
        typeof kitchenPhotoPath === "string" &&
        kitchenPhotoPath.length <= 1024 &&
        kitchenPhotoPath.startsWith(`kitchens/${user.id}/`) &&
        !kitchenPhotoPath.includes("..") &&
        !kitchenPhotoPath.includes(String.fromCharCode(92)) &&
        kitchenPhotoPath.split("/").length === 3 &&
        kitchenPhotoPath.split("/")[2].startsWith(user.id + "-");
      if (!validKitchenPath) {
        return jsonError("A valid replacement kitchen photo is required.", 400);
      }
    }

    const paths = [body.cacPath, body.idPath, body.selfiePath];
    const objectChecks = await Promise.all(paths.map((objectPath) =>
      adminClient.storage.from(expected.bucket).createSignedUrl(objectPath, 60)
    ));
    if (source === "application") {
      const photoParts = kitchenPhotoPath.split("/");
      const photoFolder = photoParts.slice(0, -1).join("/");
      const photoName = photoParts[photoParts.length - 1];
      const photoCheck = await adminClient.storage
        .from("vendor-kitchen-images")
        .list(photoFolder, { search: photoName, limit: 20 });
      if (photoCheck.error || !photoCheck.data?.some((item) => item.name === photoName)) {
        return jsonError("The replacement kitchen photo could not be verified in storage. Please upload it again.", 400);
      }
    }
    if (objectChecks.some((result) => result.error || !result.data?.signedUrl)) {
      return jsonError("One or more uploaded documents could not be verified in private storage. Please upload them again.", 400);
    }

    let updateResult: any;
    if (source === "application") {
      updateResult = await adminClient
        .from("vendor_applications")
        .update({
          cac_url: body.cacPath,
          id_url: body.idPath,
          selfie_url: body.selfiePath,
          kitchen_photo_url: adminClient.storage
            .from("vendor-kitchen-images")
            .getPublicUrl(kitchenPhotoPath).data.publicUrl,
          kyc_status: "pending_review",
        })
        .eq("id", application.id)
        .eq("kyc_status", application.kyc_status)
        .select("id")
        .maybeSingle();
    } else {
      if (!kyc) {
        return jsonError("The current KYC submission could not be confirmed. Refresh the dashboard and try again.", 409);
      }
      updateResult = await adminClient
        .from("vendor_kyc")
        .update({
          cac_url: body.cacPath,
          national_id_url: body.idPath,
          selfie_url: body.selfiePath,
          status: "pending",
        })
        .eq("id", kyc.id)
        .eq("status", kyc.status)
        .select("id")
        .maybeSingle();
    }

    if (updateResult.error) {
      console.error("KYC resubmission update failed:", updateResult.error.message);
      return jsonError("The corrected documents could not be saved. Please contact MKH support before retrying.", 500);
    }
    if (!updateResult.data) {
      return jsonError("The KYC record changed during resubmission. Refresh the dashboard and try again.", 409);
    }

    // Updating the rejected row lets the audit trigger preserve the prior decision
    // and capture a documents_resubmitted event without creating a duplicate row.
    return NextResponse.json(
      { success: true, status: "Pending Review" },
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (error) {
    console.error("KYC resubmission route error:", error);
    return jsonError("Unable to complete KYC resubmission.", 500);
  }
}

