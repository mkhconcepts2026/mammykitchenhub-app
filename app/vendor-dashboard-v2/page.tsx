"use client";
import VendorSidebar from "@/components/vendor/VendorSidebar";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Tab =
  | "dashboard"
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

  const [currentTab, setCurrentTab] =
  useState<Tab>("dashboard");
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

  const [availableBalance, setAvailableBalance] =
  useState(0);

const [pendingBalance, setPendingBalance] =
  useState(0);

const [totalEarned, setTotalEarned] =
  useState(0);

  const [cacFile, setCacFile] =
  useState<File | null>(null);

const [idFile, setIdFile] =
  useState<File | null>(null);

const [selfieFile, setSelfieFile] =
  useState<File | null>(null);

const [bankName, setBankName] =
  useState("");

const [accountNumber, setAccountNumber] =
  useState("");

  
const [accountName, setAccountName] =
  useState("");

  const [selectedBank, setSelectedBank] =
  useState("");

const [verifiedAccountName,
  setVerifiedAccountName] =
  useState("");

const [verifyingAccount,
  setVerifyingAccount] =
  useState(false);

const [kycStatus, setKycStatus] =
  useState("Not Submitted");

  const [submittingKyc, setSubmittingKyc] =
  useState(false);

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

  function calculateVendorWallet() {

  let available = 0;
  let pending = 0;

  orders.forEach((order) => {

    if (
      order.status === "delivered"
    ) {

      available += Number(
        order.total || 0
      );

    } else {

      pending += Number(
        order.total || 0
      );

    }

  });

  setAvailableBalance(
    available
  );

  setPendingBalance(
    pending
  );

  setTotalEarned(
    available + pending
  );

}

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
async function uploadKycFile(
  file: File,
  folder: string
) {

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const fileName =
    `${user.id}-${Date.now()}-${file.name}`;

  const { error } =
    await supabase.storage
      .from("kyc-documents")
      .upload(
        `${folder}/${fileName}`,
        file
      );

  if (error) {

    console.log(
      "STORAGE ERROR:",
      error
    );

    alert(
      JSON.stringify(error)
    );

    return null;

  }

  const {
    data
  } = supabase.storage
      .from("kyc-documents")
      .getPublicUrl(
        `${folder}/${fileName}`
      );

  return data.publicUrl;

}

  
async function submitKyc() {

  if (submittingKyc) return;

  setSubmittingKyc(true);

  try {

    if (
      !cacFile ||
      !idFile ||
      !selfieFile
    ) {

      alert(
        "Please upload all required documents"
      );

      setSubmittingKyc(false);

      return;

    }

    const cacUrl =
      await uploadKycFile(
        cacFile,
        "cac"
      );

    const idUrl =
      await uploadKycFile(
        idFile,
        "id"
      );

    const selfieUrl =
      await uploadKycFile(
        selfieFile,
        "selfie"
      );

    const {
      data: { user }
    } =
      await supabase.auth.getUser();

    if (!user) {

      setSubmittingKyc(false);

      return;

    }

    const {
      data,
      error
    } =
      await supabase
        .from("vendor_kyc")
        .insert({

          vendor_id: user.id,

          cac_url: cacUrl,

          national_id_url: idUrl,

          selfie_url: selfieUrl,

          bank_name: selectedBank,

          account_number:
            accountNumber,

          account_name:
            verifiedAccountName,

          status: "pending"

        });

    console.log(
      "INSERT DATA:",
      data
    );

    console.log(
      "INSERT ERROR:",
      error
    );

    if (error) {

      alert(error.message);

      setSubmittingKyc(false);

      return;

    }

    setKycStatus(
      "Pending Review"
    );

    alert(
      "Verification submitted successfully"
    );

  } finally {

    setSubmittingKyc(false);

  }

}

async function loadVendorKyc() {

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return;

  const {
    data,
    error
  } = await supabase
    .from("vendor_kyc")
    .select("*")
    .eq("vendor_id", user.id)
    .order(
      "created_at",
      { ascending: false }
    )
    .limit(1);

  if (
    error ||
    !data ||
    data.length === 0
  ) return;

  const kyc = data[0];

  console.log(
    "KYC RECORD:",
    kyc
  );

  setKycStatus(
    kyc.status === "pending"
      ? "Pending Review"
      : kyc.status === "approved"
      ? "Verified"
      : kyc.status
  );

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
  function calculateVendorWallet() {

  let available = 0;
  let pending = 0;

  orders.forEach((order) => {

    if (
      order.status === "delivered"
    ) {

      available += Number(
        order.total || 0
      );

    } else {

      pending += Number(
        order.total || 0
      );

    }

  });

  setAvailableBalance(
    available
  );

  setPendingBalance(
    pending
  );

  setTotalEarned(
    available + pending
  );

}
useEffect(() => {

  loadVendor();

  loadMenuItems();

  loadOrders();

  loadVendorKyc();

}, []);

useEffect(() => {

  calculateVendorWallet();

}, [orders]);


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
      <div className="flex">
        <VendorSidebar
  currentTab={currentTab}
  setCurrentTab={setCurrentTab}
  vendorName={vendorName}
  logout={logout}
/>

      <div className="
  flex-1
  max-w-7xl
  mx-auto
">

<div
  className="
    flex
    justify-between
    items-start
    mb-10
  "
>

  <div>

    {currentTab === "dashboard" && (

      <div>

        <h1 className="text-5xl font-bold mb-2">
          Dashboard
        </h1>

        <p className="text-gray-500 text-lg mb-8">
          Welcome back, {vendorName}
        </p>

        <div
          className="
            grid
            grid-cols-1
            md:grid-cols-2
            xl:grid-cols-4
            gap-4
            mb-8
          "
        >

          <div
            className="
              bg-white
              rounded-3xl
              px-6
              py-5
              shadow-sm
              min-h-[140px]
            "
          >
            <p className="text-gray-500">
              Today's Revenue
            </p>

            <h2 className="text-4xl font-bold mt-2">
              ₦127,500
            </h2>

            <p className="text-green-600 mt-2">
              +12.5% from yesterday
            </p>
          </div>

          <div
            className="
              bg-white
              rounded-3xl
              px-6
              py-5
              shadow-sm
              min-h-[140px]
            "
          >
            <p className="text-gray-500">
              Total Orders
            </p>

            <h2 className="text-4xl font-bold mt-2">
              {orders.length}
            </h2>

            <p className="text-green-600 mt-2">
              Active Orders
            </p>
          </div>

          <div
            className="
              bg-white
              rounded-3xl
              px-6
              py-5
              shadow-sm
              min-h-[140px]
            "
          >
            <p className="text-gray-500">
              Pending Orders
            </p>

            <h2 className="text-4xl font-bold mt-2">
              {
                orders.filter(
                  o => o.status === "pending"
                ).length
              }
            </h2>

            <p className="text-orange-500 mt-2">
              Requires attention
            </p>
          </div>

          <div
            className="
              bg-white
              rounded-3xl
              px-6
              py-5
              shadow-sm
              min-h-[140px]
            "
          >
            <p className="text-gray-500">
              Average Rating
            </p>

            <h2 className="text-4xl font-bold mt-2">
              4.8
            </h2>

            <p className="text-green-600 mt-2">
              +0.2 this week
            </p>
          </div>

        </div>

      </div>

    )}

  </div>

  <button
    onClick={logout}
    className="
      bg-red-500
      text-white
      px-6
      py-3
      rounded-xl
    "
  >
    Logout
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
      bg-white
      rounded-2xl
      shadow-sm
      border
      p-4
      flex
      justify-between
      items-center
      mb-4
    "
  >

    <div className="flex items-center gap-4">

      <img
        src={
          item.image ||
          "/placeholder.jpg"
        }
        alt={item.name}
        className="
          w-24
          h-24
          rounded-xl
          object-cover
        "
      />

      <div>

        <h3 className="
          font-bold
          text-xl
        ">
          {item.name}
        </h3>

        <p className="
          text-gray-500
        ">
          {item.category}
        </p>

        <p className="
          text-orange-600
          font-bold
          text-lg
        ">
          ₦{Number(item.price).toLocaleString()}
        </p>

      </div>

    </div>

    <div className="
      flex
      items-center
      gap-3
    ">

      <button
        onClick={() =>
          toggleAvailability(item)
        }
        className={`
          px-4
          py-2
          rounded-full
          text-sm
          font-semibold
          ${
            item.available
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }
        `}
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
          px-4
          py-2
          rounded-lg
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
          px-4
          py-2
          rounded-lg
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

  <div className="space-y-6">

    <div>

      <h1 className="text-5xl font-bold">
        Earnings & Payouts
      </h1>

      <p className="text-gray-500 text-lg">
        Track your revenue and manage payouts
      </p>

    </div>

    <div className="
      grid
      grid-cols-1
      md:grid-cols-3
      gap-6
    ">

      <div className="
        bg-orange-500
        text-white
        rounded-3xl
        p-6
      ">

        <p className="text-orange-100">
          Available Balance
        </p>

        <h2 className="
          text-4xl
          font-bold
          mt-2
        ">
          ₦{availableBalance.toLocaleString()}
        </h2>

        <button
          className="
            mt-6
            bg-white
            text-orange-500
            px-5
            py-3
            rounded-xl
            font-semibold
          "
        >
          Withdraw Funds
        </button>

      </div>

      <div className="
        bg-white
        rounded-3xl
        p-6
        shadow-sm
      ">

        <p className="text-gray-500">
          Total Earned
        </p>

        <h2 className="
          text-4xl
          font-bold
          mt-2
        ">
          ₦{totalEarned.toLocaleString()}
        </h2>

        <p className="
          text-green-600
          mt-2
        ">
          Lifetime Revenue
        </p>

      </div>

      <div className="
        bg-white
        rounded-3xl
        p-6
        shadow-sm
      ">

        <p className="text-gray-500">
          Pending Payout
        </p>

        <h2 className="
          text-4xl
          font-bold
          mt-2
        ">
          ₦{pendingBalance.toLocaleString()}
        </h2>

        <p className="
          text-orange-500
          mt-2
        ">
          Awaiting Delivery
        </p>

      </div>

    </div>

    <div className="
      bg-white
      rounded-3xl
      p-8
      shadow-sm
    ">

      <h3 className="
        text-2xl
        font-bold
        mb-6
      ">
        Transaction History
      </h3>

      {orders.length === 0 ? (

        <p className="text-gray-500">
          No transactions yet.
        </p>

      ) : (

        orders.map((order) => (

          <div
            key={order.id}
            className="
              border-b
              py-4
              flex
              justify-between
              items-center
            "
          >

            <div>

              <p className="font-semibold">
                Order #{order.id.slice(0,8)}
              </p>

              <p className="text-sm text-gray-500">
                {new Date(
                  order.created_at
                ).toLocaleDateString()}
              </p>

            </div>

            <div className="text-right">

              <p className="
                font-bold
              ">
                ₦{Number(
                  order.total
                ).toLocaleString()}
              </p>

              <p
                className={`
                  text-sm
                  ${
                    order.status ===
                    "delivered"
                      ? "text-green-600"
                      : "text-orange-500"
                  }
                `}
              >
                {order.status}
              </p>

            </div>

          </div>

        ))

      )}

    </div>

  </div>

)}

       {currentTab === "kyc" && (

  <div className="space-y-6">

    <div>

      <h1 className="text-5xl font-bold">
        KYC Verification
      </h1>
{
  kycStatus !== "Not Submitted" && (

    <div
      className="
        bg-yellow-50
        border
        border-yellow-300
        rounded-2xl
        p-6
        mb-6
      "
    >

      <h3 className="font-bold text-xl">

        KYC Status

      </h3>

      <p className="mt-2 text-lg">

        {kycStatus}

      </p>

    </div>

  )
}
      <p className="text-gray-500 text-lg">
        Complete your business verification
      </p>

    </div>

{kycStatus === "Not Submitted" && (
    <div className="
      bg-white
      rounded-3xl
      p-6
      shadow-sm
    ">

      <div className="
        flex
        justify-between
        items-center
        mb-6
      ">

        <h2 className="
          text-2xl
          font-bold
        ">
          Verification Status
        </h2>

        <span
          className="
            bg-yellow-100
            text-yellow-700
            px-4
            py-2
            rounded-full
            font-semibold
          "
        >
          {kycStatus}
        </span>

      </div>
    
      <div className="
        grid
        grid-cols-1
        md:grid-cols-2
        gap-6
      ">

        <div>

          <label className="
            block
            font-semibold
            mb-2
          ">
            CAC Certificate
          </label>

          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(e)=>
              setCacFile(
                e.target.files?.[0] || null
              )
            }
            className="
              w-full
              border
              p-3
              rounded-xl
            "
          />

        </div>

        <div>

          <label className="
            block
            font-semibold
            mb-2
          ">
            National ID
          </label>

          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(e)=>
              setIdFile(
                e.target.files?.[0] || null
              )
            }
            className="
              w-full
              border
              p-3
              rounded-xl
            "
          />

        </div>

        <div>

          <label className="
            block
            font-semibold
            mb-2
          ">
            Selfie Verification
          </label>

          <input
            type="file"
            accept=".png,.jpg,.jpeg"
            onChange={(e)=>
              setSelfieFile(
                e.target.files?.[0] || null
              )
            }
            className="
              w-full
              border
              p-3
              rounded-xl
            "
          />

        </div>

         </div>

    </div>

)}

    <div className="
      bg-white
      rounded-3xl
      p-6
      shadow-sm
    ">

   {kycStatus === "Not Submitted" && (

<div>

  <h2 className="
    text-2xl
    font-bold
    mb-6
  ">
    Bank Account Details
  </h2>

      <div className="
        grid
        grid-cols-1
        md:grid-cols-3
        gap-4
      ">

    <select
  value={selectedBank}
  onChange={(e)=>
    setSelectedBank(
      e.target.value
    )
  }
  className="
    border
    p-4
    rounded-xl
  "
>

  <option value="">
  Select Bank
</option>

<option value="044">
  Access Bank
</option>

<option value="058">
  GTBank
</option>

<option value="011">
  First Bank
</option>

<option value="033">
  UBA
</option>

<option value="057">
  Zenith Bank
</option>

<option value="070">
  Fidelity Bank
</option>

<option value="999992">
  Opay
</option>

<option value="50515">
  Moniepoint
</option>

<option value="999991">
  PalmPay
</option>

</select>

<input
  placeholder="Account Number"
  value={accountNumber}
  onChange={(e)=>
    setAccountNumber(
      e.target.value
    )
  }
  className="
    border
    p-4
    rounded-xl
  "
/>

<div
  className="
    border
    p-4
    rounded-xl
    bg-gray-50
  "
>

  {verifiedAccountName || "Account name will appear here"}

</div>

      </div>

<button
  type="button"
   onClick={async () => {

    if(
      accountNumber.length !== 10
    ){

      alert(
        "Enter a valid 10-digit account number"
      );

      return;

    }

    setVerifyingAccount(true);

try {

  const response =
    await fetch(
      "/api/verify-account",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({

          accountNumber,

          bankCode:
            selectedBank

        })

      }
    );

  const data =
    await response.json();

  if (!data.success) {

    alert(
      data.message ||
      "Verification failed"
    );

    setVerifiedAccountName("");

    return;

  }

  setVerifiedAccountName(
    data.accountName
  );

}
catch(error){

  console.error(error);

  alert(
    "Unable to verify account"
  );

}
finally{

  setVerifyingAccount(false);

}

  }}
  className="
    mt-4
    bg-blue-600
    text-white
    px-6
    py-3
    rounded-xl
    font-semibold
  "
>

  {
    verifyingAccount
      ? "Verifying..."
      : "Verify Account"
  }

</button>

     <button
  onClick={submitKyc}
  disabled={submittingKyc}
  className="
    mt-6
    bg-orange-500
    text-white
    px-6
    py-3
    rounded-xl
    font-semibold
    disabled:opacity-50
    disabled:cursor-not-allowed
  "
>

  {
    submittingKyc
      ? "Submitting..."
      : "Submit Verification"
  }


</button>

</div>

)}

</div>

</div>

)}

      </div> {/* End Main Content */}

    </div> {/* End Flex Layout */}

    </main>

  );

}