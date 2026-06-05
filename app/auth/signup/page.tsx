"use client";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff } from "lucide-react";

export default function SignupPage() {

  const router = useRouter();
  const supabase = createClient();

  const [fullName,setFullName] = useState("");
  const [email,setEmail] = useState("");
  const [phone,setPhone] = useState("");
  const [password,setPassword] = useState("");
  const [confirmPassword,setConfirmPassword] = useState("");
  const [loading,setLoading] = useState(false);
  const [showPassword,setShowPassword] =
  useState(false);

const [
  showConfirmPassword,
  setShowConfirmPassword
] =
  useState(false);

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

      if(error){

        alert(error.message);
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

      alert("Account created successfully");

      router.push("/login");

    }

    catch(err){

      console.error(err);

    }

    finally{

      setLoading(false);

    }

  }

  return(

    <main className="
      min-h-screen
      bg-gray-100
      flex
      items-center
      justify-center
      p-6
    ">

      <div className="
        w-full
        max-w-md
        bg-white
        rounded-3xl
        p-8
        shadow
      ">

        <div className="flex justify-center mb-6">

  <Image
    src="/logo.png"
    alt="Mammy Kitchen Hub"
    width={120}
    height={120}
    priority
  />

</div>

<h1
  className="
    text-4xl
    font-bold
    mb-2
    text-center
  "
>
  Create Account
</h1>

       <p className="
  text-gray-500
  mb-8
">
  Join Mammy Kitchen Hub
</p>

        <div className="space-y-4">

          <input
            type="text"
            placeholder="Full Name"
            value={fullName}
            onChange={(e)=>
              setFullName(
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

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e)=>
              setEmail(
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

        <div
  className="
    flex
    border
    rounded-xl
    overflow-hidden
  "
>

  <div
    className="
      px-4
      flex
      items-center
      bg-gray-100
      text-gray-500
      font-medium
    "
  >
    +234
  </div>

  <input
    type="tel"
    placeholder="8012345678"
    value={phone}
    onChange={(e)=>
      setPhone(
        e.target.value.replace(
          /\D/g,
          ""
        )
      )
    }
    className="
      flex-1
      p-4
      outline-none
    "
  />

</div>

<div className="relative">

  <input
    type={
      showPassword
        ? "text"
        : "password"
    }
    placeholder="Password"
    value={password}
    onChange={(e)=>
      setPassword(
        e.target.value
      )
    }
    className="
      w-full
      border
      rounded-xl
      p-4
      pr-12
    "
  />

  <button
    type="button"
    onClick={()=>
      setShowPassword(
        !showPassword
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
    {
      showPassword
        ? <EyeOff size={18}/>
        : <Eye size={18}/>
    }
  </button>

</div>

<div className="relative">

  <input
    type={
      showConfirmPassword
        ? "text"
        : "password"
    }
    placeholder="Confirm Password"
    value={confirmPassword}
    onChange={(e)=>
      setConfirmPassword(
        e.target.value
      )
    }
    className="
      w-full
      border
      rounded-xl
      p-4
      pr-12
    "
  />

  <button
    type="button"
    onClick={()=>
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
    {
      showConfirmPassword
        ? <EyeOff size={18}/>
        : <Eye size={18}/>
    }
  </button>

</div>
          <button
            onClick={handleSignup}
            disabled={loading}
            className="
              w-full
              bg-orange-500
              text-white
              p-4
              rounded-xl
              font-bold
            "
          >
            {
              loading
              ? "Creating Account..."
              : "Create Account"
            }
          </button>

        </div>

      </div>

    </main>

  );

}