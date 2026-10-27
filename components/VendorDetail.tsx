
"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/CartContext";

interface VendorDetailProps {
  vendor: any;
  menuItems: any[];
}

export function VendorDetail({
  vendor,
  menuItems,
}: VendorDetailProps) {
  const router = useRouter();

  const {
    items,
    addItem,
    decreaseItemQuantity,
  } = useCart();

  const [notice, setNotice] = useState("");

  function getItemQuantity(id: string) {
    return (
      items.find((item) => item.id === id)?.quantity ?? 0
    );
  }

  function handleAddItem(item: any) {
    setNotice("");

    if (!vendor?.id || !item?.id || !item?.name) {
      setNotice("This menu item is currently unavailable.");
      return;
    }

    if (item.available === false) {
      setNotice("This item is currently unavailable.");
      return;
    }

    const cartItem = {
      id: String(item.id),
      vendor_id: String(vendor.id),
      name: String(item.name),
      description: item.description ?? "",
      price: Number(item.price),
      quantity: 1,
      image: item.image ?? "",
    };

    if (!Number.isFinite(cartItem.price) || cartItem.price < 0) {
      setNotice("This item has an invalid price. Please try again later.");
      return;
    }

    const added = addItem(cartItem);

    if (added) {
      return;
    }

    const confirmed = window.confirm(
      "Your cart contains items from another vendor. Would you like to clear your current cart and add this item instead?"
    );

    if (!confirmed) {
      return;
    }

    const replaced = addItem(cartItem, true);

    if (!replaced) {
      setNotice("We couldn't update your cart. Please try again.");
    }
  }

  const totalItems = items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="relative h-[320px] bg-orange-50">
       <Image
  src={vendor?.image || "/mkh-food-placeholder.png"}
  alt={vendor?.name || "MKH vendor"}
  fill
  priority
  sizes="100vw"
  className="object-cover"
  onError={(event) => {
    if (
      event.currentTarget.src !==
      `${window.location.origin}/mkh-food-placeholder.png`
    ) {
      event.currentTarget.src = "/mkh-food-placeholder.png";
    }
  }}
/>

        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="absolute left-6 top-6 rounded-full bg-white p-3 shadow-lg transition hover:bg-orange-50"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-3 text-4xl font-bold text-gray-900">
          {vendor?.name || "Vendor"}
        </h1>

        <div className="mb-10 flex flex-wrap gap-5 text-gray-600">
          <span>⭐ {vendor?.rating ?? "N/A"}</span>
          <span>{vendor?.delivery_time ?? "—"}</span>
          <span>{vendor?.cuisine ?? "Cuisine"}</span>
        </div>

        <h2 className="mb-6 text-2xl font-bold text-gray-900">
          Menu
        </h2>

        {notice && (
          <div
            role="status"
            aria-live="polite"
            className="mb-5 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800"
          >
            {notice}
          </div>
        )}

        {menuItems.filter(
          (item) => item?.id
        ).length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="font-semibold text-gray-800">
              This vendor has not added any menu items yet.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Please check back later.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {menuItems
              .filter(
                (item) => item?.id
              )
              .map((item) => {
                const itemId = String(item.id);
                const quantity = getItemQuantity(itemId);

                return (
                  <div
                    key={itemId}
                    className="flex gap-5 rounded-2xl bg-white p-5 shadow-sm"
                  >
                    <div className="relative h-28 w-28 flex-shrink-0 overflow-hidden rounded-xl bg-orange-50">
                      <Image
                        src={item.image || "/mkh-food-placeholder.png"}
                        alt={item.name || "Menu item"}
                        fill
                        sizes="112px"
                        className="object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="mb-2 text-xl font-bold text-gray-900">
                        {item.name}
                      </h3>

                      {item.description && (
                        <p className="mb-3 text-sm text-gray-500">
                          {item.description}
                        </p>
                      )}

                      <p className="text-lg font-bold text-orange-600">
                        ₦
                        {Number(item.price || 0).toLocaleString("en-NG")}
                      </p>
                    </div>

                    <div className="flex items-center">
                      {item.available === false ? (
                        <button
                          type="button"
                          disabled
                          aria-label={`${item.name} is out of stock`}
                          className="cursor-not-allowed rounded-xl bg-gray-200 px-4 py-3 text-sm font-bold text-gray-500"
                        >
                          OUT OF STOCK
                        </button>
                      ) : quantity === 0 ? (
                        <button
                          type="button"
                          onClick={() => handleAddItem(item)}
                          className="rounded-xl bg-orange-500 px-5 py-3 font-bold text-white transition hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2"
                        >
                          ADD
                        </button>
                      ) : (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              decreaseItemQuantity(itemId)
                            }
                            aria-label={`Decrease ${item.name} quantity`}
                            className="h-10 w-10 rounded-full bg-gray-100 font-bold text-gray-800 transition hover:bg-gray-200"
                          >
                            −
                          </button>

                          <span
                            className="min-w-5 text-center font-bold text-gray-900"
                            aria-live="polite"
                          >
                            {quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleAddItem(item)}
                            aria-label={`Increase ${item.name} quantity`}
                            className="h-10 w-10 rounded-full bg-orange-500 font-bold text-white transition hover:bg-orange-600"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {totalItems > 0 && (
        <button
          type="button"
          onClick={() => router.push("/cart")}
          className="fixed bottom-8 right-8 z-40 flex items-center gap-3 rounded-full bg-orange-500 px-6 py-4 font-bold text-white shadow-xl transition hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2"
        >
          <ShoppingCart className="h-5 w-5" />
          Cart ({totalItems})
        </button>
      )}
    </div>
  );
}
