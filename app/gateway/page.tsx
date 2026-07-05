"use client";
import { useRouter } from "next/navigation";
export default function GatewayPage() {

  const router = useRouter();

  return (

    <main className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100 flex items-center justify-center p-6">

      <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-orange-100 p-10">

        <div className="text-center space-y-4">

          <div className="text-6xl">

            🍽️

          </div>

          <h1 className="text-4xl font-extrabold text-slate-800">

            MKH Gateway

          </h1>

          <p className="text-gray-500 text-lg">

            One secure gateway for every member of the Mammy Kitchen Hub ecosystem.

          </p>

        </div>

      <div className="mt-10 grid grid-cols-2 gap-4">

 <div

  onClick={() =>

    router.push("/login")

  }

  className="
    rounded-2xl
    border
    border-orange-200
    bg-orange-50
    p-5
    cursor-pointer
    transition-all
    duration-300
    hover:scale-105
    hover:shadow-xl
    hover:border-orange-500
  "
>

  <div className="text-3xl">

    👤

  </div>

  <h3 className="mt-3 font-bold">

    Customer

  </h3>

  <p className="mt-2 text-sm text-gray-500">

    Order meals and track deliveries.

  </p>

</div>



 <div

  onClick={() =>

    router.push("/vendor/login")

  }

  className="
    rounded-2xl
    border
    border-orange-200
    bg-orange-50
    p-5
    cursor-pointer
    transition-all
    duration-300
    hover:scale-105
    hover:shadow-xl
    hover:border-orange-500
  "

>

  <div className="text-3xl">

    🍳

  </div>

  <h3 className="mt-3 font-bold">

    Vendor

  </h3>

  <p className="mt-2 text-sm text-gray-500">

    Manage orders and menus.

  </p>

</div>

 <div

  onClick={() =>

    router.push("/rider/login")

  }

  className="
    rounded-2xl
    border
    border-orange-200
    bg-orange-50
    p-5
    cursor-pointer
    transition-all
    duration-300
    hover:scale-105
    hover:shadow-xl
    hover:border-orange-500
  "

>

  <div className="text-3xl">

    🛵

  </div>

  <h3 className="mt-3 font-bold">

    Rider

  </h3>

  <p className="mt-2 text-sm text-gray-500">

    Deliver orders and update live location.

  </p>

</div>

 <div

  onClick={() =>

    router.push("/portal/login")

  }

  className="
    rounded-2xl
    border
    border-orange-200
    bg-orange-50
    p-5
    cursor-pointer
    transition-all
    duration-300
    hover:scale-105
    hover:shadow-xl
    hover:border-orange-500
  "

>

  <div className="text-3xl">

    👨‍💼

  </div>

  <h3 className="mt-3 font-bold">

    Employee

  </h3>

  <p className="mt-2 text-sm text-gray-500">

    Secure access for MKH staff.

  </p>

</div>

</div>

      </div>

    </main>

  );

}