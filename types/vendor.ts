export interface VendorRecord {
  id: string;

  name: string;

  cuisine: string | null;

  email: string | null;

  phone: string | null;

  owner_name: string | null;

  status: string | null;

  rating: number;

  available_balance: number;

  pending_balance: number;

  lifetime_earnings: number;
}