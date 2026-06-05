"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { createClient }
from "@/lib/supabase/client";

import { VendorDetail }
from "@/components/VendorDetail";

export default function VendorPage() {


  const params =
    useParams();

  const slug =
    params.slug as string;

  const supabase =
    createClient();

  const [vendor,
    setVendor] =
    useState<any>(null);

  const [menuItems,
    setMenuItems] =
    useState<any[]>([]);

  const [loading,
    setLoading] =
    useState(true);

  useEffect(() => {

    async function loadVendor() {

      const {
        data: vendorData,
      } =
        await supabase
          .from("vendors")
          .select("*")
          .eq(
            "slug",
            slug
          )
          .single();

      if (!vendorData) {

        setLoading(false);

        return;
      }

      setVendor(
        vendorData
      );

      const {
        data: menuData,
      } =
        await supabase
          .from("menu_items")
          .select("*")
          .eq(
            "vendor_id",
            vendorData.id
          );

      setMenuItems(
        menuData || []
      );

      setLoading(false);
    }

    if (slug) {

      loadVendor();
    }

  }, [slug]);

  if (loading) {

    return (

      <main className="min-h-screen flex items-center justify-center">

        <h1 className="text-2xl font-bold">

          Loading Vendor...

        </h1>

      </main>

    );
  }

  if (!vendor) {

    return (

      <main className="min-h-screen flex items-center justify-center">

        <h1 className="text-2xl font-bold">

          Vendor Not Found

        </h1>

      </main>

    );
  }

  return (

    <VendorDetail
      vendor={vendor}
      menuItems={menuItems}
    />

  );
}