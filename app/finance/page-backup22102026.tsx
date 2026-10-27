"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import FinanceHeader from "./FinanceHeader";
import RevenueOverview from "./RevenueOverview";
import ExecutiveSummary from "./ExecutiveSummary";
import RevenueAnalytics from "./RevenueAnalytics";
import SettlementCentre from "./SettlementCentre";
import RecentFinancialActivity from "./RecentFinancialActivity";
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

    await loadFinanceStats();
    return true;
  }

  async function markProcessing(request: any) {
    const action =
      request.status === "pending" ? "approve" : "start_processing";

    const label =
      action === "approve" ? "approve" : "start processing";

    if (!confirm(`Are you sure you want to ${label} this payout?`)) {
      return;
    }

    await runPayoutAction(request, action);
  }

  async function markPaid(request: any) {
    if (request.status !== "transfer_submitted") {
      alert("Submit the transfer and record its reference before marking this payout as paid.");
      return;
    }

    if (!request.transfer_reference) {
      alert("A transfer reference is missing. Do not mark this payout as paid.");
      return;
    }

    if (!confirm(
      `Confirm the bank transfer succeeded for reference ${request.transfer_reference}?`
    )) {
      return;
    }

    await runPayoutAction(request, "mark_paid");
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
          <SettlementCentre

            payoutRequests={
              payoutRequests
            }

            vendorsMap={
              vendorsMap
            }

            markProcessing={
              markProcessing
            }

            markPaid={
              markPaid
            }

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