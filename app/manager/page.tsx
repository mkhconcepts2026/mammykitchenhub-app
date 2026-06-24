"use client";

import {
  useState,
  useEffect
} from "react";

import Image from "next/image";

import { createClient }
from "@/lib/supabase/client";

const supabase =
  createClient();

export default function ManagerPage() {

  const [activeTab, setActiveTab] =
    useState("overview");

  const [stats, setStats] =
    useState({
      vendors: 0,
      readyOrders: 0,
      riders: 0,
      deliveries: 0
    });

  const [
    readyOrdersList,
    setReadyOrdersList
  ] =
    useState<any[]>([]);

  const [
    riders,
    setRiders
  ] =
    useState<any[]>([]);

  const [
    selectedOrder,
    setSelectedOrder
  ] =
    useState<any>(null);

  const [
    showAssignModal,
    setShowAssignModal
  ] =
    useState(false);

  async function loadManagerStats() {

    const {
      count: vendors
    } =
    await supabase
      .from("vendors")
      .select("*", {
        count: "exact",
        head: true
      });

    const {
      count: riders
    } =
    await supabase
      .from("profiles")
      .select("*", {
        count: "exact",
        head: true
      })
      .eq(
        "role",
        "rider"
      );

    const {
      count: readyOrders
    } =
    await supabase
      .from("orders")
      .select("*", {
        count: "exact",
        head: true
      })
      .eq(
        "status",
        "ready_for_pickup"
      );

    const {
      count: deliveries
    } =
    await supabase
      .from("orders")
      .select("*", {
        count: "exact",
        head: true
      })
      .eq(
        "status",
        "delivered"
      );

    setStats({
      vendors:
        vendors || 0,

      riders:
        riders || 0,

      readyOrders:
        readyOrders || 0,

      deliveries:
        deliveries || 0
    });

  }

  async function loadReadyOrders() {

    const {
      data,
      error
    } =
    await supabase
      .from("orders")
      .select(`
        *,
        vendors (
          name
        )
      `)
      .eq(
        "status",
        "ready_for_pickup"
      )
      .order(
        "created_at",
        {
          ascending:false
        }
      );

    if(error){

      console.error(error);
      return;

    }

    setReadyOrdersList(
      data || []
    );

  }

  async function loadRiders() {

    const {
      data,
      error
    } =
    await supabase
      .from("profiles")
      .select("*")
      .eq(
        "role",
        "rider"
      );

    if(error){

      console.error(error);
      return;

    }

    setRiders(
      data || []
    );

  }

  async function assignRider(
    riderId:string
  ) {

    if(
      !selectedOrder
    ) return;

    const {
      error
    } =
    await supabase
      .from("orders")
      .update({
        rider_id:
          riderId,

        status:
          "assigned"
      })
      .eq(
        "id",
        selectedOrder.id
      );

    if(error){

      console.error(error);

      alert(
        "Assignment failed"
      );

      return;

    }

    alert(
      "Rider assigned successfully"
    );

    setShowAssignModal(
      false
    );

    setSelectedOrder(
      null
    );

    await loadManagerStats();

    await loadReadyOrders();

  }

  useEffect(() => {

    loadManagerStats();

    loadReadyOrders();

    loadRiders();

  }, []);

  return (

    <main
      className="
        min-h-screen
        bg-gray-100
        flex
      "
    >

      <aside
        className="
          w-80
          bg-white
          border-r
          flex
          flex-col
        "
      >

        <div
          className="
            p-6
            border-b
          "
        >

          <div className="flex justify-center mb-6">

         <Image
  src="/logo.png"
  alt="MKH Logo"
  width={180}
  height={52}
  priority
  style={{
    width: "180px",
    height: "auto"
  }}
/>

          </div>

          <div className="text-center">

            <h1
              className="
                text-5xl
                font-bold
              "
            >
              Manager Portal
            </h1>

            <p
              className="
                text-gray-500
                mt-2
              "
            >
              Lagos Region
            </p>

          </div>

        </div>

      </aside>

      <section
        className="
          flex-1
          p-10
        "
      >

        <h1
          className="
            text-5xl
            font-bold
            mb-8
          "
        >
          Manager Dashboard
        </h1>

        <div
          className="
            grid
            grid-cols-4
            gap-6
            mb-8
          "
        >

          <div className="bg-white rounded-3xl p-6">
            <p>Total Vendors</p>
            <h2 className="text-5xl font-bold">
              {stats.vendors}
            </h2>
          </div>

          <div className="bg-white rounded-3xl p-6">
            <p>Ready Orders</p>
            <h2 className="text-5xl font-bold">
              {stats.readyOrders}
            </h2>
          </div>

          <div className="bg-white rounded-3xl p-6">
            <p>Active Riders</p>
            <h2 className="text-5xl font-bold">
              {stats.riders}
            </h2>
          </div>

          <div className="bg-white rounded-3xl p-6">
            <p>Deliveries</p>
            <h2 className="text-5xl font-bold">
              {stats.deliveries}
            </h2>
          </div>

        </div>

        <div
          className="
            bg-white
            rounded-3xl
            p-6
          "
        >

          <h2
            className="
              text-2xl
              font-bold
              mb-6
            "
          >
            Orders Waiting Assignment
          </h2>

          {readyOrdersList.length === 0 && (

            <p className="text-gray-500">
              No orders waiting
            </p>

          )}

          {readyOrdersList.map(
            (order) => (

              <div
                key={order.id}
                className="
                  border
                  rounded-2xl
                  p-4
                  mb-4
                "
              >

                <h3 className="font-bold">
                  #{order.id.slice(0,8)}
                </h3>

                <p>
                  {order.vendors?.name}
                </p>

                <p>
                  {order.delivery_address}
                </p>

                <div
                  className="
                    flex
                    justify-between
                    mt-3
                  "
                >

                  <span>
                    Ready For Pickup
                  </span>

                  <span>
                    ₦{Number(
                      order.total
                    ).toLocaleString()}
                  </span>

                </div>

                <button
                  onClick={() => {

                    setSelectedOrder(
                      order
                    );

                    setShowAssignModal(
                      true
                    );

                  }}
                  className="
                    mt-4
                    w-full
                    bg-black
                    text-white
                    py-3
                    rounded-xl
                  "
                >
                  Assign Rider
                </button>

              </div>

            )
          )}

        </div>

      </section>

      {showAssignModal && (

        <div
          className="
            fixed
            inset-0
            bg-black/50
            flex
            items-center
            justify-center
            z-50
          "
        >

          <div
            className="
              bg-white
              rounded-3xl
              p-8
              w-full
              max-w-lg
            "
          >

            <h2
              className="
                text-3xl
                font-bold
                mb-6
              "
            >
              Assign Rider
            </h2>

            <div className="space-y-4">

              {riders.map(
                (rider) => (

                  <div
                    key={rider.id}
                    className="
                      border
                      rounded-2xl
                      p-4
                      flex
                      justify-between
                      items-center
                    "
                  >

                    <div>

                      <h3
                        className="
                          font-bold
                        "
                      >
                        {rider.full_name}
                      </h3>

                      <p
                        className="
                          text-sm
                          text-gray-500
                        "
                      >
                        {rider.phone ||
                          "No Phone"}
                      </p>

                    </div>

                    <button
                      onClick={() =>
                        assignRider(
                          rider.id
                        )
                      }
                      className="
                        bg-orange-500
                        text-white
                        px-4
                        py-2
                        rounded-xl
                      "
                    >
                      Assign
                    </button>

                  </div>

                )
              )}

            </div>

          </div>

        </div>

      )}

    </main>

  );

}