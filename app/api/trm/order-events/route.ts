import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireOperationalEmployee } from "@/lib/server/operationalEmployeeContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRM_ROLES = ["trm", "territory", "territorymanager", "territoryrelationshipmanager"];

export async function GET(request: Request) {
  const access = await requireOperationalEmployee(TRM_ROLES, "Territory Relationship Manager");
  if ("response" in access) return access.response;

  const orderId = new URL(request.url).searchParams.get("orderId")?.trim() || "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
    return NextResponse.json({ success: false, message: "A valid order ID is required." }, { status: 400 });
  }

  try {
    const { data: assignments, error: assignmentError } = await adminClient
      .from("mkh_trm_territory_assignments")
      .select("territory_id")
      .eq("employee_id", access.context.employee.id)
      .eq("status", "active")
      .limit(2);
    if (assignmentError || assignments?.length !== 1) {
      return NextResponse.json({ success: false, message: "A single active territory assignment is required." }, { status: 409 });
    }

    const { data: zones, error: zonesError } = await adminClient
      .from("zones")
      .select("id")
      .eq("territory_id", assignments[0].territory_id)
      .eq("is_active", true);
    if (zonesError) throw new Error("Unable to verify the assigned territory.");

    const zoneIds = (zones ?? []).map((row: any) => row.id).filter(Boolean);
    if (!zoneIds.length) return NextResponse.json({ success: true, events: [] }, { headers: { "Cache-Control": "no-store, private" } });

    const { data: links, error: linksError } = await adminClient
      .from("zone_vendors")
      .select("vendor_id")
      .in("zone_id", zoneIds)
      .eq("status", "active")
      .is("unassigned_at", null);
    if (linksError) throw new Error("Unable to verify territory vendors.");
    const candidateVendorIds = [...new Set((links ?? []).map((row: any) => row.vendor_id).filter(Boolean))] as string[];
    if (!candidateVendorIds.length) return NextResponse.json({ success: true, events: [] }, { headers: { "Cache-Control": "no-store, private" } });
    const { data: allActiveLinks, error: allActiveLinksError } = await adminClient
      .from("zone_vendors")
      .select("vendor_id, zone_id")
      .in("vendor_id", candidateVendorIds)
      .eq("status", "active")
      .is("unassigned_at", null);
    if (allActiveLinksError) throw new Error("Unable to validate unique vendor territory assignments.");
    const linksByVendor = new Map<string, any[]>();
    for (const link of allActiveLinks ?? []) {
      const existing = linksByVendor.get(link.vendor_id) ?? [];
      existing.push(link);
      linksByVendor.set(link.vendor_id, existing);
    }
    const vendorIds = candidateVendorIds.filter((id) => {
      const activeLinks = linksByVendor.get(id) ?? [];
      return activeLinks.length === 1 && zoneIds.includes(activeLinks[0].zone_id);
    });
    if (!vendorIds.length) return NextResponse.json({ success: true, events: [] }, { headers: { "Cache-Control": "no-store, private" } });

    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select("id, vendor_id")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw new Error("Unable to verify the requested order.");
    if (!order || !vendorIds.includes(order.vendor_id)) {
      return NextResponse.json({ success: false, message: "This order is outside your assigned territory." }, { status: 403 });
    }

    const { data: events, error: eventsError } = await adminClient
      .from("order_events")
      .select("id, order_id, event_type, title, description, actor_type, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (eventsError) throw new Error("Unable to load this order's audit trail.");

    return NextResponse.json({ success: true, events: events ?? [] }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load the order audit trail.";
    console.error("TRM order audit request failed:", message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
