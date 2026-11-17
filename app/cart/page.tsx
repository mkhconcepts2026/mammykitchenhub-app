"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Minus,
  Plus,
  Trash2,
  ArrowLeft,
  ShoppingCart,
  Store,
  ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/CartContext";

type VendorGroup = {
  vendorId: string;
  vendorName: string;
  items: ReturnType<typeof useCart>["items"];
  subtotal: number;
};

const PLATFORM_FEE_NGN = 300;

function naira(amount: number) {
  return `₦${Number(amount || 0).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

export default function CartPage() {
  const router = useRouter();
  const [vendorNames, setVendorNames] = useState<Record<string, string>>({});
  const { items, addItem, decreaseItemQuantity, removeItem, clearCart, hydrated } = useCart();

  const vendorIds = [...new Set(items.map((item) => item.vendor_id))].sort();
  const vendorIdsKey = vendorIds.join(",");
  const vendorGroups: VendorGroup[] = vendorIds.map((vendorId) => {
    const vendorItems = items.filter((item) => item.vendor_id === vendorId);
    return {
      vendorId,
      vendorName: vendorNames[vendorId] || "Vendor",
      items: vendorItems,
      subtotal: vendorItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    };
  });

  const foodSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    let active = true;
    const ids = vendorIdsKey ? vendorIdsKey.split(",") : [];
    if (!ids.length) {
      setVendorNames({});
      return;
    }

    const supabase = createClient();
    void supabase
      .from("vendors")
      .select("id, name")
      .in("id", ids)
      .then(({ data, error }) => {
        if (!active || error) return;
        setVendorNames(Object.fromEntries((data ?? []).map((vendor) => [vendor.id, vendor.name])));
      });

    return () => { active = false; };
  }, [vendorIdsKey]);

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-8 flex items-center gap-2 rounded-lg text-gray-700 transition hover:text-orange-600"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Your Cart</h1>
            <p className="mt-1 text-sm text-gray-500">
              {hydrated ? (
                <>{vendorGroups.length} {vendorGroups.length === 1 ? "vendor" : "vendors"} · {totalItems} menu items</>
              ) : "Restoring your saved basket…"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            disabled={!hydrated}
            className="inline-flex items-center justify-center rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-50 disabled:opacity-50"
          >
            + Add another vendor
          </button>
        </div>

        {!hydrated ? (
          <div className="rounded-2xl bg-white p-10 text-center text-gray-600 shadow-sm">
            Restoring your saved cart…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-50">
              <ShoppingCart className="h-8 w-8 text-orange-500" />
            </div>
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Your Cart is Empty</h2>
            <p className="mb-6 text-gray-500">Add delicious meals to continue.</p>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="rounded-xl bg-orange-500 px-6 py-3 font-bold text-white transition hover:bg-orange-600"
            >
              Browse Vendors
            </button>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
            <div className="space-y-6">
              {vendorGroups.map((group) => (
                <section
                  key={group.vendorId}
                  className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-orange-50/70 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-orange-600">
                        <Store className="h-5 w-5" />
                      </span>
                      <div>
                        <h2 className="font-bold text-gray-900">{group.vendorName}</h2>
                        <p className="text-xs text-gray-500">
                          {group.items.length} {group.items.length === 1 ? "menu item" : "menu items"} · separate checkout
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-orange-700">
                      {naira(group.subtotal)}
                    </span>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {group.items.map((item) => (
                      <div key={`${item.vendor_id}-${item.id}`} className="flex gap-4 p-5">
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-orange-50 sm:h-24 sm:w-24">
                          <Image
                            src={item.image || "/placeholder-food.jpg"}
                            alt={item.name}
                            fill
                            sizes="96px"
                            className="object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="mb-2 text-base font-bold text-gray-900">{item.name}</h3>
                          {item.description && <p className="mb-2 text-sm text-gray-500">{item.description}</p>}
                          <p className="font-bold text-orange-600">{naira(item.price)}</p>
                          <p className="mt-1 text-xs text-gray-500">Line total: {naira(item.price * item.quantity)}</p>
                        </div>
                        <div className="flex flex-col items-end justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            aria-label={`Remove ${item.name} from cart`}
                            className="rounded-lg p-2 text-red-500 transition hover:bg-red-50"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => decreaseItemQuantity(item.id)}
                              aria-label={`Decrease ${item.name} quantity`}
                              className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-gray-800 transition hover:bg-orange-200"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="min-w-5 text-center font-bold text-gray-900" aria-live="polite">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => addItem({ ...item, quantity: 1 })}
                              aria-label={`Increase ${item.name} quantity`}
                              className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-white transition hover:bg-orange-600"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 p-5">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">This vendor's checkout</p>
                      <p className="mt-1 text-xs text-gray-500">
                        Separate delivery calculation + {naira(PLATFORM_FEE_NGN)} platform fee
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push(`/checkout?vendorId=${encodeURIComponent(group.vendorId)}`)}
                      className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-600"
                    >
                      Checkout {group.vendorName}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </section>
              ))}
            </div>

            <aside className="h-fit rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-xl font-bold text-gray-900">Cart Summary</h2>
              <div className="space-y-3">
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-gray-600">Food subtotal across vendors</span>
                  <span className="font-semibold">{naira(foodSubtotal)}</span>
                </div>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-gray-600">Separate vendor checkouts</span>
                  <span className="font-semibold">{vendorGroups.length}</span>
                </div>
                <div className="border-t pt-4 text-sm leading-6 text-gray-600">
                  Each vendor checkout automatically includes its own {naira(PLATFORM_FEE_NGN)} platform fee, even when you check out only one vendor. Delivery is calculated separately for that vendor after you choose its checkout button.
                </div>
                <p className="text-xs text-gray-500">
                  If you check out all {vendorGroups.length} vendors separately, the total platform fees will be {naira(vendorGroups.length * PLATFORM_FEE_NGN)}. You are not charged fees for vendors you do not check out.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Are you sure you want to remove all items from your cart?")) clearCart();
                }}
                className="mt-6 w-full rounded-xl border border-red-200 py-3 font-semibold text-red-500 transition hover:bg-red-50"
              >
                Clear Cart
              </button>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
