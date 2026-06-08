import { NextResponse } from "next/server";
import { enhanceRoutesWithAI } from "./ai-enhance";

export const runtime = "nodejs";

type LatLng = { lat: number; lng: number };

type ElevationPreference = "flat" | "rolling" | "hilly";
type SurfacePreference = "road" | "trail" | "mixed";
type SafetyPreference = "balanced" | "safer";

type Metrics = {
  elevation: ElevationPreference;
  surface: SurfacePreference;
  safety: SafetyPreference;
};

type Body = {
  startLat: number;
  startLng: number;
  targetDistanceKm?: number;
  routeType?: "roundtrip" | "oneway";
  endLat?: number;
  endLng?: number;
  elevation?: ElevationPreference;
  surface?: SurfacePreference;
  safety?: SafetyPreference;
  userPreferences?: string;
  rankBy?: string;
};

const OSRM_BASE_URL = process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org";
const TRAIL_ROUTER_URL =
  process.env.TRAIL_ROUTER_URL ?? "https://trailrouter.com/ors/experimentalroutes";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Normalize longitude to [-180, 180] (e.g. -284 → 76). */
function normalizeLng(lng: number): number {
  let x = lng;
  while (x > 180) x -= 360;
  while (x < -180) x += 360;
  return x;
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

// Trail Router: round-trip routes that prefer parks, forests, water and avoid busy roads.
// API: https://trailrouter.com/api/
type TrailRouterRoute = {
  distance: number;
  duration: number;
  geometry: { type: "LineString"; coordinates: Array<[number, number, number?]> };
  greenScore?: number;
};

async function fetchTrailRouterRoutes(
  start: LatLng,
  targetMeters: number,
  surface: SurfacePreference,
  elevation: ElevationPreference,
  safety: SafetyPreference
): Promise<
  Array<{
    id: string;
    name: string;
    color: string;
    distanceMeters: number;
    durationSeconds: number;
    geometry: { type: "LineString"; coordinates: Array<[number, number]> };
    waypoint: LatLng;
  }>
> {
  const coords = `${start.lng},${start.lat}`;
  const greenPreference = surface === "trail" ? 0.9 : surface === "mixed" ? 0.5 : 0;
  const hillsPreference = elevation === "flat" ? -1 : elevation === "hilly" ? 1 : 0;
  const avoidUnsafeStreets = safety === "safer";

  const params = new URLSearchParams({
    coordinates: coords,
    roundtrip: "true",
    target_distance: String(Math.round(targetMeters)),
    green_preference: String(greenPreference),
    hills_preference: String(hillsPreference),
    avoid_unsafe_streets: String(avoidUnsafeStreets),
    avoid_repetition: "true",
  });

  const res = await fetch(`${TRAIL_ROUTER_URL}?${params.toString()}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) return [];

  const json = (await res.json()) as { routes?: TrailRouterRoute[] };
  const routes = json.routes ?? [];
  if (routes.length === 0) return [];

  const TOLERANCE = 0.15; // accept routes within ±15% of target (Trail Router is approximate)
  const inRange = routes.filter(
    (r) => r.distance >= targetMeters * (1 - TOLERANCE) && r.distance <= targetMeters * (1 + TOLERANCE)
  );
  const toUse = inRange.length >= 1 ? inRange : routes; // prefer in-range, else any
  const selected = toUse.slice(0, 3);

  return selected.map((r, i) => {
    const coordsLatLng = r.geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]);
    const mid = Math.floor(coordsLatLng.length / 2);
    const waypoint =
      coordsLatLng.length >= 2
        ? { lat: coordsLatLng[mid][0], lng: coordsLatLng[mid][1] }
        : start;
    return {
      id: `opt_${i}`,
      name: ["Option A", "Option B", "Option C"][i],
      color: ["#60a5fa", "#a78bfa", "#fb7185"][i],
      distanceMeters: r.distance,
      durationSeconds: typeof r.duration === "number" && r.duration > 1e6 ? Math.round(r.duration / 1000) : r.duration,
      geometry: { type: "LineString" as const, coordinates: coordsLatLng },
      waypoint,
    };
  });
}

type OsrmRouteRow = {
  distance: number;
  duration: number;
  geometry: { type: "LineString"; coordinates: Array<[number, number]> }; // [lon, lat]
};

type OsrmRouteResponse = {
  routes?: OsrmRouteRow[];
  message?: string;
};

function osrmStatusCode(payload: OsrmRouteResponse & Record<string, unknown>): string {
  return typeof payload.code === "string" ? payload.code : "";
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

  const json = (await res.json()) as OsrmRouteResponse & Record<string, unknown>;
  const responseCode = osrmStatusCode(json);

  if (responseCode !== "Ok" || !json.routes?.[0]) {
    const msg = json.message ?? "OSRM returned no route.";
    if (responseCode === "NoRoute") {
      throw new Error("No walkable route between points. Try a different distance or Road surface.");
    }
    throw new Error(msg);
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

    // Auto-correct if lat/lng were sent swapped (e.g. GeoJSON [lng,lat] or client bug in some regions)
    let startLatNorm = startLat;
    let startLngNorm = startLng;
    if (Math.abs(startLat) > 90 && Math.abs(startLng) <= 90) {
      startLatNorm = startLng;
      startLngNorm = startLat;
    }
    // Normalize longitude to [-180, 180] (e.g. -284 → 75.35)
    startLngNorm = normalizeLng(startLngNorm);
    if (startLatNorm < -90 || startLatNorm > 90 || startLngNorm < -180 || startLngNorm > 180) {
      return NextResponse.json({ error: "startLat/startLng out of range." }, { status: 400 });
    }

    const routeType = body.routeType === "oneway" ? "oneway" : "roundtrip";
    if (routeType === "roundtrip" && (!Number.isFinite(targetDistanceKmRaw) || targetDistanceKmRaw <= 0)) {
      return NextResponse.json({ error: "Invalid targetDistanceKm." }, { status: 400 });
    }

    // One-way: require end point, route start→end
    if (routeType === "oneway") {
      const endLat = Number(body.endLat);
      const endLng = Number(body.endLng);
      if (!Number.isFinite(endLat) || !Number.isFinite(endLng)) {
        return NextResponse.json({ error: "One-way routes require endLat and endLng." }, { status: 400 });
      }
      let endLatNorm = endLat;
      let endLngNorm = endLng;
      if (Math.abs(endLat) > 90 && Math.abs(endLng) <= 90) {
        endLatNorm = endLng;
        endLngNorm = endLat;
      }
      endLngNorm = normalizeLng(endLngNorm);
      if (endLatNorm < -90 || endLatNorm > 90 || endLngNorm < -180 || endLngNorm > 180) {
        return NextResponse.json({ error: "endLat/endLng out of range." }, { status: 400 });
      }
      const start: LatLng = { lat: startLatNorm, lng: startLngNorm };
      const end: LatLng = { lat: endLatNorm, lng: endLngNorm };
      const elevation: ElevationPreference =
        body.elevation && ["flat", "rolling", "hilly"].includes(body.elevation)
          ? body.elevation
          : "rolling";
      const surface: SurfacePreference =
        body.surface && ["road", "trail", "mixed"].includes(body.surface)
          ? body.surface
          : "road";
      const safety: SafetyPreference =
        body.safety && ["balanced", "safer"].includes(body.safety)
          ? body.safety
          : "balanced";
      const metrics: Metrics = { elevation, surface, safety };
      const userPreferences = typeof body.userPreferences === "string" ? body.userPreferences.trim() || undefined : undefined;
      const rankBy = typeof body.rankBy === "string" ? body.rankBy.trim() || undefined : undefined;

      async function applyAIOneWay(
        routeList: Array<{ id: string; name: string; color: string; distanceMeters: number; durationSeconds: number; geometry: { type: "LineString"; coordinates: Array<[number, number]> }; waypoint: LatLng; metrics: Metrics }>
      ) {
        const ai = await enhanceRoutesWithAI(
          routeList.map((r) => ({ id: r.id, name: r.name, distanceMeters: r.distanceMeters, durationSeconds: r.durationSeconds, waypoint: r.waypoint })),
          { surface, elevation },
          start,
          userPreferences,
          rankBy
        );
        if (!ai) {
          return { routes: routeList, aiRecommendedId: routeList[0]?.id ?? null, preferenceInterpretation: undefined as string | undefined };
        }
        const orderedIds = ai.ranking.map((i) => routeList[i]?.id).filter(Boolean) as string[];
        const routes = routeList.map((r, i) => ({
          ...r,
          name: ai.routeNames[i] ?? r.name,
          aiDescription: ai.routeDescriptions[i],
          aiTip: ai.runTips[i],
        }));
        return {
          routes,
          aiRecommendedId: orderedIds[0] ?? routeList[0]?.id ?? null,
          preferenceInterpretation: ai.preferenceInterpretation,
        };
      }

      try {
        const routed = await fetchOsrmRoute([start, end]);
        const waypoint = end;
        const routeList = [{
          id: "opt_0",
          name: "Option A",
          color: "#60a5fa",
          waypoint,
          metrics,
          ...routed,
        }];
        const targetDistanceKm = routed.distanceMeters / 1000;
        const { routes: enhancedRoutes, aiRecommendedId, preferenceInterpretation } = await applyAIOneWay(routeList);
        return NextResponse.json({
          start,
          targetDistanceKm,
          metrics,
          routes: enhancedRoutes,
          aiRecommendedId,
          preferenceInterpretation: preferenceInterpretation ?? undefined,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Routing failed.";
        return NextResponse.json(
          { error: "No route found between start and end. Try points that are connected by paths or roads.", details: msg },
          { status: 404 }
        );
      }
    }

    const targetDistanceKm = clamp(targetDistanceKmRaw, 0.25, 60);
    const targetMeters = targetDistanceKm * 1000;

    const start: LatLng = { lat: startLatNorm, lng: startLngNorm };

    const elevation: ElevationPreference =
      body.elevation && ["flat", "rolling", "hilly"].includes(body.elevation)
        ? body.elevation
        : "rolling";
    const surface: SurfacePreference =
      body.surface && ["road", "trail", "mixed"].includes(body.surface)
        ? body.surface
        : "road";
    const safety: SafetyPreference =
      body.safety && ["balanced", "safer"].includes(body.safety)
        ? body.safety
        : "balanced";

    const metrics: Metrics = { elevation, surface, safety };

    const userPreferences = typeof body.userPreferences === "string" ? body.userPreferences.trim() || undefined : undefined;
    const rankBy = typeof body.rankBy === "string" ? body.rankBy.trim() || undefined : undefined;

    async function applyAI(
      routeList: Array<{ id: string; name: string; color: string; distanceMeters: number; durationSeconds: number; geometry: { type: "LineString"; coordinates: Array<[number, number]> }; waypoint: LatLng; metrics: Metrics }>
    ) {
      const ai = await enhanceRoutesWithAI(
        routeList.map((r) => ({ id: r.id, name: r.name, distanceMeters: r.distanceMeters, durationSeconds: r.durationSeconds, waypoint: r.waypoint })),
        { surface, elevation },
        start,
        userPreferences,
        rankBy
      );
      if (!ai) {
        return {
          routes: routeList,
          aiRecommendedId: routeList[0]?.id ?? null,
          preferenceInterpretation: undefined,
        };
      }
      const orderedIds = ai.ranking.map((i) => routeList[i]?.id).filter(Boolean) as string[];
      const routes = routeList.map((r, i) => ({
        ...r,
        name: ai.routeNames[i] ?? r.name,
        aiDescription: ai.routeDescriptions[i],
        aiTip: ai.runTips[i],
      }));
      return {
        routes,
        aiRecommendedId: orderedIds[0] ?? routeList[0]?.id ?? null,
        preferenceInterpretation: ai.preferenceInterpretation,
      };
    }

    // Simple “LLM-like” variety: generate out-and-back routes in different directions.
    // OSRM fallback: out-and-back waypoints
    // Prefer Trail Router first (see above); this block runs if Trail Router returns no routes.
    try {
      const trailRoutes = await fetchTrailRouterRoutes(
        start,
        targetMeters,
        surface,
        elevation,
        safety
      );
      if (trailRoutes.length >= 1) {
        const routesWithMetrics = trailRoutes.map((r) => ({ ...r, metrics }));
        const { routes: enhancedRoutes, aiRecommendedId, preferenceInterpretation } = await applyAI(routesWithMetrics);
        const warning =
          enhancedRoutes.length < 3
            ? `Only ${enhancedRoutes.length} route(s) found. Try a different start or distance.`
            : undefined;
        return NextResponse.json({
          start,
          targetDistanceKm,
          metrics,
          routes: enhancedRoutes,
          aiRecommendedId,
          preferenceInterpretation: preferenceInterpretation ?? undefined,
          ...(warning ? { warning } : {}),
        });
      }
    } catch {
      // Fall through to OSRM
    }

    let bearings: number[];
    switch (elevation) {
      case "flat":
        bearings = (surface === "trail" || surface === "mixed") ? [0, 60, 120, 180, 240, 300] : [0, 120, 240];
        break;
      case "hilly":
        bearings = (surface === "trail" || surface === "mixed") ? [30, 90, 150, 210, 270, 330] : [45, 165, 285];
        break;
      case "rolling":
      default:
        bearings = (surface === "trail" || surface === "mixed") ? [20, 80, 140, 200, 260, 320] : [20, 140, 260];
        break;
    }

    const getFactor = (idx: number) => {
      const f = [0.9, 1.0, 1.1];
      return f[idx % f.length];
    };
    const colors = ["#60a5fa", "#a78bfa", "#fb7185"];
    const names = ["Option A", "Option B", "Option C"];

    const routes = [];
    const routeErrors: string[] = [];
    const TOLERANCE = 0.07;
    const MAX_ITERATIONS = 6;
    const MAX_ROUTES = 3;

    for (let i = 0; i < bearings.length && routes.length < MAX_ROUTES; i++) {
      const factor = getFactor(i);
      let legMeters = (targetMeters / 2) * factor;
      let lastRouted: Awaited<ReturnType<typeof fetchOsrmRoute>> | null = null;
      let lastWaypoint: LatLng | null = null;
      let iterations = 0;
      let addedThisBearing = false;

      while (iterations < MAX_ITERATIONS) {
        const waypoint = destinationPoint(start, bearings[i], legMeters);
        try {
          const routed = await fetchOsrmRoute([start, waypoint, start]);
          lastRouted = routed;
          lastWaypoint = waypoint;
          const ratio = routed.distanceMeters / targetMeters;
          if (ratio >= 1 - TOLERANCE && ratio <= 1 + TOLERANCE) {
            routes.push({
              id: `opt_${routes.length}`,
              name: names[routes.length],
              color: colors[routes.length],
              waypoint,
              metrics,
              ...routed,
            });
            addedThisBearing = true;
            break;
          }
          legMeters = legMeters * (targetMeters / routed.distanceMeters);
          legMeters = Math.max(100, Math.min(legMeters, targetMeters));
          iterations++;
        } catch (err) {
          routeErrors.push(err instanceof Error ? err.message : "Routing failed");
          break;
        }
      }

      // Only add fallback if we already have Option A (a real route within tolerance)
      if (!addedThisBearing && lastRouted && lastWaypoint && routes.length >= 1 && routes.length < MAX_ROUTES) {
        const idx: number = routes.length;
        routes.push({
          id: `opt_${idx}`,
          name: names[idx],
          color: colors[idx],
          waypoint: lastWaypoint,
          metrics,
          ...lastRouted,
        });
      }
    }

    // Option A must be a real route (within tolerance). If we have no routes or only fallbacks, error.
    if (routes.length === 0) {
      const hint =
        surface === "trail" || surface === "mixed"
          ? " Try Road surface or a start point nearer to paths and parks."
          : " Try a different start point or shorter distance.";
      return NextResponse.json(
        {
          error: "No route found that matches your target distance. Try a different start point, distance, or Road surface." + hint,
          ...(routeErrors[0] ? { details: routeErrors[0] } : {}),
        },
        { status: 404 }
      );
    }

    const warning =
      routes.length < MAX_ROUTES && (surface === "trail" || surface === "mixed")
        ? `Only ${routes.length} route(s) found. Try Road for more options.`
        : undefined;

    const { routes: enhancedRoutes, aiRecommendedId, preferenceInterpretation } = await applyAI(routes);

    return NextResponse.json({
      start,
      targetDistanceKm,
      metrics,
      routes: enhancedRoutes,
      aiRecommendedId,
      preferenceInterpretation: preferenceInterpretation ?? undefined,
      ...(warning ? { warning } : {}),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error." },
      { status: 500 },
    );
  }
}

