"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";

import { Navbar } from "@/components/Navbar";
import { SearchBar } from "@/components/SearchBar";
import { PromoBanner } from "@/components/PromoBanner";
import { CategoryCard } from "@/components/CategoryCard";
import { VendorCard } from "@/components/VendorCard";
import { BottomNav } from "@/components/BottomNav";

const categories = [
  { name:"Rice & Grains", icon:"🍚", color:"#FF5A1F" },
  { name:"Swallow", icon:"🍲", color:"#FACC15" },
  { name:"Fast Food", icon:"🍔", color:"#10B981" },
  { name:"Drinks", icon:"🥤", color:"#3B82F6" },
  { name:"Soups", icon:"🍜", color:"#8B5CF6" },
  { name:"Chicken", icon:"🍗", color:"#F59E0B" },
  { name:"Shawarma", icon:"🌯", color:"#EF4444" },
  { name:"Pizza", icon:"🍕", color:"#EC4899" },
];

export default function DashboardPage() {

  const router =
    useRouter();

  const supabase =
    createClient();

  const [loading,
    setLoading] =
    useState(true);

  const [vendors,
    setVendors] =
    useState<any[]>([]);
const [customerName,
  setCustomerName] =
  useState("");

  useEffect(() => {

    async function loadDashboard() {

      try {

        const {

          data:{
            session
          }

        } =
        await supabase
          .auth
          .getSession();

        if (!session) {

          router.push(
            "/login"
          );

          return;

        }
const {

  data:profile

} =
await supabase
  .from("profiles")
  .select("full_name")
  .eq(
    "id",
    session.user.id
  )
  .single();

setCustomerName(
  profile?.full_name || ""
);

        const {

          data,
          error

        } =
        await supabase
          .from("vendors")
          .select("*");

        if (!error) {

          setVendors(
            data || []
          );

        }

      }

      catch(err) {

        console.error(err);

      }

      finally {

        setLoading(false);

      }

    }

    loadDashboard();

  },[]);

  async function signOut() {

    await supabase
      .auth
      .signOut();

    router.push(
      "/login"
    );

  }

  if (loading) {

    return (

      <main className="
        min-h-screen
        flex
        items-center
        justify-center
      ">

        <h1 className="
          text-2xl
          font-bold
        ">

          Loading Dashboard...

        </h1>

      </main>

    );

  }

  return (

    <div className="
      min-h-screen
      bg-gray-50
      pb-24
      lg:pb-0
    ">

      <Navbar cartCount={3} />

      <main className="
        max-w-7xl
        mx-auto
        px-4
        py-8
        space-y-10
      ">

        <div className="
          flex
          flex-col
          md:flex-row
          md:justify-between
          md:items-center
          gap-6
        ">

          <div className="space-y-5">

           <div>

  <h1 className="
    text-4xl
    font-bold
    text-gray-900
  ">

    Welcome back,
    {" "}
    {customerName || "Customer"}
    👋

  </h1>

  <p className="
    text-gray-500
    mt-2
  ">

    What would you like to eat today?

  </p>

</div>

            <SearchBar />

          </div>

          <div className="
            flex
            gap-4
            flex-wrap
          ">

            <Link
              href="/orders"
              className="
                bg-orange-500
                text-white
                px-6
                py-3
                rounded-xl
                font-semibold
              "
            >

              My Orders

            </Link>

            <Link
              href="/cart"
              className="
                bg-black
                text-white
                px-6
                py-3
                rounded-xl
                font-semibold
              "
            >

              Cart

            </Link>

            <button
              onClick={signOut}
              className="
                bg-red-500
                text-white
                px-6
                py-3
                rounded-xl
                font-semibold
              "
            >

              Logout

            </button>

          </div>

        </div>

        <PromoBanner
          title="Get 30% OFF on your first order!"
          subtitle="Use code MKHNEW at checkout"
          bgColor="#FF5A1F"
        />

        <section>

          <div className="
            flex
            justify-between
            mb-6
          ">

            <h2 className="
              text-2xl
              font-semibold
            ">

              Browse by Category

            </h2>

          </div>

          <div className="
            grid
            grid-cols-2
            sm:grid-cols-4
            md:grid-cols-6
            lg:grid-cols-8
            gap-4
          ">

            {

              categories.map(

                (category)=>(

                  <CategoryCard
                    key={category.name}
                    name={category.name}
                    icon={category.icon}
                    color={category.color}
                  />

                )

              )

            }

          </div>

        </section>

        <section>

          <div className="
            flex
            justify-between
            mb-6
          ">

            <h2 className="
              text-2xl
              font-semibold
            ">

              Featured Vendors

            </h2>

          </div>

          {

            vendors.length===0

            ?

            (

              <div className="
                bg-white
                rounded-2xl
                p-8
                text-center
                shadow-sm
              ">

                <h3 className="
                  text-xl
                  font-bold
                  mb-3
                ">

                  No Vendors Found

                </h3>

              </div>

            )

            :

            (

              <div className="
                grid
                grid-cols-1
                sm:grid-cols-2
                lg:grid-cols-3
                gap-6
              ">

                {

                  vendors.map(

                    (vendor)=>(

                      <VendorCard
                        key={vendor.id}
                        name={vendor.name}
                        image={vendor.image}
                        rating={vendor.rating}
                        deliveryTime={
                          vendor.delivery_time
                        }
                        cuisine={
                          vendor.cuisine
                        }
                        promo={
                          vendor.promo
                        }
                      />

                    )

                  )

                }

              </div>

            )

          }

        </section>

      </main>

      <BottomNav cartCount={3} />

    </div>

  );

}