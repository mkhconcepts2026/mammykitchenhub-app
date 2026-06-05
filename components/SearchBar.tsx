"use client";

import { Search } from "lucide-react";

export function SearchBar() {

  return (

    <div className="relative max-w-2xl mx-auto">

      <Search
        className="
          absolute
          left-4
          top-1/2
          -translate-y-1/2
          w-5
          h-5
          text-gray-400
        "
      />

      <input
        type="text"
        placeholder="Search for food, vendors, or cuisine..."
        className="
          w-full
          pl-12
          pr-4
          py-4
          bg-white
          rounded-xl
          border
          border-gray-200
          shadow-sm
          focus:outline-none
          focus:ring-2
          focus:ring-orange-500
          focus:border-transparent
        "
      />

    </div>

  );
}