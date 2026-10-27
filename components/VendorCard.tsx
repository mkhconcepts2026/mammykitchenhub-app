
"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock3, Star, ArrowUpRight } from "lucide-react";
import { useState } from "react";

interface VendorCardProps {
  id?: string;
  slug?: string | null;
  name: string;
  image?: string | null;
  rating?: number | string | null;
  reviewCount?: number | string | null;
  deliveryTime?: string | null;
  cuisine?: string | null;
  promo?: string | null;
}

export function VendorCard({
  slug,
  name,
  image,
  rating,
  reviewCount,
  deliveryTime,
  cuisine,
  promo,
}: VendorCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const fallbackSlug = name
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const vendorSlug = slug?.trim() || fallbackSlug;
  const imageSrc = image?.trim() && !imageFailed
    ? image
    : "/mkh-food-placeholder.png";
  const numericRating = Number(rating);
  const hasRating =
    rating !== null &&
    rating !== undefined &&
    rating !== "" &&
    Number.isFinite(numericRating);

  return (
    <Link
      href={`/vendors/${encodeURIComponent(vendorSlug)}`}
      className="group block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
    >
      <article className="h-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition duration-300 group-hover:-translate-y-1 group-hover:shadow-lg">
        <div className="relative h-48 overflow-hidden bg-orange-50 sm:h-52">
          <Image
            src={imageSrc}
            alt={`${name} food and restaurant`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition duration-500 group-hover:scale-105"
           onError={() => {
  if (!imageFailed && imageSrc !== "/logo.png") {
    setImageFailed(true);
  }
}}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />

          {promo && (
            <span className="absolute left-3 top-3 rounded-full bg-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm">
              {promo}
            </span>
          )}

          <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-800 shadow-sm transition group-hover:bg-orange-500 group-hover:text-white">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>

        <div className="p-4 sm:p-5">
          <h3 className="truncate text-lg font-bold text-gray-900 transition group-hover:text-orange-600">
            {name}
          </h3>

          <p className="mt-1 truncate text-sm text-gray-500">
            {cuisine || "Local favourites"}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 pt-3 text-sm">
            {hasRating && (
              <span className="inline-flex items-center gap-1 font-semibold text-gray-800">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                {numericRating.toFixed(1)}
                {Number(reviewCount) > 0 && (
                  <span className="ml-1 text-xs font-normal text-gray-500">
                    ({Number(reviewCount)} {Number(reviewCount) === 1 ? "review" : "reviews"})
                  </span>
                )}
              </span>
            )}

            {deliveryTime && (
              <span className="inline-flex items-center gap-1 text-gray-500">
                <Clock3 className="h-4 w-4" />
                {deliveryTime}
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
