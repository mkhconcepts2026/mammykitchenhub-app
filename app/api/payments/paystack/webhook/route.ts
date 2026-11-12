import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { verifyAndCreditCustomerWallet } from "@/lib/payments/paystack-wallet";

export const runtime = "nodejs";

function constantTimeHexMatch(expectedHex: string, suppliedHex: string) {
  if (!/^[0-9a-f]{128}$/i.test(suppliedHex)) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const supplied = Buffer.from(suppliedHex, "hex");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function verifyWebhookSignature(rawBody: string, headers: Headers) {
  const signingSecret = process.env.PAYSTACK_WEBHOOK_SECRET;
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

  const modernHeader = headers.get("paystack-signature");
  if (modernHeader && signingSecret) {
    const parts = modernHeader.split(",").map((part) => part.trim());
    const timestampText = parts.find((part) => part.startsWith("t="))?.slice(2);
    const timestamp = Number(timestampText);
    if (!Number.isSafeInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;

    const signed = `${timestamp}.${rawBody}`;
    const expected = createHmac("sha512", signingSecret).update(signed, "utf8").digest("hex");
    return parts
      .filter((part) => part.startsWith("v1="))
      .some((part) => {
        const signatureParts = part.slice(3).split(":");
        const candidate = signatureParts[signatureParts.length - 1] ?? "";
        return constantTimeHexMatch(expected, candidate);
      });
  }

  const legacySignature = headers.get("x-paystack-signature") ?? "";
  if (!paystackSecret || !/^[0-9a-f]{128}$/i.test(legacySignature)) return false;
  const expected = createHmac("sha512", paystackSecret).update(rawBody, "utf8").digest("hex");
  return constantTimeHexMatch(expected, legacySignature);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyWebhookSignature(rawBody, request.headers)) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: unknown } };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  if (event.event !== "charge.success") {
    return NextResponse.json({ success: true, ignored: true });
  }

  const reference = typeof event.data?.reference === "string" ? event.data.reference : "";
  if (!reference.startsWith("mkh-wallet-")) {
    return NextResponse.json({ success: true, ignored: true });
  }

  try {
    // The webhook signature authenticates the event; the independent Verify API
    // call confirms amount, currency, reference, status and TEST/LIVE domain.
    await verifyAndCreditCustomerWallet(reference);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PAYSTACK WALLET WEBHOOK PROCESSING ERROR:", error);
    // Non-2xx allows Paystack to retry; the DB credit function is idempotent.
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
