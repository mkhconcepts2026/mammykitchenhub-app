import { requireActiveRider, paystackRequest, riderJson } from "@/lib/rider-payouts/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireActiveRider();
  if ("response" in access) return access.response;
  try {
    const payload = await paystackRequest<any>("/bank?currency=NGN&perPage=300");
    const banks = Array.isArray(payload.data) ? payload.data
      .filter((bank: any) => bank?.active !== false && bank?.code && bank?.name)
      .map((bank: any) => ({ name: String(bank.name), code: String(bank.code) }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name)) : [];
    return riderJson({ success: true, banks, mode: "test" });
  } catch (error) {
    return riderJson({ success: false, message: error instanceof Error ? error.message : "Unable to load TEST bank list." }, 502);
  }
}
