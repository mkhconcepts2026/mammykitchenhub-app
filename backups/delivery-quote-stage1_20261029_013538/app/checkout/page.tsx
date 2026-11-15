"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/components/CartContext";

type PaymentMethod = "cash_on_delivery" | "wallet";

export default function CheckoutPage() {
  const router = useRouter();
  const supabase = createClient();
  const { items, subtotal, clearCart } = useCart();

  const [loading, setLoading] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash_on_delivery");

  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [pageError, setPageError] = useState("");
  const codCheckoutReference = useRef<string | null>(null);

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

  const deliveryFee = 1500;
  const platformFee = 300;
  const total = subtotal + deliveryFee + platformFee;

  const formatNaira = (amount: number) =>
    `₦${amount.toLocaleString("en-NG")}`;

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

    if (!deliveryAddress.trim()) {
      setPageError("Please enter your delivery address.");
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

    if (paymentMethod === "wallet") {
      if (walletLoading) {
        setPageError("Please wait while we check your wallet balance.");
        return;
      }

      if (walletBalance === null) {
        setPageError(
          walletError || "Your wallet balance is currently unavailable."
        );
        return;
      }

      if (walletBalance < total) {
        setPageError(
          `Insufficient wallet balance. Your order total is ${formatNaira(total)}.`
        );
        return;
      }
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

      if (paymentMethod === "wallet") {
        const response = await fetch("/api/customer/wallet/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cart: items.map((item) => ({
              menu_item_id: item.id,
              quantity: item.quantity,
            })),
            deliveryAddress: deliveryAddress.trim(),
            phoneNumber: phoneNumber.trim(),
            customerNotes: customerNotes.trim() || null,
            checkoutReference: crypto.randomUUID(),
          }),
        });

        const result = await response.json();

        if (
          !response.ok ||
          result.success !== true ||
          !result.orderId
        ) {
          throw new Error(
            typeof result.message === "string"
              ? result.message
              : "Wallet checkout could not be completed."
          );
        }

        clearCart();
        router.push(
          `/success?order=${encodeURIComponent(result.orderId)}`
        );
        return;
      }

      // Reuse the reference for identical checkout details, including after reload.
      const checkoutReference = await getCodCheckoutReference();

      const response = await fetch("/api/customer/cod/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cart: items.map((item) => ({
            menu_item_id: item.id,
            quantity: item.quantity,
          })),
          address: deliveryAddress.trim(),
          phone: phoneNumber.trim(),
          notes: customerNotes.trim() || null,
          checkoutReference,
        }),
      });

      const result = await response.json();

      if (
        !response.ok ||
        result.success !== true ||
        typeof result.orderId !== "string"
      ) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Cash on Delivery checkout could not be completed."
        );
      }

      codCheckoutReference.current = null;
      try {
        sessionStorage.removeItem("mkh:cod-checkout-attempt");
      } catch {
        // Storage may be unavailable; successful checkout must still continue.
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
              <label
                htmlFor="deliveryAddress"
                className="mb-2 block font-semibold"
              >Delivery Address *</label>
              <input
                id="deliveryAddress"
                type="text"
                required
                autoComplete="street-address"
                maxLength={1000}
                placeholder="Enter delivery address"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="w-full rounded-xl border p-4 outline-none focus:border-orange-500"
              />
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
                Delivery Notes
              </label>
              <textarea
                id="customerNotes"
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Landmark, gate code, directions..."
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
              <span>{formatNaira(deliveryFee)}</span>
            </div>

            <div className="flex justify-between gap-4">
              <span>Service Fee</span>
              <span>{formatNaira(platformFee)}</span>
            </div>

            <div className="flex justify-between gap-4 border-t pt-4 text-xl font-bold">
              <span>Total</span>
              <span>{formatNaira(total)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={placeOrder}
            disabled={
              !deliveryAddress.trim() ||
              !/^0\d{10}$/.test(phoneNumber.trim()) ||
              loading ||
              items.length === 0 ||
              (paymentMethod === "wallet" &&
                (walletLoading ||
                  walletBalance === null ||
                  walletBalance < total))
            }
            className="mt-8 w-full rounded-xl bg-orange-500 p-4 font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? paymentMethod === "wallet"
                ? "Processing Wallet Payment..."
                : "Placing Order..."
              : paymentMethod === "wallet"
                ? "Pay with MKH Wallet"
                : "Place Order"}
          </button>

          <p className="mt-4 text-xs leading-5 text-gray-500">
            Wallet payments are processed by the MKH server. Card payment
            is not yet available.
          </p>
        </aside>
      </div>
    </main>
  );
}
