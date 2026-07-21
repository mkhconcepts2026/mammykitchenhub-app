"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ChangePasswordPage() {

  const router = useRouter();

  const supabase = createClient();

  const [newPassword, setNewPassword] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");

  const [showNewPassword, setShowNewPassword] =
  useState(false);

const [showConfirmPassword, setShowConfirmPassword] =
  useState(false);

const passwordChecks = {
  length: newPassword.length >= 8,
  uppercase: /[A-Z]/.test(newPassword),
  lowercase: /[a-z]/.test(newPassword),
  number: /\d/.test(newPassword),
  special: /[^A-Za-z0-9]/.test(newPassword),
};

const strength =
  Object.values(passwordChecks).filter(Boolean).length;

const strengthText =
  strength <= 2
    ? "Weak"
    : strength <= 4
    ? "Medium"
    : "Strong";

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [passwordChanged, setPasswordChanged] = useState(false);

  async function handleChangePassword() {

    try {

      setLoading(true);

      setError("");

     

      if (!newPassword) {

        setError("Enter a new password.");

        return;

      }

      if (newPassword.length < 8) {

        setError("Password must be at least 8 characters.");

        return;

      }

      if (newPassword !== confirmPassword) {

        setError("Passwords do not match.");

        return;

      }

const {
  data: { user },
  error: userError,
} = await supabase.auth.getUser();

if (userError || !user) {

  setError("Session expired. Please login again.");

  return;

}

   const response = await fetch(
  "/api/auth/change-password",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      newPassword,
    }),
  }
);

const result = await response.json();

if (!response.ok || !result.success) {

  setError(result.message || "Unable to change password.");

  
  return;

}

setPasswordChanged(true);

    }

    catch (err) {

      console.error(err);

      setError("Something went wrong.");

    }

    finally {

      setLoading(false);

    }

  }

  if (passwordChanged) {

  return (

    <main
      className="
      min-h-screen
      flex
      items-center
      justify-center
      bg-gray-100
      p-6
    "
    >

      <div
        className="
        bg-white
        rounded-2xl
        shadow-sm
        p-8
        w-full
        max-w-md
        text-center
      "
      >

        <div className="text-6xl mb-4">

          ✅

        </div>

        <h1
          className="
          text-3xl
          font-bold
          mb-4
        "
        >

          Password Updated Successfully

        </h1>

        <p
          className="
          text-gray-500
          mb-8
        "
        >

          Your password has been changed successfully.

          <br />

          Please sign in again using your new password.

        </p>

        <button

          onClick={async () => {

            await supabase.auth.signOut();

            router.push("/login");

          }}

          className="
          w-full
          bg-black
          text-white
          rounded-xl
          p-4
        "

        >

          Continue to Login

        </button>

      </div>

    </main>

  );

}

  return (

    <main
      className="
      min-h-screen
      flex
      items-center
      justify-center
      bg-gray-100
      p-6
    "
    >

      <div
        className="
        bg-white
        rounded-2xl
        shadow-sm
        p-8
        w-full
        max-w-md
      "
      >

        <h1
          className="
          text-3xl
          font-bold
          mb-2
        "
        >

          Change Password

        </h1>

        <p
          className="
          text-gray-500
          mb-6
        "
        >

          Create a new password to continue using your account.

        </p>

        <div className="space-y-4">

                 <div className="relative">

  <input
    type={showNewPassword ? "text" : "password"}
    placeholder="New Password"
    value={newPassword}
    onChange={(e) => setNewPassword(e.target.value)}
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
    onClick={() => setShowNewPassword(!showNewPassword)}
    className="
      absolute
      right-4
      top-1/2
      -translate-y-1/2
      text-gray-500
      hover:text-gray-700
    "
  >
    {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
  </button>

</div>

         <div className="relative">

  <input
    type={showConfirmPassword ? "text" : "password"}
    placeholder="Confirm New Password"
    value={confirmPassword}
    onChange={(e) => setConfirmPassword(e.target.value)}
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
    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
    className="
      absolute
      right-4
      top-1/2
      -translate-y-1/2
      text-gray-500
      hover:text-gray-700
    "
  >
    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
  </button>

</div>

        <div className="rounded-xl border p-4 bg-gray-50">

  <h3 className="font-semibold mb-3">

    Password Requirements

  </h3>

  <div className="space-y-2 text-sm">

    <p className={passwordChecks.length ? "text-green-600" : "text-gray-500"}>
      {passwordChecks.length ? "✅" : "⚪"} At least 8 characters
    </p>

    <p className={passwordChecks.uppercase ? "text-green-600" : "text-gray-500"}>
      {passwordChecks.uppercase ? "✅" : "⚪"} One uppercase letter
    </p>

    <p className={passwordChecks.lowercase ? "text-green-600" : "text-gray-500"}>
      {passwordChecks.lowercase ? "✅" : "⚪"} One lowercase letter
    </p>

    <p className={passwordChecks.number ? "text-green-600" : "text-gray-500"}>
      {passwordChecks.number ? "✅" : "⚪"} One number
    </p>

    <p className={passwordChecks.special ? "text-green-600" : "text-gray-500"}>
      {passwordChecks.special ? "✅" : "⚪"} One special character
    </p>

  </div>

</div>

<div>

  <div className="flex justify-between mb-2 text-sm">

    <span>Password Strength</span>

    <span className="font-semibold">

      {strengthText}

    </span>

  </div>

  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">

    <div
      className={`h-3 rounded-full transition-all duration-300 ${
        strength <= 2
          ? "bg-red-500 w-2/5"
          : strength <= 4
          ? "bg-yellow-500 w-4/5"
          : "bg-green-500 w-full"
      }`}
    />

  </div>

</div>

{

  error &&

  <p
    className="
      text-red-500
      text-sm
    "
  >

    {error}

  </p>

}

          <button

            onClick={handleChangePassword}

            disabled={loading}

            className="
            w-full
            bg-black
            text-white
            rounded-xl
            p-4
          "

          >

            {

              loading

              ? "Updating..."

              : "Update Password"

            }

          </button>

        </div>

      </div>

    </main>

  );

}