
"use client";

import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onSearchChange: (value: string) => void;
}

export function SearchBar({ value, onSearchChange }: SearchBarProps) {
  return (
    <div
      id="vendor-search"
      className="relative mx-auto w-full max-w-2xl scroll-mt-28"
    >
      <Search
        aria-hidden="true"
        className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
      />

      <input
        type="search"
        aria-label="Search for food, vendors, or cuisine"
        placeholder="Search for food, vendors, or cuisine..."
        value={value}
        onChange={(event) => onSearchChange(event.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-white py-4 pl-12 pr-4 shadow-sm transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
      />
    </div>
  );
}
