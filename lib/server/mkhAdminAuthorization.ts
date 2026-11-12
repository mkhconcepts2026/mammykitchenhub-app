import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export type MkhAdminContext = {
  ok: true;
  userId: string;
} | {
  ok: false;
  status: number;
  message: string;
};

export async function requireMkhAdmin(): Promise<MkhAdminContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, status: 401, message: "Please sign in with an MKH Admin account." };
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Vendor location admin authorization lookup failed:", profileError.message);
    return { ok: false, status: 500, message: "Unable to verify Admin access." };
  }

  const role = String(profile?.role ?? "").trim().toLowerCase();
  if (!profile || !["admin", "coo"].includes(role)) {
    return { ok: false, status: 403, message: "Only MKH Admin or COO can manage vendor business locations." };
  }

  return { ok: true, userId: user.id };
}
