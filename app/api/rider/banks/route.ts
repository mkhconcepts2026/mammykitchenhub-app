import { requireActiveRider, paystackRequest, riderJson } from "@/lib/rider-payouts/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireActiveRider();
  if ("response" in access) return access.response;
  try {
    const payload = await paystackRequest<any>("/bank?currency=NGN&perPage=300");
    // Paystack may return more than one row with the same bank code.
    // A bank code is the transfer destination identifier, so the dropdown
    // must contain only one option per normalized code.
    const uniqueBanks = new Map<string, { name: string; code: string }>();
    if (Array.isArray(payload.data)) {
      for (const bank of payload.data) {
        if (bank?.active === false || !bank?.code || !bank?.name) continue;
        const code = String(bank.code).trim();
        const name = String(bank.name).trim();
        if (!code || !name || uniqueBanks.has(code)) continue;
        uniqueBanks.set(code, { name, code });
      }
    }
    const banks = [...uniqueBanks.values()].sort((a, b) => a.name.localeCompare(b.name));
    return riderJson({ success: true, banks, mode: "test" });
  } catch (error) {
    return riderJson({ success: false, message: error instanceof Error ? error.message : "Unable to load TEST bank list." }, 502);
  }
}
