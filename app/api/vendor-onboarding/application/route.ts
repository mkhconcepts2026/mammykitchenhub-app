import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { encryptVendorBankAccountNumber } from "@/lib/vendor-payout/encryption";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });
}

function textValue(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function optionalText(value: unknown, maxLength: number): string | null {
  const result = textValue(value, maxLength);
  return result || null;
}

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "A valid JSON application is required." }, 400);
  }

  const vendorType = textValue(body?.vendor_type, 80);
  const kitchenName = textValue(body?.kitchen_name, 160);
  const email = textValue(body?.email, 254).toLowerCase();
  const phone = textValue(body?.phone, 40);
  const bankCode = textValue(body?.bank_code, 20);
  const accountNumber = textValue(body?.account_number, 40).replace(/\s+/g, "");
  const accountName = textValue(body?.account_name, 120);

  if (!vendorType || !kitchenName || !email || !phone) {
    return json({
      success: false,
      message: "Complete the required vendor name, type, email and phone fields.",
    }, 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ success: false, message: "Enter a valid application email address." }, 400);
  }

  if (!/^[A-Za-z0-9_-]{2,20}$/.test(bankCode) || !/^\d{10}$/.test(accountNumber) || !accountName) {
    return json({
      success: false,
      message: "Select a bank and enter the verified-format 10-digit account number and account name.",
    }, 400);
  }

  let encryptedAccountNumber: string;
  try {
    encryptedAccountNumber = encryptVendorBankAccountNumber(accountNumber);
  } catch (error) {
    console.error("Vendor application bank encryption is unavailable:", error instanceof Error ? error.message : "unknown error");
    return json({
      success: false,
      message: "Secure bank-account storage is not configured. Your application was not submitted. Please contact MKH support.",
    }, 503);
  }

  try {
    const { data: application, error } = await adminClient
      .from("vendor_applications")
      .insert({
        vendor_type: vendorType,
        kitchen_name: kitchenName,
        email,
        phone,
        business_address: optionalText(body?.business_address, 500),
        owner_name: optionalText(body?.owner_name, 160),
        owner_phone: optionalText(body?.owner_phone, 40),
        bank_code: bankCode,
        account_number: null,
        account_number_encrypted: encryptedAccountNumber,
        account_number_last4: accountNumber.slice(-4),
        account_name: accountName,
        cac_url: optionalText(body?.cac_url, 2048),
        id_url: optionalText(body?.id_url, 2048),
        selfie_url: optionalText(body?.selfie_url, 2048),
        kitchen_photo_url: optionalText(body?.kitchen_photo_url, 2048),
        store_slug: optionalText(body?.store_slug, 120),
        onboarding_status: "pending",
        kyc_status: "pending_review",
      })
      .select("id")
      .single();

    if (error || !application?.id) {
      console.error("Vendor application insert failed:", error?.message ?? "No application ID returned.");
      return json({
        success: false,
        message: "Your vendor application could not be saved. No application was confirmed; please retry.",
      }, 500);
    }

    return json({ success: true, application: { id: application.id } }, 201);
  } catch (error) {
    console.error("Vendor application submission failed:", error instanceof Error ? error.message : "unknown error");
    return json({
      success: false,
      message: "Your vendor application could not be submitted. Please retry.",
    }, 500);
  }
}
