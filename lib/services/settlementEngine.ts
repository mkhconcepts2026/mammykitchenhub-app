import { Settlement } from "@/types/settlement";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export async function processSettlement(
  settlement: Settlement
) {
  console.log("========================================");
  console.log("🚀 processSettlement() STARTED");
  console.log("========================================");

  console.log("SETTLEMENT INPUT:", settlement);

  /* ----------------------------------
     1. Verify authenticated user
  ---------------------------------- */

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  console.log("SETTLEMENT AUTH USER:", {
    userId: user?.id ?? null,
    authError,
  });

  if (authError) {
    console.error(
      "❌ SETTLEMENT AUTHENTICATION FAILED:",
      authError
    );

    return {
      success: false,
      stage: "authentication",
      error: authError,
    };
  }

  if (!user) {
    console.error(
      "❌ SETTLEMENT FAILED — NO AUTHENTICATED USER"
    );

    return {
      success: false,
      stage: "authentication",
      error: {
        message: "Authentication required for settlement",
      },
    };
  }

  /* ----------------------------------
     2. Execute atomic database settlement
  ---------------------------------- */

  console.log(
    "💰 CALLING ATOMIC SETTLEMENT RPC"
  );

  const { data, error } = await supabase.rpc(
    "process_order_settlement",
    {
      p_order_id: settlement.order_id,
      p_reference: settlement.id,
      p_territory_id:
        settlement.territory_id ?? null,
    }
  );

  console.log("SETTLEMENT RPC RESULT:", {
    data,
    error,
  });

  /* ----------------------------------
     3. RPC failure
  ---------------------------------- */

  if (error) {
    console.error(
      "❌ SETTLEMENT RPC FAILED:",
      error
    );

    return {
      success: false,
      stage: "settlement_rpc",
      error,
    };
  }

  /* ----------------------------------
     4. Validate RPC response
  ---------------------------------- */

  if (!data || data.success !== true) {
    console.error(
      "❌ SETTLEMENT RPC RETURNED FAILURE:",
      data
    );

    return {
      success: false,
      stage: "settlement_rpc",
      error: {
        message:
          data?.message ??
          "Settlement RPC returned an unsuccessful result",
      },
      data,
    };
  }

  /* ----------------------------------
     5. Already-settled order
  ---------------------------------- */

  if (data.already_settled === true) {
    console.log(
      "ℹ️ ORDER ALREADY SETTLED — NO DUPLICATE WRITES"
    );

    console.log(
      "Order:",
      settlement.order_id
    );

    console.log(
      "Rider:",
      data.rider_id
    );

    console.log("========================================");

    return {
      success: true,
      already_settled: true,
      rider_id: data.rider_id,
      data,
    };
  }

  /* ----------------------------------
     6. Settlement successful
  ---------------------------------- */

  console.log("========================================");
  console.log(
    "✅ ATOMIC SETTLEMENT COMPLETED SUCCESSFULLY"
  );
  console.log(
    "Order:",
    settlement.order_id
  );
  console.log(
    "Rider:",
    data.rider_id
  );
  console.log(
    "Vendor:",
    data.vendor_id
  );
  console.log(
    "Rider Amount:",
    data.rider_amount
  );
  console.log(
    "Vendor Amount:",
    data.vendor_amount
  );
  console.log(
    "Platform Amount:",
    data.platform_amount
  );
  console.log(
    "Delivery Amount:",
    data.delivery_amount
  );
  console.log("========================================");

  return {
    success: true,
    already_settled: false,
    rider_id: data.rider_id,
    data,
  };
}