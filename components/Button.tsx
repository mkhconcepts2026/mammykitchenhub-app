import React from "react";

type ButtonProps = {

  children: React.ReactNode;

  onClick?: () => void;

  variant?:
    | "primary"
    | "secondary"
    | "destructive";

};

export function Button({

  children,

  onClick,

  variant = "primary"

}: ButtonProps) {

  const styles = {

    primary:
      "bg-orange-500 text-white",

    secondary:
      "bg-gray-200 text-gray-900",

    destructive:
      "bg-red-500 text-white"

  };

  return (

    <button

      onClick={onClick}

      className={`
        px-5
        py-3
        rounded-xl
        font-semibold
        transition
        hover:opacity-90
        ${styles[variant]}
      `}
    >

      {children}

    </button>

  );

}