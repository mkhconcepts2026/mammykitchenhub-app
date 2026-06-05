"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Skeleton } from "@/components/ui/skeleton";

type MenuItem = {
  id:string;
  name:string;
  description:string;
  price:number;
  category:string;
  image:string;
  available:boolean;
  vendor_id:string;
};

type Order = {

  id:string;

  total:number;

  status:string;

  created_at:string;

  vendor_id:string;

  rider_id:string | null;

  delivery_address?: string | null;

customer_notes?: string | null;

customer_phone?: string | null;

profiles?: {

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

export default function VendorDashboardPage() {

  const router =
    useRouter();

  const supabase =
    createClient();

  const [orders,
    setOrders] =
    useState<Order[]>([]);

  const [loading,
    setLoading] =
    useState(true);

  const [search,
    setSearch] =
    useState("");

  const [currentTab,
    setCurrentTab] =
    useState<"orders"|"menu"|"earnings"|"kyc">("orders");

  const [menuItems,setMenuItems]=useState<MenuItem[]>([]);

  const [showMenuForm,setShowMenuForm] = useState(false);
  const [editingMenuId,setEditingMenuId] = useState<string | null>(null);
  const [menuForm,setMenuForm] = useState({
    name:"",
    description:"",
    category:"Rice",
    image:"",
    price:"",
    available:true
  });


  
async function saveMenuItem() {
  const { data:{ user } } = await supabase.auth.getUser();
  if(!user) return;
  const { data:profile } = await supabase.from("profiles").select("vendor_id").eq("id",user.id).single();
  if(!profile?.vendor_id) return;

  if(editingMenuId){
    await supabase.from("menu_items").update({
      name:menuForm.name,
      description:menuForm.description,
      category:menuForm.category,
      image:menuForm.image,
      price:Number(menuForm.price),
      available:menuForm.available
    }).eq("id",editingMenuId);
  } else {
    await supabase.from("menu_items").insert({
      vendor_id:profile.vendor_id,
      name:menuForm.name,
      description:menuForm.description,
      category:menuForm.category,
      image:menuForm.image,
      price:Number(menuForm.price),
      available:menuForm.available
    });
  }

  setShowMenuForm(false);
  setEditingMenuId(null);
  loadMenuItems();
}

async function deleteMenuItem(id:string){
  if(!confirm("Delete this menu item?")) return;
  await supabase.from("menu_items").delete().eq("id",id);
  loadMenuItems();
}

function editMenuItem(item:MenuItem){
  setEditingMenuId(item.id);
  setMenuForm({
    name:item.name,
    description:item.description,
    category:item.category,
    image:item.image,
    price:String(item.price),
    available:item.available
  });
  setShowMenuForm(true);
}

async function toggleAvailability(item:MenuItem){
  await supabase.from("menu_items").update({
    available:!item.available
  }).eq("id",item.id);
  loadMenuItems();
}

async function loadOrders() {

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

        router.push(
          "/login"
        );

        return;

      }

      const {

        data:profile

      } =
      await supabase
        .from("profiles")
        .select(
          "vendor_id"
        )
        .eq(
          "id",
          user.id
        )
        .single();

      if (
        !profile?.vendor_id
      ) {

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
  profiles!orders_user_id_fkey(
    full_name,
    email,
    phone
  )
`)
        .eq(
          "vendor_id",
          profile.vendor_id
        )
        .order(
          "created_at",
          {
            ascending:false
          }
        );

      if (error) {

        console.error(
          error
        );

      }

      setOrders(
        data || []
      );

    }

    catch(err) {

      console.error(err);

    }

    finally {

      setLoading(false);

    }

  }


  async function loadMenuItems() {

    const { data:{ user } } = await supabase.auth.getUser();
    if(!user) return;

    const { data:profile } = await supabase
      .from("profiles")
      .select("vendor_id")
      .eq("id", user.id)
      .single();

    if(!profile?.vendor_id) return;

    const { data } = await supabase
      .from("menu_items")
      .select("*")
      .eq("vendor_id", profile.vendor_id)
      .order("created_at",{ascending:false});

    setMenuItems(data || []);
  }


  useEffect(()=>{

    loadOrders();
    loadMenuItems();

    const channel =
      supabase
        .channel(
          "vendor-orders-live"
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

  async function updateStatus(

    orderId:string,

    status:string

  ) {

    await supabase
      .from("orders")
      .update({
        status
      })
      .eq(
        "id",
        orderId
      );

    loadOrders();

  }

  async function handleLogout() {

    await supabase
      .auth
      .signOut();

    router.push(
      "/login"
    );

  }

  const filteredOrders =
    useMemo(()=>{

      return orders.filter(

        (order)=>

          order.id
            .toLowerCase()
            .includes(
              search.toLowerCase()
            )

      );

    },[
      orders,
      search
    ]);

  const totalRevenue =
    orders.reduce(

      (sum,order)=>

        sum + order.total,

      0

    );

  const pendingCount =
    orders.filter(
      o=>
      o.status==="pending"
    ).length;

  const activeDeliveries =
    orders.filter(
      o=>

        o.status==="accepted" ||

        o.status==="preparing" ||

        o.status==="ready_for_pickup"

    ).length;
      if (loading) {

    return (

      <main className="
        min-h-screen
        p-8
        bg-gray-100
      ">

        <div className="
          grid
          md:grid-cols-3
          gap-6
        ">

          <Skeleton className="h-32 rounded-2xl"/>
          <Skeleton className="h-32 rounded-2xl"/>
          <Skeleton className="h-32 rounded-2xl"/>

        </div>

      </main>

    );

  }

  return (

    <main className="
      min-h-screen
      bg-gray-100
      p-8
    ">

      <div className="
        flex
        justify-between
        items-center
        mb-8
      ">

        <h1 className="
          text-4xl
          font-bold
        ">

          Vendor Dashboard

        </h1>

        <Button
          variant="destructive"
          onClick={handleLogout}
        >

          Logout

        </Button>

      </div>

      <div className="
        grid
        md:grid-cols-3
        gap-6
        mb-10
      ">

        <Card>

          <h3 className="
            text-gray-500
            mb-2
          ">

            Revenue

          </h3>

          <p className="
            text-3xl
            font-bold
          ">

            ₦
            {totalRevenue.toLocaleString()}

          </p>

        </Card>

        <Card>

          <h3 className="
            text-gray-500
            mb-2
          ">

            Pending Orders

          </h3>

          <p className="
            text-3xl
            font-bold
          ">

            {pendingCount}

          </p>

        </Card>

        <Card>

          <h3 className="
            text-gray-500
            mb-2
          ">

            Active Deliveries

          </h3>

          <p className="
            text-3xl
            font-bold
          ">

            {activeDeliveries}

          </p>

        </Card>

      </div>


      <div className="flex gap-3 mb-8 flex-wrap">

        <Button onClick={()=>setCurrentTab("orders")}>
          Orders
        </Button>

        <Button onClick={()=>setCurrentTab("menu")}>
          Menu Management
        </Button>

        <Button onClick={()=>setCurrentTab("earnings")}>
          Earnings & Payouts
        </Button>

        <Button onClick={()=>setCurrentTab("kyc")}>
          KYC Verification
        </Button>

      </div>

      {currentTab === "orders" && (
      <>
      <input
        type="text"
        placeholder="Search order UUID..."
        value={search}
        onChange={(e)=>
          setSearch(
            e.target.value
          )
        }
        className="
          w-full
          bg-white
          rounded-xl
          p-4
          mb-8
          border
        "
      />

      <div className="space-y-6">

        {

          filteredOrders.map(

            (order)=>(

              <Card
                key={order.id}
              >

                <div className="
                  flex
                  justify-between
                  mb-5
                ">

                  <div>

                    <h2 className="
                      font-bold
                      break-all
                    ">

                      {order.id}

                    </h2>

                    <p className="
                      text-gray-500
                    ">

                      {

                        new Date(
                          order.created_at
                        )
                        .toLocaleString()

                      }

                    </p>
<p className="
  text-blue-600
  text-sm
  mt-2
">

  Customer:
  {" "}
  {order.profiles?.full_name}

</p>

<p className="
  text-green-600
  text-sm
">

  📞
  {" "}
  {order.customer_phone}

</p>

<p className="
  text-gray-600
  text-sm
">

  📍
  {" "}
  {order.delivery_address}

</p>

{
  order.customer_notes && (

    <p className="
      text-orange-700
      text-sm
      mt-1
    ">

      📝
      {" "}
      {order.customer_notes}

    </p>

  )
}
                  </div>

                  <Badge>

                    {order.status}

                  </Badge>

                </div>

                {

                  order.rider_id && (

                    <div className="
                      mb-5
                      bg-green-100
                      text-green-700
                      p-3
                      rounded-xl
                      font-semibold
                    ">

                      Rider Assigned

                    </div>

                  )

                }

                <div className="mb-5">

                  <h3 className="
                    font-semibold
                    mb-3
                  ">

                    Items

                  </h3>

                  {

                    order.order_items?.map(

                      (item)=>(

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

                <div className="
                  flex
                  justify-between
                  items-center
                ">

                  <p className="
                    text-2xl
                    font-bold
                  ">

                    ₦
                    {order.total.toLocaleString()}

                  </p>

                  <div className="
                    flex
                    gap-3
                    flex-wrap
                  ">

                    {

                      order.status ===
                      "pending"

                      &&

                      <>

                        <Button
                          onClick={()=>

                            updateStatus(
                              order.id,
                              "accepted"
                            )

                          }
                        >

                          Accept

                        </Button>

                        <Button
                          variant="destructive"
                          onClick={()=>

                            updateStatus(
                              order.id,
                              "cancelled"
                            )

                          }
                        >

                          Reject

                        </Button>

                      </>

                    }

                    {

                      order.status ===
                      "accepted"

                      &&

                      <Button
                        onClick={()=>

                          updateStatus(
                            order.id,
                            "preparing"
                          )

                        }
                      >

                        Preparing

                      </Button>

                    }

                    {

                      order.status ===
                      "preparing"

                      &&

                      <Button
                        onClick={()=>

                          updateStatus(
                            order.id,
                            "ready_for_pickup"
                          )

                        }
                      >

                        Ready For Pickup

                      </Button>

                    }

                  </div>

                </div>

              </Card>

            )

          )

        }

      </div>

      </>
      )}
      
      {currentTab === "menu" && (
        <div>
          <Card>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold">Menu Management</h2>
                <p className="text-gray-500">Manage your restaurant menu items</p>
              </div>
              <Button>Add Item</Button>
            </div>

            <div className="space-y-4">

  {menuItems.length === 0 ? (

    <p className="text-gray-500">
      No menu items found.
    </p>

  ) : (

    menuItems.map((item)=>(

      <div
        key={item.id}
        className="border rounded-xl p-4 flex justify-between items-center"
      >

        <div>

          <h3 className="font-bold">
            {item.name}
          </h3>

          <p className="text-sm text-gray-500">
            {item.category}
          </p>

          <p>
            ₦{Number(item.price).toLocaleString()}
          </p>

        </div>

        <div className="flex gap-2 items-center">

          <button
  onClick={()=>
    toggleAvailability(item)
  }
  className="
    px-3
    py-1
    rounded-full
    text-sm
    border
    cursor-pointer
  "
>
  {item.available
    ? "Available"
    : "Out Of Stock"}
</button>

          <Button
            onClick={()=>
              editMenuItem(item)
            }
          >
            Edit
          </Button>

          <Button
            variant="destructive"
            onClick={()=>
              deleteMenuItem(item.id)
            }
          >
            Delete
          </Button>

        </div>

      </div>

    ))

  )}

</div>

</Card>

</div>

)}


      {currentTab === "earnings" && (
        <Card>
          <h2 className="text-2xl font-bold mb-2">Earnings & Payouts</h2>
          <p className="text-gray-500">Coming next phase.</p>
        </Card>
      )}

      {currentTab === "kyc" && (
        <Card>
          <h2 className="text-2xl font-bold mb-2">KYC Verification</h2>
          <p className="text-gray-500">Coming next phase.</p>
        </Card>
      )}

    </main>

  );

}