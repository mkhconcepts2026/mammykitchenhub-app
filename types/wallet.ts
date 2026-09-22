export interface Wallet {

  id: string;

  owner_id: string;

  owner_type:
    | "vendor"
    | "rider"
    | "mkh";

  available_balance: number;

  pending_balance: number;

  locked_balance: number;

  settled_balance: number;

  lifetime_earnings: number;

  updated_at: string;

}

export interface WalletTransaction {

  id: string;

  wallet_id: string;

  ledger_entry_id: string;

  amount: number;

  transaction_type:
    | "credit"
    | "debit";

  balance_after: number;

  created_at: string;

}