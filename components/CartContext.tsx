
"use client";

import {
  createContext,
  useContext,
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
  addItem: (
    item: CartItem,
    replaceExistingVendorCart?: boolean
  ) => boolean;
  decreaseItemQuantity: (id: string) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
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

  function addItem(
    item: CartItem,
    replaceExistingVendorCart = false
  ): boolean {
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

    const differentVendor = items.some(
      (existingItem) =>
        existingItem.vendor_id !== item.vendor_id
    );

    if (differentVendor) {
      if (!replaceExistingVendorCart) {
        return false;
      }

      setItems([
        {
          ...item,
          price,
          quantity,
        },
      ]);

      return true;
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
            ? {
                ...currentItem,
                quantity: currentItem.quantity + quantity,
              }
            : currentItem
        );
      }

      return [
        ...currentItems,
        {
          ...item,
          price,
          quantity,
        },
      ];
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
        clearCart,
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
