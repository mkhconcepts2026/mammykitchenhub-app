import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status, headers: { "Cache-Control": "no-store" } });
}

function sha256(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return fail("Please sign in to place your grouped order.", 401);

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, role, status")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) {
      console.error("Grouped checkout profile lookup failed:", profileError.message);
      return fail("We could not verify your customer account.", 500);
    }
    if (!profile || String(profile.role ?? "").toLowerCase() !== "customer" ||
        String(profile.status ?? "").toLowerCase() !== "active") {
      return fail("An active customer account is required.", 403);
    }

    let rawBody: unknown;
    try { rawBody = await request.json(); } catch { return fail("Invalid grouped checkout request.", 400); }
    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      return fail("Invalid grouped checkout details.", 400);
    }
    const body = rawBody as Record<string, unknown>;
    const { cart, quotes, checkoutReference } = body;
    const address = body.address;
    const phone = body.phone;
    const notes = body.notes ?? null;
    const paymentMethod = body.paymentMethod;

    if (typeof checkoutReference !== "string" || !UUID_PATTERN.test(checkoutReference)) {
      return fail("A valid checkout reference is required.", 400);
    }
    if (typeof address !== "string" || !address.trim() || address.trim().length > 1000) {
      return fail("A valid Google Maps delivery address is required.", 400);
    }
    if (typeof phone !== "string" || !/^0\d{10}$/.test(phone.trim())) {
      return fail("Phone number must be exactly 11 digits and start with 0.", 400);
    }
    if (notes !== null && (typeof notes !== "string" || notes.length > 2000)) {
      return fail("Your delivery notes are invalid.", 400);
    }
    if (paymentMethod !== "wallet" && paymentMethod !== "cash_on_delivery") {
      return fail("Choose a valid payment method.", 400);
    }
    if (!Array.isArray(cart) || cart.length < 2 || cart.length > 50) {
      return fail("A grouped basket must contain between 2 and 50 menu items.", 400);
    }
    if (!Array.isArray(quotes) || quotes.length < 2 || quotes.length > 10) {
      return fail("Your grouped delivery quotes are missing or invalid. Recalculate delivery.", 400);
    }

    const seen = new Set<string>();
    const safeCart: Array<{ menu_item_id: string; quantity: number }> = [];
    for (const rawItem of cart) {
      if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) {
        return fail("A menu item in your basket is invalid.", 400);
      }
      const item = rawItem as Record<string, unknown>;
      if (typeof item.menu_item_id !== "string" || !UUID_PATTERN.test(item.menu_item_id) ||
          !Number.isSafeInteger(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > 99) {
        return fail("A menu item ID or quantity is invalid.", 400);
      }
      const id = item.menu_item_id.toLowerCase();
      if (seen.has(id)) return fail("Duplicate menu items must be combined before checkout.", 400);
      seen.add(id);
      safeCart.push({ menu_item_id: id, quantity: Number(item.quantity) });
    }
    safeCart.sort((a, b) => a.menu_item_id.localeCompare(b.menu_item_id));

    const quoteIds = new Set<string>();
    const quoteVendors = new Set<string>();
    const safeQuotes: Array<{ vendor_id: string; quote_id: string; cart_hash: string }> = [];
    for (const rawQuote of quotes) {
      if (!rawQuote || typeof rawQuote !== "object" || Array.isArray(rawQuote)) {
        return fail("A vendor delivery quote is invalid.", 400);
      }
      const quote = rawQuote as Record<string, unknown>;
      if (typeof quote.vendorId !== "string" || !UUID_PATTERN.test(quote.vendorId) ||
          typeof quote.quoteId !== "string" || !UUID_PATTERN.test(quote.quoteId) ||
          typeof quote.cartHash !== "string" || !/^[0-9a-f]{64}$/i.test(quote.cartHash)) {
        return fail("A vendor delivery quote reference is invalid. Recalculate delivery.", 400);
      }
      const vendorId = quote.vendorId.toLowerCase();
      const quoteId = quote.quoteId.toLowerCase();
      if (quoteVendors.has(vendorId) || quoteIds.has(quoteId)) {
        return fail("Duplicate vendor delivery quotes were received.", 400);
      }
      quoteVendors.add(vendorId);
      quoteIds.add(quoteId);
      safeQuotes.push({ vendor_id: vendorId, quote_id: quoteId, cart_hash: quote.cartHash.toLowerCase() });
    }
    safeQuotes.sort((a, b) => a.vendor_id.localeCompare(b.vendor_id));

    // Re-read item/vendor relationships on the server. Never trust vendor IDs
    // supplied by the browser when deciding the child orders.
    const { data: menuRows, error: menuError } = await adminClient
      .from("menu_items")
      .select("id, vendor_id, available")
      .in("id", safeCart.map((item) => item.menu_item_id));
    if (menuError || !menuRows || menuRows.length !== safeCart.length) {
      console.error("Grouped checkout menu validation failed:", menuError?.message);
      return fail("One or more menu items are unavailable. Refresh your basket.", 409);
    }
    if (menuRows.some((item: any) => item.available !== true)) {
      return fail("One or more menu items are no longer available.", 409);
    }
    const vendorIds = [...new Set(menuRows.map((item: any) => String(item.vendor_id).toLowerCase()))].sort();
    if (vendorIds.length !== safeQuotes.length ||
        vendorIds.some((vendorId, index) => vendorId !== safeQuotes[index]?.vendor_id)) {
      return fail("Your basket changed after delivery was calculated. Recalculate all vendor deliveries.", 409);
    }

    const canonicalCartHash = sha256(safeCart);
    const destinationAddressHash = sha256({
      address: address.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-NG"),
    });

    // Independently rebuild each vendor's canonical cart hash from the
    // authenticated server-side menu -> vendor relationships. Never trust a
    // quote hash supplied by the browser without matching its exact basket.
    const menuById = new Map(menuRows.map((item: any) => [String(item.id).toLowerCase(), String(item.vendor_id).toLowerCase()]));
    const expectedByVendor = new Map<string, Array<{ menu_item_id: string; quantity: number }>>();
    for (const item of safeCart) {
      const vendorId = menuById.get(item.menu_item_id);
      if (!vendorId) return fail("A basket item no longer has a valid vendor.", 409);
      const vendorItems = expectedByVendor.get(vendorId) ?? [];
      vendorItems.push(item);
      expectedByVendor.set(vendorId, vendorItems);
    }
    for (const [vendorId, vendorItems] of expectedByVendor) {
      const expectedHash = sha256([...vendorItems].sort((left, right) => left.menu_item_id.localeCompare(right.menu_item_id)));
      const matchingQuote = safeQuotes.find((quote) => quote.vendor_id === vendorId);
      if (!matchingQuote || matchingQuote.cart_hash !== expectedHash) {
        return fail("A vendor's basket changed after its delivery route was calculated. Recalculate all vendor deliveries.", 409);
      }
    }

    // Keep the existing vendor/order screens in sync with customer contact data.
    const { data: savedProfile, error: phoneError } = await adminClient
      .from("profiles")
      .update({ phone: phone.trim() })
      .eq("id", user.id)
      .select("id")
      .maybeSingle();
    if (phoneError || !savedProfile) {
      console.error("Grouped checkout customer phone save failed:", phoneError?.message);
      return fail("We could not save your contact number. Please try again.", 500);
    }

    const { data, error } = await adminClient.rpc("mkh_create_customer_group_order_from_quotes", {
      p_customer_id: user.id,
      p_cart: safeCart,
      p_delivery_address: address.trim(),
      p_customer_phone: phone.trim(),
      p_customer_notes: typeof notes === "string" ? notes.trim() || null : null,
      p_checkout_reference: checkoutReference,
      p_quotes: safeQuotes,
      p_cart_hash: canonicalCartHash,
      p_destination_address_hash: destinationAddressHash,
      p_payment_method: paymentMethod,
    });

    if (error) {
      console.error("Grouped checkout database error:", error);
      const message = String(error.message ?? "");
      if (/Insufficient available balance|Insufficient wallet balance/i.test(message)) {
        return fail("Your MKH Wallet balance is insufficient for this grouped basket.", 409);
      }
      if (/quote|basket|vendor|menu|expired|unavailable|changed|checkout reference/i.test(message)) {
        return fail("A vendor item or delivery quote has changed. Review the basket and calculate all delivery routes again.", 409);
      }
      return fail("MKH could not complete the grouped checkout. No partial vendor orders or wallet debit were committed.", 500);
    }

    if (!data || data.success !== true || typeof data.group_id !== "string" ||
        !Array.isArray(data.orders) || data.orders.length !== safeQuotes.length) {
      console.error("Unexpected grouped checkout RPC response:", data);
      return fail("We could not confirm all vendor orders. Please check My Orders before retrying.", 500);
    }

    const firstOrderId = data.orders[0]?.orderId;
    if (typeof firstOrderId !== "string" || !UUID_PATTERN.test(firstOrderId)) {
      return fail("The grouped checkout completed, but order confirmation needs review. Please open My Orders.", 500);
    }

    return NextResponse.json({
      success: true,
      groupId: data.group_id,
      orders: data.orders,
      orderIds: data.order_ids,
      total: data.total,
      serviceFee: data.service_fee,
      vendorCount: data.orders.length,
      paymentMethod: data.payment_method,
      paymentStatus: data.payment_status,
      duplicate: data.duplicate === true,
      firstOrderId,
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    console.error("Grouped checkout request failed:", error instanceof Error ? error.message : "unknown error");
    return fail("An unexpected grouped checkout error occurred. Please check My Orders before retrying.", 500);
  }
}
