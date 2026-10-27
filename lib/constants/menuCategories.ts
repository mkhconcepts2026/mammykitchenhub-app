// Single source of truth for the customer-facing and vendor menu category selector.
// Keep these entries aligned with the MKH customer dashboard category cards.
export const MKH_MENU_CATEGORIES = [
  { name: "Rice & Grains", icon: "🍚", color: "#FF5A1F" },
  { name: "Swallow", icon: "🍲", color: "#FACC15" },
  { name: "Noodles", icon: "🍜", color: "#10B981" },
  { name: "Drinks", icon: "🥤", color: "#3B82F6" },
  { name: "Soups", icon: "🍜", color: "#8B5CF6" },
  { name: "Chicken", icon: "🍗", color: "#F59E0B" },
  { name: "Shawarma", icon: "🌯", color: "#EF4444" },
  { name: "Pizza", icon: "🍕", color: "#EC4899" },
  { name: "Buffet Experiences", icon: "🍽️", color: "#D97706" },
] as const;