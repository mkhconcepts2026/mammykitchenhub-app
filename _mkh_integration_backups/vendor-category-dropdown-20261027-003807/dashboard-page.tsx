
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

import { createClient } from "@/lib/supabase/client";

import { Navbar } from "@/components/Navbar";
import { SearchBar } from "@/components/SearchBar";
import { PromoBanner } from "@/components/PromoBanner";
import { CategoryCard } from "@/components/CategoryCard";
import { VendorCard } from "@/components/VendorCard";
import { BottomNav } from "@/components/BottomNav";

const categories = [
  { name: "Rice & Grains", icon: "🍚", color: "#FF5A1F" },
  { name: "Swallow", icon: "🍲", color: "#FACC15" },
  { name: "Noodles", icon: "🍜", color: "#10B981" },
  { name: "Drinks", icon: "🥤", color: "#3B82F6" },
  { name: "Soups", icon: "🍜", color: "#8B5CF6" },
  { name: "Chicken", icon: "🍗", color: "#F59E0B" },
  { name: "Shawarma", icon: "🌯", color: "#EF4444" },
  { name: "Pizza", icon: "🍕", color: "#EC4899" },
  { name: "Buffet Experiences", icon: "🍽️", color: "#D97706" },
];

type Vendor = {
  id: string;
  slug?: string | null;
  name: string;
  image?: string | null;
  rating?: number | string | null;
  review_count?: number | string | null;
  delivery_time?: string | null;
  cuisine?: string | null;
  promo?: string | null;
};

type MenuItem = {
  id: string;
  vendor_id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  available?: boolean | null;
  price?: number | string | null;
  image?: string | null;
};

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function matchesCategory(category: string, item: MenuItem) {
  const itemCategory = normalize(item.category);
  const itemName = normalize(item.name);
  const itemDescription = normalize(item.description);

  const searchableItem = `${itemName} ${itemDescription}`;

  switch (category) {
    case "Rice & Grains":
      return (
        ["rice", "rice & grains", "grains"].includes(itemCategory) ||
        /\b(rice|jollof|fried rice|white rice|ofada)\b/.test(searchableItem)
      );

    case "Swallow":
      return (
        itemCategory === "swallow" ||
        /\b(pounded yam|eba|fufu|amala|semovita|semo|wheat swallow)\b/.test(
          searchableItem
        )
      );

    case "Drinks":
      return (
        itemCategory === "drinks" ||
        /\b(drink|juice|water|soda|chapman|smoothie|beverage)\b/.test(
          searchableItem
        )
      );

    case "Soups":
      return (
        ["soup", "soups"].includes(itemCategory) ||
        /\b(soup|egusi|ogbono|okra soup|pepper soup|vegetable soup)\b/.test(
          searchableItem
        )
      );

    case "Chicken":
      return (
        itemCategory === "chicken" ||
        /\b(chicken|broiler)\b/.test(searchableItem)
      );

    case "Shawarma":
      return (
        itemCategory === "shawarma" ||
        /\b(shawarma)\b/.test(searchableItem)
      );

    case "Pizza":
      return (
        itemCategory === "pizza" ||
        /\b(pizza)\b/.test(searchableItem)
      );

    case "Noodles":
  return (
    ["noodles", "noddles"].includes(itemCategory) ||
    /\bnoodles?\b/.test(searchableItem)
  );

    default:
      return itemCategory === normalize(category);
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
const category = params.get("category");

if (
  category &&
  categories.some((item) => item.name === category) &&
  category !== "Buffet Experiences"
) {
  setSelectedCategory(category);
} else {
  setSelectedCategory("");
}

    async function loadDashboard() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/login");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", session.user.id)
          .maybeSingle();

        setCustomerName(profile?.full_name || "");

        const [
          { data: vendorData, error: vendorError },
          { data: menuData, error: menuError },
          { data: reviewSummaryData, error: reviewSummaryError },
        ] = await Promise.all([
          supabase.from("vendors").select("*"),
          supabase
            .from("menu_items")
            .select("id, vendor_id, name, description, category, available, price, image"),
          supabase
            .from("vendor_review_summary")
            .select("vendor_id, average_rating, review_count"),
        ]);

        if (vendorError) {
          console.error("Unable to load vendors:", vendorError);
          setVendors([]);
          return;
        }

        if (menuError) {
          console.error("Unable to load menu items:", menuError);
          setVendors([]);
          return;
        }

        if (reviewSummaryError) {
          console.error("Unable to load vendor review summaries:", reviewSummaryError);
        }

        const ratingsByVendor = new Map(
          (reviewSummaryData ?? []).map((summary) => [
            summary.vendor_id,
            summary,
          ] as const)
        );

        setVendors(
          (vendorData ?? []).map((vendor) => {
            const summary = ratingsByVendor.get(vendor.id);

            return {
              ...vendor,
              rating: summary ? Number(summary.average_rating) : null,
              review_count: summary ? Number(summary.review_count) : 0,
            };
          }) as Vendor[]
        );
        setMenuItems((menuData ?? []) as MenuItem[]);
      } catch (error) {
        console.error("Unable to load customer dashboard:", error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [router, supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const filteredVendors = vendors.filter((vendor) => {
    const query = normalize(searchQuery);

    const vendorMenuItems = menuItems.filter(
      (item) =>
        item.vendor_id === vendor.id &&
        item.available !== false
    );

    const matchesSelectedCategory =
      !selectedCategory ||
      vendorMenuItems.some((item) =>
        matchesCategory(selectedCategory, item)
      );

    const matchesSearch =
      !query ||
      [
        vendor.name,
        vendor.cuisine,
        vendor.promo,
        ...vendorMenuItems.flatMap((item) => [
          item.name,
          item.category,
          item.description,
        ]),
      ].some((value) => normalize(value).includes(query));

    return matchesSelectedCategory && matchesSearch;
  });

  const filteredMenuItems = menuItems.filter((item) => {
    const query = normalize(searchQuery);
    const itemVendor = vendors.find((vendor) => vendor.id === item.vendor_id);
    const matchesSelectedCategory =
      !selectedCategory || matchesCategory(selectedCategory, item);
    const matchesSearch =
      !query ||
      [
        item.name,
        item.category,
        item.description,
        itemVendor?.name,
        itemVendor?.cuisine,
      ].some((value) => normalize(value).includes(query));

    return matchesSelectedCategory && matchesSearch;
  });

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-orange-100 border-t-orange-500" />
          <h1 className="text-lg font-semibold text-gray-800">
            Preparing your MKH experience...
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Finding your food marketplace.
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 lg:pb-0">
      <Navbar />

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-6 sm:px-6 sm:py-8">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-orange-50 via-white to-amber-50 p-6 sm:p-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-orange-600">
                Mammy Kitchen Hub
              </p>

              <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
                Welcome back, {customerName || "Food Lover"}!
                <span className="ml-2" aria-hidden="true">👋</span>
              </h1>

              <p className="mt-3 max-w-xl text-base leading-7 text-gray-600 sm:text-lg">
                Your next favourite meal is waiting. Discover great food and
                exciting dining experiences with MKH.
              </p>

              <div className="mt-6">
                <SearchBar
                  value={searchQuery}
                  onSearchChange={setSearchQuery}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 lg:max-w-xs lg:justify-end">
              <Link
                href="/orders"
                className="rounded-xl border border-orange-200 bg-white px-5 py-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-50"
              >
                My Orders
              </Link>

              <Link
                href="/cart"
                className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-700"
              >
                View Cart
              </Link>

              <button
                type="button"
                onClick={signOut}
                className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-600 transition hover:border-red-200 hover:text-red-600"
              >
                Sign Out
              </button>
            </div>
          </div>
        </section>

        <section aria-label="Featured promotion">
          <PromoBanner
            title="Get 30% OFF on your first order!"
            subtitle="Use code MKHNEW at checkout"
            bgColor="#FF5A1F"
          />
        </section>

        <section aria-labelledby="categories-heading">
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-orange-600">
                Explore something delicious
              </p>
              <h2
                id="categories-heading"
                className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl"
              >
                Browse by Category
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9">
            {categories.map((category) => (
              <CategoryCard
                key={category.name}
                name={category.name}
                icon={category.icon}
                color={category.color}
              />
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-gray-900">
                  Discover MKH Buffet Experiences
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Seasonal hotel buffet deals are planned for a future release.
                </p>
              </div>

              <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-800">
                Coming soon
              </span>
            </div>
          </div>
        </section>

        <section id="featured-vendors" aria-labelledby="vendors-heading">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600">
                Find your next meal
              </p>

              <h2
                id="vendors-heading"
                className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl"
              >
                {selectedCategory
                  ? `${selectedCategory} Menu Items`
                  : "Featured Vendors"}
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {selectedCategory
                  ? "Browse matching menu items, including items currently out of stock."
                  : "Explore vendors available on MKH."}
              </p>
            </div>

            {selectedCategory && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory("");
                  window.history.replaceState(null, "", "/dashboard");
                }}
                className="w-fit rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-orange-300 hover:text-orange-600"
              >
                Clear category
              </button>
            )}
          </div>

          {((selectedCategory ? filteredMenuItems.length : filteredVendors.length) === 0) ? (
            <div className="rounded-3xl border border-gray-100 bg-white px-6 py-12 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-3xl">
                {selectedCategory || searchQuery ? "🔎" : "🍲"}
              </div>

              <h3 className="mt-4 text-xl font-bold text-gray-900">
                {selectedCategory
                  ? "No matching menu items found"
                  : searchQuery
                    ? "No matching vendors found"
                    : "No vendors available yet"}
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
                {selectedCategory
                  ? "Try another category or clear your category filter to see more menu items."
                  : searchQuery
                    ? "Try another search or clear your search to see available vendors."
                    : "Please check back soon as more vendors join MKH."}
              </p>

              {(selectedCategory || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory("");
                    setSearchQuery("");
                    window.history.replaceState(null, "", "/dashboard");
                  }}
                  className="mt-5 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            selectedCategory ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredMenuItems.map((item) => {
                  const itemVendor = vendors.find((vendor) => vendor.id === item.vendor_id);
                  const slugSource = itemVendor?.slug?.trim() || itemVendor?.name || "vendor";
                  const vendorSlug = slugSource
                    .toLowerCase()
                    .trim()
                    .replace(/['’]/g, "")
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "");
                  const itemUnavailable = item.available === false;

                  return (
                    <article
                      key={item.id}
                      className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
                    >
                      <div className="relative h-44 bg-orange-50">
                        <Image
                          src={item.image?.trim() || "/mkh-food-placeholder.png"}
                          alt={item.name || "Menu item"}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className={`object-cover ${itemUnavailable ? "grayscale opacity-80" : ""}`}
                        />
                        <span
                          className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold ${
                            itemUnavailable
                              ? "bg-red-100 text-red-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {itemUnavailable ? "Out of Stock" : "Available"}
                        </span>
                      </div>
                      <div className="p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {item.category || selectedCategory}
                        </p>
                        <h3 className="mt-1 text-lg font-bold text-gray-900">
                          {item.name}
                        </h3>
                        {item.description && (
                          <p className="mt-2 line-clamp-2 text-sm text-gray-500">
                            {item.description}
                          </p>
                        )}
                        <p className="mt-3 text-lg font-bold text-orange-600">
                          ₦{Number(item.price ?? 0).toLocaleString("en-NG")}
                        </p>
                        <p className="mt-2 text-sm text-gray-600">
                          From {itemVendor?.name || "MKH Vendor"}
                        </p>
                        <Link
                          href={`/vendors/${encodeURIComponent(vendorSlug)}`}
                          className="mt-4 inline-flex rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
                        >
                          View store
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredVendors.map((vendor) => (
                  <VendorCard
                    key={vendor.id}
                    id={vendor.id}
                    slug={vendor.slug}
                    name={vendor.name}
                    image={vendor.image}
                    rating={vendor.rating}
                    reviewCount={vendor.review_count}
                    deliveryTime={vendor.delivery_time}
                    cuisine={vendor.cuisine}
                    promo={vendor.promo}
                  />
                ))}
              </div>
            )
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
