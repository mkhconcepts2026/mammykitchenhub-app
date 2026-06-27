"use client";

import Image from "next/image";

export default function FinanceHeader() {

  return (

    <div
      className="
        flex
        flex-col
        lg:flex-row
        lg:items-center
        gap-6
        mb-10
      "
    >

      <Image
        src="/logo.png"
        alt="MKH Logo"
        width={180}
        height={52}
        priority
        style={{
          width: "180px",
          height: "auto"
        }}
      />

      <div>

        <h1
          className="
            text-5xl
            font-bold
            tracking-tight
          "
        >
          Finance & Accounts
        </h1>

        <p
          className="
            text-gray-500
            mt-2
            text-lg
          "
        >
          Manage MKH revenue,
          settlements and payouts
        </p>

      </div>

    </div>

  );

}