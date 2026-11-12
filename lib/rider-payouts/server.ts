import { createCipheriv, randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const noStoreHeaders = { "Cache-Control": "no-store, private" };

export function riderJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStoreHeaders });
}

export async function requireActiveRider() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { response: riderJson({ success: false, message: "Please sign in again." }, 401) } as const;

  const { data: profile, error } = await adminClient
    .from("profiles")
    .select("id, role, status, full_name, email")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !profile || String(profile.role ?? "").toLowerCase() !== "rider" || String(profile.status ?? "").toLowerCase() !== "active") {
    return { response: riderJson({ success: false, message: "An active rider account is required." }, 403) } as const;
  }
  return { user, profile, supabase } as const;
}

export function requirePaystackTestKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key || !key.startsWith("sk_test_")) {
    throw new Error("Rider payouts are TEST-ONLY. Configure a Paystack test secret key (sk_test_...).");
  }
  return key;
}

export async function paystackRequest<T = any>(path: string, init?: RequestInit): Promise<T> {
  const key = requirePaystackTestKey();
  const response = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.status) {
    const error = new Error(String(payload?.message ?? `Paystack request failed (${response.status}).`));
    (error as any).httpStatus = response.status;
    (error as any).providerPayload = payload;
    throw error;
  }
  return payload as T;
}

function encryptionKey() {
  const encoded = process.env.MKH_RIDER_PAYOUT_ENCRYPTION_KEY;
  if (!encoded) throw new Error("MKH_RIDER_PAYOUT_ENCRYPTION_KEY is not configured.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("MKH_RIDER_PAYOUT_ENCRYPTION_KEY must be Base64-encoded 32-byte key material.");
  return key;
}

export function encryptRiderAccountNumber(accountNumber: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(accountNumber, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encrypted.toString("base64")}`;
}

export function newRiderTransferReference() {
  return `mkh_rider_${randomUUID()}`.toLowerCase();
}
