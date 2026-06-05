"use client";

interface CategoryCardProps {
  name: string;
  icon: string;
  color: string;
}

export function CategoryCard({
  name,
  icon,
  color,
}: CategoryCardProps) {

  return (

    <div
      className="
        flex
        flex-col
        items-center
        gap-3
        p-4
        bg-white
        rounded-xl
        shadow-sm
        hover:shadow-md
        transition-shadow
        cursor-pointer
        border
        border-gray-100
      "
    >

      <div
        className="
          w-16
          h-16
          rounded-full
          flex
          items-center
          justify-center
          text-3xl
        "
        style={{
          backgroundColor: `${color}15`,
        }}
      >

        {icon}

      </div>

      <span className="font-medium text-sm text-center">

        {name}

      </span>

    </div>

  );
}