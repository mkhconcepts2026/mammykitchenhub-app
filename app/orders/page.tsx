"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function OrdersPage() {

  const supabase = createClient();

  const [orders,setOrders] =
    useState<any[]>([]);

  const [loading,setLoading] =
    useState(true);

  const statuses = [

    "pending",
    "accepted",
    "preparing",
    "picked_up",
    "delivered"

  ];

  async function loadOrders() {

    try {

      const {

        data:{
          user
        }

      } =
      await supabase
        .auth
        .getUser();

      if (!user) {

        setLoading(false);

        return;

      }

      const {

        data,
        error

      } =
      await supabase
        .from("orders")
       .select(`
  *,
  order_items(
    id,
    name,
    quantity,
    price
  ),
  rider:profiles!orders_rider_id_fkey(
    full_name,
    phone
  )
`)
        .eq(
          "user_id",
          user.id
        )
        .order(
          "created_at",
          {
            ascending:false
          }
        );

      if (!error) {

        setOrders(
          data || []
        );

      }

    }

    catch(err) {

      console.error(err);

    }

    finally {

      setLoading(false);

    }

  }

  useEffect(()=>{

    loadOrders();

    const channel =
      supabase
        .channel(
          "customer-orders-live"
        )
        .on(
          "postgres_changes",
          {

            event:"*",
            schema:"public",
            table:"orders"

          },
          ()=>{

            loadOrders();

          }
        )
        .subscribe();

    return ()=>{

      supabase
        .removeChannel(
          channel
        );

    };

  },[]);

  async function cancelOrder(
    orderId:string
  ){

    const confirmed =
      confirm(
        "Cancel this order?"
      );

    if (!confirmed)
      return;

    const {
      error
    } =
      await supabase
        .from("orders")
        .update({

          status:
            "cancelled"

        })
        .eq(
          "id",
          orderId
        );

    if (error) {

      alert(
        "Failed to cancel."
      );

      return;

    }

    loadOrders();

  }

  function badgeColor(
    status:string
  ){

    switch(status){

      case "pending":

        return
        "bg-yellow-100 text-yellow-700";

      case "accepted":

        return
        "bg-blue-100 text-blue-700";

      case "preparing":

        return
        "bg-purple-100 text-purple-700";

      case "picked_up":

        return
        "bg-indigo-100 text-indigo-700";

      case "delivered":

        return
        "bg-green-100 text-green-700";

      case "cancelled":

        return
        "bg-red-100 text-red-700";

      default:

        return
        "bg-gray-100 text-gray-700";

    }

  }

  if (loading){

    return(

      <main className="
        min-h-screen
        flex
        items-center
        justify-center
      ">

        <h1 className="
          text-2xl
          font-bold
        ">

          Loading Orders...

        </h1>

      </main>

    );

  }

  return (

    <main className="
      min-h-screen
      bg-gray-50
      p-6
    ">

      <div className="
        max-w-5xl
        mx-auto
      ">

        <div className="
          flex
          justify-between
          items-center
          mb-10
        ">

          <h1 className="
            text-4xl
            font-bold
          ">

            My Orders

          </h1>

          <Link
            href="/dashboard"
            className="
              bg-orange-500
              text-white
              px-5
              py-3
              rounded-xl
              font-semibold
            "
          >

            Continue Shopping

          </Link>

        </div>

        {

          orders.length===0

          ?(

            <div className="
              bg-white
              rounded-2xl
              p-10
              text-center
              shadow-sm
            ">

              <h2 className="
                text-2xl
                font-bold
                mb-3
              ">

                No Orders Yet

              </h2>

            </div>

          )

          :(

            <div className="
              space-y-6
            ">

              {

                orders.map(
                  (order)=>{

                    const currentIndex =
                      statuses.indexOf(
                        order.status
                      );

                    return(

                      <div
                        key={order.id}
                        className="
                          bg-white
                          rounded-2xl
                          shadow-sm
                          p-6
                        "
                      >

                        <div className="
                          flex
                          justify-between
                          mb-6
                        ">

                          <div>
                            <div className="
  mt-6
  space-y-2
  text-sm
">

  <p>

    <strong>
      Delivery Address:
    </strong>

    {" "}

    {order.delivery_address || "N/A"}

  </p>

  {

    order.customer_notes && (

      <p>

        <strong>
          Notes:
        </strong>

        {" "}

        {order.customer_notes}

      </p>

    )

  }

</div>

                            <h2 className="
                              font-bold
                              text-lg
                            ">

                              Order

                            </h2>

                            <p className="
                              text-gray-500
                              break-all
                            ">

                              {order.id}

                            </p>

                          </div>

                          <span
                            className={`
                              px-4
                              py-2
                              rounded-full
                              capitalize
                              ${badgeColor(
                                order.status
                              )}
                            `}
                          >

                            {order.status}

                          </span>

                        </div>

                        <div className="
                          mb-8
                        ">

                          <h3 className="
                            font-bold
                            mb-4
                          ">

                            Order Progress

                          </h3>

                          <div className="
                            flex
                            flex-wrap
                            gap-3
                          ">

                            {

                              statuses.map(

                                (
                                  step,
                                  index
                                )=>(

                                  <div
                                    key={step}
                                    className={`
                                      px-4
                                      py-2
                                      rounded-full
                                      text-sm
                                      capitalize

                                      ${
                                        index
                                        <=
                                        currentIndex

                                        ?

                                        "bg-green-500 text-white"

                                        :

                                        "bg-gray-200 text-gray-500"
                                      }
                                    `}
                                  >

                                    {step.replace(
                                      "_",
                                      " "
                                    )}

                                  </div>

                                )

                              )

                            }

                          </div>

                        </div>

                        <div className="
                          mb-6
                        ">

                          {

                            order.order_items?.map(

                              (item:any)=>(

                                <div
                                  key={item.id}
                                  className="
                                    flex
                                    justify-between
                                    py-2
                                  "
                                >

                                  <span>

                                    {item.quantity}x {item.name}

                                  </span>

                                  <span>

                                    ₦
                                    {item.price.toLocaleString()}

                                  </span>

                                </div>

                              )

                            )

                          }

                        </div>

                        <div className="
                          flex
                          justify-between
                          items-center
                        ">

                          <div>

                            <p className="
                              text-gray-600
                            ">

                              {

                                new Date(
                                  order.created_at
                                )
                                .toLocaleDateString()

                              }

                            </p>

                            <p className="
                              text-orange-500
                              text-xl
                              font-bold
                            ">

                              ₦
                              {order.total.toLocaleString()}

                            </p>

                          </div>

                          {

                            order.status ===
                            "pending"

                            &&

                            <button
                              onClick={()=>

                                cancelOrder(
                                  order.id
                                )

                              }
                              className="
                                bg-red-500
                                text-white
                                px-5
                                py-3
                                rounded-xl
                              "
                            >

                              Cancel Order

                            </button>

                          }

                        </div>

                      </div>

                    );

                  }

                )

              }

            </div>

          )

        }

      </div>

    </main>

  );

}