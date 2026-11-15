import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireOperationalEmployee } from "@/lib/server/operationalEmployeeContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VHA_ROLES = ["vha", "vendorhubagent"];

export async function GET() {
  const result = await requireOperationalEmployee(VHA_ROLES, "Vendor Hub Agent");
  if ("response" in result) return result.response;
  const { employee, profile } = result.context;

  const { data: assignments, error: assignmentError } = await adminClient
    .from("vendor_hub_agent_assignments")
    .select("vendor_id, assigned_at, status, deactivated_at")
    .eq("employee_id", employee.id)
    .eq("status", "active")
    .is("deactivated_at", null)
    .order("assigned_at", { ascending: false });

  if (assignmentError) {
    console.error("VHA assignment lookup failed:", assignmentError.message);
    return NextResponse.json(
      { success: false, message: "Unable to load your current vendor assignment." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!assignments?.length) {
    return NextResponse.json(
      { success: true, assigned: false, message: "No active vendor is assigned to your VHA account." },
      { headers: { "Cache-Control": "no-store, private" } }
    );
  }

  if (assignments.length !== 1) {
    return NextResponse.json(
      { success: false, assigned: false, message: "Your account has multiple active vendor assignments. Please contact Admin to resolve them." },
      { status: 409, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { data: vendor, error: vendorError } = await adminClient
    .from("vendors")
    .select("id, name, status, location, owner_name")
    .eq("id", assignments[0].vendor_id)
    .maybeSingle();

  if (vendorError || !vendor || String(vendor.status ?? "").toLowerCase() !== "active") {
    return NextResponse.json(
      { success: false, assigned: false, message: "Your assigned vendor is missing or inactive." },
      { status: 409, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { data: orders, error: ordersError } = await adminClient
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      created_at,
      delivered_at,
      rider_id,
      order_items!order_items_order_id_fkey (
        id,
        name,
        quantity
      )
    `)
    .eq("vendor_id", vendor.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (ordersError) {
    console.error("VHA orders lookup failed:", ordersError.message);
    return NextResponse.json(
      { success: false, message: "Unable to load orders for your assigned vendor." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const orderRows = orders ?? [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const statuses = orderRows.map((order: any) => String(order.status ?? "").toLowerCase());
  const metrics = {
    activeOrders: statuses.filter((status: string) => ["pending", "accepted", "preparing", "ready_for_pickup", "assigned", "picked_up"].includes(status)).length,
    awaitingAcceptance: statuses.filter((status: string) => status === "pending").length,
    preparing: statuses.filter((status: string) => status === "preparing").length,
    readyForPickup: statuses.filter((status: string) => status === "ready_for_pickup").length,
    completedToday: orderRows.filter((order: any) => String(order.status ?? "").toLowerCase() === "delivered" && order.delivered_at && new Date(order.delivered_at).getTime() >= today.getTime()).length,
  };

  const riderIds = [...new Set(orderRows.map((order: any) => order.rider_id).filter(Boolean))] as string[];
  const { data: riderProfiles } = riderIds.length
    ? await adminClient.from("profiles").select("id, full_name").in("id", riderIds)
    : { data: [] as any[] };
  const riderNameById = new Map((riderProfiles ?? []).map((rider: any) => [rider.id, rider.full_name]));

  return NextResponse.json(
    {
      success: true,
      assigned: true,
      agent: {
        name: [employee.first_name, employee.last_name].filter(Boolean).join(" ") || profile.full_name || "Vendor Hub Agent",
      },
      vendor,
      metrics,
      orders: orderRows.map((order: any) => ({
        ...order,
        rider_name: order.rider_id ? riderNameById.get(order.rider_id) ?? "Assigned rider" : null,
      })),
      refreshedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store, private" } }
  );
}
