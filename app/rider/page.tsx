"use client";

import { useCallback, useEffect, useState } from "react";

type RiderWallet = {
  rider_id: string;
  available_balance: number | string | null;
  pending_balance: number | string | null;
  lifetime_earnings: number | string | null;
  updated_at: string | null;
};

type WalletResponse = {
  success?: boolean;
  active?: boolean;
  wallet?: RiderWallet | null;
  message?: string;
};

const money = (value: number | string | null | undefined) => {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
};

const dateTime = (value: string | null | undefined) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(date);
};

function BalanceCard({
  title,
  amount,
  description,
}: {
  title: string;
  amount: string;
  description: string;
}) {
  return (
    <section
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 22,
        minWidth: 0,
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
      }}
    >
      <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>{title}</p>
      <p
        style={{
          color: "#0f172a",
          fontSize: "clamp(1.35rem, 3vw, 1.8rem)",
          fontWeight: 700,
          letterSpacing: "-0.03em",
          margin: "12px 0 8px",
          overflowWrap: "anywhere",
        }}
      >
        {amount}
      </p>
      <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5, margin: 0 }}>
        {description}
      </p>
    </section>
  );
}

export default function RiderPage() {
  const [wallet, setWallet] = useState<RiderWallet | null>(null);
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadWallet = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/rider/wallet", {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const result = (await response.json()) as WalletResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to load your rider wallet.");
      }

      setWallet(result.wallet ?? null);
      setHasWallet(Boolean(result.active && result.wallet));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your rider wallet. Please try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#0f172a",
        padding: "clamp(20px, 4vw, 40px)",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 28,
          }}
        >
          <div>
            <p
              style={{
                color: "#15803d",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.12em",
                margin: "0 0 8px",
                textTransform: "uppercase",
              }}
            >
              Mammy Kitchen Hub
            </p>
            <h1
              style={{
                fontSize: "clamp(1.8rem, 4vw, 2.4rem)",
                letterSpacing: "-0.04em",
                lineHeight: 1.15,
                margin: 0,
              }}
            >
              Rider Dashboard
            </h1>
            <p style={{ color: "#64748b", lineHeight: 1.6, margin: "10px 0 0" }}>
              Your earnings and wallet overview.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadWallet(true)}
            disabled={loading || refreshing}
            style={{
              background: "#166534",
              border: 0,
              borderRadius: 10,
              color: "#ffffff",
              cursor: loading || refreshing ? "wait" : "pointer",
              fontSize: 14,
              fontWeight: 700,
              padding: "12px 16px",
              opacity: loading || refreshing ? 0.7 : 1,
            }}
          >
            {refreshing ? "Refreshingâ€¦" : "Refresh wallet"}
          </button>
        </header>

        {error ? (
          <section
            role="alert"
            style={{
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              borderRadius: 14,
              color: "#9a3412",
              padding: 18,
              marginBottom: 22,
            }}
          >
            <p style={{ fontWeight: 700, margin: "0 0 6px" }}>
              Wallet could not be loaded
            </p>
            <p style={{ lineHeight: 1.5, margin: "0 0 12px" }}>{error}</p>
            <button
              type="button"
              onClick={() => void loadWallet(true)}
              style={{
                background: "#9a3412",
                border: 0,
                borderRadius: 8,
                color: "#ffffff",
                cursor: "pointer",
                fontWeight: 700,
                padding: "9px 12px",
              }}
            >
              Try again
            </button>
          </section>
        ) : loading ? (
          <section
            aria-live="polite"
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              color: "#64748b",
              padding: 28,
            }}
          >
            Loading your walletâ€¦
          </section>
        ) : !hasWallet ? (
          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: 24,
            }}
          >
            <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>
              Your wallet is not available yet
            </h2>
            <p style={{ color: "#64748b", lineHeight: 1.6, margin: 0 }}>
              No rider wallet record was returned for your account. Your balance
              has not been estimated or created here. Please contact MKH support
              if you believe this is unexpected.
            </p>
          </section>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))",
                gap: 16,
              }}
            >
              <BalanceCard
                title="Available balance"
                amount={money(wallet?.available_balance)}
                description="Balance currently recorded as available in your rider wallet."
              />
              <BalanceCard
                title="Pending earnings"
                amount={money(wallet?.pending_balance)}
                description="Earnings still pending settlement or release."
              />
              <BalanceCard
                title="Lifetime earnings"
                amount={money(wallet?.lifetime_earnings)}
                description="Cumulative earnings recorded in your rider wallet."
              />
            </div>

            <section
              style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                marginTop: 20,
                padding: 22,
              }}
            >
              <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>
                Wallet update
              </h2>
              <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>
                Last updated: {dateTime(wallet?.updated_at)}
              </p>
            </section>
          </>
        )}

        <section
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 16,
            marginTop: 20,
            padding: 20,
          }}
        >
          <h2 style={{ color: "#166534", fontSize: 16, margin: "0 0 8px" }}>
            Monday withdrawal eligibility
          </h2>
          <p style={{ color: "#166534", lineHeight: 1.6, margin: 0 }}>
            MKH rider earnings follow the Monday withdrawal-eligibility rule.
            This dashboard is read-only: it does not request a withdrawal or
            change wallet balances. Withdrawals must use the approved rider
            payout process and the bank account registered to your rider account.
          </p>
        </section>

        <p
          style={{
            color: "#94a3b8",
            fontSize: 12,
            lineHeight: 1.5,
            margin: "24px 0 0",
          }}
        >
          Wallet figures are read from MKH records. If a figure looks incorrect,
          contact MKH support rather than attempting to change it here.
        </p>
      </div>
    </main>
  );
}

