"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  order: any;
}

export default function AuditTrail({ order }: Props) {

      const supabase = createClient();

 const [orderEvents, setOrderEvents] = useState<any[]>([]);
    
 useEffect(() => {
  if (!order?.id) return;

  async function loadOrderEvents() {
    const { data, error } = await supabase
      .from("order_events")
      .select("*")
      .eq("order_id", order.id)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error(error);
      return;
    }

    setOrderEvents(data || []);
  }

  loadOrderEvents();
}, [order?.id]);

  if (!order) return null;

 
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-8 py-6">
        <h2 className="text-2xl font-bold text-slate-900">
          Audit Trail
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Complete operational history for this order.
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {orderEvents.map((event) => (
          <div
            key={event.title}
            className="flex items-center justify-between px-8 py-5"
          >
            <div>
              <h3 className="font-semibold text-slate-900">
                {event.title}
              </h3>
            </div>

            <div className="text-right">
              <p className="text-sm font-medium text-slate-700">
                {new Date(event.created_at).toLocaleDateString()}
              </p>

              <p className="text-sm text-slate-500">
                {new Date(event.created_at).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
