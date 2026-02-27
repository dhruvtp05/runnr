import { NextResponse } from "next/server";

export const runtime = "nodejs";

type LatLng = { lat: number; lng: number };

type ElevationPreference = "flat" | "rolling" | "hilly";
type SurfacePreference = "road" | "trail" | "mixed";
type EffortPreference = "easy" | "steady" | "tempo";
type SafetyPreference = "balanced" | "safer";

type Metrics = {
  elevation: ElevationPreference;
  surface: SurfacePreference;
  effort: EffortPreference;
  safety: SafetyPreference;
};

type Body = {
  startLat: number;
  startLng: number;
  targetDistanceKm: number;
  elevation?: ElevationPreference;
  surface?: SurfacePreference;
  effort?: EffortPreference;
  safety?: SafetyPreference;
};

const OSRM_BASE_URL = process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number) {
  return (rad * 180) / Math.PI;
}

// Great-circle destination given initial point, bearing, distance.
function destinationPoint(start: LatLng, bearingDeg: number, distanceMeters: number): LatLng {
  const R = 6_371_000; // meters
  const δ = distanceMeters / R;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(start.lat);
  const λ1 = toRad(start.lng);

  const sinφ1 = Math.sin(φ1);
  const cosφ1 = Math.cos(φ1);
  const sinδ = Math.sin(δ);
  const cosδ = Math.cos(δ);

  const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const y = Math.sin(θ) * sinδ * cosφ1;
  const x = cosδ - sinφ1 * sinφ2;
  const λ2 = λ1 + Math.atan2(y, x);

  let lng = toDeg(λ2);
  // normalize to [-180, 180]
  lng = ((lng + 540) % 360) - 180;

  return { lat: toDeg(φ2), lng };
}

async function fetchOsrmRoute(points: LatLng[]) {
  // OSRM expects lon,lat pairs
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${OSRM_BASE_URL.replace(/\/$/, "")}/route/v1/foot/${coords}?overview=full&geometries=geojson&steps=false`;

  const res = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Routing failed (${res.status}). ${text}`.trim());
  }

  const json = (await res.json()) as {
    code: string;
    routes?: Array<{
      distance: number;
      duration: number;
      geometry: { type: "LineString"; coordinates: Array<[number, number]> }; // [lon, lat]
    }>;
    message?: string;
  };

  if (json.code !== "Ok" || !json.routes?.[0]) {
    throw new Error(json.message ?? "OSRM returned no routes.");
  }

  const r = json.routes[0];
  const coordsLatLng = r.geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]);
  return {
    distanceMeters: r.distance,
    durationSeconds: r.duration,
    geometry: { type: "LineString" as const, coordinates: coordsLatLng },
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<Body>;

    const startLat = Number(body.startLat);
    const startLng = Number(body.startLng);
    const targetDistanceKmRaw = Number(body.targetDistanceKm);

    if (!Number.isFinite(startLat) || !Number.isFinite(startLng)) {
      return NextResponse.json({ error: "Invalid startLat/startLng." }, { status: 400 });
    }
    if (startLat < -90 || startLat > 90 || startLng < -180 || startLng > 180) {
      return NextResponse.json({ error: "startLat/startLng out of range." }, { status: 400 });
    }
    if (!Number.isFinite(targetDistanceKmRaw) || targetDistanceKmRaw <= 0) {
      return NextResponse.json({ error: "Invalid targetDistanceKm." }, { status: 400 });
    }

    const targetDistanceKm = clamp(targetDistanceKmRaw, 0.25, 60);
    const targetMeters = targetDistanceKm * 1000;

    const start: LatLng = { lat: startLat, lng: startLng };

    const elevation: ElevationPreference =
      body.elevation && ["flat", "rolling", "hilly"].includes(body.elevation)
        ? body.elevation
        : "rolling";
    const surface: SurfacePreference =
      body.surface && ["road", "trail", "mixed"].includes(body.surface)
        ? body.surface
        : "road";
    const effort: EffortPreference =
      body.effort && ["easy", "steady", "tempo"].includes(body.effort)
        ? body.effort
        : "steady";
    const safety: SafetyPreference =
      body.safety && ["balanced", "safer"].includes(body.safety)
        ? body.safety
        : "balanced";

    const metrics: Metrics = { elevation, surface, effort, safety };

    // Simple “LLM-like” variety: generate out-and-back routes in different directions.
    // Each option: start -> waypoint -> start
    let bearings: number[];
    switch (elevation) {
      case "flat":
        bearings = [0, 120, 240];
        break;
      case "hilly":
        bearings = [45, 165, 285];
        break;
      case "rolling":
      default:
        bearings = [20, 140, 260];
        break;
    }

    let factors: number[];
    switch (effort) {
      case "easy":
        factors = [0.9, 1.0, 1.05];
        break;
      case "tempo":
        factors = [0.8, 0.9, 1.0];
        break;
      case "steady":
      default:
        factors = [0.9, 1.0, 1.1];
        break;
    }
    const colors = ["#60a5fa", "#a78bfa", "#fb7185"];
    const names = ["Option A", "Option B", "Option C"];

    const routes = [];
    for (let i = 0; i < bearings.length; i++) {
      const legMeters = (targetMeters / 2) * factors[i];
      const waypoint = destinationPoint(start, bearings[i], legMeters);

      try {
        const routed = await fetchOsrmRoute([start, waypoint, start]);
        routes.push({
          id: `opt_${i}`,
          name: names[i],
          color: colors[i],
          waypoint,
          metrics,
          ...routed,
        });
      } catch {
        // Skip failed candidates (e.g. ocean / no foot network nearby)
      }
    }

    if (routes.length === 0) {
      return NextResponse.json(
        { error: "No routes found near that point. Try another location." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      start,
      targetDistanceKm,
      metrics,
      routes,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error." },
      { status: 500 },
    );
  }
}

