import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const MAX_SIZE = 5 * 1024 * 1024;

type AuthUser = { id: string; email?: string | null };
type VendorContext =
  | { user: AuthUser; kind: "vendor"; record: any }
  | { user: AuthUser; kind: "application"; record: any }
  | { errorResponse: NextResponse };

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function resolveVendor(): Promise<VendorContext> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { errorResponse: jsonError("Authentication required. Please sign in again.", 401) };
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id,vendor_id,role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    console.error("Storefront profile lookup failed:", profileError.message);
    return { errorResponse: jsonError("Unable to verify your vendor account.", 500) };
  }

  const role = String(profile?.role ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const vendorRoles = new Set(["vendor", "vendor_owner", "vendor_manager", "vendor_staff", "vendor_admin", "store_owner", "merchant"]);
  if (!profile || !vendorRoles.has(role)) {
    return { errorResponse: jsonError("This signed-in account is not linked to an authorized vendor profile.", 403) };
  }

  // Existing approved vendors update vendors.image directly.
  if (profile.vendor_id) {
    const { data: vendor, error: vendorError } = await adminClient
      .from("vendors")
      .select("id,name,image,status")
      .eq("id", profile.vendor_id)
      .maybeSingle();
    if (vendorError) {
      console.error("Storefront vendor lookup failed:", vendorError.message);
      return { errorResponse: jsonError("Unable to load the linked vendor record.", 500) };
    }
    if (vendor) {
      if (String(vendor.status ?? "active").trim().toLowerCase() !== "active") {
        return { errorResponse: jsonError("The linked vendor record is inactive.", 403) };
      }
      return { user, kind: "vendor", record: vendor };
    }
  }

  // Vendor applicants may have a workspace before a vendors row exists.
  // Resolve their application by the authenticated email and save the image there;
  // Admin business approval already copies kitchen_photo_url into vendors.image.
  if (!user.email) {
    return { errorResponse: jsonError("Your account has no email linked to a vendor application.", 403) };
  }
  const { data: application, error: applicationError } = await adminClient
    .from("vendor_applications")
    .select("id,kitchen_name,email,status,kyc_status,kitchen_photo_url,created_at")
    .ilike("email", user.email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (applicationError) {
    console.error("Storefront application lookup failed:", applicationError.message);
    return { errorResponse: jsonError("Unable to load your vendor application.", 500) };
  }
  if (!application || String(application.status ?? "pending").trim().toLowerCase() === "rejected") {
    return { errorResponse: jsonError("No active vendor record or eligible vendor application was found for this account.", 403) };
  }
  return { user, kind: "application", record: application };
}

export async function GET() {
  const context = await resolveVendor();
  if ("errorResponse" in context) return context.errorResponse;
  const record = context.record;
  return NextResponse.json(
    {
      success: true,
      vendorName: context.kind === "vendor" ? (record.name ?? "") : (record.kitchen_name ?? ""),
      image: context.kind === "vendor" ? (record.image ?? "") : (record.kitchen_photo_url ?? ""),
      imageTarget: context.kind,
    },
    { headers: { "Cache-Control": "no-store, private" } },
  );
}

export async function POST(request: Request) {
  const context = await resolveVendor();
  if ("errorResponse" in context) return context.errorResponse;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Invalid photo upload request.", 400);
  }

  const value = form.get("file");
  if (!value || typeof value === "string" || typeof value.arrayBuffer !== "function") {
    return jsonError("Choose a storefront photo first.", 400);
  }
  const file = value as File;
  if (!["image/png", "image/jpeg"].includes(file.type)) {
    return jsonError("Choose a PNG or JPG image.", 400);
  }
  if (file.size <= 0 || file.size > MAX_SIZE) {
    return jsonError("The image must be greater than 0 bytes and no larger than 5 MB.", 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const isPng = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if ((file.type === "image/png" && !isPng) || (file.type === "image/jpeg" && !isJpeg)) {
    return jsonError("The file contents do not match a valid PNG or JPG image.", 400);
  }

  const extension = file.type === "image/png" ? "png" : "jpg";
  const folderId = context.kind === "vendor" ? context.record.id : context.user.id;
  const storagePath = `kitchens/${folderId}/${context.user.id}-storefront-${Date.now()}.${extension}`;
  const { error: uploadError } = await adminClient.storage
    .from("vendor-kitchen-images")
    .upload(storagePath, bytes, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
  if (uploadError) {
    console.error("Storefront image upload failed:", uploadError.message);
    return jsonError("The photo could not be uploaded. Please try again.", 500);
  }

  const publicUrl = adminClient.storage.from("vendor-kitchen-images").getPublicUrl(storagePath).data.publicUrl;
  let updatedName = "";
  let updatedImage = publicUrl;
  let updateError: any = null;
  let updatedId: string | null = null;

  if (context.kind === "vendor") {
    const { data, error } = await adminClient
      .from("vendors")
      .update({ image: publicUrl })
      .eq("id", context.record.id)
      .select("id,name,image")
      .maybeSingle();
    updateError = error;
    updatedId = data?.id ?? null;
    updatedName = data?.name ?? "";
    updatedImage = data?.image ?? publicUrl;
  } else {
    // The storefront photo can be supplied while the application is pending.
    // Keep its business/KYC statuses untouched; the existing approval flow copies this URL to vendors.image.
    const { data, error } = await adminClient
      .from("vendor_applications")
      .update({ kitchen_photo_url: publicUrl })
      .eq("id", context.record.id)
      .eq("status", context.record.status)
      .eq("kyc_status", context.record.kyc_status)
      .select("id,kitchen_name,kitchen_photo_url")
      .maybeSingle();
    updateError = error;
    updatedId = data?.id ?? null;
    updatedName = data?.kitchen_name ?? "";
    updatedImage = data?.kitchen_photo_url ?? publicUrl;
  }

  if (updateError || !updatedId) {
    await adminClient.storage.from("vendor-kitchen-images").remove([storagePath]);
    if (updateError) console.error("Storefront image reference update failed:", updateError.message);
    return jsonError("The photo uploaded, but the storefront record could not be updated.", 500);
  }

  return NextResponse.json(
    {
      success: true,
      vendorName: updatedName,
      image: updatedImage,
      imageTarget: context.kind,
      message: "Storefront photo updated successfully.",
    },
    { headers: { "Cache-Control": "no-store, private" } },
  );
}