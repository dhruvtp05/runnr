import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getSupabase() {
  if (!url || !anonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
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
