import { NextResponse } from "next/server";

export const runtime = "nodejs";

const OPEN_ELEVATION = "https://api.open-elevation.com/api/v1/lookup";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { points?: Array<[number, number]> };
    const points = body.points;
    if (!Array.isArray(points) || points.length === 0 || points.length > 100) {
      return NextResponse.json({ error: "Invalid points." }, { status: 400 });
    }
    const locations = points
      .map((p) => `${Number(p[0])},${Number(p[1])}`)
      .join("|");
    const url = `${OPEN_ELEVATION}?locations=${encodeURIComponent(locations)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ error: "Elevation service unavailable." }, { status: 502 });
    }
    const data = (await res.json()) as { results?: Array<{ elevation?: number }> };
    const elevations = (data.results ?? []).map((r) => Number(r.elevation) || 0);
    return NextResponse.json({ elevations });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Elevation lookup failed." },
      { status: 500 },
    );
  }
}
