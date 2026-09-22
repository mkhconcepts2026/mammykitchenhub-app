export interface RiderRecord {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;

  available_balance: number;
  pending_balance: number;
  lifetime_earnings: number;

  updated_at: string | null;
}