"use client";
import VendorSidebar from "@/components/vendor/VendorSidebar";
import VendorDashboardTab from "@/components/vendor/VendorDashboardTab";
import VendorStorefrontCard from "@/components/vendor/VendorStorefrontCard";
import VendorOrdersTab from "@/components/vendor/VendorOrdersTab";
import VendorMenuTab from "@/components/vendor/VendorMenuTab";
import VendorKYCTab from "@/components/vendor/VendorKYCTab";
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

  const [averageRating, setAverageRating] =
    useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadVendorRating() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) return;

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("vendor_id")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError || !profile?.vendor_id) return;

        const { data: summary, error: summaryError } = await supabase
          .from("vendor_review_summary")
          .select("average_rating, review_count")
          .eq("vendor_id", profile.vendor_id)
          .maybeSingle();

        if (cancelled) return;

        if (summaryError || !summary) {
          setAverageRating(null);
          setReviewCount(0);
          return;
        }

        const rating = Number(summary.average_rating);
        const count = Number(summary.review_count);

        setAverageRating(
          Number.isFinite(rating) && count > 0 ? rating : null
        );
        setReviewCount(
          Number.isFinite(count) && count > 0 ? count : 0
        );
      } catch {
        if (!cancelled) {
          setAverageRating(null);
          setReviewCount(0);
        }
      }
    }

    void loadVendorRating();

    return () => {
      cancelled = true;
    };
  }, []);

  const [kitchenImage, setKitchenImage] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoMessage, setPhotoMessage] = useState("");
  const [photoError, setPhotoError] = useState("");

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

const nextFriday = new Date();

while (nextFriday.getDay() !== 5) {
  nextFriday.setDate(
    nextFriday.getDate() + 1
  );
}

const nextFridayText =
  nextFriday.toLocaleDateString(
    "en-NG",
    {
      weekday: "long",
      month: "short",
      day: "numeric"
    }
  );

const [totalEarned, setTotalEarned] =
  useState(0);

const successfulOrders =
  orders.filter(
    (order) =>
      order.status === "delivered"
  ).length;

const [vendorWallet, setVendorWallet] =
  useState<any>(null);

  const [payoutHistory, setPayoutHistory] =
  useState<any[]>([]);

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


const [nextPayoutText, setNextPayoutText] =
  useState("");

const [verifyingAccount,
  setVerifyingAccount] =
  useState(false);

const [kycStatus, setKycStatus] =
  useState("Not Submitted");
const [kycReviewNotes, setKycReviewNotes] = useState("");
const [kycSource, setKycSource] = useState<"application" | "vendor_kyc" | null>(null);
const [kycSourceRecordId, setKycSourceRecordId] = useState("");
const [kycStorePhotoFile, setKycStorePhotoFile] = useState<File | null>(null);
const [kycStorePhotoUploading, setKycStorePhotoUploading] = useState(false);
const [kycStorePhotoMessage, setKycStorePhotoMessage] = useState("");
const [kycStorePhotoError, setKycStorePhotoError] = useState("");

  const [submittingKyc, setSubmittingKyc] =
  useState(false);

  const [isSubmittingPayout, setIsSubmittingPayout] =
  useState(false);
const [isPayoutWindowOpen, setIsPayoutWindowOpen] =
  useState(false);
  const [hasPendingPayout, setHasPendingPayout] =
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
  data: wallet
} =
await supabase
  .from("vendor_wallets")
  .select("*")
  .eq(
    "vendor_id",
    profile.vendor_id
  )
  .single();

setVendorWallet(
  wallet
);

console.log(
  "VENDOR WALLET:",
  wallet
);

const {
  data: pendingRequest
} =
await supabase
  .from("payout_requests")
  .select("id")
  .eq(
    "requester_id",
    profile.vendor_id
  )
  .eq(
    "status",
    "pending"
  )
  .maybeSingle();

setHasPendingPayout(
  !!pendingRequest
);

const {
  data: payouts
} =
await supabase
  .from("payout_requests")
  .select("*")
  .eq(
    "requester_id",
    profile.vendor_id
  )
  .order(
    "requested_at",
    {
      ascending:false
    }
  );

setPayoutHistory(
  payouts || []
);

if (wallet) {

  let availableBalance =
    Number(
      wallet.available_balance || 0
    );

  let pendingBalance =
    Number(
      wallet.accrued_balance || 0
    );

  // Automatically move matured earnings
  // into Available Balance during
  // payout window.

  if (

    isPayoutWindowOpen &&

    pendingBalance > 0

  ) {

    availableBalance +=
      pendingBalance;

    pendingBalance = 0;

  }

  setAvailableBalance(
    availableBalance
  );

  setPendingBalance(
    pendingBalance
  );

  setTotalEarned(
    Number(
      wallet.lifetime_earnings || 0
    )
  );

}

      const {
        data:vendor
      } =
      await supabase
        .from("vendors")
        .select("name,image")
        .eq(
          "id",
          profile.vendor_id
        )
        .single();

      if (vendor?.name) setVendorName(vendor.name);
      setKitchenImage(vendor?.image || "");

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

function checkPayoutWindow() {

  const now = new Date();

  console.log(
  "CURRENT TIME:",
  now.toString()
);

console.log(
  "DAY:",
  now.getDay()
);

console.log(
  "HOUR:",
  now.getHours()
);

  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();

  const fridayOpen =
    day === 5 &&
    hour >= 16;

  const saturdayOpen =
    day === 6;

  const sundayOpen =
    day === 0 &&
    (
      hour < 23 ||
      (
        hour === 23 &&
        minute <= 59
      )
    );

  const payoutWindowOpen =
    fridayOpen ||
    saturdayOpen ||
    sundayOpen;

    console.log(
  "PAYOUT WINDOW:",
  payoutWindowOpen
);

  setIsPayoutWindowOpen(
    payoutWindowOpen
  );

  if (payoutWindowOpen) {

    setNextPayoutText(
      "Withdrawals close Sunday at 11:59 PM"
    );

  } else {

    setNextPayoutText(
      "Next withdrawal window opens Friday at 4:00 PM"
    );

  }

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

    const response = await fetch("/api/vendor/orders", {
      cache: "no-store",
    });
    const result = await response.json();

    if (!response.ok || result?.success !== true) {
      throw new Error(
        typeof result?.message === "string"
          ? result.message
          : "Unable to load vendor orders."
      );
    }

    setOrders(Array.isArray(result.orders) ? result.orders : []);

  }

  catch(error){

    console.error(error);

  }

  finally{

    setLoadingOrders(false);

  }

}


async function updateOrderStatus(
  orderId: string,
  status: string
) {
  const vendorAllowedStatuses = [
    "accepted",
    "preparing",
    "ready_for_pickup",
    "cancelled",
  ];

  if (!vendorAllowedStatuses.includes(status)) {
    console.warn(
      "Vendor attempted unauthorized order status:",
      status
    );

    alert(
      "This order status is controlled by the rider or system."
    );

    return;
  }

  try {
    const { data, error } = await supabase.rpc(
      "vendor_update_order_status",
      {
        p_order_id: orderId,
        p_status: status,
      }
    );

    if (error) {
      console.error(
        "VENDOR ORDER STATUS RPC ERROR:",
        error
      );

      alert(
        error.message ||
          "Unable to update order status."
      );

      return;
    }

    if (!data?.success) {
      console.error(
        "VENDOR ORDER STATUS UNCONFIRMED:",
        data
      );

      alert(
        "The order status update could not be confirmed."
      );

      return;
    }

    await loadOrders();
  } catch (error) {
    console.error(
      "UPDATE ORDER STATUS ERROR:",
      error
    );

    alert(
      "Unable to update order status."
    );
  }
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
  folder: string,
  bucket = "kyc-documents"
) {

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const originalName = file.name.trim();
  const lastDot = originalName.lastIndexOf(".");
  const rawBaseName = lastDot > 0 ? originalName.slice(0, lastDot) : originalName;
  const rawExtension = lastDot > 0 ? originalName.slice(lastDot + 1) : "";
  const safeBaseName = rawBaseName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "upload";
  const safeExtension = rawExtension
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
  const safeFileName = safeExtension
    ? `${safeBaseName}.${safeExtension}`
    : safeBaseName;
  const fileName =
    `${user.id}-${Date.now()}-${safeFileName}`;

  const { error } =
    await supabase.storage
      .from(bucket)
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

  // Private bucket: persist an object path, never a public URL.
  return `${folder}/${fileName}`;

}

  
async function submitKyc(files?: { cacFile: File; idFile: File; selfieFile: File; kitchenPhotoFile: File }) {
  if (submittingKyc) return;
  setSubmittingKyc(true);

  try {
    const submittedCacFile = files?.cacFile ?? cacFile;
    const submittedIdFile = files?.idFile ?? idFile;
    const submittedSelfieFile = files?.selfieFile ?? selfieFile;
    const submittedKitchenPhotoFile = files?.kitchenPhotoFile;
    if (!submittedCacFile || !submittedIdFile || !submittedSelfieFile || !submittedKitchenPhotoFile) {
      alert("Please upload the corrected CAC certificate, National ID, selfie and kitchen photo.");
      return;
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      alert("Your session could not be verified. Please sign in again.");
      return;
    }

    const statusResponse = await fetch("/api/vendor/kyc-status", { cache: "no-store" });
    const statusResult = await statusResponse.json().catch(() => ({}));
    if (
      !statusResponse.ok ||
      !statusResult?.success ||
      !["Rejected", "Requires Attention"].includes(String(statusResult.status)) ||
      !["application", "vendor_kyc"].includes(String(statusResult.source)) ||
      typeof statusResult.sourceRecordId !== "string"
    ) {
      alert("Resubmission is only available for a rejected KYC submission. Refresh the page and try again.");
      return;
    }

    const isApplicationSource = statusResult.source === "application";
    const bucket = isApplicationSource ? "vendor-documents" : "kyc-documents";
    const cacFolder = "cac";
    const idFolder = isApplicationSource ? "ids" : "id";
    const selfieFolder = isApplicationSource ? "selfies" : "selfie";

    const cacPath = await uploadKycFile(submittedCacFile, cacFolder, bucket);
    if (!cacPath) return;
    const idPath = await uploadKycFile(submittedIdFile, idFolder, bucket);
    if (!idPath) return;
    const selfiePath = await uploadKycFile(submittedSelfieFile, selfieFolder, bucket);
    if (!selfiePath) return;

    let kitchenPhotoPath: string | null = null;
    if (isApplicationSource) {
      if (
        !["image/png", "image/jpeg"].includes(submittedKitchenPhotoFile.type) ||
        submittedKitchenPhotoFile.size > 5 * 1024 * 1024
      ) {
        alert("The kitchen photo must be a PNG or JPG image no larger than 5 MB.");
        return;
      }
      const safePhotoName = submittedKitchenPhotoFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const photoStoragePath = `kitchens/${user.id}/${user.id}-${Date.now()}-${safePhotoName}`;
      const { error: photoUploadError } = await supabase.storage
        .from("vendor-kitchen-images")
        .upload(photoStoragePath, submittedKitchenPhotoFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: submittedKitchenPhotoFile.type,
        });
      if (photoUploadError) {
        console.error("Kitchen photo upload failed:", photoUploadError);
        alert(`Kitchen photo upload failed: ${photoUploadError.message}`);
        return;
      }
      kitchenPhotoPath = photoStoragePath;
    }
    if (!selfiePath) return;

    const response = await fetch("/api/vendor/kyc-resubmit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: statusResult.source,
        sourceRecordId: statusResult.sourceRecordId,
        cacPath,
        idPath,
        selfiePath,
        kitchenPhotoPath,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.success) {
      alert(typeof result?.message === "string" ? result.message : "The corrected documents could not be submitted. Please try again.");
      return;
    }

    setKycStatus("Pending Review");
    setKycReviewNotes("");
    await loadVendorKyc();
    alert("Corrected documents submitted successfully. Your KYC status is now Pending Review.");
  } catch (error) {
    console.error("KYC resubmission error:", error);
    alert("We could not complete the resubmission. Please check your connection and try again.");
  } finally {
    setSubmittingKyc(false);
  }
}

async function uploadKycStorePhoto() {
  if (kycStorePhotoUploading) return;
  setKycStorePhotoError("");
  setKycStorePhotoMessage("");

  const file = kycStorePhotoFile;
  if (!file) {
    setKycStorePhotoError("Choose a store photo first.");
    return;
  }
  if (!kycSource || !kycSourceRecordId) {
    setKycStorePhotoError("The current KYC submission could not be identified. Refresh the dashboard and try again.");
    return;
  }
  if (!["image/png", "image/jpeg"].includes(file.type)) {
    setKycStorePhotoError("Choose a PNG or JPG image.");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    setKycStorePhotoError("The store photo must be 5 MB or smaller.");
    return;
  }
  if (["Verified", "Rejected"].includes(kycStatus)) {
    setKycStorePhotoError("For a rejected KYC submission, use the corrected-document resubmission workflow. Verified submissions require support to change.");
    return;
  }

  setKycStorePhotoUploading(true);
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Please sign in again.");

    const form = new FormData();
    form.set("file", file);
    form.set("source", kycSource);
    form.set("sourceRecordId", kycSourceRecordId);

    const response = await fetch("/api/vendor/kyc-store-photo", {
      method: "POST",
      body: form,
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.success) {
      throw new Error(result?.message || "The store photo could not be saved to your KYC submission.");
    }

    setKycStorePhotoFile(null);
    setKycStorePhotoMessage("Store photo saved to your current KYC submission. It remains subject to review.");
    await loadVendorKyc();
  } catch (error) {
    setKycStorePhotoError(error instanceof Error ? error.message : "Could not upload the store photo.");
  } finally {
    setKycStorePhotoUploading(false);
  }
}
async function loadStorefrontProfile() {
  try {
    const response = await fetch("/api/vendor/storefront-photo", { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.success) {
      console.error("Storefront profile load failed:", result?.message || response.status);
      return;
    }
    if (typeof result.vendorName === "string" && result.vendorName.trim()) {
      setVendorName(result.vendorName);
    }
    setKitchenImage(typeof result.image === "string" ? result.image : "");
  } catch (error) {
    console.error("Unable to load storefront profile:", error);
  }
}
async function loadVendorKyc() {
  try {
    // Wait for the browser session before requesting the server-side KYC status.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) return;

    // The API independently verifies the server-side session.
    const response = await fetch("/api/vendor/kyc-status", { cache: "no-store" });
    if (!response.ok) {
      console.error("KYC status request failed:", response.status);
      return;
    }
    const result = await response.json();
    if (result?.success && typeof result.status === "string") {
      setKycStatus(result.status || "Not Submitted");
      setKycReviewNotes(typeof result.reviewNotes === "string" ? result.reviewNotes : "");
      setKycSource(result.source === "application" || result.source === "vendor_kyc" ? result.source : null);
      setKycSourceRecordId(typeof result.sourceRecordId === "string" ? result.sourceRecordId : "");
    }
  } catch (error) {
    console.error("Unable to load vendor KYC status:", error);
  }
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

  async function handleKitchenPhotoChange(
  event: React.ChangeEvent<HTMLInputElement>
) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  setPhotoMessage("");
  setPhotoError("");
  if (!["image/png", "image/jpeg"].includes(file.type)) {
    setPhotoError("Choose a PNG or JPG image.");
    return;
  }
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
    setPhotoError("The image must be no larger than 5 MB.");
    return;
  }

  setPhotoUploading(true);
  try {
    const form = new FormData();
    form.set("file", file);
    const response = await fetch("/api/vendor/storefront-photo", {
      method: "POST",
      body: form,
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.success) {
      throw new Error(result?.message || "Could not update the storefront photo.");
    }

    if (typeof result.image === "string") setKitchenImage(result.image);
    if (typeof result.vendorName === "string") setVendorName(result.vendorName);
    setPhotoMessage("Storefront photo updated successfully.");
  } catch (error) {
    setPhotoError(error instanceof Error ? error.message : "Could not update the storefront photo.");
  } finally {
    setPhotoUploading(false);
  }
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

async function requestPayout() {

  try {

    setIsSubmittingPayout(true);

    const {
      data:{ user }
    } =
    await supabase
      .auth
      .getUser();

    if(!user){

      return;

    }

    const {
      data: profile
    } =
    await supabase
      .from("profiles")
      .select("vendor_id")
      .eq(
        "id",
        user.id
      )
      .single();

    if(
      !profile?.vendor_id
    ){

      alert(
        "Vendor not found"
      );

      return;

    }

    const {
      data: existingRequest
    } =
    await supabase
      .from(
        "payout_requests"
      )
      .select("id")
      .eq(
        "requester_id",
        profile.vendor_id
      )
      .eq(
        "status",
        "pending"
      )
      .maybeSingle();

    if(existingRequest){

      alert(
        "You already have a pending payout request awaiting approval."
      );

      return;

    }

    const {
      error
    } =
    await supabase
      .from(
        "payout_requests"
      )
      .insert({

        requester_id:
          profile.vendor_id,

        requester_type:
          "vendor",

        amount:
          pendingBalance,

        status:
          "pending"

      });

    if(error){

      console.error(
        "PAYOUT ERROR:",
        error
      );

      alert(
        JSON.stringify(error)
      );

      return;

    }

    alert(
      "Payout request submitted"
    );

   

  }

  catch(error){

    console.error(
      error
    );

  }

  finally{

    setIsSubmittingPayout(
      false
    );

  }

}
useEffect(() => {

  checkPayoutWindow();

  loadVendor();

  loadMenuItems();

  loadOrders();

  loadStorefrontProfile();
  loadVendorKyc();

}, []);


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

    <main className="min-h-screen bg-[#eef2f7] text-[#0b1220]">
      <div className="flex min-h-screen">
        <VendorSidebar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          vendorName={vendorName}
          logout={logout}
        />

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex min-h-[88px] items-center justify-between gap-4 border-b border-slate-200/80 bg-white/95 px-5 py-4 backdrop-blur-xl md:px-8">
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-[#ff6b00]">
                Mammy Kitchen Hub
              </p>
              <h1 className="mt-1 truncate text-xl font-extrabold tracking-tight text-[#0b1220] md:text-2xl">
                Vendor Workspace
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 sm:inline-flex">
                Store Operations
              </span>
              <button type="button" onClick={logout} className="rounded-xl bg-[#ff6b00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#e65f00] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200">Logout</button>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0b1220] text-sm font-bold text-white" aria-label="Vendor account">
                {(vendorName || "V").slice(0, 1).toUpperCase()}
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1500px] p-4 md:p-8">
            {currentTab === "dashboard" && (
              <>

<VendorDashboardTab vendorName={vendorName} orders={orders} averageRating={averageRating} reviewCount={reviewCount} />
              <VendorStorefrontCard
                vendorName={vendorName}
                image={kitchenImage}
                uploading={photoUploading}
                message={photoMessage}
                error={photoError}
                onPhotoChange={handleKitchenPhotoChange}
              />

              </>)}

        {currentTab === "orders" && (
          <VendorOrdersTab
            orders={orders}
            loadingOrders={loadingOrders}
            updateOrderStatus={updateOrderStatus}
          />
        )}
        {currentTab === "menu" && (
          <VendorMenuTab
            menuItems={menuItems}
            showForm={showForm}
            setShowForm={setShowForm}
            editingId={editingId}
            setEditingId={setEditingId}
            form={form}
            setForm={setForm}
            imageFile={imageFile}
            setImageFile={setImageFile}
            saveMenuItem={saveMenuItem}
            editMenuItem={editMenuItem}
            deleteMenuItem={deleteMenuItem}
            toggleAvailability={toggleAvailability}
          />
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

  <div
  className="
    bg-orange-500
    text-white
    rounded-3xl
    p-6
  "
>

  <p className="text-orange-100">
    Available for Withdrawal
  </p>

  <h2
    className="
      text-4xl
      font-bold
      mt-2
    "
  >
    ₦{pendingBalance.toLocaleString()}
  </h2>

  <p
    className="
      text-orange-100
      mt-2
    "
  >
    {
      isPayoutWindowOpen

        ? "Withdrawal window is open"

        : "Withdrawal window opens Friday 4PM"
    }
  </p>

  <button
    onClick={requestPayout}
    disabled={
      !isPayoutWindowOpen ||
      isSubmittingPayout ||
      pendingBalance <= 0 ||
      hasPendingPayout
    }
    className={`
      mt-6
      px-5
      py-3
      rounded-xl
      font-semibold
      w-full

      ${
        hasPendingPayout

          ? "bg-blue-100 text-blue-600 cursor-not-allowed"

          : isPayoutWindowOpen

          ? "bg-white text-orange-500"

          : "bg-gray-300 text-gray-500 cursor-not-allowed"
      }
    `}
  >

    {

      isSubmittingPayout

        ? "Submitting..."

        : hasPendingPayout

        ? "Payout Request Submitted"

        : isPayoutWindowOpen

        ? "Withdraw Funds"

        : "Available Friday 4PM - Sunday 11:59PM"

    }

  </button>

</div>

<div className="
  bg-white
  rounded-3xl
  p-6
  shadow-sm
">

  <p className="text-gray-500">
   Lifetime Earnings
  </p>

  <h2 className="
    text-4xl
    font-bold
    mt-2
  ">
    ₦{totalEarned.toLocaleString()}
  </h2>

  <p className="
    text-blue-600
    mt-2
  ">
    Total revenue earned on MKH
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

  <p
    className={`
      mt-2
      ${
        isPayoutWindowOpen
          ? "text-green-600"
          : "text-orange-500"
      }
    `}
  >
    Available on {nextFridayText}
  </p>

</div>

    </div>

    <div className="
  bg-white
  rounded-3xl
  p-6
  shadow-sm
">

  <p className="text-gray-500">
    Successful Orders
  </p>

  <h2 className="
    text-4xl
    font-bold
    mt-2
  ">
    {successfulOrders}
  </h2>

  <p className="
    text-green-600
    mt-2
  ">
    Completed Deliveries
  </p>

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

{currentTab === "earnings" && (
<div
  className="
    bg-white
    rounded-3xl
    p-8
    shadow-sm
    mt-8
  "
>

  <h3
    className="
      text-2xl
      font-bold
      mb-6
    "
  >
    Withdrawal History
  </h3>

  {payoutHistory.length === 0 ? (

    <p className="text-gray-500">
      No withdrawal requests yet.
    </p>

  ) : (

    payoutHistory.map((payout) => (

      <div
        key={payout.id}
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
            ₦{Number(
              payout.amount
            ).toLocaleString()}
          </p>

          <p className="text-sm text-gray-500">
            {new Date(
              payout.requested_at
            ).toLocaleDateString()}
          </p>

        </div>

        <div>

          <span
            className={`
              px-3
              py-2
              rounded-full
              text-xs
              font-semibold

              ${
                payout.status === "pending"
                  ? "bg-orange-100 text-orange-700"
                  : payout.status === "approved"
                  ? "bg-blue-100 text-blue-700"
                  : payout.status === "processing"
                  ? "bg-purple-100 text-purple-700"
                  : payout.status === "paid"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }
            `}
          >
            {payout.status.toUpperCase()}
          </span>

        </div>

      </div>

    ))

  )}

</div>
)}

       {currentTab === "kyc" && (
  <>
    <VendorKYCTab kycStatus={kycStatus} reviewNotes={kycReviewNotes} onResubmit={submitKyc} submitting={submittingKyc} />
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold">Vendor Store Photo</h2>
      <p className="mt-1 text-sm text-slate-600">
        Upload a PNG or JPG photo of your store for KYC review. This updates the current KYC submission only; it does not change your verification status or storefront image.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="file"
          accept="image/png,image/jpeg"
          disabled={kycStorePhotoUploading}
          className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:font-semibold"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            event.target.value = "";
            setKycStorePhotoFile(file);
            setKycStorePhotoMessage("");
            setKycStorePhotoError("");
          }}
        />
        <button
          type="button"
          onClick={() => void uploadKycStorePhoto()}
          disabled={!kycStorePhotoFile || !kycSource || !kycSourceRecordId || kycStorePhotoUploading || ["Verified", "Rejected"].includes(kycStatus)}
          className="shrink-0 rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {kycStorePhotoUploading ? "Uploadingâ€¦" : "Upload Store Photo"}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">PNG or JPG, maximum 5 MB. Photo-only updates are for submissions awaiting review; rejected submissions must use the corrected-document resubmission flow.</p>
      {kycStorePhotoMessage && <p role="status" className="mt-3 text-sm font-medium text-green-700">{kycStorePhotoMessage}</p>}
      {kycStorePhotoError && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{kycStorePhotoError}</p>}
    </section>
  </>
)}

          </div> {/* End Page Content */}
        </div> {/* End Main Content */}
      </div> {/* End Flex Layout */}
    </main>

  );

}
