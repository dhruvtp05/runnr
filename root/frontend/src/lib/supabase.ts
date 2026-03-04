import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Server-side (API routes): uses SUPABASE_SERVICE_ROLE_KEY so the app can
 * read/write while RLS blocks direct anon access. Never expose the service
 * role key to the client.
 * Client-side: not used (all DB access goes through Next.js API routes).
 */
export function getSupabase(): SupabaseClient {
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  const isServer = typeof window === "undefined";
  if (isServer) {
    if (!serviceRoleKey) {
      throw new Error(
        "Missing SUPABASE_SERVICE_ROLE_KEY. Add it in .env.local (server-only). " +
        "Get it from Supabase Dashboard → Settings → API → service_role."
      );
    }
    return createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  if (!anonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, anonKey);
}

export type SavedRouteRow = {
  id: string;
  created_at: string;
  name: string | null;
  start_lat: number;
  start_lng: number;
  target_distance_km: number;
  distance_unit: string;
  metrics: Record<string, string>;
  routes: unknown;
};
