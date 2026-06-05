"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/components/CartContext";

export default function CheckoutPage() {

  const router =
    useRouter();

  const supabase =
    createClient();

  const {
    items,
    subtotal,
    clearCart
  } =
    useCart();

  const [loading,
    setLoading] =
    useState(false);
    const [
  deliveryAddress,
  setDeliveryAddress
] =
  useState("");

const [
  phoneNumber,
  setPhoneNumber
] =
  useState("");

const [
  customerNotes,
  setCustomerNotes
] =
  useState("");

  const deliveryFee =
    1500;

  const total =
    subtotal +
    deliveryFee;

  async function placeOrder() {

    try {

      setLoading(true);

      const {

        data:{
          user
        }

      } =
      await supabase
        .auth
        .getUser();

      if (!user) {

        alert(
          "Please login first."
        );

        router.push(
          "/login"
        );

        return;

      }

      if (
        items.length === 0
      ) {

        alert(
          "Cart is empty."
        );

        return;

      }

      const vendorId =
        items[0]
        ?.vendor_id;
if (
  !deliveryAddress.trim()
) {

  alert(
    "Please enter a delivery address."
  );

  return;

}
      const {

        data:order,
        error:orderError

      } =
      await supabase
        .from("orders")
        .insert({

  user_id:
    user.id,

  vendor_id:
    vendorId,

  total,

  delivery_address:
    deliveryAddress,

  customer_notes:
    customerNotes,
customer_phone: phoneNumber,
  status:
    "pending"

})
        .select()
        .single();

      if (orderError)
        throw orderError;

      const orderItems =
        items.map(

          (item)=>({

            order_id:
              order.id,

            menu_item_id:
              item.id,

            name:
              item.name,

            quantity:
              item.quantity,

            price:
              item.price

          })

        );

      const {

        error:itemError

      } =
      await supabase
        .from(
          "order_items"
        )
        .insert(
          orderItems
        );

      if (itemError)
        throw itemError;

      clearCart();

      router.push(

        `/success?order=${order.id}`

      );

    }

    catch(err) {

      console.error(err);

      alert(
        "Failed placing order."
      );

    }

    finally {

      setLoading(false);

    }

  }

  return (

    <main className="
      min-h-screen
      bg-gray-50
      p-6
    ">

      <div className="
        max-w-6xl
        mx-auto
        grid
        lg:grid-cols-3
        gap-8
      ">

        <div className="
          lg:col-span-2
          bg-white
          rounded-2xl
          shadow-sm
          p-8
        ">

          <h1 className="
            text-4xl
            font-bold
            mb-8
          ">

            Checkout

          </h1>

          <div className="
            space-y-6
          ">

            <div>

              <label className="
                block
                font-semibold
                mb-2
              ">

                Delivery Address

              </label>

              <input
  type="text"
  placeholder="Enter delivery address"
  value={deliveryAddress}
  onChange={(e)=>
    setDeliveryAddress(
      e.target.value
    )
  }
  className="
    w-full
    border
    rounded-xl
    p-4
  "
/>

            </div>

            <div>

              <label className="
                block
                font-semibold
                mb-2
              ">

                Phone Number

              </label>

              <input
  type="text"
  placeholder="08012345678"
  value={phoneNumber}
  onChange={(e)=>
    setPhoneNumber(
      e.target.value
    )
  }
  className="
    w-full
    border
    rounded-xl
    p-4
  "
/>
<div>

  <label className="
    block
    font-semibold
    mb-2
  ">

    Delivery Notes

  </label>

  <textarea
    value={customerNotes}
    onChange={(e)=>
      setCustomerNotes(
        e.target.value
      )
    }
    placeholder="
      Landmark,
      gate code,
      directions...
    "
    className="
      w-full
      border
      rounded-xl
      p-4
    "
  />

</div>
            </div>

            <div>

              <label className="
                block
                font-semibold
                mb-2
              ">

                Payment Method

              </label>

              <select
                className="
                  w-full
                  border
                  rounded-xl
                  p-4
                "
              >

                <option>

                  Cash on Delivery

                </option>

                <option>

                  Card Payment

                </option>

              </select>

            </div>

          </div>

        </div>

        <div className="
          bg-white
          rounded-2xl
          shadow-sm
          p-8
          h-fit
        ">

          <h2 className="
            text-2xl
            font-bold
            mb-6
          ">

            Order Summary

          </h2>

          <div className="
            space-y-4
            mb-8
          ">

            {

              items.map(

                (item)=>(

                  <div
                    key={item.id}
                    className="
                      flex
                      justify-between
                    "
                  >

                    <div>

                      {item.quantity}x {item.name}

                    </div>

                    <div>

                      ₦
                      {

                        (
                          item.price *
                          item.quantity
                        )
                        .toLocaleString()

                      }

                    </div>

                  </div>

                )

              )

            }

          </div>

          <div className="
            border-t
            pt-6
            space-y-3
          ">

            <div className="
              flex
              justify-between
            ">

              <span>

                Subtotal

              </span>

              <span>

                ₦
                {subtotal.toLocaleString()}

              </span>

            </div>

            <div className="
              flex
              justify-between
            ">

              <span>

                Delivery

              </span>

              <span>

                ₦
                {deliveryFee.toLocaleString()}

              </span>

            </div>

            <div className="
              flex
              justify-between
              text-xl
              font-bold
            ">

              <span>

                Total

              </span>

              <span>

                ₦
                {total.toLocaleString()}

              </span>

            </div>

          </div>

          <button
            onClick={
              placeOrder
            }
            disabled={
              loading
            }
            className="
              w-full
              mt-8
              bg-orange-500
              text-white
              p-4
              rounded-xl
              font-bold
            "
          >

            {

              loading
              ? "Placing Order..."
              : "Place Order"

            }

          </button>

        </div>

      </div>

    </main>

  );

}