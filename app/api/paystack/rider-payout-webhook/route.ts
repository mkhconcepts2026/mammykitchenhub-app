import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requirePaystackTestKey } from "@/lib/rider-payouts/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let secret: string;
  try { secret = requirePaystackTestKey(); }
  catch { return NextResponse.json({ success: false }, { status: 503 }); }

  const raw = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("x-paystack-signature") ?? "";
  if (!/^[a-f0-9]{128}$/i.test(signature)) return NextResponse.json({ success: false }, { status: 401 });
  const expected = createHmac("sha512", secret).update(raw).digest();
  const received = Buffer.from(signature, "hex");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  let event: any;
  try { event = JSON.parse(raw.toString("utf8")); }
  catch { return NextResponse.json({ success: false }, { status: 400 }); }

  const eventType = String(event?.event ?? "");
  if (!["transfer.success", "transfer.failed", "transfer.reversed"].includes(eventType)) {
    return NextResponse.json({ success: true, ignored: true });
  }
  const reference = String(event?.data?.reference ?? "");
  const transferCode = event?.data?.transfer_code ? String(event.data.transfer_code) : null;
  if (!reference) return NextResponse.json({ success: false, message: "Transfer reference is missing." }, { status: 400 });

  const { data, error } = await adminClient.rpc("mkh_rider_apply_paystack_transfer_event", {
    p_reference: reference,
    p_event_type: eventType,
    p_transfer_code: transferCode,
    p_failure_reason: eventType === "transfer.success" ? null : String(event?.data?.failures ?? event?.data?.reason ?? eventType).slice(0, 300),
  });
  if (error || !data?.success) {
    console.error("Rider payout webhook processing failed:", error?.message ?? data?.message);
    return NextResponse.json({ success: false }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
