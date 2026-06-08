import { NextResponse } from "next/server";

export const runtime = "nodejs";

type GeocodeResult = {
  name: string;
  lat: number;
  lng: number;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));

  if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "runnr-route-builder/1.0" },
        cache: "no-store",
      });

      if (!res.ok) {
        return NextResponse.json({ results: [] });
      }

      const data = (await res.json()) as { display_name?: string };
      const name = data.display_name?.trim();
      if (!name) {
        return NextResponse.json({ results: [] });
      }

      return NextResponse.json({
        results: [{ name, lat, lng: lon }],
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Reverse geocoding error." },
        { status: 500 },
      );
    }
  }

  if (!q) {
    return NextResponse.json({ results: [] });
  }

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(
    q,
  )}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "runnr-route-builder/1.0",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Geocoding request failed." },
        { status: 500 },
      );
    }

    const data = (await res.json()) as Array<{
      display_name: string;
      lat: string;
      lon: string;
    }>;

    const results: GeocodeResult[] = data
      .map((item) => ({
        name: item.display_name,
        lat: Number(item.lat),
        lng: Number(item.lon),
      }))
      .filter(
        (r) =>
          Number.isFinite(r.lat) &&
          Number.isFinite(r.lng) &&
          r.lat >= -90 &&
          r.lat <= 90 &&
          r.lng >= -180 &&
          r.lng <= 180,
      );

    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Geocoding error." },
      { status: 500 },
    );
  }
}

