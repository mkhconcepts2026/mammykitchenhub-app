"use client";

import Image from "next/image";
import Link from "next/link";

interface VendorCardProps {

  name: string;

  image: string;

  rating: number;

  deliveryTime: string;

  cuisine: string;

  promo?: string;
}

export function VendorCard({

  name,

  image,

  rating,

  deliveryTime,

  cuisine,

  promo,

}: VendorCardProps) {

  const slug =
    name
      .toLowerCase()
      .replace(/'/g, "")
      .replace(/\s+/g, "-");

  return (

    <Link
      href={`/vendors/${slug}`}
      className="block"
    >

      <div
        className="
          bg-white
          rounded-2xl
          overflow-hidden
          shadow-sm
          hover:shadow-lg
          transition-all
          duration-300
          cursor-pointer
        "
      >

        <div className="relative h-56">

          <Image
            src={image}
            alt={name}
            fill
            sizes="
              (max-width: 768px) 100vw,
              (max-width: 1200px) 50vw,
              33vw
            "
            className="object-cover"
          />

          {promo && (

            <div
              className="
                absolute
                top-4
                left-4
                bg-orange-500
                text-white
                px-3
                py-1
                rounded-full
                text-sm
                font-semibold
              "
            >

              {promo}

            </div>

          )}

        </div>

        <div className="p-5">

          <h3 className="text-xl font-bold mb-2">

            {name}

          </h3>

          <p className="text-gray-500 mb-4">

            {cuisine}

          </p>

          <div className="flex items-center justify-between text-sm">

            <span className="font-medium">

              ⭐ {rating}

            </span>

            <span className="text-gray-600">

              {deliveryTime}

            </span>

          </div>

        </div>

      </div>

    </Link>

  );
}