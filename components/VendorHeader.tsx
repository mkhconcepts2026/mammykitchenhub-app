"use client";

import Image from "next/image";
import {
  ArrowLeft,
  Star,
  Clock,
  MapPin,
} from "lucide-react";

interface VendorHeaderProps {
  onBack: () => void;
}

export function VendorHeader({
  onBack,
}: VendorHeaderProps) {

  return (

    <>

      <div
        className="
        relative
        h-64
        overflow-hidden
      "
      >

        <Image
          src="https://images.unsplash.com/photo-1693296304638-d1b43dfcfc8d?w=1200"
          alt="Vendor"
          fill
          sizes="100vw"
          className="object-cover"
        />

        <button
          onClick={onBack}
          className="
            absolute
            top-4
            left-4
            bg-white
            w-10
            h-10
            rounded-full
            shadow-lg
            flex
            items-center
            justify-center
          "
        >

          <ArrowLeft className="w-5 h-5" />

        </button>

      </div>

      <div
        className="
        bg-white
        rounded-2xl
        shadow-lg
        p-6
        -mt-8
        relative
        z-10
      "
      >

        <h1
          className="
          text-2xl
          font-bold
          mb-2
        "
        >

          Mama's Kitchen

        </h1>

        <p
          className="
          text-gray-600
          mb-4
        "
        >

          Nigerian Cuisine • Ikeja, Lagos

        </p>

        <div
          className="
          flex
          flex-wrap
          gap-6
          text-sm
        "
        >

          <div className="flex items-center gap-1">

            <Star
              className="
              w-5
              h-5
              fill-yellow-400
              text-yellow-400
            "
            />

            <span className="font-semibold">

              4.8

            </span>

            <span className="text-gray-500">

              (250+ ratings)

            </span>

          </div>

          <div
            className="
            flex
            items-center
            gap-1
            text-gray-600
          "
          >

            <Clock className="w-5 h-5" />

            <span>

              25–35 min

            </span>

          </div>

          <div
            className="
            flex
            items-center
            gap-1
            text-gray-600
          "
          >

            <MapPin className="w-5 h-5" />

            <span>

              3.2 km away

            </span>

          </div>

        </div>

      </div>

    </>

  );
}