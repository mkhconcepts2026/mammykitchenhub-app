import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: any;
  try { body = await request.json(); } catch { return fail("Invalid request body."); }

  const slug = typeof body?.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    return fail("Enter a valid store URL using letters, numbers and single hyphens.");
  }

  try {
    const [vendorResult, applicationResult] = await Promise.all([
      adminClient.from("vendors").select("id").ilike("slug", slug).limit(1),
      (adminClient as any).from("vendor_applications").select("id,status").ilike("store_slug", slug).limit(20),
    ]);

    if (vendorResult.error || applicationResult.error) {
      console.error("Store slug availability lookup failed:", vendorResult.error?.message, applicationResult.error?.message);
      return fail("Unable to confirm store URL availability. Please try again.", 503);
    }

    return NextResponse.json(
      { success: true, available: (vendorResult.data?.length ?? 0) === 0 && !(applicationResult.data ?? []).some((row: any) => String(row.status ?? "").toLowerCase() !== "rejected") },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Store slug availability request failed:", error instanceof Error ? error.message : "unknown error");
    return fail("Unable to confirm store URL availability. Please try again.", 500);
  }
}