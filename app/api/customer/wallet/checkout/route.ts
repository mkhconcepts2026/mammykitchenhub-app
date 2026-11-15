import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

export async function POST(request: Request) {
  try {
    // Authenticate from the customer's existing server session.
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse("Please sign in to pay with your wallet.", 401);
    }

    // Never accept a customer ID or wallet balance from the browser.
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("WALLET CHECKOUT PROFILE ERROR:", profileError);
      return errorResponse("Unable to verify your account.", 500);
    }

    if (
      !profile ||
      profile.role?.toLowerCase() !== "customer" ||
      profile.status?.toLowerCase() !== "active"
    ) {
      return errorResponse("An active customer account is required.", 403);
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid request body.", 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse("Invalid checkout details.", 400);
    }

    const input = body as Record<string, unknown>;
    const {
      cart,
      checkoutReference,
      deliveryQuoteId,
    } = input;
    // Use the same field names as the COD checkout contract. Keep aliases for
    // clients already using the wallet endpoint's earlier request shape.
    const deliveryAddress = input.address ?? input.deliveryAddress;
    const phoneNumber = input.phone ?? input.phoneNumber;
    const customerNotes = input.notes ?? input.customerNotes;

    if (
      typeof deliveryAddress !== "string" ||
      !deliveryAddress.trim() ||
      deliveryAddress.trim().length > 1000
    ) {
      return errorResponse("Enter a valid delivery address.", 400);
    }

    if (
      typeof phoneNumber !== "string" ||
      !phoneNumber.trim() ||
      phoneNumber.trim().length > 40
    ) {
      return errorResponse("Enter a valid phone number.", 400);
    }

    if (
      customerNotes !== undefined &&
      customerNotes !== null &&
      (typeof customerNotes !== "string" || customerNotes.length > 2000)
    ) {
      return errorResponse("Delivery notes are too long.", 400);
    }

    if (
      typeof checkoutReference !== "string" ||
      !UUID_PATTERN.test(checkoutReference)
    ) {
      return errorResponse("Invalid checkout reference.", 400);
    }

    if (!Array.isArray(cart) || cart.length === 0 || cart.length > 50) {
      return errorResponse("Your cart is empty or contains too many items.", 400);
    }

    if (typeof deliveryQuoteId !== "string" || !UUID_PATTERN.test(deliveryQuoteId)) {
      return errorResponse("Confirm your delivery address and calculate a fresh delivery quote first.", 400);
    }

    const seenIds = new Set<string>();
    const normalizedCart: Array<{
      menu_item_id: string;
      quantity: number;
    }> = [];

    for (const item of cart) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return errorResponse("Invalid cart item.", 400);
      }

      const candidate = item as Record<string, unknown>;
      const id = candidate.menu_item_id;
      const quantity = candidate.quantity;

      if (
        typeof id !== "string" ||
        !UUID_PATTERN.test(id) ||
        !Number.isSafeInteger(quantity) ||
        (quantity as number) < 1 ||
        (quantity as number) > 99
      ) {
        return errorResponse("Invalid product or quantity in your cart.", 400);
      }

      if (seenIds.has(id)) {
        return errorResponse(
          "Your cart contains a duplicate product. Please review your cart.",
          400
        );
      }

      seenIds.add(id);
      normalizedCart.push({
        menu_item_id: id,
        quantity: quantity as number,
      });
    }

    // Recreate the exact canonical hashes used when MKH created this quote.
    // The database RPC performs the final validation under a row lock.
    const { data: quoteSnapshot, error: quoteLookupError } = await adminClient
      .from("delivery_quotes")
      .select("id, customer_id, destination_locality_id")
      .eq("id", deliveryQuoteId)
      .maybeSingle();

    if (quoteLookupError) {
      console.error("WALLET checkout delivery quote lookup failed:", quoteLookupError.message);
      return errorResponse("We could not verify your delivery quote. Please calculate delivery again.", 503);
    }

    if (!quoteSnapshot || quoteSnapshot.customer_id !== user.id || typeof quoteSnapshot.destination_locality_id !== "string") {
      return errorResponse("This delivery quote is unavailable. Please calculate delivery again.", 409);
    }

    const canonicalCart = [...normalizedCart].sort((a, b) =>
      a.menu_item_id.localeCompare(b.menu_item_id)
    );
    const cartHash = createHash("sha256")
      .update(JSON.stringify(canonicalCart), "utf8")
      .digest("hex");
    const destinationAddressHash = createHash("sha256")
      .update(JSON.stringify({
        address: deliveryAddress.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-NG"),
        localityId: quoteSnapshot.destination_locality_id,
      }), "utf8")
      .digest("hex");

    // Vendor order screens read customer contact from profiles.phone.
    if (typeof phoneNumber !== "string" || !/^0\d{10}$/.test(phoneNumber.trim())) {
      return Response.json({ error: "Phone number must be exactly 11 digits and start with 0 (e.g. 08012345678)." }, { status: 400 });
    }

    const { data: savedProfile, error: phoneSaveError } = await adminClient
      .from("profiles")
      .update({ phone: phoneNumber.trim() })
      .eq("id", user.id)
      .select("id")
      .maybeSingle();

    if (phoneSaveError || !savedProfile) {
      console.error("Wallet checkout phone save failed:", phoneSaveError?.message);
      return errorResponse(
        "We couldn't save your contact number. Please try again.",
        500
      );
    }

    // The database function calculates prices and performs the
    // order creation, wallet debit, and ledger insert atomically.
    const { data, error } = await adminClient.rpc(
      "create_customer_wallet_order_from_quote",
      {
        p_customer_id: user.id,
        p_cart: normalizedCart,
        p_delivery_address: deliveryAddress.trim(),
        p_customer_phone: phoneNumber.trim(),
        p_customer_notes:
          typeof customerNotes === "string" ? customerNotes.trim() || null : null,
        p_checkout_reference: checkoutReference,
        p_delivery_quote_id: deliveryQuoteId,
        p_cart_hash: cartHash,
        p_destination_address_hash: destinationAddressHash,
      }
    );

    if (error) {
      console.error("WALLET CHECKOUT RPC ERROR:", error);

      const message = error.message || "";

      if (message.includes("Insufficient wallet balance")) {
        return errorResponse(
          "Your wallet balance is insufficient for this order.",
          409
        );
      }

      if (
        message.includes("unavailable") ||
        message.includes("invalid") ||
        message.includes("mixed-vendor") ||
        message.includes("Invalid checkout details") ||
        message.includes("Checkout reference already used") ||
        message.includes("Delivery quote") ||
        message.includes("delivery quote") ||
        message.includes("Cart or delivery address changed")
      ) {
        return errorResponse(
          "Your cart or checkout details have changed. Please review and try again.",
          400
        );
      }

      return errorResponse(
        "We couldn't complete wallet checkout. Please check your order before retrying.",
        500
      );
    }

    if (
      !data ||
      typeof data !== "object" ||
      data.success !== true ||
      typeof data.order_id !== "string"
    ) {
      console.error("Unexpected wallet checkout response:", data);
      return errorResponse("Unable to confirm the order result.", 500);
    }

    return NextResponse.json({
      success: true,
      orderId: data.order_id,
      total: data.total,
      duplicate: data.duplicate === true,
    });
  } catch (error) {
    console.error("CUSTOMER WALLET CHECKOUT ERROR:", error);

    return errorResponse("An unexpected checkout error occurred.", 500);
  }
}
