export type FinancialEventType =
  | "settlement_created"
  | "wallet_updated"
  | "ledger_entry_created"
  | "vendor_paid"
  | "rider_paid";

export interface FinancialEvent {
  type: FinancialEventType;
  reference: string;
  payload: Record<string, any>;
  created_at: string;
}

const listeners: Record<
  FinancialEventType,
  ((event: FinancialEvent) => Promise<void> | void)[]
> = {
  settlement_created: [],
  wallet_updated: [],
  ledger_entry_created: [],
  vendor_paid: [],
  rider_paid: [],
};

export function subscribe(
  type: FinancialEventType,
  listener: (event: FinancialEvent) => Promise<void> | void
) {
  listeners[type].push(listener);
}

export async function publish(event: FinancialEvent) {
  for (const listener of listeners[event.type]) {
    await listener(event);
  }
}