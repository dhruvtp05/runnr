import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("saved_routes")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({
      id: data.id,
      name: data.name,
      start: { lat: data.start_lat, lng: data.start_lng },
      targetDistanceKm: data.target_distance_km,
      distanceUnit: data.distance_unit ?? "km",
      metrics: data.metrics ?? {},
      routes: data.routes ?? [],
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    const supabase = getSupabase();
    const { error } = await supabase.from("saved_routes").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete." },
      { status: 500 }
    );
  }
}
