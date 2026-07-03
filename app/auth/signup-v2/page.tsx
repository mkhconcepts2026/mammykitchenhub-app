"use client";

import AuthLayout from "@/components/auth/AuthLayout";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthCard from "@/components/auth/AuthCard";
import AuthHeader from "@/components/auth/AuthHeader";
import AuthFooter from "@/components/auth/AuthFooter";
import AuthButton from "@/components/auth/AuthButton";
import TextField from "@/components/auth/fields/TextField";
import { User } from "lucide-react";
import EmailField from "@/components/auth/fields/EmailField";
import PhoneField from "@/components/auth/fields/PhoneField";
import PasswordField from "@/components/auth/fields/PasswordField";

export default function SignupV2Page() {
    const router = useRouter();

  const supabase = createClient();

  const [fullName, setFullName] = useState("");

  const [email, setEmail] = useState("");

  const [phone, setPhone] = useState("");

  const [password, setPassword] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);

 async function handleSignup(){

  if(password !== confirmPassword){

    alert("Passwords do not match");

    return;

  }

  try{

    setLoading(true);

    const { data,error } =

      await supabase.auth.signUp({

        email,

        password

      });

      console.log("SIGNUP RESULT:", data);

console.log("SIGNUP ERROR:", error);

   if (error) {

  if (error.message.toLowerCase().includes("rate limit")) {

    alert(
      "You've requested too many verification emails. Please wait a few minutes before trying again."
    );

  } else {

    alert(error.message);

  }

  return;

}

    if(!data.user){

      alert("User not created");

      return;

    }

    const { error:profileError } =

      await supabase

      .from("profiles")

      .insert({

        id:data.user.id,

        full_name:fullName,

        email,

        phone:`+234${phone}`,

        role:"customer"

      });

    if(profileError){

      alert(profileError.message);

      return;

    }

   router.push(

  `/auth/verify-email?email=${encodeURIComponent(email)}`

);

  }

  catch(err){

    console.error(err);

  }

  finally{

    setLoading(false);

  }

}
  return (
    <AuthLayout>

      <AuthCard>

       <AuthHeader
  title="Welcome to MKH"
  subtitle="Create your customer account and discover amazing meals from trusted local kitchens."
/>

<div className="space-y-6">

  <TextField
    label="Full Name"
    placeholder="Enter your full name"
    icon={<User size={20} />}
    value={fullName}
    onChange={(e) => setFullName(e.target.value)}
  />

  <EmailField
    value={email}
    onChange={setEmail}
  />

  <PhoneField
    value={phone}
    onChange={setPhone}
  />

  <PasswordField
    value={password}
    onChange={setPassword}
  />

  <PasswordField
    label="Confirm Password"
    placeholder="Confirm your password"
    showStrength={false}
    value={confirmPassword}
    onChange={setConfirmPassword}
  />

  <AuthButton
  onClick={handleSignup}
  disabled={loading}
>
  {
    loading
      ? "Creating Account..."
      : "Create My Account"
  }
</AuthButton>

          <div className="text-center text-gray-500">

            Already an MKH member?

            <span className="text-orange-600 font-semibold cursor-pointer ml-2">

              Sign In

            </span>

          </div>

        </div>

        <AuthFooter />

      </AuthCard>

    </AuthLayout>
  );
}
