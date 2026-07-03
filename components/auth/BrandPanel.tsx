"use client";

import Image from "next/image";
import {
  UtensilsCrossed,
  Store,
  Bike,
  Heart,
  ShieldCheck,
} from "lucide-react";

export default function BrandPanel() {
  return (
    <aside
      className="
        hidden
        lg:flex
        relative
        flex-col
        justify-between
        overflow-hidden
        rounded-r-[60px]
        bg-[#111111]
        text-white
      "
    >
      {/* Background Image */}

     <Image
  src="/auth/chef.jpg"
  alt="Chef"
  fill
  sizes="50vw"
  className="object-cover"
/>

      {/* Dark Overlay */}

      <div className="absolute inset-0 bg-gradient-to-t
from-black/85
via-black/60
to-black/35" />

      {/* Content */}

      <div className="relative z-10 p-14">

        <div
  className="
    inline-flex
    items-center
    rounded-2xl
    bg-white/95
    backdrop-blur-md
    shadow-xl
    px-5
    py-4
    mb-12
  "
>

 <Image
  src="/logo.png"
  alt="MKH"
  width={260}
  height={82}
  priority
  className="
    drop-shadow-2xl
  "
/>

<div
  className="
    mt-6
    inline-flex
    rounded-full
    bg-orange-500
    px-5
    py-2
    text-sm
    font-bold
    tracking-wider
    uppercase
  "
>

  Africa's Next FoodTech Platform

</div>

</div>

        <h1
          className="
text-6xl
xl:text-7xl
font-black
leading-[0.95]
tracking-[-0.03em]
mb-8
"
        >
          Good Food,

          <br />

          <span className="text-orange-400">

            Great Experience.

          </span>

        </h1>

        <p
          className="
text-2xl
leading-10
text-gray-200
max-w-xl
mb-14
"
        >
          Empowering Local Food Businesses
          Through Technology.
        </p>

        <div className="space-y-6">

          <Feature
            icon={<UtensilsCrossed size={22} />}
            title="Quality Meals"
            text="Delicious meals prepared by trusted local kitchens."
          />

          <Feature
            icon={<Store size={22} />}
            title="Trusted Vendors"
            text="Verified vendors committed to quality."
          />

          <Feature
            icon={<Bike size={22} />}
            title="Fast Delivery"
            text="Professional riders delivering on time."
          />

          <Feature
            icon={<Heart size={22} />}
            title="Customer Satisfaction"
            text="Every order matters."
          />

        </div>
      </div>

      {/* Bottom Card */}

      <div className="relative z-10 p-14 pt-0">

        <div
          className="
            rounded-3xl
            bg-white/10
            backdrop-blur-md
            border
            border-white/20
            p-6
          "
        >

          <div className="flex gap-4">

            <ShieldCheck
              className="text-orange-400"
              size={34}
            />

            <div>

              <h3 className="font-bold text-xl">

                Safe. Secure. Reliable.

              </h3>

              <p className="text-gray-300 mt-2">

                Trusted by customers,
                vendors, riders,
                employees and partners.

              </p>

            </div>

          </div>

        </div>

      </div>

    </aside>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-6 items-start">

      <div
        className="
          w-14
          h-14
          rounded-full
          bg-orange-500/20
          flex
          items-center
          justify-center
          text-orange-400
        "
      >
        {icon}
      </div>

      <div>

        <h3
  className="
    font-bold
    text-2xl
    mb-1
  "
>

          {title}

        </h3>

        <p className="text-gray-300">

          {text}

        </p>

      </div>

    </div>
  );
}