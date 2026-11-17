
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type CartItem = {
  id: string;
  vendor_id: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  image?: string;
};

type CartContextType = {
  items: CartItem[];
  addItem: (item: CartItem) => boolean;
  decreaseItemQuantity: (id: string) => void;
  removeItem: (id: string) => void;
  removeVendorItems: (vendorId: string) => void;
  clearCart: () => void;
  hydrated: boolean;
  subtotal: number;
  totalItems: number;
};

const CartContext = createContext<CartContextType | undefined>(
  undefined
);

export function CartProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Keep the multi-vendor basket across dashboard/cart/checkout navigation
  // and browser refreshes. Only menu-item basket data is stored locally.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("mkh_customer_cart_v1");
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((item): item is CartItem =>
            item &&
            typeof item === "object" &&
            typeof item.id === "string" &&
            typeof item.vendor_id === "string" &&
            typeof item.name === "string" &&
            Number.isFinite(Number(item.price)) &&
            Number(item.price) >= 0 &&
            Number.isSafeInteger(Number(item.quantity)) &&
            Number(item.quantity) > 0
          ).map((item) => ({
            ...item,
            price: Number(item.price),
            quantity: Number(item.quantity),
          }));
          setItems(valid);
        }
      }
    } catch (error) {
      console.warn("MKH cart restore failed; starting an empty cart.", error);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem("mkh_customer_cart_v1", JSON.stringify(items));
    } catch (error) {
      console.warn("MKH cart persistence is unavailable in this browser.", error);
    }
  }, [items, hydrated]);

  function addItem(item: CartItem): boolean {
    const quantity = Math.floor(Number(item.quantity));
    const price = Number(item.price);

    if (
      !item.id ||
      !item.vendor_id ||
      !item.name ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      return false;
    }

    setItems((currentItems) => {
      const existingItem = currentItems.find(
        (currentItem) =>
          currentItem.id === item.id &&
          currentItem.vendor_id === item.vendor_id
      );

      if (existingItem) {
        return currentItems.map((currentItem) =>
          currentItem.id === item.id &&
          currentItem.vendor_id === item.vendor_id
            ? { ...currentItem, quantity: currentItem.quantity + quantity }
            : currentItem
        );
      }

      return [...currentItems, { ...item, price, quantity }];
    });

    return true;
  }

  function decreaseItemQuantity(id: string) {
    setItems((currentItems) =>
      currentItems
        .map((item) =>
          item.id === id
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeItem(id: string) {
    setItems((currentItems) =>
      currentItems.filter((item) => item.id !== id)
    );
  }

  function removeVendorItems(vendorId: string) {
    setItems((currentItems) =>
      currentItems.filter((item) => item.vendor_id !== vendorId)
    );
  }

  function clearCart() {
    setItems([]);
  }

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const totalItems = items.reduce(
    (total, item) => total + item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        decreaseItemQuantity,
        removeItem,
        removeVendorItems,
        clearCart,
        hydrated,
        subtotal,
        totalItems,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error(
      "useCart must be used inside CartProvider"
    );
  }

  return context;
}
