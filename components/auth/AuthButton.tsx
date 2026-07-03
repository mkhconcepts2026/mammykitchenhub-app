"use client";

import { ArrowRight } from "lucide-react";
import { ButtonHTMLAttributes } from "react";

type Props =
  ButtonHTMLAttributes<HTMLButtonElement>;

export default function AuthButton({

  children,

  className = "",

  ...props

}: Props) {

  return (

    <button

      {...props}

      className={`
        w-full
        rounded-2xl
        bg-orange-500
        hover:bg-orange-600
        text-white
        py-5
        font-bold
        text-xl
        flex
        items-center
        justify-center
        gap-3
        transition-all
        duration-300
        hover:scale-[1.02]
        shadow-lg
        ${className}
      `}

    >

      {children}

      <ArrowRight size={22} />

    </button>

  );

}