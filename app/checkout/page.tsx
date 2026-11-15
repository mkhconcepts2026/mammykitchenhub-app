"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/components/CartContext";
import GoogleDeliveryAddressPicker, {
  type GoogleDestination,
} from "@/components/checkout/GoogleDeliveryAddressPicker";

type PaymentMethod = "cash_on_delivery" | "wallet";

type DeliveryQuote = {
  quoteId: string;
  distanceKm: number;
  deliveryFee: number;
  platformFee: number;
  subtotal: number;
  total: number;
  rateVersion: number;
  expiresAt: string;
  resolvedVendorAddress: string;
  resolvedDestinationAddress: string;
};


export default function CheckoutPage() {
  const router = useRouter();
  const supabase = createClient();
  const { items, subtotal, clearCart } = useCart();

  const [loading, setLoading] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [googleDestination, setGoogleDestination] =
    useState<GoogleDestination | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash_on_delivery");

  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [pageError, setPageError] = useState("");
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const codCheckoutReference = useRef<string | null>(null);
  const walletCheckoutReference = useRef<string | null>(null);

  async function getCodCheckoutReference(): Promise<string> {
    const signatureInput = JSON.stringify({
      cart: items.map((item) => ({
        menu_item_id: item.id,
        quantity: item.quantity,
      })),
      address: deliveryAddress.trim(),
      phone: phoneNumber.trim(),
      notes: customerNotes.trim() || null,
    });

    // SHA-256 fingerprint; the underlying checkout details are not stored.
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(signatureInput)
    );
    const signature = Array.from(
      new Uint8Array(digest),
      (byte) => byte.toString(16).padStart(2, "0")
    ).join("");
    const storageKey = "mkh:cod-checkout-attempt";

    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed.signature === signature &&
          typeof parsed.reference === "string" &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed.reference)
        ) {
          codCheckoutReference.current = parsed.reference;
          return parsed.reference;
        }
      }

      const reference = crypto.randomUUID();
      codCheckoutReference.current = reference;
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ signature, reference })
      );
      return reference;
    } catch {
      // Fall back to the in-memory reference if browser storage is unavailable.
      if (!codCheckoutReference.current) {
        codCheckoutReference.current = crypto.randomUUID();
      }
      return codCheckoutReference.current;
    }
  }


  async function getWalletCheckoutReference(): Promise<string> {
    const signatureInput = JSON.stringify({
      cart: items.map((item) => ({ menu_item_id: item.id, quantity: item.quantity })),
      address: deliveryAddress.trim(),
      phone: phoneNumber.trim(),
      notes: customerNotes.trim() || null,
      deliveryQuoteId: deliveryQuote?.quoteId ?? null,
    });
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(signatureInput));
    const signature = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const storageKey = "mkh:wallet-checkout-attempt";
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.signature === signature && typeof parsed.reference === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed.reference)) {
          walletCheckoutReference.current = parsed.reference;
          return parsed.reference;
        }
      }
      const reference = crypto.randomUUID();
      walletCheckoutReference.current = reference;
      sessionStorage.setItem(storageKey, JSON.stringify({ signature, reference }));
      return reference;
    } catch {
      if (!walletCheckoutReference.current) walletCheckoutReference.current = crypto.randomUUID();
      return walletCheckoutReference.current;
    }
  }

  const deliveryFee = deliveryQuote?.deliveryFee ?? 0;
  const platformFee = deliveryQuote?.platformFee ?? 300;
  const total = deliveryQuote?.total ?? subtotal + platformFee;

  const formatNaira = (amount: number) =>
    `₦${amount.toLocaleString("en-NG")}`;
  async function calculateDeliveryQuote() {
    setQuoteError("");
    setPageError("");
    setDeliveryQuote(null);

    if (!googleDestination) {
      setQuoteError(
        "Select your address from Google Maps or pin the exact delivery point on the map."
      );
      return;
    }

    if (!deliveryAddress.trim()) {
      setQuoteError("Confirm your Google Maps delivery location first.");
      return;
    }
    if (items.length === 0) {
      setQuoteError("Your cart is empty.");
      return;
    }
    if (items.some((item) => item.vendor_id !== items[0]?.vendor_id)) {
      setQuoteError("Please order from one vendor at a time.");
      return;
    }

    setQuoteLoading(true);
    try {
      const response = await fetch("/api/customer/delivery-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          cart: items.map((item) => ({ menu_item_id: item.id, quantity: item.quantity })),
          deliveryAddress: deliveryAddress.trim(),
          googleDestination: {
            placeId: googleDestination.placeId,
            latitude: googleDestination.latitude,
            longitude: googleDestination.longitude,
            captureMethod: googleDestination.captureMethod,
          },
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true || !result?.quote) {
        throw new Error(typeof result?.message === "string" ? result.message : "We could not calculate delivery for this address.");
      }

      const quote = result.quote as DeliveryQuote;
      if (Math.round(Number(quote.subtotal) * 100) !== Math.round(Number(subtotal) * 100)) {
        throw new Error("Menu prices changed since the cart was loaded. Refresh your cart and calculate delivery again.");
      }
      if (!quote.quoteId || !Number.isFinite(Number(quote.deliveryFee)) || !Number.isFinite(Number(quote.distanceKm)) || !quote.expiresAt) {
        throw new Error("The delivery service returned an invalid quote. Please try again.");
      }
      setDeliveryQuote(quote);
    } catch (error) {
      setDeliveryQuote(null);
      setQuoteError(error instanceof Error ? error.message : "Delivery could not be calculated. Please try again.");
    } finally {
      setQuoteLoading(false);
    }
  }

  const loadWalletBalance = useCallback(async () => {
    setWalletLoading(true);
    setWalletError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setWalletBalance(null);
        setWalletError("Please sign in to use your wallet.");
        return;
      }

      const { data: wallet, error } = await supabase
        .from("customer_wallets")
        .select("available_balance")
        .eq("customer_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (!wallet) {
        setWalletBalance(null);
        setWalletError(
          "Your MKH Wallet is not activated yet. Please activate it before checkout."
        );
        return;
      }

      setWalletBalance(Number(wallet.available_balance));
    } catch (error) {
      console.error("WALLET BALANCE ERROR:", error);
      setWalletBalance(null);
      setWalletError(
        "Unable to load your wallet balance. Please try again."
      );
    } finally {
      setWalletLoading(false);
    }
  }, [supabase]);

  async function placeOrder() {
    setPageError("");

    if (loading) return;

    if (items.length === 0) {
      setPageError("Your cart is empty.");
      return;
    }

    if (!googleDestination) {
      setPageError(
        "Select your delivery address from Google Maps or pin the exact point on the map."
      );
      return;
    }

    if (!deliveryAddress.trim()) {
      setPageError("Please confirm your Google Maps delivery address.");
      return;
    }

    if (!/^0\d{10}$/.test(phoneNumber.trim())) {
      setPageError("Enter a valid 11-digit phone number starting with 0, e.g. 08012345678.");
      return;
    }

    if (
      !Number.isFinite(subtotal) ||
      subtotal <= 0 ||
      items.some(
        (item) =>
          !Number.isSafeInteger(item.quantity) ||
          item.quantity < 1 ||
          !Number.isFinite(item.price) ||
          item.price < 0
      )
    ) {
      setPageError("Your cart contains invalid items. Please review it.");
      return;
    }

    if (items.some((item) => item.vendor_id !== items[0]?.vendor_id)) {
      setPageError(
        "Please order from one vendor at a time. Remove items from other vendors."
      );
      return;
    }

    if (!deliveryQuote) {
      setPageError("Confirm your delivery address and calculate delivery before placing the test order.");
      return;
    }

    if (!Number.isFinite(Date.parse(deliveryQuote.expiresAt)) || Date.parse(deliveryQuote.expiresAt) <= Date.now()) {
      setDeliveryQuote(null);
      setPageError("Your delivery quote has expired. Calculate delivery again before placing the order.");
      return;
    }

    if (paymentMethod === "wallet" && (walletBalance === null || walletBalance < total)) {
      setPageError("Your MKH Wallet balance is insufficient. Add money to your wallet or choose another payment method.");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push("/login");
        return;
      }

      const isWalletPayment = paymentMethod === "wallet";
      // Keep payment-method references separate so a COD retry can never be
      // replayed as a wallet debit, or vice versa.
      const checkoutReference = isWalletPayment
        ? await getWalletCheckoutReference()
        : await getCodCheckoutReference();

      const response = await fetch(
        isWalletPayment ? "/api/customer/wallet/checkout" : "/api/customer/cod/checkout",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cart: items.map((item) => ({ menu_item_id: item.id, quantity: item.quantity })),
            address: deliveryAddress.trim(),
            phone: phoneNumber.trim(),
            notes: customerNotes.trim() || null,
            checkoutReference,
            deliveryQuoteId: deliveryQuote.quoteId,
          }),
        }
      );

      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true || typeof result?.orderId !== "string") {
        throw new Error(
          typeof result?.error === "string" ? result.error :
          typeof result?.message === "string" ? result.message :
          (isWalletPayment ? "MKH Wallet checkout could not be completed." : "Cash on Delivery checkout could not be completed.")
        );
      }

      if (isWalletPayment) {
        walletCheckoutReference.current = null;
        try { sessionStorage.removeItem("mkh:wallet-checkout-attempt"); } catch { /* storage may be unavailable */ }
      } else {
        codCheckoutReference.current = null;
        try { sessionStorage.removeItem("mkh:cod-checkout-attempt"); } catch { /* storage may be unavailable */ }
      }
      clearCart();
      router.push(
        `/success?order=${encodeURIComponent(result.orderId)}`
      );
    } catch (error) {
      console.error("CHECKOUT ERROR:", error);
      setPageError(
        error instanceof Error
          ? error.message
          : "Checkout failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function handlePaymentMethodChange(value: string) {
    const method = value as PaymentMethod;
    setPaymentMethod(method);
    setPageError("");

    if (method === "wallet") {
      void loadWalletBalance();
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-3">
        <section className="rounded-2xl bg-white p-6 shadow-sm sm:p-8 lg:col-span-2">
          <h1 className="mb-8 text-3xl font-bold sm:text-4xl">
            Checkout
          </h1>

          <div className="space-y-6">
            <div>
              <label className="mb-2 block font-semibold">
                Google Maps delivery location *
              </label>

              <GoogleDeliveryAddressPicker
                localityLabel="Lagos, Nigeria"
                selectedLocation={googleDestination}
                disabled={loading || quoteLoading}
                onLocationSelected={(destination) => {
                  setGoogleDestination(destination);
                  setDeliveryAddress(destination.formattedAddress);
                  setDeliveryQuote(null);
                  setQuoteError("");
                  setPageError("");
                }}
                onSelectionCleared={() => {
                  setGoogleDestination(null);
                  setDeliveryAddress("");
                  setDeliveryQuote(null);
                  setQuoteError("");
                }}
              />

              {googleDestination && (
                <p className="mt-2 text-xs text-slate-600">
                  The exact Google Maps address or delivery pin you select will be
                  used for road-distance calculation.
                </p>
              )}
            </div>
                        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <p className="mb-4 text-sm text-slate-600">
                Your Google Maps street address or exact delivery pin is used for
                routing and delivery calculation. MKH locality, territory and zone
                assignments are managed internally and are not required at checkout.
              </p>
              <button
                type="button"
                onClick={calculateDeliveryQuote}
                disabled={quoteLoading || !googleDestination || !deliveryAddress.trim() || items.length === 0}
                className="w-full rounded-xl bg-orange-500 p-3 font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {quoteLoading ? "Calculating road distance..." : "Confirm Address & Calculate Delivery"}
              </button>
              {quoteError && <p role="alert" className="mt-3 text-sm text-red-700">{quoteError}</p>}
              {deliveryQuote && (
                <div className="mt-3 space-y-1 text-sm text-green-800">
                  <p><strong>From vendor:</strong> {deliveryQuote.resolvedVendorAddress}</p>
                  <p><strong>Google destination used for route:</strong> {deliveryQuote.resolvedDestinationAddress}</p>
                  <p>Road distance: {deliveryQuote.distanceKm.toFixed(2)} km</p>
                  <p>Delivery fee: {formatNaira(deliveryQuote.deliveryFee)}</p>
                  <p className="text-xs text-gray-600">Quote expires at {new Date(deliveryQuote.expiresAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}.</p>
                </div>
              )}
            </div>
            <div>
              <label
                htmlFor="phoneNumber"
                className="mb-2 block font-semibold"
              >Phone Number *</label>
              <input
                id="phoneNumber"
                type="tel"
                required
                autoComplete="tel"
                inputMode="numeric"
                minLength={11}
                maxLength={11}
                pattern="0[0-9]{10}"
                placeholder="08012345678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 11))}
                className="w-full rounded-xl border p-4 outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label
                htmlFor="customerNotes"
                className="mb-2 block font-semibold"
              >
                House number, unit and delivery instructions (optional)
              </label>
              <textarea
                id="customerNotes"
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="House number, flat/unit, building, gate, landmark or gate code (e.g. No. 14, second entrance)..."
                maxLength={2000}
                rows={3}
                className="w-full rounded-xl border p-4 outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label
                htmlFor="paymentMethod"
                className="mb-2 block font-semibold"
              >
                Payment Method
              </label>
              <select
                id="paymentMethod"
                value={paymentMethod}
                onChange={(e) =>
                  handlePaymentMethodChange(e.target.value)
                }
                disabled={loading}
                className="w-full rounded-xl border bg-white p-4 outline-none focus:border-orange-500"
              >
                <option value="cash_on_delivery">
                  Cash on Delivery
                </option>
                <option value="wallet">MKH Wallet</option>
                <option value="card" disabled>
                  Card Payment — Coming Soon
                </option>
              </select>
            </div>

            {paymentMethod === "wallet" && (
              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
                <div className="text-sm font-medium text-gray-600">
                  Available MKH Wallet Balance
                </div>

                <div className="mt-2 text-2xl font-bold text-gray-900">
                  {walletLoading
                    ? "Checking balance..."
                    : walletBalance === null
                      ? "Unavailable"
                      : formatNaira(walletBalance)}
                </div>

                {walletError && (
                  <p className="mt-3 text-sm text-red-700">
                    {walletError}
                  </p>
                )}

                {walletBalance !== null && (
                  <p
                    className={`mt-3 text-sm ${
                      walletBalance >= total
                        ? "text-green-700"
                        : "text-red-700"
                    }`}
                  >
                    {walletBalance >= total
                      ? "Your balance covers this order."
                      : `You need ${formatNaira(total - walletBalance)} more to pay for this order.`}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => void loadWalletBalance()}
                  disabled={walletLoading || loading}
                  className="mt-3 text-sm font-semibold text-orange-700 underline disabled:opacity-50"
                >
                  Refresh balance
                </button>
              </div>
            )}

            {pageError && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                {pageError}
              </div>
            )}
          </div>
        </section>

        <aside className="h-fit rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          <h2 className="mb-6 text-2xl font-bold">Order Summary</h2>

          <div className="mb-8 space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex justify-between gap-4 text-sm"
              >
                <span>
                  {item.quantity} × {item.name}
                </span>
                <span className="shrink-0">
                  {formatNaira(item.price * item.quantity)}
                </span>
              </div>
            ))}

            {items.length === 0 && (
              <p className="text-sm text-gray-500">
                Your cart is empty.
              </p>
            )}
          </div>

          <div className="space-y-3 border-t pt-6">
            <div className="flex justify-between gap-4">
              <span>Subtotal</span>
              <span>{formatNaira(subtotal)}</span>
            </div>

            <div className="flex justify-between gap-4">
              <span>Delivery Fee</span>
              <span>{deliveryQuote ? formatNaira(deliveryFee) : "Calculated after address confirmation"}</span>
            </div>
            {deliveryQuote && (
              <div className="flex justify-between gap-4 text-sm text-gray-600">
                <span>Road distance</span>
                <span>{deliveryQuote.distanceKm.toFixed(2)} km</span>
              </div>
            )}

            <div className="flex justify-between gap-4">
              <span>Service Fee</span>
              <span>{formatNaira(platformFee)}</span>
            </div>

            <div className="flex justify-between gap-4 border-t pt-4 text-xl font-bold">
              <span>{deliveryQuote ? "Total" : "Estimated total (before delivery)"}</span>
              <span>{formatNaira(total)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={placeOrder}
            disabled={loading || quoteLoading || items.length === 0 || !deliveryQuote || (paymentMethod === "wallet" && (walletLoading || walletBalance === null || walletBalance < total))}
            className="mt-8 w-full rounded-xl bg-orange-500 p-4 font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >{loading ? "Processing order…" : paymentMethod === "wallet" ? "Pay with MKH Wallet" : "Place Test COD Order"}</button>

          <p className="mt-3 text-xs leading-5 text-amber-800">Cash on Delivery is enabled for TEST orders only and will be disabled for production. MKH Wallet orders use the confirmed delivery quote and an atomic wallet debit.</p>
          <p className="mt-4 text-xs leading-5 text-gray-500">Paystack card payment at checkout is not yet available. Wallet funding is available through the customer dashboard.</p>
        </aside>
      </div>
    </main>
  );
}
