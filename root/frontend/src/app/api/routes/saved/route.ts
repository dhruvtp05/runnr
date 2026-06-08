import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

type SavedRouteListItem = {
  id: string;
  name: string | null;
  createdAt: string;
  targetDistanceKm: number;
  distanceUnit: string;
  routeCount: number;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { ids?: unknown };
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string" && id.length > 0).slice(0, 50)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ items: [] as SavedRouteListItem[] });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("saved_routes")
      .select("id, name, created_at, target_distance_km, distance_unit, routes")
      .in("id", ids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const byId = new Map(
      (data ?? []).map((row) => {
        const routes = Array.isArray(row.routes) ? row.routes : [];
        return [
          row.id as string,
          {
            id: row.id as string,
            name: (row.name as string | null) ?? null,
            createdAt: row.created_at as string,
            targetDistanceKm: Number(row.target_distance_km),
            distanceUnit: (row.distance_unit as string) ?? "km",
            routeCount: routes.length,
          } satisfies SavedRouteListItem,
        ];
      }),
    );

    const items = ids
      .map((id) => byId.get(id))
      .filter((item): item is SavedRouteListItem => item !== undefined);

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list saved routes." },
      { status: 500 },
    );
  }
}
