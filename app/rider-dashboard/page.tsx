"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import {

  Bike,
  Wallet,
  Clock,
  LogOut

} from "lucide-react";

type RiderPage =
  | "active"
  | "earnings";

type Order = {

  id:string;

  status:string;

  total:number;

  food_amount:number;

  delivery_fee:number;

  platform_fee:number;

  vendor_amount:number;

  rider_amount:number;

  mkh_amount:number;

  created_at:string;

  vendor_id:string;

  rider_id:string | null;

  delivery_address:string | null;

  customer_notes?: string | null;

  delivery_otp?: string | null;

  otp_verified?: boolean;

  vendors?:{

    name:string;

    location:string;

  };

  profiles?:{

    full_name:string;

    email:string;

    phone:string | null;

  } | null;

  order_items?:{

    id:string;

    name:string;

    quantity:number;

    price:number;

  }[];

};

export default function RiderDashboardPage(){

  const router =
    useRouter();

  const supabase =
    createClient();

  const [currentPage,
    setCurrentPage] =
    useState<RiderPage>(
      "active"
    );

  const [loading,
    setLoading] =
    useState(true);

  const [availableOrders,
    setAvailableOrders] =
    useState<Order[]>([]);

  const [myOrders,
    setMyOrders] =
    useState<Order[]>([]);

    const [completedOrders,
  setCompletedOrders] =
  useState<Order[]>([]);

    const [otpInputs, setOtpInputs] =
  useState<Record<string,string>>({});

  async function loadDashboard(){

    try{

      setLoading(true);

      const {

        data:{
          user
        }

      } =
      await supabase
        .auth
        .getUser();

      if(!user){

        router.push(
          "/login"
        );

        return;

      }

      /*
      AVAILABLE PICKUPS
      */

 const {
  data: queue,
  error: queueError
} = await supabase
  .from("orders")
  .select(`
    *,
    order_items!order_items_order_id_fkey(
      id,
      name,
      quantity,
      price
    ),
   vendors(
  name,
  location
),
profiles!orders_user_id_fkey(
  full_name,
  email,
  phone
)
  `)
  .eq(
    "status",
    "ready_for_pickup"
  )
  .is(
    "rider_id",
    null
  )
  .order(
    "created_at",
    {
      ascending: false
    }
  );


if(queue?.[0]){

  const {
    data:customer,
    error:customerError
  } = await supabase
    .from("profiles")
    .select(`
      full_name,
      email
    `)
    .eq(
      "id",
      queue[0].user_id
    )
    .single();

}

      /*
      RIDER ACTIVE JOBS
      */

      const {

        data:active,
        error:activeError

      } =
      await supabase
        .from("orders")
      .select(`
  *,
  order_items!order_items_order_id_fkey(
    id,
    name,
    quantity,
    price
  ),
  vendors(
  name,
  location
),
profiles!orders_user_id_fkey(
  full_name,
  email,
  phone
)
`)
        .eq(
          "rider_id",
          user.id
        )
        .neq(
          "status",
          "delivered"
        )
        .order(
          "created_at",
          {
            ascending:false
          }
        );

      if(activeError){

        console.error(
          
          activeError
        );

      }

    setAvailableOrders(
  queue || []
);

setMyOrders(
  active || []
);

const {
  data: completed
} =
await supabase
  .from("orders")
  .select(`
    *,
    vendors(
      name,
      location
    )
  `)
  .eq(
    "rider_id",
    user.id
  )
  .eq(
    "status",
    "delivered"
  );

setCompletedOrders(
  completed || []
);

    }

    catch(err){

      console.error(
        err
      );

    }

    finally{

      setLoading(false);

    }

  }

  useEffect(()=>{

    loadDashboard();

    const channel =
      supabase
        .channel(
          "rider-live"
        )
        .on(
          "postgres_changes",
          {

            event:"*",

            schema:"public",

            table:"orders"

          },

          ()=>{

            loadDashboard();

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
async function acceptDelivery(

  orderId:string

){

  try{

    const {

      data:{
        user
      }

    } =
    await supabase
      .auth
      .getUser();

if(!user){

  alert(
    "No rider logged in."
  );

  return;

}

const generatedOtp =
  Math.floor(
    1000 +
    Math.random() * 9000
  ).toString();

console.log(
  "GENERATED OTP:",
  generatedOtp
);

const {

  data,

  error

} =
await supabase
  .from("orders")
  .update({

  rider_id:user.id,

  status:"accepted",

 delivery_otp:
  generatedOtp,

  otp_verified:false

})
      .eq(
        "id",
        orderId
      )
      .select();

    console.log(
      "ACCEPT RESULT:",
      data
    );
console.log(
  "UPDATED ORDER:",
  data?.[0]
);
    console.log(
      "ACCEPT ERROR:",
      error
    );

    if(error){

      alert(
        error.message
      );

      return;

    }

    loadDashboard();

  }

  catch(err){

    console.error(err);

  }

}

  async function updateStatus(

  orderId:string,

  status:string

){

  const { error } =
    await supabase
      .from("orders")
      .update({
        status
      })
      .eq(
        "id",
        orderId
      );

  if(error){

    console.error(error);
    return;

  }

  if(status === "delivered"){

    const {
      data: order
    } =
    await supabase
      .from("orders")
      .select("*")
      .eq(
        "id",
        orderId
      )
      .single();

    if(order){

      const {
        data: existingTransaction
      } =
      await supabase
        .from(
          "wallet_transactions"
        )
        .select("id")
        .eq(
          "order_id",
          orderId
        )
        .maybeSingle();

      if(!existingTransaction){

        const vendorShare =
  Number(
    order.vendor_amount || 0
  );

const riderShare =
  Number(
    order.rider_amount || 0
  );

const mkhShare =
  Number(
    order.mkh_amount || 0
  );

console.log(
  "ORDER FINANCE:",
  {
    total: order.total,
    vendor_amount: order.vendor_amount,
    rider_amount: order.rider_amount,
    mkh_amount: order.mkh_amount,
    vendorShare
  }
);

        const {
          error: transactionError
        } =
        await supabase
          .from(
            "wallet_transactions"
          )
          .insert({

            vendor_id:
              order.vendor_id,

            order_id:
              orderId,

            amount:
              vendorShare,

            transaction_type:
              "order_earning"

          });

        console.log(
          "TRANSACTION ERROR:",
          transactionError
        );

        const {
          data: wallet
        } =
        await supabase
          .from(
            "vendor_wallets"
          )
          .select("*")
          .eq(
            "vendor_id",
            order.vendor_id
          )
          .single();

        if(wallet){

          const {
            error: walletError
          } =
          await supabase
            .from(
              "vendor_wallets"
            )
            .update({

              accrued_balance:
                Number(
                  wallet.accrued_balance || 0
                ) +
                vendorShare,

              lifetime_earnings:
                Number(
                  wallet.lifetime_earnings || 0
                ) +
                vendorShare

            })
            .eq(
              "vendor_id",
              order.vendor_id
            );

          console.log(
            "WALLET ERROR:",
            walletError
          );

        }

      }

    }

  }

  loadDashboard();

}
async function verifyOtp(

  orderId:string,

  correctOtp:string

){

  const enteredOtp =
    otpInputs[orderId];

  if(
    enteredOtp !==
    correctOtp
  ){

    alert(
      "Incorrect OTP"
    );

    return;

  }

  const { error } =
    await supabase
      .from("orders")
      .update({

        otp_verified:true

      })
      .eq(
        "id",
        orderId
      );

  if(error){

    alert(
      error.message
    );

    return;

  }

  alert(
    "OTP Verified"
  );

  loadDashboard();

}
  async function logout(){

    await supabase
      .auth
      .signOut();

    router.push(
      "/login"
    );

  }

 const deliveredCount =
  useMemo(()=>{

    return completedOrders.length;

  },[
    completedOrders
  ]);

 const earnings =
  useMemo(()=>{

    return completedOrders.reduce(

      (sum,order)=>

        sum +
        Number(
          order.rider_amount || 0
        ),

      0

    );

  },[
    completedOrders
  ]);

  if(loading){

    return(

      <main className="
        min-h-screen
        flex
        items-center
        justify-center
      ">

        <h1 className="
          text-3xl
          font-bold
        ">

          Loading Rider Dashboard...

        </h1>

      </main>

    );

  }

  return(

    <div className="
      min-h-screen
      bg-gray-100
      p-6
    ">

      <div className="
        max-w-6xl
        mx-auto
      ">

        <div className="
          flex
          justify-between
          items-center
          mb-10
        ">

          <div>

            <h1 className="
              text-4xl
              font-bold
            ">

              Rider Dashboard

            </h1>

            <p className="
              text-gray-500
              mt-2
            ">

              Manage deliveries & earnings

            </p>

          </div>

          <button

            onClick={logout}

            className="
              bg-red-500
              text-white
              px-5
              py-3
              rounded-xl
              flex
              items-center
              gap-2
            "

          >

            <LogOut className="w-5 h-5"/>

            Logout

          </button>

        </div>

        <div className="
          flex
          gap-4
          mb-8
        ">

          <button

            onClick={()=>

              setCurrentPage(
                "active"
              )

            }

            className={`
              px-6
              py-3
              rounded-xl
              font-semibold
              ${
                currentPage==="active"

                ?

                "bg-orange-500 text-white"

                :

                "bg-white"
              }
            `}

          >

            Active

          </button>

          <button

            onClick={()=>

              setCurrentPage(
                "earnings"
              )

            }

            className={`
              px-6
              py-3
              rounded-xl
              font-semibold
              ${
                currentPage==="earnings"

                ?

                "bg-orange-500 text-white"

                :

                "bg-white"
              }
            `}

          >

            Earnings

          </button>

        </div>
                {

          currentPage ===
          "earnings"

          ? (

            <div className="
              grid
              md:grid-cols-2
              gap-6
            ">

              <div className="
                bg-white
                p-8
                rounded-3xl
                shadow-sm
              ">

                <div className="
                  flex
                  items-center
                  gap-4
                  mb-5
                ">

                  <Wallet
                         className="
                             w-10
                              h-10
                           text-green-500
                              "
                              />

                  <h2 className="
                    text-3xl
                    font-bold
                  ">

                    Earnings

                  </h2>

                </div>

                <p className="
                  text-5xl
                  font-bold
                  text-green-600
                ">

                  ₦

                  {

                    earnings
                      .toLocaleString()

                  }

                </p>

              </div>

              <div className="
                bg-white
                p-8
                rounded-3xl
                shadow-sm
              ">

                <div className="
                  flex
                  items-center
                  gap-4
                  mb-5
                ">

                  <Bike
                    className="
                      w-10
                      h-10
                      text-orange-500
                    "
                  />

                  <h2 className="
                    text-3xl
                    font-bold
                  ">

                    Deliveries

                  </h2>

                </div>

                <p className="
                  text-5xl
                  font-bold
                ">

                  {

                    deliveredCount

                  }

                </p>

              </div>

            </div>

          )

          : (

            <div className="
              space-y-10
            ">

              <section>

                <h2 className="
                  text-2xl
                  font-bold
                  mb-5
                ">

                  Available Pickups

                </h2>

                <div className="
                  space-y-5
                ">

                  {

                    availableOrders.length === 0

                    ? (

                      <div className="
                        bg-white
                        p-8
                        rounded-2xl
                        text-center
                      ">

                        No deliveries waiting.

                      </div>

                    )

                    : availableOrders.map(

                      (order)=>(

                        <div

                          key={order.id}

                          className="
                            bg-white
                            p-6
                            rounded-3xl
                            shadow-sm
                          "

                        >

                          <div className="
  flex
  justify-between
  items-start
  mb-5
">

                            <div>

 <h3 className="
  font-bold
  text-xl
">
  {order.vendors?.name}
</h3>

<p className="
  text-gray-500
">
  {order.vendors?.location}
</p>
<p className="
  text-sm
  text-blue-600
  mt-1
">
  Customer: {order.profiles?.full_name}
</p>
<a
  href={`tel:${order.profiles?.phone}`}
  className="
    block
    text-sm
    text-green-600
    font-medium
  "
>
  📞 {order.profiles?.phone}
</a>

<p className="
  text-sm
  text-gray-600
">
  📍 {order.delivery_address}
</p>

<a
  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    order.delivery_address || ""
  )}`}
  target="_blank"
  rel="noopener noreferrer"
  className="
    inline-block
    text-sm
    text-blue-600
    font-medium
    mt-1
  "
>
  Open in Google Maps →
</a>
{
  order.customer_notes && (
    <p
      className="
        text-sm
        text-orange-700
        mt-1
      "
    >
      📝 {order.customer_notes}
    </p>
  )
}
<p className="
  text-lg
  font-semibold
  text-green-600
  mt-2
">
  ₦{Number(order.total).toLocaleString()}
</p>

<p className="
  text-sm
  text-gray-500
  mt-1
">
  Rider earns approximately₦{
  Number(
    order.rider_amount || 0
  ).toLocaleString()
}
</p>

<p className="
  text-sm
  text-orange-600
  mt-2 
">
   Ordered: {new Date(order.created_at).toLocaleString()}
  
</p>

                            </div>

                            
  <div className="
  text-right
">

  <Clock
    className="
      text-orange-500
      ml-auto
      mb-2
    "
  />

  <p className="
    text-sm
    text-gray-500
  ">
    Ready
  </p>

</div>

                          </div>

                          <button

                            onClick={()=>

                              acceptDelivery(
                                order.id
                              )

                            }

                            className="
                              bg-orange-500
                              text-white
                              px-6
                              py-3
                              rounded-xl
                              font-bold
                            "

                          >

                            Accept Delivery

                          </button>

                        </div>

                      )

                    )

                  }

                </div>

              </section>

              <section>

                <h2 className="
                  text-2xl
                  font-bold
                  mb-5
                ">

                  My Deliveries

                </h2>

                <div className="
                  space-y-6
                ">

                  {

                    myOrders.map(

                      (order)=>(

                        <div

                          key={order.id}

                          className="
                            bg-white
                            rounded-3xl
                            p-6
                            shadow-sm
                          "

                        >

                          <div className="
                            flex
                            justify-between
                            mb-6
                          ">

                            <div>

                            <h3 className="
  font-bold
  text-xl
">
  {order.vendors?.name}
</h3>

<p className="
  text-gray-500
">
  {order.vendors?.location}
</p>
<p className="
  text-sm
  text-blue-600
  mt-1
">
  Customer: {order.profiles?.full_name}
</p>

<a
  href={`tel:${order.profiles?.phone}`}
  className="
    block
    text-sm
    text-green-600
    font-medium
  "
>
  📞 {order.profiles?.phone}
  </a>
  <p className="
  text-sm
  text-gray-600
">
  📍 {order.delivery_address}
</p>
<a
  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    order.delivery_address || ""
  )}`}
  target="_blank"
  rel="noopener noreferrer"
  className="
    inline-block
    text-sm
    text-blue-600
    font-medium
    mt-1
  "
>
  Open in Google Maps →
</a>
{
  order.customer_notes && (
    <p
      className="
        text-sm
        text-orange-700
        mt-1
      "
    >
      📝 {order.customer_notes}
    </p>
  )
}
<p className="
  capitalize
  text-orange-600
  text-sm
  mt-1
">
  {order.status}
</p>
<p className="
  text-sm
  text-gray-500
  mt-2
">
  Order Value:
  {" "}
  ₦{Number(order.total).toLocaleString()}
</p>

<p className="
  text-sm
  text-green-600
">
  Rider Earnings:
  {" "}
  ₦{
  Number(
    order.rider_amount || 0
  ).toLocaleString()
}
</p>

<p className="
  text-sm
  text-gray-500
">
  Ordered:
  {" "}
  {
    new Date(
      order.created_at
    ).toLocaleString()
  }
</p>

                            </div>

                            <p className="
                              text-2xl
                              font-bold
                              text-green-600
                            ">

                             ₦

{

  Number(
    order.rider_amount || 0
  )

}

                            </p>

                          </div>

                          <div className="
                            space-y-2
                            mb-6
                          ">

                            {

                              order
                                .order_items
                                ?.map(

                                  (item)=>(

                                    <div

                                      key={item.id}

                                      className="
                                        flex
                                        justify-between
                                      "

                                    >

                                      <span>

                                        {

                                          item.quantity

                                        }x {item.name}

                                      </span>

                                      <span>

                                        ₦

                                        {

                                          item.price
                                            .toLocaleString()

                                        }

                                      </span>

                                    </div>

                                  )

                                )

                            }

                          </div>
{
  order.status === "picked_up" &&
  !order.otp_verified && (

    <div className="mb-4">

      <input
        type="text"
        placeholder="Enter customer OTP"
        value={
          otpInputs[order.id] || ""
        }
        onChange={(e)=>

          setOtpInputs({

            ...otpInputs,

            [order.id]:
              e.target.value

          })

        }
        className="
          border
          p-3
          rounded-xl
          w-full
          mb-2
        "
      />

      <button

        onClick={()=>

          verifyOtp(
            order.id,
            order.delivery_otp || ""
          )

        }

        className="
          bg-orange-500
          text-white
          px-5
          py-2
          rounded-xl
        "

      >

        Verify OTP

      </button>

    </div>

  )
}
                {

  (
    order.status === "accepted" ||
    order.status === "assigned"
  )

  &&

  <button

    onClick={()=>

      updateStatus(
        order.id,
        "picked_up"
      )

    }

    className="
      bg-blue-500
      text-white
      px-6
      py-3
      rounded-xl
      font-bold
    "

  >

    Confirm Pickup

  </button>

}

                          

  {
  order.status === "picked_up" &&
  order.otp_verified && (

    <button

      onClick={()=>

        updateStatus(
          order.id,
          "delivered"
        )

      }

      className="
        bg-green-500
        text-white
        px-6
        py-3
        rounded-xl
        font-bold
      "

    >

      Complete Delivery

    </button>

  )
}
                        </div>

                      )

                    )

                  }

                </div>

              </section>

            </div>

          )

        }

      </div>

    </div>

  );

}