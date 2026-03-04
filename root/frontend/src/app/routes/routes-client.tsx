"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngTuple } from "leaflet";
import { Loader2, Save, MapPin, Download, Copy, Check, Search, Thermometer } from "lucide-react";

type LatLng = { lat: number; lng: number };

type RouteType = "roundtrip" | "oneway";
type ElevationPreference = "flat" | "rolling" | "hilly";
type SurfacePreference = "road" | "trail" | "mixed";
type SafetyPreference = "balanced" | "safer";

type Metrics = {
  elevation: ElevationPreference;
  surface: SurfacePreference;
  safety: SafetyPreference;
};

type RouteOption = {
  id: string;
  name: string;
  color: string;
  distanceMeters: number;
  durationSeconds: number;
  geometry: { type: "LineString"; coordinates: Array<[number, number]> }; // [lat, lng]
  waypoint: LatLng;
  aiDescription?: string;
  aiTip?: string;
};

type RoutesResponse = {
  start: LatLng;
  targetDistanceKm: number;
  metrics: Metrics;
  routes: RouteOption[];
  warning?: string;
  aiRecommendedId?: string;
  preferenceInterpretation?: string;
};

const KM_PER_MILE = 1.60934;

function fmtDistance(meters: number, unit: "km" | "mi" = "km") {
  if (unit === "mi") {
    const miles = meters / 1000 / KM_PER_MILE;
    return `${miles.toFixed(miles < 10 ? 2 : 1)} mi`;
  }
  const km = meters / 1000;
  return `${km.toFixed(km < 10 ? 2 : 1)} km`;
}

function parseLatLng(input: string): LatLng | null {
  const match = input.trim().match(
    /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/u,
  );
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function buildGoogleMapsUrl(coords: Array<[number, number]>): string {
  if (coords.length === 0) return "";
  const maxWaypoints = 25;
  const step = Math.max(1, Math.floor(coords.length / maxWaypoints));
  const points = coords.filter((_, i) => i % step === 0 || i === coords.length - 1);
  const unique = points.map(([lat, lng]) => `${lat},${lng}`).join("/");
  return `https://www.google.com/maps/dir/${unique}`;
}

function downloadGPX(route: { name: string; geometry: { coordinates: Array<[number, number]> } }) {
  const coords = route.geometry.coordinates;
  const trkpts = coords
    .map(([lat, lng]) => `    <trkpt lat="${lat}" lon="${lng}"></trkpt>`)
    .join("\n");
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="runnr" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${escapeXml(route.name)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
  const blob = new Blob([gpx], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${route.name.replace(/[^a-z0-9]/gi, "_")}.gpx`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ElevationSparkline({ elevations, className }: { elevations: number[]; className?: string }) {
  if (elevations.length < 2) return null;
  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  const range = max - min || 1;
  const w = 200;
  const h = 32;
  const pts = elevations.map((e, i) => {
    const x = (i / (elevations.length - 1)) * w;
    const y = h - ((e - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none">
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.8" points={pts} />
    </svg>
  );
}

function ClickToSetPoint({
  routeType,
  hasStart,
  hasEnd,
  onPickStart,
  onPickEnd,
}: {
  routeType: RouteType;
  hasStart: boolean;
  hasEnd: boolean;
  onPickStart: (p: LatLng) => void;
  onPickEnd: (p: LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      const p = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (routeType === "roundtrip") {
        onPickStart(p);
      } else {
        if (!hasStart) onPickStart(p);
        else if (!hasEnd) onPickEnd(p);
      }
    },
  });
  return null;
}

function FitBounds({ coords }: { coords: Array<[number, number]> | null }) {
  const map = useMap();

  useEffect(() => {
    if (!coords || coords.length < 2) return;
    const bounds: LatLngBoundsExpression = coords as unknown as LatLngTuple[];
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [coords, map]);

  return null;
}

function CenterOnSelection({
  start,
  end,
  hasRoute,
}: {
  start: LatLng | null;
  end: LatLng | null;
  hasRoute: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (hasRoute) return;
    if (start && end) {
      const bounds: LatLngBoundsExpression = [
        [start.lat, start.lng],
        [end.lat, end.lng],
      ] as unknown as LatLngTuple[];
      map.fitBounds(bounds, { padding: [24, 24] });
    } else if (start) {
      map.setView([start.lat, start.lng], 14);
    }
  }, [start, end, hasRoute, map]);

  return null;
}

export default function RoutesClient() {
  const [routeType, setRouteType] = useState<RouteType>("roundtrip");
  const [start, setStart] = useState<LatLng | null>(null);
  const [end, setEnd] = useState<LatLng | null>(null);
  const [targetDistance, setTargetDistance] = useState<string>("");
  const [distanceUnit, setDistanceUnit] = useState<"km" | "mi">("km");
  const [elevation, setElevation] = useState<ElevationPreference>("rolling");
  const [surface, setSurface] = useState<SurfacePreference>("road");
  const [safety, setSafety] = useState<SafetyPreference>("balanced");
  const [startQuery, setStartQuery] = useState("");
  const [endQuery, setEndQuery] = useState("");
  const [startLabel, setStartLabel] = useState<string | null>(null);
  const [endLabel, setEndLabel] = useState<string | null>(null);
  const [isGeocodingStart, setIsGeocodingStart] = useState(false);
  const [isGeocodingEnd, setIsGeocodingEnd] = useState(false);
  const [startSuggestions, setStartSuggestions] = useState<
    { name: string; lat: number; lng: number }[]
  >([]);
  const [endSuggestions, setEndSuggestions] = useState<
    { name: string; lat: number; lng: number }[]
  >([]);
  const [distanceFocused, setDistanceFocused] = useState(false);
  const [userPreferences, setUserPreferences] = useState("");
  const [rankBy, setRankBy] = useState("");
  const [recentStarts, setRecentStarts] = useState<
    { lat: number; lng: number; label: string | null }[]
  >([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preferenceInterpretation, setPreferenceInterpretation] = useState<string | null>(null);
  const [aiRecommendedId, setAiRecommendedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [routeElevation, setRouteElevation] = useState<{ elevations: number[]; climbMeters: number } | null>(null);
  const [elevationLoading, setElevationLoading] = useState(false);

  const selectedRoute = useMemo(
    () => routes.find((r) => r.id === selectedId) ?? null,
    [routes, selectedId],
  );

  // Load personalization from localStorage
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const rsRaw = window.localStorage.getItem("runnr:recent-starts");
      if (rsRaw) {
        const parsed = JSON.parse(rsRaw) as { lat: number; lng: number; label?: string | null }[];
        if (Array.isArray(parsed)) {
          setRecentStarts(
            parsed
              .filter(
                (p) =>
                  typeof p.lat === "number" &&
                  typeof p.lng === "number" &&
                  Number.isFinite(p.lat) &&
                  Number.isFinite(p.lng),
              )
              .slice(0, 5)
              .map((p) => ({ lat: p.lat, lng: p.lng, label: p.label ?? null })),
          );
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const onPickStart = useCallback((p: LatLng) => {
    setStart(p);
    setStartQuery(`${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`);
    setStartLabel(null);
    setStartSuggestions([]);
    setEnd(null);
    setRoutes([]);
    setSelectedId(null);
    setError(null);
    setWarning(null);
    setPreferenceInterpretation(null);
    setAiRecommendedId(null);
    setSavedId(null);
  }, []);

  const onPickEnd = useCallback((p: LatLng) => {
    setEnd(p);
    setEndQuery(`${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`);
    setEndLabel(null);
    setEndSuggestions([]);
    setRoutes([]);
    setSelectedId(null);
    setError(null);
    setWarning(null);
    setSavedId(null);
  }, []);

  // Whenever start changes, remember it as a recent start
  useEffect(() => {
    if (!start) return;
    try {
      if (typeof window === "undefined") return;
      const label =
        startLabel ??
        (startQuery.trim() || `${start.lat.toFixed(5)}, ${start.lng.toFixed(5)}`);
      setRecentStarts((prev) => {
        const key = `${start.lat.toFixed(5)},${start.lng.toFixed(5)}`;
        const existing = prev.filter(
          (p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}` !== key,
        );
        const next = [
          { lat: start.lat, lng: start.lng, label: label || null },
          ...existing,
        ].slice(0, 5);
        try {
          window.localStorage.setItem("runnr:recent-starts", JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    } catch {
      // ignore
    }
  }, [start, startLabel, startQuery]);

  const onRouteTypeChange = useCallback((t: RouteType) => {
    setRouteType(t);
    setStart(null);
    setEnd(null);
    setStartQuery("");
    setEndQuery("");
    setStartLabel(null);
    setEndLabel(null);
    setRoutes([]);
    setSelectedId(null);
    setError(null);
    setWarning(null);
    setSavedId(null);
  }, []);

  const applyPreset = (id: "5k-easy" | "10k-long" | "hilly-30") => {
    setRouteType("roundtrip");
    setError(null);
    setWarning(null);
    setSavedId(null);
    setRoutes([]);
    setSelectedId(null);
    switch (id) {
      case "5k-easy":
        setDistanceUnit("km");
        setTargetDistance("5");
        setElevation("flat");
        setSurface("road");
        setSafety("safer");
        setUserPreferences("Easy 5k loop, keep it gentle.");
        break;
      case "10k-long":
        setDistanceUnit("km");
        setTargetDistance("10");
        setElevation("rolling");
        setSurface("road");
        setSafety("balanced");
        setUserPreferences("Steady long run around 10k.");
        break;
      case "hilly-30":
        setDistanceUnit("km");
        setTargetDistance("5");
        setElevation("hilly");
        setSurface("mixed");
        setSafety("balanced");
        setUserPreferences("Hilly route for about 30 minutes.");
        break;
      default:
        break;
    }
  };

  const saveRoute = useCallback(async () => {
    if (!start || routes.length === 0) return;
    setIsSaving(true);
    setError(null);
    try {
      const baseDistance = Number(targetDistance);
      const targetDistanceKm =
        routeType === "oneway"
          ? (routes[0]?.distanceMeters ?? 0) / 1000
          : distanceUnit === "mi"
            ? baseDistance * KM_PER_MILE
            : baseDistance;
      const res = await fetch("/api/routes/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: saveName.trim() || undefined,
          startLat: start.lat,
          startLng: start.lng,
          targetDistanceKm,
          distanceUnit,
          routeType,
          endLat: routeType === "oneway" && end ? end.lat : undefined,
          endLng: routeType === "oneway" && end ? end.lng : undefined,
          metrics: { elevation, surface, safety, routeType },
          routes,
        }),
      });
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      if (json.id) {
        setSavedId(json.id);
        try {
          if (typeof window !== "undefined") {
            const key = "runnr:saved-routes";
            const existing = JSON.parse(
              window.localStorage.getItem(key) ?? "[]",
            ) as { id: string; name: string | null; createdAt: string }[];
            const entry = {
              id: json.id,
              name: saveName.trim() || null,
              createdAt: new Date().toISOString(),
            };
            const filtered = existing.filter((r) => r.id !== entry.id);
            window.localStorage.setItem(
              key,
              JSON.stringify([entry, ...filtered].slice(0, 50)),
            );
          }
        } catch {
          // ignore localStorage errors
        }
      } else {
        setSavedId(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save route.");
    } finally {
      setIsSaving(false);
    }
  }, [start, end, routes, routeType, distanceUnit, targetDistance, elevation, surface, safety, saveName]);

  const copySavedLink = useCallback(() => {
    if (!savedId) return;
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/routes/saved/${savedId}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }, [savedId]);

  const geocodeLocation = useCallback(
    async (kind: "start" | "end") => {
      setError(null);
      setWarning(null);
      setSavedId(null);
      const query = (kind === "start" ? startQuery : endQuery).trim();
      if (!query) {
        setError("Enter an address or coordinates first.");
        return;
      }

      const parsed = parseLatLng(query);
      if (parsed) {
        if (kind === "start") {
          onPickStart(parsed);
        } else {
          onPickEnd(parsed);
        }
        return;
      }

      if (kind === "start") setIsGeocodingStart(true);
      else setIsGeocodingEnd(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
        if (!res.ok) {
          setError("Geocoding failed. Try a different search.");
          return;
        }
        const data = (await res.json()) as {
          results?: { name: string; lat: number; lng: number }[];
          error?: string;
        };
        const results = data.results ?? [];
        if (!results.length) {
          setError("No locations found for that search.");
          return;
        }
        const best = results[0];
        const point: LatLng = { lat: best.lat, lng: best.lng };
        if (kind === "start") {
          onPickStart(point);
          setStartLabel(best.name);
          setStartSuggestions(results.slice(0, 5));
        } else {
          onPickEnd(point);
          setEndLabel(best.name);
          setEndSuggestions(results.slice(0, 5));
        }
      } catch {
        setError("Geocoding error. Check your connection and try again.");
      } finally {
        if (kind === "start") setIsGeocodingStart(false);
        else setIsGeocodingEnd(false);
      }
    },
    [startQuery, endQuery, onPickStart, onPickEnd],
  );

  useEffect(() => {
    const q = startQuery.trim();
    if (!q || parseLatLng(q)) {
      setStartSuggestions([]);
      return;
    }
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          results?: { name: string; lat: number; lng: number }[];
        };
        setStartSuggestions((data.results ?? []).slice(0, 5));
      } catch {
        // ignore
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [startQuery]);

  useEffect(() => {
    const q = endQuery.trim();
    if (!q || parseLatLng(q)) {
      setEndSuggestions([]);
      return;
    }
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          results?: { name: string; lat: number; lng: number }[];
        };
        setEndSuggestions((data.results ?? []).slice(0, 5));
      } catch {
        // ignore
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [endQuery]);

  useEffect(() => {
    if (!start) {
      setWeather(null);
      return;
    }
    setWeatherLoading(true);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${start.lat}&longitude=${start.lng}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`;
    fetch(url)
      .then((r) => r.json())
      .then((d: { current?: { temperature_2m?: number; weather_code?: number } }) => {
        const c = d.current;
        if (c && typeof c.temperature_2m === "number" && typeof c.weather_code === "number") {
          setWeather({ temp: c.temperature_2m, code: c.weather_code });
        } else {
          setWeather(null);
        }
      })
      .catch(() => setWeather(null))
      .finally(() => setWeatherLoading(false));
  }, [start]);

  const weatherBadge = useMemo(() => {
    if (!weather) return null;
    const { temp, code } = weather;
    // WMO: 0 clear, 1-3 clouds, 45 fog, 61-67 rain, 80-82 showers, 95+ thunderstorm
    const stormy = code >= 95 || (code >= 61 && code <= 67);
    if (stormy) {
      return {
        label: "Stormy – consider another time",
        temp,
        color: "bg-amber-500/20 text-amber-200 border-amber-500/30",
      };
    }

    let label: string;
    let color: string;

    if (temp <= 20) {
      label = "Very cold for running";
      color = "bg-sky-500/20 text-sky-100 border-sky-500/30";
    } else if (temp <= 40) {
      label = "Cold – layer up";
      color = "bg-sky-500/20 text-sky-100 border-sky-500/30";
    } else if (temp <= 60) {
      // Research: best running performance is typically around 45–55 °F
      label = "Great running weather";
      color = "bg-emerald-500/20 text-emerald-200 border-emerald-500/30";
    } else if (temp <= 75) {
      label = "Warm – stay hydrated";
      color = "bg-orange-500/20 text-orange-200 border-orange-500/30";
    } else if (temp <= 85) {
      label = "Hot – go easy";
      color = "bg-orange-500/20 text-orange-200 border-orange-500/30";
    } else {
      label = "Very hot – use caution";
      color = "bg-red-500/20 text-red-200 border-red-500/30";
    }

    return { label, temp, color };
  }, [weather]);

  useEffect(() => {
    if (!selectedRoute?.geometry.coordinates.length) {
      setRouteElevation(null);
      return;
    }
    const coords = selectedRoute.geometry.coordinates;
    const n = Math.min(25, coords.length);
    const step = coords.length <= n ? 1 : Math.floor((coords.length - 1) / (n - 1));
    const points = [];
    for (let i = 0; i < n; i++) {
      const idx = i === n - 1 ? coords.length - 1 : Math.min(i * step, coords.length - 1);
      points.push(coords[idx]);
    }
    setElevationLoading(true);
    fetch("/api/elevation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ points }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { elevations?: number[] } | null) => {
        if (!data?.elevations?.length) {
          setRouteElevation(null);
          return;
        }
        const elevations = data.elevations;
        let climb = 0;
        for (let i = 1; i < elevations.length; i++) {
          const d = elevations[i] - elevations[i - 1];
          if (d > 0) climb += d;
        }
        setRouteElevation({ elevations, climbMeters: Math.round(climb) });
      })
      .catch(() => setRouteElevation(null))
      .finally(() => setElevationLoading(false));
  }, [selectedRoute?.id, selectedRoute?.geometry.coordinates]);

  const effortLabel = useMemo(() => {
    if (!selectedRoute) return null;
    const distKm = selectedRoute.distanceMeters / 1000;
    const climb = routeElevation?.climbMeters ?? 0;
    if (climb > 0) {
      if (climb < 150 && distKm < 8) return { label: "Easy", color: "text-emerald-400" };
      if (climb > 300 || distKm > 15) return { label: "Hard", color: "text-amber-400" };
      return { label: "Moderate", color: "text-zinc-300" };
    }
    if (distKm < 5) return { label: "Easy", color: "text-emerald-400" };
    if (distKm > 15) return { label: "Hard", color: "text-amber-400" };
    return { label: "Moderate", color: "text-zinc-300" };
  }, [selectedRoute, routeElevation]);

  const generate = useCallback(async () => {
    setError(null);
    setWarning(null);
    setSavedId(null);
    if (!start) {
      setError("Click the map to set a start point first.");
      return;
    }
    if (routeType === "oneway") {
      if (!end) {
        setError("Click the map to set an end point for a one-way route.");
        return;
      }
    } else {
      const baseDistance = Number(targetDistance);
      const targetDistanceKm =
        distanceUnit === "mi" ? baseDistance * KM_PER_MILE : baseDistance;
      if (
        !Number.isFinite(baseDistance) ||
        baseDistance <= 0 ||
        targetDistanceKm <= 0.25 ||
        targetDistanceKm > 60
      ) {
        setError(
          distanceUnit === "mi"
            ? "Enter a target distance between 0.25 mi and ~37 mi."
            : "Enter a target distance between 0.25 km and 60 km."
        );
        return;
      }
    }

    setIsLoading(true);
    try {
      const body: Record<string, unknown> = {
        startLat: start.lat,
        startLng: start.lng,
        routeType,
        elevation,
        surface,
        safety,
        userPreferences: userPreferences.trim() || undefined,
        rankBy: rankBy.trim() || undefined,
      };
      if (routeType === "roundtrip") {
        const targetDistanceKm = distanceUnit === "mi" ? targetDistance * KM_PER_MILE : targetDistance;
        body.targetDistanceKm = targetDistanceKm;
      } else {
        body.endLat = end!.lat;
        body.endLng = end!.lng;
      }
      const res = await fetch("/api/routes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      let json: unknown;
      try {
        json = await res.json();
      } catch {
        setError("Invalid response from server. Please try again.");
        return;
      }

      if (!res.ok) {
        const msg =
          typeof json === "object" && json !== null && "error" in json
            ? String((json as { error: unknown }).error)
            : "Failed to generate routes.";
        const details =
          typeof json === "object" && json !== null && "details" in json
            ? (json as { details?: string }).details
            : undefined;
        setError(details ? `${msg} ${details}` : msg);
        return;
      }

      const data = json as RoutesResponse & { preferenceInterpretation?: unknown };
      setRoutes(data.routes);
      setAiRecommendedId(data.aiRecommendedId ?? null);
      const pref = data.preferenceInterpretation;
      if (typeof pref === "string") {
        setPreferenceInterpretation(pref);
      } else if (pref && typeof pref === "object") {
        // Some AI responses may return a structured object here; coerce to a short string.
        try {
          const parts = Object.values(pref as Record<string, unknown>)
            .map((v) => (typeof v === "string" ? v.trim() : ""))
            .filter(Boolean);
          setPreferenceInterpretation(parts.join(" · ") || null);
        } catch {
          setPreferenceInterpretation(null);
        }
      } else {
        setPreferenceInterpretation(null);
      }
      setSelectedId(data.aiRecommendedId ?? data.routes[0]?.id ?? null);
      setWarning(data.warning ?? null);
      if (data.routes.length === 0) {
        setError("No routes found. Try another location or Road surface.");
      }
    } catch (e) {
      if (e instanceof TypeError && e.message.includes("fetch")) {
        setError("Network error. Check your connection and try again.");
      } else {
        setError(e instanceof Error ? e.message : "Failed to generate routes.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [start, end, routeType, targetDistance, distanceUnit, elevation, surface, safety, userPreferences, rankBy]);

  return (
    <div className="grid lg:grid-cols-[420px_1fr] gap-6">
      <section className="glass rounded-2xl p-5 border border-white/10 min-w-0 overflow-hidden">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-white font-semibold text-lg">Route options</h2>
            <p className="text-sm text-zinc-400">
              {routeType === "roundtrip" ? (
                start ? (
                  <>Start: {start.lat.toFixed(5)}, {start.lng.toFixed(5)}</>
                ) : (
                  "Click the map to choose your start point."
                )
              ) : start && end ? (
                <span className="flex flex-wrap items-center gap-2">
                  Start → End set.{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setEnd(null);
                      setRoutes([]);
                      setSelectedId(null);
                    }}
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    Change end point
                  </button>
                </span>
              ) : start ? (
                "Now click the map to set your end point."
              ) : (
                "Click the map to set your start point, then your end point."
              )}
            </p>
          </div>
        </div>

        <div className="grid gap-3 mb-4">
          <div className="grid gap-1">
            <span className="text-sm font-medium text-zinc-300">Route type</span>
            <div className="inline-flex gap-1 rounded-xl bg-black/30 p-1 border border-white/10">
              {[
                { value: "roundtrip" as const, label: "There and back" },
                { value: "oneway" as const, label: "One-way" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onRouteTypeChange(opt.value)}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    routeType === opt.value
                      ? "bg-white text-zinc-900"
                      : "text-zinc-300 hover:bg-white/10"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <div className="grid gap-1">
              <span className="text-sm font-medium text-zinc-300">
                Start location (address or coordinates)
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={startQuery}
                  onChange={(e) => setStartQuery(e.target.value)}
                  placeholder='e.g. "Golden Gate Bridge" or "37.7749,-122.4194"'
                  className="flex-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm placeholder:text-zinc-500 outline-none focus:border-white/20"
                />
                <button
                  type="button"
                  onClick={() => geocodeLocation("start")}
                  disabled={isGeocodingStart}
                  className="inline-flex items-center justify-center gap-1 rounded-xl bg-white/20 px-3 py-2 text-sm font-medium text-white hover:bg-white/30 disabled:opacity-60"
                >
                  {isGeocodingStart ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Search
                </button>
              </div>
              {startSuggestions.length > 0 ? (
                <div className="mt-1 rounded-xl bg-black/80 border border-white/15 shadow-lg max-h-48 overflow-auto">
                  {startSuggestions.map((s, idx) => (
                    <button
                      key={`${s.lat}-${s.lng}-${idx}`}
                      type="button"
                      onClick={() => {
                        onPickStart({ lat: s.lat, lng: s.lng });
                        setStartLabel(s.name);
                        setStartQuery(s.name);
                        setStartSuggestions([]);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/10 flex items-start gap-2"
                    >
                      <Search className="w-3 h-3 mt-0.5 text-zinc-400" />
                      <span className="line-clamp-2">{s.name}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {startLabel ? (
                <span className="text-xs text-zinc-400 line-clamp-2">
                  Using: {startLabel}
                </span>
              ) : null}
              {recentStarts.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1.5 items-center">
                  <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                    Recent:
                  </span>
                  {recentStarts.map((s, idx) => (
                    <button
                      key={`${s.lat}-${s.lng}-${idx}`}
                      type="button"
                      onClick={() => {
                        const label =
                          s.label ??
                          `${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`;
                        setStart({ lat: s.lat, lng: s.lng });
                        setStartQuery(label);
                        setStartLabel(s.label);
                        setStartSuggestions([]);
                        setEnd(null);
                        setEndQuery("");
                        setRoutes([]);
                        setSelectedId(null);
                        setError(null);
                        setWarning(null);
                        setSavedId(null);
                      }}
                      className="rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-white/10"
                    >
                      {s.label ?? `${s.lat.toFixed(3)}, ${s.lng.toFixed(3)}`}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {routeType === "oneway" ? (
              <div className="grid gap-1">
                <span className="text-sm font-medium text-zinc-300">
                  End location (address or coordinates)
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={endQuery}
                    onChange={(e) => setEndQuery(e.target.value)}
                    placeholder='e.g. "Central Park" or "40.7812,-73.9665"'
                    className="flex-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm placeholder:text-zinc-500 outline-none focus:border-white/20"
                  />
                  <button
                    type="button"
                    onClick={() => geocodeLocation("end")}
                    disabled={isGeocodingEnd}
                    className="inline-flex items-center justify-center gap-1 rounded-xl bg-white/20 px-3 py-2 text-sm font-medium text-white hover:bg-white/30 disabled:opacity-60"
                  >
                    {isGeocodingEnd ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    Search
                  </button>
                </div>
                {endSuggestions.length > 0 ? (
                  <div className="mt-1 rounded-xl bg-black/80 border border-white/15 shadow-lg max-h-48 overflow-auto">
                    {endSuggestions.map((s, idx) => (
                      <button
                        key={`${s.lat}-${s.lng}-${idx}`}
                        type="button"
                        onClick={() => {
                          onPickEnd({ lat: s.lat, lng: s.lng });
                          setEndLabel(s.name);
                          setEndQuery(s.name);
                          setEndSuggestions([]);
                        }}
                        className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/10 flex items-start gap-2"
                      >
                        <Search className="w-3 h-3 mt-0.5 text-zinc-400" />
                        <span className="line-clamp-2">{s.name}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {endLabel ? (
                  <span className="text-xs text-zinc-400 line-clamp-2">
                    Using: {endLabel}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {routeType === "roundtrip" ? (
            <label className="grid gap-1">
              <span className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                Target distance
                <span className="inline-flex rounded-lg bg-black/30 p-0.5 border border-white/10">
                  <button
                    type="button"
                    onClick={() => setDistanceUnit("km")}
                    className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                      distanceUnit === "km"
                        ? "bg-white text-zinc-900"
                        : "text-zinc-400 hover:text-zinc-300"
                    }`}
                  >
                    km
                  </button>
                  <button
                    type="button"
                    onClick={() => setDistanceUnit("mi")}
                    className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                      distanceUnit === "mi"
                        ? "bg-white text-zinc-900"
                        : "text-zinc-400 hover:text-zinc-300"
                    }`}
                  >
                    mi
                  </button>
                </span>
              </span>
              <input
                type="number"
                min={distanceUnit === "mi" ? 0.25 : 0.25}
                max={distanceUnit === "mi" ? 37 : 60}
                step={0.25}
                value={targetDistance}
                onChange={(e) => setTargetDistance(e.target.value)}
                onFocus={() => setDistanceFocused(true)}
                onBlur={() => setDistanceFocused(false)}
                placeholder={distanceUnit === "mi" ? "e.g. 3.1" : "e.g. 5"}
                className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white outline-none placeholder:text-zinc-500 focus:border-white/20"
              />
            </label>
          ) : null}

          {routeType === "roundtrip" ? (
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
              <span>Presets:</span>
              <button
                type="button"
                onClick={() => applyPreset("5k-easy")}
                className="rounded-full border border-white/15 bg-black/40 px-2.5 py-1 hover:bg-white/10"
              >
                5k easy
              </button>
              <button
                type="button"
                onClick={() => applyPreset("10k-long")}
                className="rounded-full border border-white/15 bg-black/40 px-2.5 py-1 hover:bg-white/10"
              >
                10k long run
              </button>
              <button
                type="button"
                onClick={() => applyPreset("hilly-30")}
                className="rounded-full border border-white/15 bg-black/40 px-2.5 py-1 hover:bg-white/10"
              >
                Hilly ~30 min
              </button>
            </div>
          ) : null}

          <div className="grid gap-5">
            <div className="grid gap-2 min-w-0">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Elevation</span>
              <div className="inline-flex w-full max-w-full gap-0.5 rounded-full bg-white/5 p-0.5 border border-white/10">
                {[
                  { value: "flat", label: "Flat" },
                  { value: "rolling", label: "Rolling" },
                  { value: "hilly", label: "Hilly" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setElevation(opt.value as ElevationPreference)}
                    className={`flex-1 min-w-0 rounded-full px-3 py-2 text-xs font-medium transition-all duration-150 ${
                      elevation === opt.value
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 min-w-0">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Safety bias</span>
              <div className="inline-flex w-full max-w-full gap-0.5 rounded-full bg-white/5 p-0.5 border border-white/10">
                {[
                  { value: "balanced", label: "Balanced" },
                  { value: "safer", label: "Safer" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSafety(opt.value as SafetyPreference)}
                    className={`flex-1 min-w-0 rounded-full px-3 py-2 text-xs font-medium transition-all duration-150 ${
                      safety === opt.value
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 min-w-0">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Surface</span>
              <div className="inline-flex w-full max-w-full gap-0.5 rounded-full bg-white/5 p-0.5 border border-white/10">
                {[
                  { value: "road", label: "Road" },
                  { value: "trail", label: "Trail" },
                  { value: "mixed", label: "Mixed" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSurface(opt.value as SurfacePreference)}
                    className={`flex-1 min-w-0 rounded-full px-3 py-2 text-xs font-medium transition-all duration-150 ${
                      surface === opt.value
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label className="grid gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Preferences <span className="normal-case font-normal text-zinc-600">(optional)</span>
            </span>
            <input
              type="text"
              placeholder="e.g. avoid main road, more shade"
              value={userPreferences}
              onChange={(e) => setUserPreferences(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-colors"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Rank by <span className="normal-case font-normal text-zinc-600">(optional)</span>
            </span>
            <input
              type="text"
              placeholder="e.g. morning run, most scenic"
              value={rankBy}
              onChange={(e) => setRankBy(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-colors"
            />
          </label>

          {start && (
            <div className="flex items-center gap-2 flex-wrap">
              {weatherLoading ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Weather…
                </span>
              ) : weatherBadge ? (
                <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${weatherBadge.color}`}>
                  <Thermometer className="w-3.5 h-3.5" />
                  {weatherBadge.temp}°F — {weatherBadge.label}
                </span>
              ) : null}
            </div>
          )}

          <button
            type="button"
            onClick={generate}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-zinc-900 font-semibold px-4 py-2.5 hover:bg-zinc-200 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Generate routes
          </button>

          {error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          {warning ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              {warning}
            </div>
          ) : null}
          {preferenceInterpretation && typeof preferenceInterpretation === "string" ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              AI: {preferenceInterpretation}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3">
          {routes.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
              Generate routes to see options here.
            </div>
          ) : (
            routes.map((r) => {
              const isSelected = r.id === selectedId;
              const isAiRecommended = r.id === aiRecommendedId;
              const aiDescriptionText =
                typeof r.aiDescription === "string" ? r.aiDescription : null;
              let aiTipText: string | null = null;
              if (typeof r.aiTip === "string") {
                aiTipText = r.aiTip;
              } else if (r.aiTip && typeof r.aiTip === "object") {
                try {
                  const parts = Object.values(r.aiTip as Record<string, unknown>)
                    .map((v) => (typeof v === "string" ? v.trim() : ""))
                    .filter(Boolean);
                  aiTipText = parts.join(" · ") || null;
                } catch {
                  aiTipText = null;
                }
              }
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={`text-left rounded-2xl border p-4 transition-all ${
                    isSelected
                      ? "border-white/20 bg-white/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-block w-3 h-3 rounded-full shrink-0"
                        style={{ background: r.color }}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-semibold">{r.name}</span>
                          {isAiRecommended ? (
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              AI pick
                            </span>
                          ) : null}
                        </div>
                        {aiDescriptionText ? (
                          <div className="text-xs text-zinc-400 mt-0.5">{aiDescriptionText}</div>
                        ) : (
                          <div className="text-xs text-zinc-400">
                            Waypoint: {r.waypoint.lat.toFixed(4)}, {r.waypoint.lng.toFixed(4)}
                          </div>
                        )}
                        {aiTipText ? (
                          <div className="text-xs text-zinc-500 mt-1 italic">Tip: {aiTipText}</div>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-white font-semibold">
                        {fmtDistance(r.distanceMeters, distanceUnit)}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {routes.length > 0 ? (
          <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-sm font-medium text-zinc-300">Save routes</h3>
            <p className="text-xs text-zinc-400">Store this set of routes in Supabase and get a link to open later or share.</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Route name (optional)"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="flex-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm placeholder:text-zinc-500 outline-none focus:border-white/20"
              />
              <button
                type="button"
                onClick={saveRoute}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/30 disabled:opacity-60"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
            </div>
            {savedId ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-emerald-400">Saved!</span>
                <button
                  type="button"
                  onClick={copySavedLink}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-zinc-300 hover:bg-white/20"
                >
                  {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {linkCopied ? "Copied" : "Copy link"}
                </button>
                <a
                  href={`/routes/saved/${savedId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-400 hover:text-white underline"
                >
                  Open
                </a>
              </div>
            ) : null}
          </div>
        ) : null}

        {selectedRoute ? (
          <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-sm font-medium text-zinc-300">Export selected route</h3>
            {(routeElevation || elevationLoading || effortLabel) && (
              <div className="space-y-1.5">
                {elevationLoading ? (
                  <span className="text-xs text-zinc-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Elevation…</span>
                ) : routeElevation ? (
                  <>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-zinc-400">Climb: {routeElevation.climbMeters} m</span>
                      {effortLabel && <span className={effortLabel.color}>Effort: {effortLabel.label}</span>}
                    </div>
                    {routeElevation.elevations.length > 1 && (
                      <ElevationSparkline elevations={routeElevation.elevations} className="h-8 w-full" />
                    )}
                  </>
                ) : effortLabel ? (
                  <span className={`text-xs ${effortLabel.color}`}>Effort: {effortLabel.label}</span>
                ) : null}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <a
                href={buildGoogleMapsUrl(selectedRoute.geometry.coordinates)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/30"
              >
                <MapPin className="w-4 h-4" />
                Open in Google Maps
              </a>
              <button
                type="button"
                onClick={() => downloadGPX(selectedRoute)}
                className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/30"
              >
                <Download className="w-4 h-4" />
                Download GPX (for watch)
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              GPX works with Garmin, Apple Watch (via apps), Strava, and other running apps.{" "}
              <a
                href="/routes/export"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-300 underline hover:text-white"
              >
                See how to send this to Strava / Garmin / Apple →
              </a>
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl overflow-hidden border border-white/10 bg-black/20">
        <MapContainer
          center={
            start && end
              ? ([(start.lat + end.lat) / 2, (start.lng + end.lng) / 2] as LatLngTuple)
              : start
                ? ([start.lat, start.lng] as LatLngTuple)
                : ([37.7749, -122.4194] as LatLngTuple)
          }
          zoom={start && end ? 12 : start ? 14 : 11}
          scrollWheelZoom
          style={{ height: "70vh", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          <ClickToSetPoint
            routeType={routeType}
            hasStart={!!start}
            hasEnd={!!end}
            onPickStart={onPickStart}
            onPickEnd={onPickEnd}
          />

          {start ? (
            <CircleMarker
              center={[start.lat, start.lng]}
              radius={8}
              pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#3b82f6", fillOpacity: 1 }}
            />
          ) : null}
          {routeType === "oneway" && end ? (
            <CircleMarker
              center={[end.lat, end.lng]}
              radius={8}
              pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#ec4899", fillOpacity: 1 }}
            />
          ) : null}

          {routes.map((r) => (
            <Polyline
              key={r.id}
              positions={r.geometry.coordinates as unknown as LatLngTuple[]}
              pathOptions={{
                color: r.color,
                weight: r.id === selectedId ? 6 : 4,
                opacity: r.id === selectedId ? 0.9 : 0.5,
              }}
            />
          ))}

          <FitBounds
            coords={selectedRoute?.geometry.coordinates ?? null}
          />
          <CenterOnSelection start={start} end={end} hasRoute={!!selectedRoute} />
        </MapContainer>
      </section>
    </div>
  );
}

