"use client";

import Image from "next/image";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";

import { useCart }
from "@/components/CartContext";

interface VendorDetailProps {

  vendor:any;

  menuItems:any[];

}

export function VendorDetail({

  vendor,

  menuItems,

}:VendorDetailProps) {

  const router =
    useRouter();

  const {

    items,

    addItem,

    removeItem,

  } =
    useCart();

  function getItemQuantity(

    id:string

  ){

    return (

      items.find(

        item =>

          item.id === id

      )?.quantity || 0

    );

  }

  const totalItems =

    items.reduce(

      (sum,item)=>

        sum + item.quantity,

      0

    );

  return (

    <div className="
      min-h-screen
      bg-gray-50
      pb-32
    ">

      <div className="
        relative
        h-[320px]
      ">

        <Image
          src={
            vendor?.image ||
            "/placeholder.jpg"
          }
          alt={
            vendor?.name ||
            "Vendor"
          }
          fill
          priority
          className="
            object-cover
          "
        />

        <button

          onClick={()=>

            router.back()

          }

          className="
            absolute
            top-6
            left-6
            bg-white
            rounded-full
            p-3
            shadow-lg
          "

        >

          <ArrowLeft className="w-5 h-5"/>

        </button>

      </div>

      <div className="
        max-w-6xl
        mx-auto
        px-4
        py-8
      ">

        <h1 className="
          text-4xl
          font-bold
          mb-3
        ">

          {

            vendor?.name ||

            "Vendor"

          }

        </h1>

        <div className="
          flex
          gap-5
          mb-10
          text-gray-600
        ">

          <span>

            ⭐ {

              vendor?.rating ??

              "N/A"

            }

          </span>

          <span>

            {

              vendor?.delivery_time ??

              "—"

            }

          </span>

          <span>

            {

              vendor?.cuisine ??

              "Cuisine"

            }

          </span>

        </div>

        <h2 className="
          text-2xl
          font-bold
          mb-6
        ">

          Menu

        </h2>

        <div className="
          space-y-5
        ">

          {

            menuItems
              ?.filter(

                item =>

                  item &&
                  item.id

              )

              .map(

                (item)=>(

                  <div

                    key={
                      String(
                        item.id
                      )
                    }

                    className="
                      bg-white
                      rounded-2xl
                      p-5
                      shadow-sm
                      flex
                      gap-5
                    "

                  >

                    <div className="
                      relative
                      w-28
                      h-28
                      flex-shrink-0
                    ">

                      <Image
                        src={
                          item.image ||
                          "/placeholder.jpg"
                        }
                        alt={
                          item.name ||
                          "Menu Item"
                        }
                        fill
                        sizes="112px"
                        className="
                          rounded-xl
                          object-cover
                        "
                      />

                    </div>

                    <div className="
                      flex-1
                    ">

                      <h3 className="
                        text-xl
                        font-bold
                        mb-2
                      ">

                        {

                          item.name

                        }

                      </h3>

                      <p className="
                        text-gray-500
                        mb-3
                      ">

                        {

                          item.description

                        }

                      </p>

                      <p className="
                        text-orange-500
                        font-bold
                        text-lg
                      ">

                        ₦

                        {

                          Number(

                            item.price || 0

                          ).toLocaleString()

                        }

                      </p>

                    </div>

                    <div className="
                      flex
                      items-center
                    ">

                      {

                        getItemQuantity(

                          String(
                            item.id
                          )

                        ) === 0

                        ? (

                          <button

                            onClick={()=>

                              addItem({

                                id:
                                  String(
                                    item.id
                                  ),

                                vendor_id:
                                  String(
                                    vendor.id
                                  ),

                                name:
                                  item.name,

                                price:
                                  Number(
                                    item.price
                                  ),

                                quantity:1,

                                image:
                                  item.image,

                              })

                            }

                            className="
                              bg-orange-500
                              text-white
                              px-5
                              py-3
                              rounded-xl
                            "

                          >

                            ADD

                          </button>

                        )

                        : (

                          <div className="
                            flex
                            items-center
                            gap-3
                          ">

                            <button

                              onClick={()=>

                                removeItem(

                                  String(
                                    item.id
                                  )

                                )

                              }

                              className="
                                w-10
                                h-10
                                rounded-full
                                bg-gray-200
                              "

                            >

                              −

                            </button>

                            <span className="
                              font-bold
                            ">

                              {

                                getItemQuantity(

                                  String(
                                    item.id
                                  )

                                )

                              }

                            </span>

                            <button

                              onClick={()=>

                                addItem({

                                  id:
                                    String(
                                      item.id
                                    ),

                                  vendor_id:
                                    String(
                                      vendor.id
                                    ),

                                  name:
                                    item.name,

                                  price:
                                    Number(
                                      item.price
                                    ),

                                  quantity:1,

                                  image:
                                    item.image,

                                })

                              }

                              className="
                                w-10
                                h-10
                                rounded-full
                                bg-orange-500
                                text-white
                              "

                            >

                              +

                            </button>

                          </div>

                        )

                      }

                    </div>

                  </div>

                )

              )

          }

        </div>

      </div>

      {

        totalItems > 0 && (

          <button

            onClick={()=>

              router.push(
                "/cart"
              )

            }

            className="
              fixed
              bottom-8
              right-8
              bg-orange-500
              text-white
              rounded-full
              px-6
              py-4
              shadow-xl
              flex
              items-center
              gap-3
              font-bold
              hover:bg-orange-600
            "

          >

            <ShoppingCart className="w-5 h-5"/>

            Cart (

              {totalItems}

            )

          </button>

        )

      }

    </div>

  );

}