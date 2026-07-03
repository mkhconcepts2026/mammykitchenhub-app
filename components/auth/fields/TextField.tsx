"use client";

import { InputHTMLAttributes, ReactNode } from "react";

type TextFieldProps =
  InputHTMLAttributes<HTMLInputElement> & {

    label: string;

    icon?: ReactNode;

  };

export default function TextField({

  label,

  icon,

  className = "",

  ...props

}: TextFieldProps) {

  return (

    <div className="space-y-2">

      <label
        className="
          text-sm
          font-semibold
          text-gray-700
        "
      >

        {label}

      </label>

      <div
        className="
          flex
          items-center
          rounded-2xl
          border
          border-gray-300
          bg-white
          px-4
          py-4
          transition
          focus-within:border-orange-500
          focus-within:ring-2
          focus-within:ring-orange-200
        "
      >

        {

          icon && (

            <div
              className="
                mr-3
                text-gray-400
              "
            >

              {icon}

            </div>

          )

        }

        <input

          {...props}

          className={`
            flex-1
            outline-none
            bg-transparent
            ${className}
          `}

        />

      </div>

    </div>

  );

}