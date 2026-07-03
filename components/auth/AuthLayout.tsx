"use client";

import { ReactNode } from "react";

import BrandPanel from "./BrandPanel";

type AuthLayoutProps = {

  children: ReactNode;

};

export default function AuthLayout({

  children,

}: AuthLayoutProps) {

  return (

    <main
      className="
        min-h-screen
        bg-orange-50
      "
    >

      <div
        className="
          grid
          lg:grid-cols-2
          min-h-screen
        "
      >

        <BrandPanel />

        <section
          className="
            flex
            items-center
            justify-center
            p-8
            lg:p-16
          "
        >

          {children}

        </section>

      </div>

    </main>

  );

}