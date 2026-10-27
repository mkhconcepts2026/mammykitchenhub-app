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

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return jsonError("Authentication required. Please sign in again.", 401);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Invalid upload request.", 400);
  }

  const sourceValue = form.get("source");
  const recordIdValue = form.get("sourceRecordId");
  const fileValue = form.get("file");
  if (
    typeof sourceValue !== "string" ||
    !["application", "vendor_kyc"].includes(sourceValue) ||
    typeof recordIdValue !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(recordIdValue) ||
    !fileValue ||
    typeof fileValue === "string" ||
    typeof fileValue.arrayBuffer !== "function"
  ) {
    return jsonError("A valid KYC submission and store photo are required.", 400);
  }

  const source = sourceValue as "application" | "vendor_kyc";
  const sourceRecordId = recordIdValue;
  const file = fileValue as File;
  if (!["image/png", "image/jpeg"].includes(file.type)) {
    return jsonError("Choose a PNG or JPG image.", 400);
  }
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
    return jsonError("The store photo must be greater than 0 bytes and no larger than 5 MB.", 400);
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id,role,status")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    console.error("Store photo profile lookup failed:", profileError.message);
    return jsonError("Unable to verify your vendor account.", 500);
  }
  if (
    !profile ||
    String(profile.role ?? "").toLowerCase() !== "vendor" ||
    String(profile.status ?? "").toLowerCase() !== "active"
  ) {
    return jsonError("Only active vendor accounts can upload a KYC store photo.", 403);
  }

  try {
    const [kycResult, applicationResult] = await Promise.all([
      adminClient
        .from("vendor_kyc")
        .select("id,vendor_id,status,created_at,kitchen_photo_url")
        .eq("vendor_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      user.email
        ? adminClient
            .from("vendor_applications")
            .select("id,email,kyc_status,created_at,kitchen_photo_url")
            .ilike("email", user.email)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
    ]);

    if (kycResult.error || applicationResult.error) {
      console.error("Store photo KYC lookup failed:", kycResult.error?.message, applicationResult.error?.message);
      return jsonError("Unable to verify the current KYC submission.", 500);
    }

    const kyc = kycResult.data;
    const application = applicationResult.data;
    const kycTime = kyc ? new Date(kyc.created_at || 0).getTime() : -1;
    const applicationTime = application ? new Date(application.created_at || 0).getTime() : -1;
    const currentSource: "application" | "vendor_kyc" = applicationTime > kycTime || !kyc
      ? "application"
      : "vendor_kyc";
    const currentRecord = currentSource === "application" ? application : kyc;

    if (!currentRecord || source !== currentSource || currentRecord.id !== sourceRecordId) {
      return jsonError("The active KYC submission changed. Refresh the vendor dashboard and try again.", 409);
    }

    const currentStatus = source === "application" ? application?.kyc_status : kyc?.status;
    const normalizedStatus = String(currentStatus ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (["approved", "verified", "rejected"].includes(normalizedStatus)) {
      return jsonError("Photo-only updates are available while KYC is awaiting review. Use the corrected-document resubmission flow for rejected records.", 409);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const isPng = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if ((file.type === "image/png" && !isPng) || (file.type === "image/jpeg" && !isJpeg)) {
      return jsonError("The file contents do not match a valid PNG or JPG image.", 400);
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "store-photo";
    const storagePath = `kitchens/${user.id}/${user.id}-${Date.now()}-${safeName}`;
    const { error: uploadError } = await adminClient.storage
      .from("vendor-kitchen-images")
      .upload(storagePath, bytes, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      console.error("KYC store photo upload failed:", uploadError.message);
      return jsonError("The store photo could not be uploaded. Please try again.", 500);
    }

    const publicUrl = adminClient.storage.from("vendor-kitchen-images").getPublicUrl(storagePath).data.publicUrl;
    if (!publicUrl) {
      await adminClient.storage.from("vendor-kitchen-images").remove([storagePath]);
      return jsonError("The photo uploaded, but its reference could not be created.", 500);
    }

    let updateError: any = null;
    let updatedId: string | null = null;
    if (source === "application" && application && user.email) {
      const { data, error } = await adminClient
        .from("vendor_applications")
        .update({ kitchen_photo_url: publicUrl })
        .eq("id", application.id)
        .eq("kyc_status", application.kyc_status)
        .ilike("email", user.email)
        .select("id")
        .maybeSingle();
      updateError = error;
      updatedId = data?.id ?? null;
    } else if (source === "vendor_kyc" && kyc) {
      const { data, error } = await adminClient
        .from("vendor_kyc")
        .update({ kitchen_photo_url: publicUrl })
        .eq("id", kyc.id)
        .eq("vendor_id", user.id)
        .eq("status", kyc.status)
        .select("id")
        .maybeSingle();
      updateError = error;
      updatedId = data?.id ?? null;
    }

    if (updateError || !updatedId) {
      await adminClient.storage.from("vendor-kitchen-images").remove([storagePath]);
      if (updateError) console.error("KYC store photo reference update failed:", updateError.message);
      return jsonError(
        updateError ? "The photo uploaded, but the KYC record could not be updated." : "The KYC record changed during upload. Refresh and try again.",
        updateError ? 500 : 409,
      );
    }

    return NextResponse.json(
      { success: true, source, sourceRecordId: updatedId, message: "Store photo saved to the current KYC submission. The KYC decision was not changed." },
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (error) {
    console.error("KYC store photo route error:", error);
    return jsonError("Unable to save the KYC store photo.", 500);
  }
}