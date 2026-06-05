import React from "react";

type BadgeProps = {
  children: React.ReactNode;
  className?: string;
};

export function Badge({

  children,
  className = ""

}: BadgeProps) {

  return (

    <span
      className={`
        inline-flex
        items-center
        rounded-full
        px-3
        py-1
        text-sm
        font-medium
        bg-orange-100
        text-orange-700
        ${className}
      `}
    >

      {children}

    </span>

  );

}