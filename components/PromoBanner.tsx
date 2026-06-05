"use client";

import Image from "next/image";

interface PromoBannerProps {
  title: string;
  subtitle: string;
  bgColor: string;
  image?: string;
}

export function PromoBanner({
  title,
  subtitle,
  bgColor,
  image,
}: PromoBannerProps) {

  return (

    <div
      className="
        relative
        rounded-2xl
        p-6
        overflow-hidden
        min-h-[180px]
        flex
        items-center
      "
      style={{ backgroundColor: bgColor }}
    >

      <div className="relative z-10 max-w-md">

        <h2 className="text-white text-2xl font-bold mb-2">

          {title}

        </h2>

        <p className="text-white/90 mb-4">

          {subtitle}

        </p>

        <button
          className="
            bg-white
            text-black
            px-6
            py-2
            rounded-lg
            font-medium
            hover:bg-white/90
            transition-colors
          "
        >

          Order Now

        </button>

      </div>

      {image && (

        <div
          className="
            absolute
            right-0
            top-1/2
            -translate-y-1/2
            h-full
            w-[220px]
          "
        >

          <Image
            src={image}
            alt="Promo"
            fill
            className="
              object-contain
              opacity-80
            "
          />

        </div>

      )}

    </div>

  );
}