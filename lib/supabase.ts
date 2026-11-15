import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase public environment configuration.");
}

// Use the same cookie-aware browser client pattern as lib/supabase/client.ts.
// This preserves the signed-in user's session for RLS-protected Data API requests.
export const supabase = createBrowserClient(
  supabaseUrl,
  supabaseAnonKey
);