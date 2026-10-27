
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
  const isBuffet = name === "Buffet Experiences";

  const href = isBuffet
    ? "/buffet-experiences"
    : `/dashboard?category=${encodeURIComponent(name)}#vendor-search`;

  return (
    <a
      href={href}
      aria-label={`Explore ${name}`}
      className="group flex min-h-[142px] flex-col items-center justify-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
    >
      <span
        className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl transition-transform duration-200 group-hover:scale-105"
        style={{ backgroundColor: `${color}18` }}
      >
        {icon}
      </span>

      <span className="text-sm font-semibold leading-snug text-gray-800 transition-colors group-hover:text-orange-600">
        {name}
      </span>

      <span className="text-xs font-medium text-gray-400 transition-colors group-hover:text-orange-500">
        Explore
      </span>
    </a>
  );
}
