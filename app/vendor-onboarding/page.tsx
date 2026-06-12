"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function VendorOnboarding() {
  const [step, setStep] = useState(1);

   const totalSteps = 10;

const progress =
  Math.round((step / totalSteps) * 100);

  const stepTitles = [
  "",
  "Choose Vendor Type",
  "Kitchen Information",
  "Email Verification",
  "Business Information",
  "Create Vendor Account",
  "Bank Verification",
  "KYC Verification",
  "Review Application",
  "Submitting Application",
  "Completed"
];

const [emailOtp, setEmailOtp] = useState("");
const [generatedOtp, setGeneratedOtp] = useState("");
const [emailVerified, setEmailVerified] = useState(false);
const [sendingOtp, setSendingOtp] = useState(false);
const [showPassword, setShowPassword] =
  useState(false);
  
  const [slugAvailable, setSlugAvailable] =
  useState<boolean | null>(null);

const [showConfirmPassword, setShowConfirmPassword] =
  useState(false);
const [vendorData, setVendorData] = useState<{

  vendorType: string;

  kitchenName: string;

  phone: string;

  email: string;

  address: string;

  ownerName: string;

  ownerPhone: string;

  ownerEmail: string;

  storeSlug: string;

  password: string;

  confirmPassword: string;

  authUserId: string;

  bankCode: string;

  accountNumber: string;

  accountName: string;

  cacFile: File | null;

  idFile: File | null;

  selfieFile: File | null;

  kitchenPhoto: File | null;

}>({

  vendorType: "",

  kitchenName: "",

  phone: "",

  email: "",

  address: "",

  ownerName: "",

  ownerPhone: "",

  ownerEmail: "",

  storeSlug: "",

  password: "",

  confirmPassword: "",

  authUserId: "",

  bankCode: "",

  accountNumber: "",

  accountName: "",

  cacFile: null,

  idFile: null,

  selfieFile: null,

  kitchenPhoto: null,

});

const [verifyingAccount, setVerifyingAccount] =
  useState(false);

const [submittingKyc, setSubmittingKyc] =
  useState(false);

const sendOtp = async () => {

  if (!vendorData.email) {

    alert("Please enter an email address");

    return;

  }

  setSendingOtp(true);

  const otp =
    Math.floor(
      100000 + Math.random() * 900000
    ).toString();

  setGeneratedOtp(otp);

  console.log("OTP:", otp);

  alert(
    `Development OTP: ${otp}`
  );

  setStep(4);

  setSendingOtp(false);

};

  return (
    <main
      className="
        min-h-screen
        bg-orange-50
        flex
        items-center
        justify-center
        p-6
      "
    >
      <div
        className="
          w-full
          max-w-6xl
          bg-white
          rounded-3xl
          shadow-lg
          overflow-hidden
          grid
          grid-cols-2
        "
      >
        {/* Left Side */}

        <div
          className="
            bg-orange-100
            p-10
            flex
            flex-col
            items-center
            justify-center
          "
        >
          <div
  className="
    text-8xl
    mb-6
    animate-pulse
  "
>
{
  step === 1
    ? "👨‍🍳"
  : step === 2
    ? "🍽️"
  : step === 3
    ? "🏢"
  : step === 4
    ? "📧"
  : step === 5
    ? "🏪"
  : step === 6
    ? "👤"
  : step === 7
    ? "🏦"
  : step === 8
    ? "🪪"
  : step === 9
    ? "✅"
  : "🚀"
}

</div>

<h1 className="text-5xl font-bold mb-6">

  {
  step === 1
    ? "Tell Us About Your Kitchen"
  : step === 2
    ? "Kitchen Information"
  : step === 3
    ? "Business Information"
  : step === 4
    ? "Verify Your Email"
  : step === 5
    ? "Create Your Store"
  : step === 6
    ? "Owner Information"
  : step === 7
    ? "Verify Bank Account"
  : step === 8
    ? "KYC Verification"
  : step === 9
    ? "Review Application"
  : "Your Business Journey Starts Here"
}

</h1>

<p className="text-gray-600 text-xl">

  {
  step === 1
    ? "Choose the type of food business you operate."
  : step === 2
    ? "Help customers discover your kitchen."
  : step === 3
    ? "Provide your business information."
  : step === 4
    ? "Verify ownership of your email address."
  : step === 5
    ? "Create your vendor login credentials."
  : step === 6
    ? "Tell us about the owner of this business."
  : step === 7
    ? "Verify your payout account."
  : step === 8
    ? "Upload documents for compliance review."
  : step === 9
    ? "Review everything before submission."
  :  "You're one step away from joining the Mammy Kitchen Hub marketplace."
}

</p>
<div
  className="
    mt-10
    bg-white
    rounded-2xl
    p-6
    shadow-sm
    w-full
    max-w-md
  "
>

  <h3 className="font-bold mb-4">
    Your Progress
  </h3>

  <div className="space-y-3 text-left">

    <div>
      {step >= 1 ? "✅" : "○"} Vendor Type
    </div>

    <div>
      {step >= 2 ? "✅" : "○"} Kitchen Information
    </div>

    <div>
      {step >= 3 ? "✅" : "○"} Business Information
    </div>

    <div>
      {step >= 4 ? "✅" : "○"} Email Verification
    </div>

    <div>
      {step >= 5 ? "✅" : "○"} Vendor Account
    </div>

    <div>
      {step >= 6 ? "✅" : "○"} Owner Information
    </div>

    <div>
      {step >= 7 ? "✅" : "○"} Bank Verification
    </div>

    <div>
      {step >= 8 ? "✅" : "○"} KYC Verification
    </div>

    <div>
      {step >= 9 ? "✅" : "○"} Review Application
    </div>

  </div>

</div>
        </div>

        {/* Right Side */}

        <div
          className="
            p-12
            flex
            flex-col
            justify-center
          "
        >
            {step > 1 && step < 10 && (

  <button
    onClick={() => setStep(step - 1)}
    className="
      mb-8
      text-orange-500
      font-semibold
      text-left
    "
  >
    ← Previous Step
  </button>

)}


          {step === 1 && (
            <>
              <div className="mb-8">
                <div className="flex gap-3 mb-8">
                  <div className="w-4 h-4 rounded-full bg-orange-500" />
                  <div className="w-4 h-4 rounded-full bg-orange-200" />
                  <div className="w-4 h-4 rounded-full bg-orange-200" />
                  <div className="w-4 h-4 rounded-full bg-orange-200" />
                  <div className="w-4 h-4 rounded-full bg-orange-200" />
                  <div className="w-4 h-4 rounded-full bg-orange-200" />
                </div>

                <h1 className="text-5xl font-bold mb-4">
                  Welcome
                </h1>

                <p className="text-xl text-gray-500">
                  Let's get your kitchen onboarded.
                </p>
              </div>

              <button
                onClick={() => setStep(2)}
                className="
                  bg-orange-500
                  text-white
                  py-4
                  rounded-2xl
                  font-bold
                  text-lg
                "
              >
                Get Started
              </button>
            </>
          )}

        {step === 2 && (

  <div>

    <div className="flex gap-3 mb-8">

      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-200" />
      <div className="w-4 h-4 rounded-full bg-orange-200" />
      <div className="w-4 h-4 rounded-full bg-orange-200" />
      <div className="w-4 h-4 rounded-full bg-orange-200" />

    </div>

    <h1 className="text-4xl font-bold mb-3">
      Select Vendor Type
    </h1>

    <p className="text-gray-500 mb-8">
      Tell us what type of food business you operate.
    </p>

    <div className="space-y-4">

      <button
        onClick={() => {

  setVendorData({
    ...vendorData,
    vendorType: "Kitchen / Restaurant"
  });

  setStep(3);

}}
        className="
          w-full
          border-2
          border-gray-200
          hover:border-orange-500
          p-6
          rounded-2xl
          text-left
          transition
        "
      >
        <h3 className="font-bold text-xl">
          🍲 Kitchen / Restaurant
        </h3>

        <p className="text-gray-500 mt-2">
          Restaurants, cloud kitchens, catering services.
        </p>
      </button>

      <button
        onClick={() => {

  setVendorData({
    ...vendorData,
    vendorType: "Home Food Vendor"
  });

  setStep(3);

}}
        className="
          w-full
          border-2
          border-gray-200
          hover:border-orange-500
          p-6
          rounded-2xl
          text-left
          transition
        "
      >
        <h3 className="font-bold text-xl">
          🧁 Home Food Vendor
        </h3>

        <p className="text-gray-500 mt-2">
          Small-scale food sellers operating from home.
        </p>
      </button>

      <button
        onClick={() => {

  setVendorData({
    ...vendorData,
    vendorType: "Drinks & Beverages"
  });

  setStep(3);

}}
        className="
          w-full
          border-2
          border-gray-200
          hover:border-orange-500
          p-6
          rounded-2xl
          text-left
          transition
        "
      >
        <h3 className="font-bold text-xl">
          🍹 Drinks & Beverages
        </h3>

        <p className="text-gray-500 mt-2">
          Smoothies, cocktails, juice bars and beverage vendors.
        </p>
      </button>

    </div>

  </div>

)}
{step === 3 && (

  <div>

    <div className="flex gap-3 mb-8">

      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-200" />
      <div className="w-4 h-4 rounded-full bg-orange-200" />
      <div className="w-4 h-4 rounded-full bg-orange-200" />

    </div>

    <h1 className="text-4xl font-bold mb-6">
      Kitchen Information
    </h1>
<p className="text-orange-500 font-bold mb-4">
  Vendor Type: {vendorData.vendorType}
</p>
    <div className="space-y-4">

      <input
  value={vendorData.kitchenName}
  onChange={(e) =>
    setVendorData({
      ...vendorData,
      kitchenName: e.target.value
    })
  }
  placeholder="Kitchen Name"
        className="
          w-full
          border
          p-4
          rounded-xl
        "
      />

      <input
  value={vendorData.phone}
  onChange={(e) =>
    setVendorData({
      ...vendorData,
      phone: e.target.value
    })
  }
  placeholder="Phone Number"
        className="
          w-full
          border
          p-4
          rounded-xl
        "
      />

      <input
  value={vendorData.email}
  onChange={(e) =>
    setVendorData({
      ...vendorData,
      email: e.target.value
    })
  }
  placeholder="Email Address"
        className="
          w-full
          border
          p-4
          rounded-xl
        "
      />

     <input
  value={vendorData.address}
  onChange={(e) =>
    setVendorData({
      ...vendorData,
      address: e.target.value
    })
  }
  placeholder="Business Address"
        className="
          w-full
          border
          p-4
          rounded-xl
        "
      />

      <button
        onClick={sendOtp}
        className="
          w-full
          bg-orange-500
          text-white
          py-4
          rounded-xl
          font-bold
        "
      >
        Continue
      </button>

    </div>

  </div>

)}
{step === 4 && (

  <div>

    {/* Progress */}

    <div className="flex gap-3 mb-8">

      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-200" />
      <div className="w-4 h-4 rounded-full bg-orange-200" />

    </div>

    <button
      onClick={() => setStep(3)}
      className="
        text-orange-500
        font-bold
        mb-6
      "
    >
      
    </button>

    <h1 className="text-4xl font-bold mb-3">
      Verify Email Address
    </h1>

    <p className="text-gray-500 mb-8">
      Enter the verification code sent to your email.
    </p>

    <div className="space-y-4">

      <input
        value={vendorData.email}
        readOnly
        className="
          w-full
          border
          p-4
          rounded-xl
          bg-gray-100
        "
      />

      <input
        placeholder="Enter OTP Code"
        value={emailOtp}
        onChange={(e)=>
          setEmailOtp(e.target.value)
        }
        className="
          w-full
          border
          p-4
          rounded-xl
        "
      />

      <button
        onClick={() => {

          if (
            emailOtp === generatedOtp
          ) {

            setEmailVerified(true);

            alert(
              "Email verified successfully"
            );

            setStep(5);

          } else {

            alert(
              "Invalid OTP"
            );

          }

        }}
        className="
          w-full
          bg-orange-500
          text-white
          py-4
          rounded-xl
          font-bold
        "
      >
        Verify Email
      </button>

      <button
        onClick={sendOtp}
        className="
          w-full
          border
          py-4
          rounded-xl
          font-bold
        "
      >
        Resend OTP
      </button>

    </div>

  </div>

)}
{step === 5 && (

  <div>

    <div className="mb-8">

  <div className="flex justify-between mb-2">

    <span className="text-sm font-medium">
      Onboarding Progress
    </span>

    <span className="text-sm font-bold text-orange-500">
      {progress}%
    </span>

  </div>

  <div
    className="
      w-full
      h-3
      bg-gray-200
      rounded-full
      overflow-hidden
    "
  >

    <div
      className="
        h-full
        bg-orange-500
        transition-all
        duration-700
      "
      style={{
        width: `${progress}%`
      }}
    />

  </div>

  <p className="text-gray-500 text-sm mt-2">

    {stepTitles[step]}

  </p>

</div>


    <h1 className="text-4xl font-bold mb-3">
      Create Vendor Account
    </h1>

    <p className="text-gray-500 mb-8">
      Create your MKH login credentials.
    </p>

    <div className="space-y-4">


      <input
        placeholder="Store URL (e.g. mamas-kitchen)"
        value={vendorData.storeSlug}
       onChange={async (e) => {

  const slug = e.target.value
    .toLowerCase()
    .replace(/\s+/g, "-");

  setVendorData({
    ...vendorData,
    storeSlug: slug
  });

  if (!slug) {

    setSlugAvailable(null);

    return;

  }

  const { data } = await supabase
    .from("vendors")
    .select("id")
    .eq("slug", slug);

  setSlugAvailable(
    !data || data.length === 0
  );

}}
        className="
          w-full
          border
          p-4
          rounded-xl
        "
      />
<div
  className="
    bg-orange-50
    border
    border-orange-200
    rounded-xl
    p-4
    text-sm
  "
>

  <div>
    Your store URL:
  </div>

  <div className="font-bold text-orange-600 mt-1">
    https://mammykitchenhub.com/store/
    {vendorData.storeSlug || "your-store"}
  </div>
<div
  className="
    bg-white
    border
    rounded-2xl
    p-5
    shadow-sm
    mt-4
  "
>

  <div className="font-bold text-lg mb-3">
    🏪 Store Preview
  </div>

  <div className="font-semibold text-orange-600">
    {vendorData.kitchenName || "Your Kitchen"}
  </div>

  <div className="text-sm text-gray-500 mt-1">
    https://mammykitchenhub.com/store/
    {vendorData.storeSlug || "your-store"}
  </div>

  <div className="mt-4 space-y-2 text-sm">

    <div>✅ Email Verified</div>

    <div>✅ Phone Verified</div>

    <div>🚀 Ready For Approval</div>

  </div>

</div>
  {slugAvailable === true && (

    <div className="text-green-600 mt-2">

      ✅ Store URL available

    </div>

  )}

  {slugAvailable === false && (

    <div className="text-red-600 mt-2">

      ❌ Store URL already taken

    </div>

  )}

</div>

      <div className="relative">

  <input
    type={showPassword ? "text" : "password"}
    placeholder="Password"
    value={vendorData.password}
    onChange={(e)=>
      setVendorData({
        ...vendorData,
        password: e.target.value
      })
    }
    className="
      w-full
      border
      p-4
      rounded-xl
      pr-14
    "
  />

  <button
    type="button"
    onClick={() =>
      setShowPassword(!showPassword)
    }
    className="
      absolute
      right-4
      top-1/2
      -translate-y-1/2
      text-gray-500
    "
  >
    {showPassword ? "🙈" : "👁️"}
  </button>

</div>

      <div className="relative">

  <input
    type={showConfirmPassword ? "text" : "password"}
    placeholder="Confirm Password"
    value={vendorData.confirmPassword}
    onChange={(e)=>
      setVendorData({
        ...vendorData,
        confirmPassword: e.target.value
      })
    }
    className="
      w-full
      border
      p-4
      rounded-xl
      pr-14
    "
  />

  <button
    type="button"
    onClick={() =>
      setShowConfirmPassword(
        !showConfirmPassword
      )
    }
    className="
      absolute
      right-4
      top-1/2
      -translate-y-1/2
      text-gray-500
    "
  >
    {showConfirmPassword ? "🙈" : "👁️"}
  </button>

</div>

      
      <div
  className="
    bg-gray-100
    rounded-full
    h-2
    overflow-hidden
  "
>

  <div
    className={`
      h-full
      transition-all
      ${
        vendorData.password.length < 6
          ? "w-1/4 bg-red-500"
          : vendorData.password.length < 8
          ? "w-2/4 bg-yellow-500"
          : vendorData.password.length < 12
          ? "w-3/4 bg-blue-500"
          : "w-full bg-green-500"
      }
    `}
  />

</div>

<p className="text-sm text-gray-500">

  {
    vendorData.password.length < 6
      ? "Weak password"
      : vendorData.password.length < 8
      ? "Fair password"
      : vendorData.password.length < 12
      ? "Strong password"
      : "Very strong password"
  }

</p>

{vendorData.confirmPassword && (

  <p
    className={`text-sm font-medium ${
      vendorData.password === vendorData.confirmPassword
        ? "text-green-600"
        : "text-red-600"
    }`}
  >

    {
      vendorData.password === vendorData.confirmPassword
        ? "✓ Passwords match"
        : "✗ Passwords do not match"
    }

  </p>

)}
      <button
        onClick={async () => {

          if (
            vendorData.password !==
            vendorData.confirmPassword
          ) {

            alert(
              "Passwords do not match"
            );

            return;

          }

          const {
            data,
            error
          } = await supabase.auth.signUp({

            email:
              vendorData.email,

            password:
              vendorData.password

          });

          if (error) {

            alert(error.message);

            return;

          }

          setVendorData({

            ...vendorData,

            authUserId:
              data.user?.id || ""

          });

          setStep(6);

        }}
        className="
          w-full
          bg-orange-500
          text-white
          py-4
          rounded-xl
          font-bold
        "
      >
        Create Account
      </button>

    </div>

  </div>

)}
{step === 6 && (

  <div>

    <div className="flex gap-3 mb-8">

      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-200" />
      <div className="w-4 h-4 rounded-full bg-orange-200" />

    </div>

    <h1 className="text-4xl font-bold mb-3">
      Owner Information
    </h1>

    <p className="text-gray-500 mb-8">
      Tell us about the owner of this business.
    </p>

    <div className="space-y-4">

      <input
        value={vendorData.ownerName}
        onChange={(e)=>
          setVendorData({
            ...vendorData,
            ownerName:e.target.value
          })
        }
        placeholder="Owner Full Name"
        className="
          w-full
          border
          p-4
          rounded-xl
        "
      />

      <input
        value={vendorData.ownerPhone}
        onChange={(e)=>
          setVendorData({
            ...vendorData,
            ownerPhone:e.target.value
          })
        }
        placeholder="Owner Phone Number"
        className="
          w-full
          border
          p-4
          rounded-xl
        "
      />

      <input
        value={vendorData.ownerEmail}
        onChange={(e)=>
          setVendorData({
            ...vendorData,
            ownerEmail:e.target.value
          })
        }
        placeholder="Owner Email Address"
        className="
          w-full
          border
          p-4
          rounded-xl
        "
      />

      <button
        onClick={() => setStep(7)}
        className="
          w-full
          bg-orange-500
          text-white
          py-4
          rounded-xl
          font-bold
        "
      >
        Continue
      </button>

    </div>

  </div>

)}
{step === 7 && (

  <div>

    <div className="flex gap-3 mb-8">

      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-200" />

    </div>

    <h1 className="text-4xl font-bold mb-3">
      Bank Account Verification
    </h1>

    <p className="text-gray-500 mb-8">
      We'll pay your earnings into this account.
    </p>

    <div className="space-y-4">

      <select
        value={vendorData.bankCode}
        onChange={(e)=>
          setVendorData({
            ...vendorData,
            bankCode:e.target.value
          })
        }
        className="
          w-full
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
        value={vendorData.accountNumber}
        onChange={(e)=>
          setVendorData({
            ...vendorData,
            accountNumber:e.target.value
          })
        }
        placeholder="Account Number"
        className="
          w-full
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

        {vendorData.accountName ||
          "Verified account name appears here"}

      </div>

      <button

        type="button"

        onClick={async()=>{

          if(
            vendorData.accountNumber.length !== 10
          ){
            alert(
              "Enter a valid account number"
            );
            return;
          }

          setVerifyingAccount(true);

          try{

            const response =
              await fetch(
                "/api/verify-account",
                {
                  method:"POST",

                  headers:{
                    "Content-Type":
                    "application/json"
                  },

                  body:JSON.stringify({

                    accountNumber:
                      vendorData.accountNumber,

                    bankCode:
                      vendorData.bankCode

                  })

                }
              );

            const data =
              await response.json();

            if(!data.success){

              alert(
                data.message
              );

              return;

            }

            setVendorData({

              ...vendorData,

              accountName:
                data.accountName

            });

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
          w-full
          bg-blue-600
          text-white
          py-4
          rounded-xl
          font-bold
        "
      >

        {
          verifyingAccount
            ? "Verifying..."
            : "Verify Account"
        }

      </button>

      <button
        onClick={() => setStep(8)}
        className="
          w-full
          bg-orange-500
          text-white
          py-4
          rounded-xl
          font-bold
        "
      >
        Continue
      </button>

    </div>

  </div>

)}

{step === 8 && (

  <div>

    <div className="flex gap-3 mb-8">

      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-500" />

    </div>

    <h1 className="text-4xl font-bold mb-3">
      KYC Verification
    </h1>

    <p className="text-gray-500 mb-8">
      Upload your business verification documents.
    </p>

    <div className="space-y-4">

     {vendorData.vendorType === "Kitchen / Restaurant" && (

  <div>

    <label className="font-semibold">
      CAC Certificate
    </label>

    <input
      type="file"
      accept=".pdf,.png,.jpg,.jpeg"
      onChange={(e)=>
        setVendorData({

          ...vendorData,

          cacFile:
            e.target.files?.[0] || null

        })
      }
      className="
        w-full
        border
        p-4
        rounded-xl
      "
    />

  </div>

)}

      <div>

        <label className="font-semibold">
          National ID
        </label>

        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={(e)=>
            setVendorData({

              ...vendorData,

              idFile:
                e.target.files?.[0] || null

            })
          }
          className="
            w-full
            border
            p-4
            rounded-xl
          "
        />

      </div>

      <div>
<div>

  <label className="font-semibold">
    Kitchen Photo
  </label>

  <input
    type="file"
    accept=".png,.jpg,.jpeg"
    onChange={(e)=>
      setVendorData({

        ...vendorData,

        kitchenPhoto:
          e.target.files?.[0] || null

      })
    }
    className="
      w-full
      border
      p-4
      rounded-xl
    "
  />

  <p className="text-sm text-gray-500 mt-2">
    Upload a clear photo of your kitchen or food preparation area.
  </p>

</div>

        <label className="font-semibold">
          Selfie Verification
        </label>

        <input
          type="file"
          accept=".png,.jpg,.jpeg"
          onChange={(e)=>
            setVendorData({

              ...vendorData,

              selfieFile:
                e.target.files?.[0] || null

            })
          }
          className="
            w-full
            border
            p-4
            rounded-xl
          "
        />

      </div>

      <button
        onClick={() => setStep(9)}
        className="
          w-full
          bg-orange-500
          text-white
          py-4
          rounded-xl
          font-bold
        "
      >
        Continue
      </button>

    </div>

  </div>

)}
{step === 9 && (

  <div>

    <div className="flex gap-3 mb-8">

      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-500" />
      <div className="w-4 h-4 rounded-full bg-orange-500" />

    </div>

    <h1 className="text-4xl font-bold mb-3">
      Review Application
    </h1>

    <p className="text-gray-500 mb-8">
      Confirm your information before submitting.
    </p>

    <div className="space-y-4">

      <div className="border rounded-xl p-4">

        <div className="font-semibold">
          Vendor Type
        </div>

        <div className="text-gray-600">
          {vendorData.vendorType || "Not Selected"}
        </div>

      </div>

      <div className="border rounded-xl p-4">

        <div className="font-semibold">
          Kitchen Name
        </div>

        <div className="text-gray-600">
          {vendorData.kitchenName}
        </div>

      </div>

      <div className="border rounded-xl p-4">

        <div className="font-semibold">
          Kitchen Phone
        </div>

        <div className="text-gray-600">
          {vendorData.phone}
        </div>

      </div>

      <div className="border rounded-xl p-4">

        <div className="font-semibold">
          Business Address
        </div>

        <div className="text-gray-600">
          {vendorData.address}
        </div>

      </div>

      <div className="border rounded-xl p-4">

        <div className="font-semibold">
          Owner Name
        </div>

        <div className="text-gray-600">
          {vendorData.ownerName}
        </div>

      </div>

      <div className="border rounded-xl p-4">

        <div className="font-semibold">
          Owner Phone
        </div>

        <div className="text-gray-600">
          {vendorData.ownerPhone}
        </div>

      </div>

      <div className="border rounded-xl p-4">

        <div className="font-semibold">
          Verified Account
        </div>

        <div className="text-gray-600">
          {vendorData.accountName}
        </div>

      </div>

      <div className="border rounded-xl p-4">

<div
  className="
    bg-green-50
    border
    border-green-200
    rounded-xl
    p-5
    mb-4
  "
>

  <h3 className="font-bold text-lg mb-2">
    🎯 Application Completion
  </h3>

  <div className="w-full bg-green-100 rounded-full h-3">

    <div
      className="
        bg-green-500
        h-3
        rounded-full
      "
      style={{ width: "100%" }}
    />

  </div>

  <p className="text-sm text-green-700 mt-2">
    Your application is ready for submission.
  </p>

</div>
        <div className="font-semibold mb-2">
          Uploaded Documents
     <div>

  {vendorData.vendorType === "Kitchen / Restaurant" ? (

    vendorData.cacFile
      ? "✅ CAC Registration Uploaded"
      : "❌ CAC Registration Required"

  ) : (

    "ℹ️ CAC Registration Not Required For This Vendor Type"

  )}

</div>
          {vendorData.idFile ? "✅ National ID Uploaded" : "❌ National ID Missing"}
        </div>

        <div>
          {vendorData.selfieFile ? "✅ Selfie Uploaded" : "❌ Selfie Missing"}
        </div>

      </div>

     <button
  onClick={async () => {

    try {

     

      alert("Uploading documents...");

      let cacUrl = "";
      let idUrl = "";
      let selfieUrl = "";
      let kitchenPhotoUrl = "";

     if (vendorData.cacFile) {

  const { data, error } = await supabase.storage
    .from("vendor-documents")
    .upload(
      `cac/${Date.now()}-${vendorData.cacFile.name}`,
      vendorData.cacFile
    );

  console.log("CAC DATA:", data);
  console.log("CAC ERROR:", error);

  if (data) {

    cacUrl =
      supabase.storage
        .from("vendor-documents")
        .getPublicUrl(data.path)
        .data.publicUrl;
  }
}

      if (vendorData.idFile) {

        const { data } = await supabase.storage
          .from("vendor-documents")
          .upload(
            `ids/${Date.now()}-${vendorData.idFile.name}`,
            vendorData.idFile
          );

        if (data) {

          idUrl =
            supabase.storage
              .from("vendor-documents")
              .getPublicUrl(data.path)
              .data.publicUrl;
        }
      }

      if (vendorData.selfieFile) {

        const { data } = await supabase.storage
          .from("vendor-documents")
          .upload(
            `selfies/${Date.now()}-${vendorData.selfieFile.name}`,
            vendorData.selfieFile
          );

        if (data) {

          selfieUrl =
            supabase.storage
              .from("vendor-documents")
              .getPublicUrl(data.path)
              .data.publicUrl;
        }
      }

      if (vendorData.kitchenPhoto) {

        const { data } = await supabase.storage
          .from("vendor-documents")
          .upload(
            `kitchens/${Date.now()}-${vendorData.kitchenPhoto.name}`,
            vendorData.kitchenPhoto
          );

        if (data) {

          kitchenPhotoUrl =
            supabase.storage
              .from("vendor-documents")
              .getPublicUrl(data.path)
              .data.publicUrl;
        }
      }

      const { error } =
        await supabase
          .from("vendor_applications")
          .insert({

            vendor_type:
              vendorData.vendorType,

            kitchen_name:
              vendorData.kitchenName,

            email:
              vendorData.email,

            phone:
              vendorData.phone,

            business_address:
              vendorData.address,

            owner_name:
              vendorData.ownerName,

            owner_phone:
              vendorData.ownerPhone,

            bank_code:
              vendorData.bankCode,

            account_number:
              vendorData.accountNumber,

            account_name:
              vendorData.accountName,

            cac_url:
              cacUrl,

            id_url:
              idUrl,

            selfie_url:
              selfieUrl,

            kitchen_photo_url:
              kitchenPhotoUrl,

            onboarding_status:
              "pending",

            kyc_status:
              "pending_review"
          });

    if (error) {

  console.error(error);

  alert(
    JSON.stringify(error, null, 2)
  );

  return;
}

      setStep(10);

    } catch (error) {

      console.error(error);

      alert("Submission failed");

    }

  }}

  className="
    w-full
    bg-orange-500
    text-white
    py-4
    rounded-xl
    font-bold
    text-lg
  "
>
  Submit Application
</button>

    </div>

  </div>

)}
{step === 10 && (

  <div className="text-center">

    <div
  className="
    text-7xl
    mb-6
    animate-bounce
  "
>
  🎉
</div>

    <h1 className="text-4xl font-bold mb-4">
      Application Submitted
    </h1>

    <p className="text-gray-500 text-lg mb-8">
      Your vendor application has been received.
    </p>
<div
  className="
    bg-green-50
    border
    border-green-200
    rounded-xl
    p-4
    mt-6
    mb-6
  "
>

  <p className="font-semibold text-green-700">
    Welcome to Mammy Kitchen Hub 🎉
  </p>

  <p className="text-sm text-gray-600 mt-1">
    Your store is now in the review queue.
    Once approved, you'll gain access to your
    Vendor Dashboard and can start listing
    meals immediately.
  </p>

</div>
    <div
      className="
        bg-orange-50
        border
        border-orange-200
        rounded-2xl
        p-6
        mb-8
      "
    >

      <h3 className="font-bold text-xl mb-2">
        Application Status
      </h3>

      <p className="text-orange-600 font-semibold">
        Pending Review
      </p>

      <p className="text-gray-500 mt-3">
        Estimated review time:
        24 - 48 hours
      </p>

    </div>

    <button
  onClick={() => {
    window.location.href = "/";
  }}
  className="
    w-full
    bg-orange-500
    text-white
    py-4
    rounded-xl
    font-bold
  "
>
  Return Home
</button>

  </div>

)}

        </div>
      </div>
    </main>
  );
}