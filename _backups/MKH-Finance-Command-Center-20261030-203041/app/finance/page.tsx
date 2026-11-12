"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import FinanceHeader from "./FinanceHeader";
import RevenueOverview from "./RevenueOverview";
import ExecutiveSummary from "./ExecutiveSummary";
import RevenueAnalytics from "./RevenueAnalytics";
import SettlementCentre from "./SettlementCentre";
import RecentFinancialActivity from "./RecentFinancialActivity";
import FinanceControlRoom from "@/components/finance/FinanceControlRoom";
import { createClient } from "@/lib/supabase/client";

type FinanceOrderRow = {
  total: number | string | null;
  mkh_amount: number | string | null;
  platform_fee: number | string | null;
  delivery_fee: number | string | null;
  created_at: string;
};

export default function FinancePage() {

  const supabase =
    createClient();

  const [ordersLoadError, setOrdersLoadError] =
    useState(false);

  const [stats, setStats] =
    useState({

      totalRevenue: 0,

      platformRevenue: 0,

      deliveryRevenue: 0,

      pendingPayouts: 0,

      processingPayouts: 0,

      paidPayouts: 0

    });

  const [
    payoutRequests,
    setPayoutRequests
  ] = useState<any[]>([]);

  const [
    vendorsMap,
    setVendorsMap
  ] = useState<
    Record<string, string>
  >({});

  const [summary, setSummary] =
    useState({

      totalOrders: 0,

      averageRevenue: 0,

      pendingRequests: 0,

      completedPayouts: 0

    });

  const [
    revenueTrends,
    setRevenueTrends
  ] = useState({

    averageOrderValue: 0,

    highestRevenueDay: "",

    highestRevenueAmount: 0,

    yesterdayRevenue: 0,

    lastWeekRevenue: 0,

    todayGrowth: 0,

    weekGrowth: 0

  });

  const [
    revenueAnalytics,
    setRevenueAnalytics
  ] = useState({

    today: 0,

    week: 0,

    month: 0

  });

  const [
    searchTerm,
    setSearchTerm
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter
  ] = useState("All Status");

  async function loadFinanceStats() {

    const {
      data: payouts
    } =
      await supabase
        .from(
          "payout_requests"
        )
        .select("*")
        .order(
          "requested_at",
          {
            ascending: false
          }
        );

    setPayoutRequests(
      payouts || []
    );

    const {
      data: vendors
    } =
      await supabase
        .from("vendors")
        .select(`
    id,
    name
  `);

    const map:
      Record<string, string> = {};

    (vendors || []).forEach(
      (vendor) => {

        map[
          vendor.id
        ] =
          vendor.name;

      }
    );

    setVendorsMap(
      map
    );

    const {
      data: orderRows,
      error: ordersError,
    } = await (supabase as any).rpc(
      "finance_get_order_financial_rows"
    );

    const orders: FinanceOrderRow[] =
      (orderRows ?? []) as FinanceOrderRow[];

    setOrdersLoadError(Boolean(ordersError));

    if (ordersError) {
      console.error(
        "Finance order reporting query failed:",
        ordersError
      );
    }

    const {
      data: pendingPayouts
    } =
      await supabase
        .from("payout_requests")
        .select("amount")
        .eq(
          "status",
          "pending"
        );

    const {
      data: processingPayouts
    } =
      await supabase
        .from("payout_requests")
        .select("amount")
        .eq(
          "status",
          "processing"
        );

    const {
      data: paidPayouts
    } =
      await supabase
        .from("payout_requests")
        .select("amount")
        .eq(
          "status",
          "paid"
        );

    /* ---------- DATE CALCULATIONS ---------- */

    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    const weekStart =
      new Date(today);

    weekStart.setDate(
      today.getDate() -
      today.getDay()
    );

    const monthStart =
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      );

    const yesterday =
      new Date(today);

    yesterday.setDate(
      today.getDate() - 1
    );

    const lastWeekStart =
      new Date(weekStart);

    lastWeekStart.setDate(
      weekStart.getDate() - 7
    );

    /* ---------- REVENUE TOTALS ---------- */

    const totalRevenue =
      (orders || []).reduce(

        (sum, order) =>

          sum +

          Number(
            order.mkh_amount || 0
          ),

        0

      );

    const todayRevenue =
      (orders || [])

        .filter(

          (order) =>

            new Date(
              order.created_at
            ) >= today

        )

        .reduce(

          (sum, order) =>

            sum +

            Number(
              order.mkh_amount || 0
            ),

          0

        );

    const weekRevenue =
      (orders || [])

        .filter(

          (order) =>

            new Date(
              order.created_at
            ) >= weekStart

        )

        .reduce(

          (sum, order) =>

            sum +

            Number(
              order.mkh_amount || 0
            ),

          0

        );

    const monthRevenue =
      (orders || [])

        .filter(

          (order) =>

            new Date(
              order.created_at
            ) >= monthStart

        )

        .reduce(

          (sum, order) =>

            sum +

            Number(
              order.mkh_amount || 0
            ),

          0

        );

    const yesterdayRevenue =
      (orders || [])

        .filter((order) => {

          const orderDate =
            new Date(
              order.created_at
            );

          return (

            orderDate >= yesterday &&

            orderDate < today

          );

        })

        .reduce(

          (sum, order) =>

            sum +

            Number(
              order.mkh_amount || 0
            ),

          0

        );

    const lastWeekRevenue =
      (orders || [])

        .filter((order) => {

          const orderDate =
            new Date(
              order.created_at
            );

          return (

            orderDate >= lastWeekStart &&

            orderDate < weekStart

          );

        })

        .reduce(

          (sum, order) =>

            sum +

            Number(
              order.mkh_amount || 0
            ),

          0

        );

    const averageOrderValue =
      (orders && orders.length > 0)

        ? Math.round(

          orders.reduce(

            (sum, order) =>

              sum +

              Number(
                order.total || 0
              ),

            0

          )

          /

          orders.length

        )

        : 0;

    const revenueByDay:
      Record<string, number> = {};

    (orders || []).forEach(
      (order) => {

        const day =
          new Date(
            order.created_at
          ).toLocaleDateString(
            "en-NG",
            {
              weekday: "long"
            }
          );

        revenueByDay[day] =

          (revenueByDay[day] || 0)

          +

          Number(
            order.mkh_amount || 0
          );

      }
    );

    let highestRevenueDay = "";

    let highestRevenueAmount = 0;

    Object.entries(
      revenueByDay
    ).forEach(

      ([day, amount]) => {

        if (
          amount >
          highestRevenueAmount
        ) {

          highestRevenueDay =
            day;

          highestRevenueAmount =
            amount;

        }

      }

    );

    const platformRevenue =
      (orders || []).reduce(

        (sum, order) =>

          sum +
          Number(
            order.platform_fee || 0
          ),

        0

      );

    const deliveryRevenue =
      (orders || []).reduce(

        (sum, order) =>

          sum +

          (
            Number(
              order.mkh_amount || 0
            )

            -

            Number(
              order.platform_fee || 0
            )
          ),

        0

      );

    const pendingAmount =
      (pendingPayouts || []).reduce(

        (sum, payout) =>

          sum +
          Number(
            payout.amount || 0
          ),

        0

      );

    const processingAmount =
      (processingPayouts || []).reduce(

        (sum, payout) =>

          sum +
          Number(
            payout.amount || 0
          ),

        0

      );

    const paidAmount =
      (paidPayouts || []).reduce(

        (sum, payout) =>

          sum +
          Number(
            payout.amount || 0
          ),

        0

      );

    setStats({

      totalRevenue,

      platformRevenue,

      deliveryRevenue,

      pendingPayouts:
        pendingAmount,

      processingPayouts:
        processingAmount,

      paidPayouts:
        paidAmount

    });

    setSummary({

      totalOrders:
        orders?.length || 0,

      averageRevenue:
        orders && orders.length > 0

          ? Math.round(
            totalRevenue /
            orders.length
          )

          : 0,

      pendingRequests:
        pendingPayouts?.length || 0,

      completedPayouts:
        paidPayouts?.length || 0

    });

    setRevenueAnalytics({

      today:
        todayRevenue,

      week:
        weekRevenue,

      month:
        monthRevenue

    });

    setRevenueTrends({

      averageOrderValue,

      highestRevenueDay,

      highestRevenueAmount,

      yesterdayRevenue,

      lastWeekRevenue,

      todayGrowth: 0,

      weekGrowth: 0

    });

  }



  useEffect(() => {

    loadFinanceStats();

  }, []);

  async function runPayoutAction(
    request: any,
    action: string,
    reason?: string,
    transferReference?: string
  ) {
    if (request.requester_type !== "vendor") {
      alert("This action is available only for vendor payout requests.");
      return false;
    }

    const { data: result, error } = await supabase.rpc(
      "resolve_vendor_payout",
      {
        p_payout_request_id: request.id,
        p_action: action,
        p_reason: reason ?? null,
        p_transfer_reference: transferReference ?? null,
      }
    );

    if (error) {
      alert(`Payout action failed: ${error.message}`);
      return false;
    }

    if (!result?.success) {
      alert(result?.message ?? "Payout action could not be completed.");
      return false;
    }

    alert(result.message ?? "Payout action completed.");
    await loadFinanceStats();
    return true;
  }

  async function approvePayout(request: any) {
    if (request.status !== "pending") return;
    if (!confirm("Approve this vendor payout request?")) return;
    await runPayoutAction(request, "approve");
  }

  async function startProcessing(request: any) {
    if (request.status !== "approved") return;
    if (!confirm("Start processing this approved payout?")) return;
    await runPayoutAction(request, "start_processing");
  }

  async function submitTransfer(request: any) {
    if (request.status !== "processing") return;

    const reference = window.prompt(
      "Enter the bank transfer reference after initiating the transfer. Do not mark the payout paid until success is verified."
    );
    if (!reference?.trim()) {
      alert("A transfer reference is required.");
      return;
    }
    if (!confirm(
      `Record transfer reference "${reference.trim()}" and mark this payout as transfer submitted?`
    )) return;

    await runPayoutAction(
      request,
      "submit_transfer",
      undefined,
      reference.trim()
    );
  }

  async function markPaid(request: any) {
    if (request.status !== "transfer_submitted") return;
    if (!request.transfer_reference) {
      alert("A transfer reference is missing. Do not mark this payout as paid.");
      return;
    }
    if (!confirm(
      `Have you independently verified that the transfer succeeded for reference "${request.transfer_reference}"?`
    )) return;

    await runPayoutAction(request, "mark_paid");
  }

  async function holdPayout(request: any) {
    const reason = window.prompt("Enter the reason for placing this payout on hold:");
    if (!reason?.trim()) {
      alert("A reason is required to place a payout on hold.");
      return;
    }
    if (!confirm("Place this payout on hold? Its reserved funds will remain reserved.")) return;
    await runPayoutAction(request, "hold", reason.trim());
  }

  async function resumePayout(request: any) {
    if (request.status !== "on_hold") return;
    if (!confirm("Resume this payout to its previous status? Only do this after any transfer uncertainty has been resolved.")) return;
    await runPayoutAction(request, "resume");
  }

  async function rejectPayout(request: any) {
    if (!["pending", "approved"].includes(request.status)) return;
    const reason = window.prompt("Enter the reason for rejecting this payout:");
    if (!reason?.trim()) {
      alert("A rejection reason is required.");
      return;
    }
    if (!confirm("Reject this payout and restore its reserved funds?")) return;
    await runPayoutAction(request, "reject", reason.trim());
  }

  async function reportTransferFailure(request: any) {
    if (!["processing", "transfer_submitted"].includes(request.status)) return;
    const reason = window.prompt(
      "Describe the verified transfer failure. Use this only after confirming the transfer did not succeed."
    );
    if (!reason?.trim()) {
      alert("A reason is required.");
      return;
    }
    if (!confirm("Confirm the transfer failed and the reserved funds should be restored?")) return;
    await runPayoutAction(request, "confirm_transfer_failure", reason.trim());
  }

  return (

    <main
      className="
        min-h-screen
        bg-slate-50
        p-8
      "
    >

      <div
        className="
          max-w-7xl
          mx-auto
        "
      >

        <FinanceHeader />

        {ordersLoadError && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            Order financial data could not be loaded. Revenue figures may
            be incomplete. Please contact the system administrator.
          </div>
        )}


        <RevenueOverview

          totalRevenue={
            stats.totalRevenue
          }

          platformRevenue={
            stats.platformRevenue
          }

          deliveryRevenue={
            stats.deliveryRevenue
          }

          pendingPayouts={
            stats.pendingPayouts
          }

          processingPayouts={
            stats.processingPayouts
          }

          paidPayouts={
            stats.paidPayouts
          }

        />

                 <ExecutiveSummary
            totalOrders={
              summary.totalOrders
            }
            averageRevenue={
              summary.averageRevenue
            }
            pendingRequests={
              summary.pendingRequests
            }
            completedPayouts={
              summary.completedPayouts
            }
          />

          <RevenueAnalytics

            todayRevenue={
              revenueAnalytics.today
            }

            weekRevenue={
              revenueAnalytics.week
            }

            monthRevenue={
              revenueAnalytics.month
            }

            averageOrderValue={
              revenueTrends.averageOrderValue
            }

            highestRevenueDay={
              revenueTrends.highestRevenueDay
            }

            highestRevenueAmount={
              revenueTrends.highestRevenueAmount
            }

          />
          <FinanceControlRoom />

          <SettlementCentre

            payoutRequests={
              payoutRequests
            }

            vendorsMap={
              vendorsMap
            }

            approvePayout={approvePayout}
            startProcessing={startProcessing}
            submitTransfer={submitTransfer}
            markPaid={markPaid}
            holdPayout={holdPayout}
            resumePayout={resumePayout}
            rejectPayout={rejectPayout}
            reportTransferFailure={reportTransferFailure}

          />

   <RecentFinancialActivity

  payoutRequests={
    payoutRequests
  }

  vendorsMap={
    vendorsMap
  }

  searchTerm={
    searchTerm
  }

  setSearchTerm={
    setSearchTerm
  }

  statusFilter={
    statusFilter
  }

  setStatusFilter={
    setStatusFilter
  }

/>

        </div>

    </main>

  );

}