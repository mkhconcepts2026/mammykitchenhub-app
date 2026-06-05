"use client";

import { Star } from "lucide-react";

interface ReviewCardProps {
  name: string;
  rating: number;
  comment: string;
  date: string;
}

export function ReviewCard({
  name,
  rating,
  comment,
  date,
}: ReviewCardProps) {

  return (

    <div
      className="
      bg-white
      p-4
      rounded-xl
      border
      border-gray-100
    "
    >

      <div
        className="
        flex
        justify-between
        mb-2
      "
      >

        <h4 className="font-semibold">

          {name}

        </h4>

        <span
          className="
          text-sm
          text-gray-500
        "
        >

          {date}

        </span>

      </div>

      <div
        className="
        flex
        gap-1
        mb-3
      "
      >

        {[...Array(5)].map(
          (_, i) => (

            <Star
              key={i}
              className={`w-4 h-4 ${
                i < rating
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300"
              }`}
            />

          )
        )}

      </div>

      <p
        className="
        text-sm
        text-gray-600
      "
      >

        {comment}

      </p>

    </div>

  );
}