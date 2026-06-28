"use client";

import {

  createContext,
  useContext,
  useState,
  ReactNode

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

    item: CartItem

  ) => void;

  removeItem: (

    id: string

  ) => void;

  clearCart: () => void;

  subtotal: number;

  totalItems: number;

};

const CartContext =
  createContext<
    CartContextType
    | undefined
  >(undefined);

export function CartProvider({

  children

}:{

  children:ReactNode

}){

  const [items,setItems] =
    useState<CartItem[]>([]);

  function addItem(

    item:CartItem

  ){

    setItems(

      (prev)=>{

        const existing =
          prev.find(

            (i)=>

              i.id ===
              item.id

          );

        if(existing){

          return prev.map(

            (i)=>

              i.id ===
              item.id

              ?

              {

                ...i,

                quantity:
                  i.quantity +
                  item.quantity

              }

              :

              i

          );

        }

        return [

          ...prev,

          item

        ];

      }

    );

  }

  function removeItem(

    id:string

  ){

    setItems(

      (prev)=>

        prev.filter(

          (item)=>

            item.id !== id

        )

    );

  }

  function clearCart(){

    setItems([]);

  }

  const subtotal =
    items.reduce(

      (

        sum,

        item

      )=>

        sum +
        (

          item.price *
          item.quantity

        ),

      0

    );

  return(

  <CartContext.Provider

  value={{

    items,

    addItem,

    removeItem,

    clearCart,

    subtotal,

    totalItems: items.reduce(

      (total, item) =>

        total + item.quantity,

      0

    )

  }}

>

      {children}

    </CartContext.Provider>

  );

}

export function useCart(){

  const context =
    useContext(
      CartContext
    );

  if(!context){

    throw new Error(

      "useCart must be used inside CartProvider"

    );

  }

  return context;

}