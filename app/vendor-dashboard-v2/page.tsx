"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Tab =
  | "orders"
  | "menu"
  | "earnings"
  | "kyc";

export default function VendorDashboardV2() {

  const router =
    useRouter();

  const supabase =
    createClient();

  const [loading,setLoading] =
    useState(true);

  const [vendorName,setVendorName] =
    useState("");

  const [currentTab,setCurrentTab] =
    useState<Tab>("orders");
    const [orders, setOrders] =
  useState<any[]>([]);

const [loadingOrders, setLoadingOrders] =
  useState(false);

    const [menuItems,setMenuItems] = useState<any[]>([]);
const [showForm,setShowForm] = useState(false);
const [editingId,setEditingId] = useState<string | null>(null);

const [form,setForm] = useState({
  name:"",
  description:"",
  category:"Rice",
  image:"",
  price:"",
  available:true
});
const [imageFile,setImageFile] =
  useState<File | null>(null);

  async function loadVendor() {

    try {

      const {
        data:{ user }
      } =
      await supabase
        .auth
        .getUser();

      if(!user){

        router.push("/login");
        return;

      }

      const {
        data:profile
      } =
      await supabase
        .from("profiles")
        .select("vendor_id")
        .eq("id",user.id)
        .single();
        console.log("PROFILE:", profile);

      if(!profile?.vendor_id){

        setLoading(false);
        return;

      }

      const {
        data:vendor
      } =
      await supabase
        .from("vendors")
        .select("name")
        .eq(
          "id",
          profile.vendor_id
        )
        .single();

      setVendorName(
        vendor?.name || ""
      );

    }

    catch(error){

      console.error(error);

    }

    finally{

      setLoading(false);

    }

  }
async function loadMenuItems(){

  const {
    data:{ user }
  } = await supabase.auth.getUser();

  if(!user) return;

  const {
    data:profile
  } = await supabase
    .from("profiles")
    .select("vendor_id")
    .eq("id", user.id)
    .single();

  if(!profile?.vendor_id) return;

  const { data } = await supabase
    .from("menu_items")
    .select("*")
    .eq("vendor_id", profile.vendor_id)
    .order("created_at", {
      ascending:false
    });

  setMenuItems(data || []);

}

async function loadOrders() {

  try {

    setLoadingOrders(true);

    const {
      data:{ user }
    } =
    await supabase
      .auth
      .getUser();

    if(!user){

      setLoadingOrders(false);
      return;

    }

    const {
      data:profile
    } =
    await supabase
      .from("profiles")
      .select("vendor_id")
      .eq("id", user.id)
      .single();

    if(!profile?.vendor_id){

      setLoadingOrders(false);
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
    profiles!orders_user_id_fkey(
      full_name,
      phone,
      email
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

    if(error){

      console.error(error);

    }

    setOrders(data || []);

  }

  catch(error){

    console.error(error);

  }

  finally{

    setLoadingOrders(false);

  }

}

async function updateOrderStatus(
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

  await loadOrders();

}
async function saveMenuItem(){

  const {
    data:{ user }
  } = await supabase.auth.getUser();
  console.log("SAVE CLICKED");
console.log("USER:", user);

  if(!user) return;

  const {
    data:profile
  } = await supabase
    .from("profiles")
    .select("vendor_id")
    .eq("id", user.id)
    .single();
console.log("PROFILE:", profile);
console.log("FORM:", form);
  if(!profile?.vendor_id) return;

  let imageUrl =
  form.image;
  if(imageFile){

  const fileExt =
    imageFile.name
      .split(".")
      .pop();

  const fileName =
    `${Date.now()}.${fileExt}`;

  const {

    error:uploadError

  } =
  await supabase
    .storage
    .from("menu-images")
    .upload(
      fileName,
      imageFile
    );

  if(uploadError){

    alert(
      uploadError.message
    );

    return;

  }

  const {

    data

  } =
  supabase
    .storage
    .from("menu-images")
    .getPublicUrl(
      fileName
    );

  imageUrl =
    data.publicUrl;

}
  if(editingId){

    await supabase
      .from("menu_items")
      .update({
        name:form.name,
        description:form.description,
        category:form.category,
        image:imageUrl,
        price:Number(form.price),
        available:form.available
      })
      .eq("id", editingId);

  } else {

    const { data, error } =
await supabase
  .from("menu_items")
  .insert({
        vendor_id:profile.vendor_id,
        name:form.name,
        description:form.description,
        category:form.category,
        image:imageUrl,
        price:Number(form.price),
        available:form.available
      });
      console.log("INSERT DATA:", data);
console.log("INSERT ERROR:", error);

  }

  setShowForm(false);

  setEditingId(null);

  setForm({
    name:"",
    description:"",
    category:"Rice",
    image:"",
    price:"",
    available:true
  });

  await loadMenuItems();

}

function editMenuItem(item:any){

  setEditingId(item.id);

  setForm({
    name:item.name,
    description:item.description,
    category:item.category,
    image:item.image,
    price:String(item.price),
    available:item.available
  });

  setShowForm(true);

}

async function deleteMenuItem(id:string){

  const ok =
    window.confirm(
      "Delete menu item?"
    );

  if(!ok) return;

  await supabase
    .from("menu_items")
    .delete()
    .eq("id", id);

  await loadMenuItems();

}

async function toggleAvailability(item:any){

  await supabase
    .from("menu_items")
    .update({
      available:!item.available
    })
    .eq("id", item.id);

  await loadMenuItems();

}

  async function logout(){

    await supabase
      .auth
      .signOut();

    router.push("/login");

  }
useEffect(()=>{

  loadVendor();

  loadMenuItems();

  loadOrders();

},[]);

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

          Loading Vendor Dashboard...

        </h1>

      </main>

    );

  }

  return(

    <main className="
      min-h-screen
      bg-gray-100
      p-8
    ">

      <div className="
        max-w-7xl
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

              {vendorName}

            </h1>

            <p className="
              text-gray-500
              text-lg
            ">

              Vendor Dashboard

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
            "
          >

            Logout

          </button>

        </div>

        <div className="
          flex
          gap-4
          mb-10
          flex-wrap
        ">

          <button
            onClick={()=>
              setCurrentTab(
                "orders"
              )
            }
            className={`
              px-6
              py-3
              rounded-xl
              font-semibold
              ${
                currentTab === "orders"
                ? "bg-orange-500 text-white"
                : "bg-white"
              }
            `}
          >
            Orders
          </button>

          <button
            onClick={()=>
              setCurrentTab(
                "menu"
              )
            }
            className={`
              px-6
              py-3
              rounded-xl
              font-semibold
              ${
                currentTab === "menu"
                ? "bg-orange-500 text-white"
                : "bg-white"
              }
            `}
          >
            Menu Management
          </button>

          <button
            onClick={()=>
              setCurrentTab(
                "earnings"
              )
            }
            className={`
              px-6
              py-3
              rounded-xl
              font-semibold
              ${
                currentTab === "earnings"
                ? "bg-orange-500 text-white"
                : "bg-white"
              }
            `}
          >
            Earnings & Payouts
          </button>

          <button
            onClick={()=>
              setCurrentTab(
                "kyc"
              )
            }
            className={`
              px-6
              py-3
              rounded-xl
              font-semibold
              ${
                currentTab === "kyc"
                ? "bg-orange-500 text-white"
                : "bg-white"
              }
            `}
          >
            KYC Verification
          </button>

        </div>

       {currentTab === "orders" && (

  <div className="bg-white rounded-3xl p-8">

    <div className="flex justify-between mb-6">

      <h2 className="text-2xl font-bold">
        Orders
      </h2>

      <span className="text-gray-500">
        {orders.length} Orders
      </span>

    </div>

    {loadingOrders && (

      <p>Loading orders...</p>

    )}

    {!loadingOrders && orders.length === 0 && (

      <p className="text-gray-500">
        No orders yet.
      </p>

    )}

    {!loadingOrders &&
      orders.map((order) => (

        <div
          key={order.id}
          className="
            border
            rounded-xl
            p-4
            mb-4
          "
        >

          <div className="flex justify-between">

            <div>

              <h3 className="font-bold">
                Order #{order.id.slice(0,8)}
              </h3>

             <p className="text-sm text-blue-600">
  Customer:
  {" "}
  {order.profiles?.full_name || "Unknown Customer"}
</p>

<p className="text-sm text-green-600">
  📞 {order.profiles?.phone || "No phone"}
</p>
<p className="text-sm text-gray-600">
  📍 {order.delivery_address || "No address"}
</p>

{
  order.customer_notes && (
    <p className="text-sm text-orange-700">
      📝 {order.customer_notes}
    </p>
  )
}

            </div>

           <span
  className={`
    px-3
    py-1
    rounded-full
    text-sm
    font-medium
    capitalize

    ${
      order.status === "pending"
        ? "bg-yellow-100 text-yellow-700"
        : order.status === "accepted"
        ? "bg-blue-100 text-blue-700"
        : order.status === "preparing"
        ? "bg-purple-100 text-purple-700"
        : order.status === "ready_for_pickup"
        ? "bg-orange-100 text-orange-700"
        : order.status === "picked_up"
        ? "bg-indigo-100 text-indigo-700"
        : "bg-green-100 text-green-700"
    }
  `}
>
  {order.status.replaceAll("_"," ")}
</span>

          </div>

         <div className="mt-3 flex justify-between items-center">
<p className="text-sm text-gray-500">
  {new Date(order.created_at).toLocaleString()}
</p>
  <p className="font-semibold">
    ₦{Number(order.total).toLocaleString()}
  </p>

  <select
    value={order.status}
    onChange={(e)=>
      updateOrderStatus(
        order.id,
        e.target.value
      )
    }
    className="
      border
      rounded-lg
      px-3
      py-2
    "
  >
    <option value="pending">
      Pending
    </option>

    <option value="accepted">
      Accepted
    </option>

    <option value="preparing">
      Preparing
    </option>

    <option value="ready_for_pickup">
  Ready For Pickup
</option>

<option value="picked_up">
  Picked Up
</option>

    <option value="delivered">
      Delivered
    </option>

  </select>

</div>
        </div>

      ))
    }

  </div>

)}

        {currentTab === "menu" && (

  <div className="bg-white rounded-3xl p-8">

    <div className="flex justify-between items-center mb-6">

      <h2 className="text-2xl font-bold">
        Menu Management
      </h2>

      <button
        onClick={() => {
          setEditingId(null);

          setForm({
            name: "",
            description: "",
            category: "Rice",
            image: "",
            price: "",
            available: true,
          });

          setShowForm(true);
        }}
        className="
          bg-orange-500
          text-white
          px-4
          py-2
          rounded-xl
        "
      >
        Add Item
      </button>

    </div>

    {showForm && (

      <div className="
        border
        rounded-xl
        p-4
        mb-6
        space-y-3
      ">

        <input
          placeholder="Food Name"
          value={form.name}
          onChange={(e) =>
            setForm({
              ...form,
              name: e.target.value,
            })
          }
          className="
            w-full
            border
            p-3
            rounded-lg
          "
        />

        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) =>
            setForm({
              ...form,
              description: e.target.value,
            })
          }
          className="
            w-full
            border
            p-3
            rounded-lg
          "
        />

        <input
          placeholder="Category"
          value={form.category}
          onChange={(e) =>
            setForm({
              ...form,
              category: e.target.value,
            })
          }
          className="
            w-full
            border
            p-3
            rounded-lg
          "
        />

<input
  type="file"
  accept="image/png,image/jpeg,image/jpg"
  onChange={(e)=>{

    const file =
      e.target.files?.[0];

    if(!file) return;

    if(
      file.size >
      5 * 1024 * 1024
    ){

      alert(
        "Image must be less than 5MB"
      );

      return;

    }

    setImageFile(file);

  }}
  className="
    w-full
    border
    p-3
    rounded-lg
  "
/>

        <input
          type="number"
          placeholder="Price"
          value={form.price}
          onChange={(e) =>
            setForm({
              ...form,
              price: e.target.value,
            })
          }
          className="
            w-full
            border
            p-3
            rounded-lg
          "
        />
{imageFile && (

  <img
    src={URL.createObjectURL(imageFile)}
    alt="Preview"
    className="
      w-40
      h-40
      object-cover
      rounded-xl
    "
  />

)}
       <button
  type="button"
  onClick={saveMenuItem}
  className="
    bg-green-600
    text-white
    px-5
    py-2
    rounded-xl
  "
>
  {editingId
    ? "Update Item"
    : "Save Item"}
</button>

      </div>

    )}

    <div className="space-y-3">

      {menuItems.length === 0 ? (

        <p className="text-gray-500">
          No menu items found.
        </p>

      ) : (

        menuItems.map((item) => (

          <div
            key={item.id}
            className="
              border
              rounded-xl
              p-4
              flex
              justify-between
              items-center
            "
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

            <div className="flex gap-2">

              <button
                onClick={() =>
                  toggleAvailability(item)
                }
                className="
                  bg-gray-200
                  px-3
                  py-1
                  rounded
                "
              >
                {item.available
                  ? "Available"
                  : "Out Of Stock"}
              </button>

              <button
                onClick={() =>
                  editMenuItem(item)
                }
                className="
                  bg-blue-500
                  text-white
                  px-3
                  py-1
                  rounded
                "
              >
                Edit
              </button>

              <button
                onClick={() =>
                  deleteMenuItem(item.id)
                }
                className="
                  bg-red-500
                  text-white
                  px-3
                  py-1
                  rounded
                "
              >
                Delete
              </button>

            </div>

          </div>

        ))

      )}

    </div>

  </div>

)}

        {currentTab === "earnings" && (

          <div className="
            bg-white
            rounded-3xl
            p-8
          ">

            <h2 className="
              text-2xl
              font-bold
              mb-2
            ">

              Earnings & Payouts

            </h2>

            <p className="
              text-gray-500
            ">

              Vendor wallet coming next.

            </p>

          </div>

        )}

        {currentTab === "kyc" && (

          <div className="
            bg-white
            rounded-3xl
            p-8
          ">

            <h2 className="
              text-2xl
              font-bold
              mb-2
            ">

              KYC Verification

            </h2>

            <p className="
              text-gray-500
            ">

              KYC module coming next.

            </p>

          </div>

        )}

      </div>

    </main>

  );

}