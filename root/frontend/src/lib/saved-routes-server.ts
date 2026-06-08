import { getSupabase } from "@/lib/supabase";

export type SavedRouteSummary = {
  id: string;
  name: string | null;
  targetDistanceKm: number;
  distanceUnit: string;
  routeCount: number;
  createdAt: string;
};

export async function getSavedRouteSummary(id: string): Promise<SavedRouteSummary | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("saved_routes")
      .select("id, name, created_at, target_distance_km, distance_unit, routes")
      .eq("id", id)
      .single();

    if (error || !data) return null;

    const routes = Array.isArray(data.routes) ? data.routes : [];
    return {
      id: data.id as string,
      name: (data.name as string | null) ?? null,
      targetDistanceKm: Number(data.target_distance_km),
      distanceUnit: (data.distance_unit as string) ?? "km",
      routeCount: routes.length,
      createdAt: data.created_at as string,
    };
  } catch {
    return null;
  }
}
