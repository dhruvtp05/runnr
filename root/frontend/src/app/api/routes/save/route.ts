import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

type Body = {
  name?: string;
  startLat: number;
  startLng: number;
  targetDistanceKm: number;
  distanceUnit: string;
  metrics: Record<string, string>;
  routes: unknown[];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (
      typeof body.startLat !== "number" ||
      typeof body.startLng !== "number" ||
      !Array.isArray(body.routes) ||
      body.routes.length === 0
    ) {
      return NextResponse.json({ error: "Invalid payload: need startLat, startLng, and non-empty routes." }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("saved_routes")
      .insert({
        name: typeof body.name === "string" ? body.name.trim() || null : null,
        start_lat: body.startLat,
        start_lng: body.startLng,
        target_distance_km: body.targetDistanceKm,
        distance_unit: body.distanceUnit === "mi" ? "mi" : "km",
        metrics: body.metrics ?? {},
        routes: body.routes,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ id: data.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save." },
      { status: 500 }
    );
  }
}
