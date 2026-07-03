"use client";

import Link from "next/link";
import { MailCheck, ArrowRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function VerifyEmailPage() {
const searchParams = useSearchParams();
const supabase = createClient();

const [sending, setSending] = useState(false);

const [message, setMessage] = useState("");

const email =

  searchParams.get("email");

  async function resendVerification() {

  if (!email) {

    return;

  }

  try {

    setSending(true);

    setMessage("");

    const { error } =

      await supabase.auth.resend({

        type: "signup",

        email,

      });

    if (error) {

      setMessage(error.message);

      return;

    }

    setMessage(

      "✅ Verification email sent successfully."

    );

  }

  finally {

    setSending(false);

  }

}
  return (

    <main className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100 flex items-center justify-center p-6">

      <div className="max-w-lg w-full bg-white rounded-[36px] shadow-2xl p-12 text-center">

        <div className="w-28 h-28 rounded-full bg-orange-100 mx-auto flex items-center justify-center mb-8">

          <MailCheck
            size={56}
            className="text-orange-500"
          />

        </div>

        <p className="uppercase tracking-[0.35em] text-orange-500 font-bold text-sm mb-4">

          EMAIL VERIFICATION

        </p>

        <h1 className="text-5xl font-black text-slate-900 leading-tight mb-6">

          Check Your Inbox 📬

        </h1>

        <p className="text-lg text-gray-600 leading-8 mb-8">

         We've sent a verification email to:

         <div className="mt-5 mb-6">

  <span className="inline-flex rounded-full bg-orange-100 px-5 py-3 font-bold text-orange-700">

    {email || "your email"}

  </span>

</div>

          Please click the verification link before logging in to your MKH account.

        </p>

        <div className="rounded-2xl bg-orange-50 border border-orange-200 p-6 mb-8">

          <p className="font-semibold text-slate-800">

            Why verify your email?

          </p>

          <ul className="mt-4 space-y-2 text-left text-gray-600">

            <li>✅ Secure your MKH account</li>

            <li>✅ Prevent fake registrations</li>

            <li>✅ Receive order updates</li>

            <li>✅ Receive promotional offers</li>

          </ul>

        </div>

        <Link
          href="/login"
          className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-2xl py-5 font-bold text-xl flex items-center justify-center gap-3 transition"
        >

          Continue to Login

          <ArrowRight size={22} />

        </Link>

        <p className="mt-8 text-gray-500">

          Didn't receive an email?

        </p>

        <button

  onClick={resendVerification}

  disabled={sending}

  className="

    mt-3

    text-orange-600

    font-semibold

    hover:underline

    disabled:opacity-50

  "

>

  {

    sending

      ? "Sending..."

      : "Resend Verification Email"

  }

</button>

{

  message && (

    <p className="mt-4 text-sm text-green-600 font-medium">

      {message}

    </p>

  )

}

      </div>

    </main>

  );

}