"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";

export interface MenuItemType {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
}

interface CartItem extends MenuItemType {
  quantity: number;
}

interface CartContextType {

  items: CartItem[];

  addItem: (
    item: MenuItemType
  ) => void;

  removeItem: (
    itemId: string
  ) => void;

  getItemQuantity: (
    itemId: string
  ) => number;

  totalItems: number;

  subtotal: number;

}

const CartContext =
  createContext<
    CartContextType | undefined
  >(undefined);

export function CartProvider({
  children,
}: {
  children: ReactNode;
}) {

  const [items, setItems] =
    useState<CartItem[]>([]);

  function addItem(
    item: MenuItemType
  ) {

    setItems((prev) => {

      const existing =
        prev.find(
          (i) => i.id === item.id
        );

      if (existing) {

        return prev.map((i) =>

          i.id === item.id
            ? {
                ...i,
                quantity:
                  i.quantity + 1,
              }
            : i
        );
      }

      return [
        ...prev,
        {
          ...item,
          quantity: 1,
        },
      ];
    });
  }

  function removeItem(
    itemId: string
  ) {

    setItems((prev) => {

      const existing =
        prev.find(
          (i) => i.id === itemId
        );

      if (
        existing &&
        existing.quantity > 1
      ) {

        return prev.map((i) =>

          i.id === itemId
            ? {
                ...i,
                quantity:
                  i.quantity - 1,
              }
            : i
        );
      }

      return prev.filter(
        (i) =>
          i.id !== itemId
      );
    });
  }

  function getItemQuantity(
    itemId: string
  ) {

    return (
      items.find(
        (i) => i.id === itemId
      )?.quantity || 0
    );
  }

  const totalItems =
    items.reduce(
      (sum, item) =>
        sum + item.quantity,
      0
    );

  const subtotal =
    items.reduce(
      (sum, item) =>
        sum +
        item.price *
          item.quantity,
      0
    );

  return (

    <CartContext.Provider
      value={{

        items,

        addItem,

        removeItem,

        getItemQuantity,

        totalItems,

        subtotal,

      }}
    >

      {children}

    </CartContext.Provider>

  );
}

export function useCart() {

  const context =
    useContext(CartContext);

  if (!context) {

    throw new Error(
      "useCart must be used inside CartProvider"
    );
  }

  return context;
}