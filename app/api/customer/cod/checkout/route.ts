import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please sign in to place your order." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (
      profileError ||
      !profile ||
      profile.role?.toLowerCase() !== "customer" ||
      profile.status?.toLowerCase() !== "active"
    ) {
      return NextResponse.json(
        { error: "Your account is not eligible to place orders." },
        { status: 403 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const {
      cart,
      address,
      phone,
      notes,
      checkoutReference,
      deliveryQuoteId,
    } = body as Record<string, unknown>;

    if (
      !Array.isArray(cart) ||
      cart.length < 1 ||
      cart.length > 50
    ) {
      return NextResponse.json(
        { error: "Your cart is invalid." },
        { status: 400 }
      );
    }

    if (
      typeof address !== "string" ||
      !address.trim() ||
      address.trim().length > 1000
    ) {
      return NextResponse.json(
        { error: "Please enter a valid delivery address." },
        { status: 400 }
      );
    }

    if (
      typeof phone !== "string" ||
      !phone.trim() ||
      phone.trim().length > 40
    ) {
      return NextResponse.json(
        { error: "Please enter a valid phone number." },
        { status: 400 }
      );
    }

    if (
      notes !== undefined &&
      notes !== null &&
      (typeof notes !== "string" || notes.length > 2000)
    ) {
      return NextResponse.json(
        { error: "Your order notes are invalid." },
        { status: 400 }
      );
    }

    if (
      typeof checkoutReference !== "string" ||
      !UUID_PATTERN.test(checkoutReference)
    ) {
      return NextResponse.json(
        { error: "A valid checkout reference is required." },
        { status: 400 }
      );
    }

    if (
      typeof deliveryQuoteId !== "string" ||
      !UUID_PATTERN.test(deliveryQuoteId)
    ) {
      return NextResponse.json(
        { error: "Confirm your delivery address and calculate a fresh delivery quote first." },
        { status: 400 }
      );
    }

    const seenItemIds = new Set<string>();

    for (const item of cart) {
      if (
        !item ||
        typeof item !== "object" ||
        typeof item.menu_item_id !== "string" ||
        !UUID_PATTERN.test(item.menu_item_id) ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 99
      ) {
        return NextResponse.json(
          { error: "One or more cart items are invalid." },
          { status: 400 }
        );
      }

      const itemId = item.menu_item_id.toLowerCase();

      if (seenItemIds.has(itemId)) {
        return NextResponse.json(
          { error: "Duplicate cart items must be combined." },
          { status: 400 }
        );
      }

      seenItemIds.add(itemId);
    }

    const safeCart = cart.map(
      (item: { menu_item_id: string; quantity: number }) => ({
        menu_item_id: item.menu_item_id.toLowerCase(),
        quantity: item.quantity,
      })
    );

    // Read the quote's locality so this server calculates the same address hash
    // used when the quote was created. The database RPC rechecks the quote under
    // a row lock; this lookup is not the final authorization/consumption check.
    const { data: quoteSnapshot, error: quoteLookupError } = await adminClient
      .from("delivery_quotes")
      .select("id, customer_id, destination_locality_id")
      .eq("id", deliveryQuoteId)
      .maybeSingle();

    if (quoteLookupError) {
      console.error("COD checkout delivery quote lookup failed:", quoteLookupError.message);
      return NextResponse.json(
        { error: "We could not verify your delivery quote. Please calculate delivery again." },
        { status: 503 }
      );
    }

    if (
      !quoteSnapshot ||
      quoteSnapshot.customer_id !== user.id ||
      typeof quoteSnapshot.destination_locality_id !== "string"
    ) {
      return NextResponse.json(
        { error: "This delivery quote is unavailable. Please calculate delivery again." },
        { status: 409 }
      );
    }

    const canonicalCart = [...safeCart].sort((a, b) =>
      a.menu_item_id.localeCompare(b.menu_item_id)
    );
    const cartHash = createHash("sha256")
      .update(JSON.stringify(canonicalCart), "utf8")
      .digest("hex");
    const destinationAddressHash = createHash("sha256")
      .update(
        JSON.stringify({
          address: address.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-NG"),
          localityId: quoteSnapshot.destination_locality_id,
        }),
        "utf8"
      )
      .digest("hex");

    // Vendor order screens read customer contact from profiles.phone.
    if (typeof phone !== "string" || !/^0\d{10}$/.test(phone.trim())) {
      return Response.json({ error: "Phone number must be exactly 11 digits and start with 0 (e.g. 08012345678)." }, { status: 400 });
    }

    const { data: savedProfile, error: phoneSaveError } = await adminClient
      .from("profiles")
      .update({ phone: phone.trim() })
      .eq("id", user.id)
      .select("id")
      .maybeSingle();

    if (phoneSaveError || !savedProfile) {
      console.error("COD checkout phone save failed:", phoneSaveError?.message);
      return NextResponse.json(
        { error: "We couldn't save your contact number. Please try again." },
        { status: 500 }
      );
    }

    const { data, error: orderError } = await adminClient.rpc(
      "create_customer_cod_order_from_quote",
      {
        p_customer_id: user.id,
        p_cart: safeCart,
        p_delivery_address: address.trim(),
        p_customer_phone: phone.trim(),
        p_customer_notes:
          typeof notes === "string" ? notes.trim() || null : null,
        p_checkout_reference: checkoutReference,
        p_delivery_quote_id: deliveryQuoteId,
        p_cart_hash: cartHash,
        p_destination_address_hash: destinationAddressHash,
      }
    );

    if (orderError) {
      console.error("COD checkout database error:", orderError);

      return NextResponse.json(
        {
          error:
            "We could not complete your order. Please check your orders before trying again.",
        },
        { status: 500 }
      );
    }

    if (
      !data ||
      data.success !== true ||
      typeof data.order_id !== "string" ||
      !UUID_PATTERN.test(data.order_id)
    ) {
      return NextResponse.json(
        {
          error:
            "We could not confirm your order. Please check your orders before retrying.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId: data.order_id,
      total: data.total,
      duplicate: data.duplicate === true,
    });
  } catch (error) {
    console.error("COD checkout request failed:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred during checkout." },
      { status: 500 }
    );
  }
}