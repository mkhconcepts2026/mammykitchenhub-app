"use client";

import { ReactNode } from "react";

type Props = {

  children: ReactNode;

};

export default function AuthCard({

  children,

}: Props) {

  return (

    <div
      className="
        w-full
        max-w-xl
        bg-white
        rounded-[40px]
        shadow-[0_30px_80px_rgba(0,0,0,0.12)]
        border
        border-gray-100
        px-14
        py-14
      "
    >

      {children}

    </div>

  );

}