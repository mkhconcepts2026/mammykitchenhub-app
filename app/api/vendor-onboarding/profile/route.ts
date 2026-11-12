import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function json(message: string, status = 200, success = true) {
  return NextResponse.json(
    { success, message },
    { status, headers: { "Cache-Control": "no-store, private" } },
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user?.id || !user.email) {
    return json("Please sign in again to finish setting up your vendor applicant account.", 401, false);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json("Invalid profile setup request.", 400, false);
  }

  const applicationId = String(body?.applicationId ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(applicationId)) {
    return json("The vendor application could not be identified.", 400, false);
  }

  try {
    const { data: application, error: applicationError } = await adminClient
      .from("vendor_applications")
      .select("id,email,owner_name,owner_phone,phone,kitchen_name")
      .eq("id", applicationId)
      .maybeSingle();

    if (applicationError) {
      console.error("Vendor applicant application check failed:", applicationError.message);
      return json("The submitted application could not be confirmed.", 500, false);
    }

    if (!application || String(application.email ?? "").trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      return json("This application does not belong to the signed-in account.", 403, false);
    }

    const { data: existingProfile, error: existingProfileError } = await adminClient
      .from("profiles")
      .select("id,role,vendor_id")
      .eq("id", user.id)
      .maybeSingle();

    if (existingProfileError) {
      console.error("Existing vendor applicant profile check failed:", existingProfileError.message);
      return json("The account profile could not be checked.", 500, false);
    }

    // Never overwrite or downgrade an existing profile. Existing account roles
    // and vendor links are owned by the established approval/role workflows.
    if (existingProfile) {
      return NextResponse.json(
        { success: true, created: false, existingRole: existingProfile.role ?? null },
        { headers: { "Cache-Control": "no-store, private" } },
      );
    }

    const { error: insertError } = await adminClient
      .from("profiles")
      .insert({
        id: user.id,
        full_name: String(application.owner_name || application.kitchen_name || user.email).trim(),
        email: user.email,
        phone: String(application.owner_phone || application.phone || "").trim() || null,
        role: "VENDOR_APPLICANT",
        vendor_id: null,
        status: "active",
        must_change_password: false,
      });

    if (insertError) {
      // A concurrent profile creation is harmless; do not mutate it.
      if (insertError.code === "23505") {
        const { data: concurrentProfile } = await adminClient
          .from("profiles")
          .select("id,role,vendor_id")
          .eq("id", user.id)
          .maybeSingle();
        if (concurrentProfile) {
          return NextResponse.json(
            { success: true, created: false, existingRole: concurrentProfile.role ?? null },
            { headers: { "Cache-Control": "no-store, private" } },
          );
        }
      }
      console.error("Vendor applicant profile creation failed:", insertError.message);
      return json("Your application was received, but the login profile still needs MKH support. Please do not submit another application.", 500, false);
    }

    return NextResponse.json(
      { success: true, created: true, role: "VENDOR_APPLICANT" },
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (error) {
    console.error("Vendor applicant profile provisioning error:", error);
    return json("Your application was received, but the login profile could not be completed. Please contact MKH support.", 500, false);
  }
}
