"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngTuple } from "leaflet";
import { Loader2, Save, MapPin, Download, Copy, Check, Search, Thermometer, LocateFixed, ChevronDown, History } from "lucide-react";
import {
  KM_PER_MILE,
  fmtDistance,
  fmtDuration,
  parsePaceMinPerUnit,
  formatPaceMinPerUnit,
  durationAtPaceSeconds,
  sortRoutes,
  formatRecentStartLabel,
  type RouteSortBy,
} from "@/lib/route-utils";
import { upsertSavedRouteMeta } from "@/lib/saved-routes-storage";
import RouteCompareTable from "./route-compare-table";
import FormSection from "./form-section";

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
  const [isLocatingStart, setIsLocatingStart] = useState(false);
  const [startSuggestions, setStartSuggestions] = useState<
    { name: string; lat: number; lng: number }[]
  >([]);
  const [endSuggestions, setEndSuggestions] = useState<
    { name: string; lat: number; lng: number }[]
  >([]);
  const [distanceFocused, setDistanceFocused] = useState(false);
  const [sortBy, setSortBy] = useState<RouteSortBy>("recommended");
  const [paceInput, setPaceInput] = useState("6:00");
  const [recentStarts, setRecentStarts] = useState<
    { lat: number; lng: number; label: string | null }[]
  >([]);
  const [recentExpanded, setRecentExpanded] = useState(false);
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

  const targetDistanceMeters = useMemo(() => {
    if (routeType === "oneway") {
      return routes[0]?.distanceMeters ?? 0;
    }
    const baseDistance = Number(targetDistance);
    if (!Number.isFinite(baseDistance) || baseDistance <= 0) return 0;
    const km = distanceUnit === "mi" ? baseDistance * KM_PER_MILE : baseDistance;
    return km * 1000;
  }, [routeType, targetDistance, distanceUnit, routes]);

  const paceMinPerUnit = useMemo(() => parsePaceMinPerUnit(paceInput) ?? 6, [paceInput]);

  const sortedRoutes = useMemo(
    () => sortRoutes(routes, sortBy, targetDistanceMeters || undefined),
    [routes, sortBy, targetDistanceMeters],
  );

  const selectedRoute = useMemo(
    () => sortedRoutes.find((r) => r.id === selectedId) ?? null,
    [sortedRoutes, selectedId],
  );

  const topPickId = useMemo(() => {
    if (aiRecommendedId && sortBy === "recommended") return aiRecommendedId;
    return sortedRoutes[0]?.id ?? null;
  }, [aiRecommendedId, sortBy, sortedRoutes]);

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

  const applyRecentStart = useCallback(
    (s: { lat: number; lng: number; label: string | null }) => {
      const label = s.label ?? `${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`;
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
      setRecentExpanded(false);
    },
    [],
  );

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
        setSortBy("closest");
        break;
      case "10k-long":
        setDistanceUnit("km");
        setTargetDistance("10");
        setElevation("rolling");
        setSurface("road");
        setSafety("balanced");
        setSortBy("closest");
        break;
      case "hilly-30":
        setDistanceUnit("km");
        setTargetDistance("5");
        setElevation("hilly");
        setSurface("mixed");
        setSafety("balanced");
        setSortBy("fastest");
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
        upsertSavedRouteMeta({
          id: json.id,
          name: saveName.trim() || null,
          createdAt: new Date().toISOString(),
        });
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

  const useMyLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Your browser does not support location access.");
      return;
    }

    setIsLocatingStart(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onPickStart(p);
        setStartLabel("My location");
        setStartQuery("My location");
        setIsLocatingStart(false);

        try {
          const res = await fetch(
            `/api/geocode?lat=${encodeURIComponent(p.lat)}&lon=${encodeURIComponent(p.lng)}`,
          );
          if (res.ok) {
            const data = (await res.json()) as {
              results?: Array<{ name: string }>;
            };
            const name = data.results?.[0]?.name;
            if (name) {
              setStartLabel(name);
              setStartQuery(name);
            }
          }
        } catch {
          // Keep "My location" if reverse geocoding fails.
        }
      },
      (err) => {
        setIsLocatingStart(false);
        const messages: Record<number, string> = {
          1: "Location access was denied. Allow location in your browser settings.",
          2: "Could not determine your location.",
          3: "Location request timed out. Try again.",
        };
        setError(messages[err.code] ?? "Could not get your location.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, [onPickStart]);

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
        variant: "weather-badge-amber",
      };
    }

    let label: string;
    let variant: string;

    if (temp <= 20) {
      label = "Very cold for running";
      variant = "weather-badge-cold";
    } else if (temp <= 40) {
      label = "Cold – layer up";
      variant = "weather-badge-cold";
    } else if (temp <= 60) {
      label = "Great running weather";
      variant = "weather-badge-good";
    } else if (temp <= 75) {
      label = "Warm – stay hydrated";
      variant = "weather-badge-warm";
    } else if (temp <= 85) {
      label = "Hot – go easy";
      variant = "weather-badge-warm";
    } else {
      label = "Very hot – use caution";
      variant = "weather-badge-hot";
    }

    return { label, temp, variant };
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
      if (climb < 150 && distKm < 8) return { label: "Easy", color: "effort-easy" };
      if (climb > 300 || distKm > 15) return { label: "Hard", color: "effort-hard" };
      return { label: "Moderate", color: "effort-moderate" };
    }
    if (distKm < 5) return { label: "Easy", color: "effort-easy" };
    if (distKm > 15) return { label: "Hard", color: "effort-hard" };
    return { label: "Moderate", color: "effort-moderate" };
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
      };
      if (routeType === "roundtrip") {
        const baseDistance = Number(targetDistance);
        body.targetDistanceKm =
          distanceUnit === "mi" ? baseDistance * KM_PER_MILE : baseDistance;
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
      const generatedTargetMeters =
        routeType === "roundtrip"
          ? (distanceUnit === "mi"
              ? Number(targetDistance) * KM_PER_MILE
              : Number(targetDistance)) * 1000
          : data.routes[0]?.distanceMeters ?? 0;

      setSelectedId(
        sortRoutes(data.routes, sortBy, generatedTargetMeters || undefined)[0]?.id ??
          data.aiRecommendedId ??
          data.routes[0]?.id ??
          null,
      );
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
  }, [start, end, routeType, targetDistance, distanceUnit, elevation, surface, safety, sortBy]);

  return (
    <div className="grid lg:grid-cols-[420px_1fr] gap-6">
      <section className="panel planner-sidebar">
        <div className="planner-header">
          <h2 className="text-heading font-semibold text-lg">Route planner</h2>
          <p className="text-sm text-body mt-1">
            {routeType === "roundtrip" ? (
              start ? (
                <>Start set · click the map to move it</>
              ) : (
                "Pick a start on the map or search below"
              )
            ) : start && end ? (
              <span className="flex flex-wrap items-center gap-2">
                Start and end set.{" "}
                <button
                  type="button"
                  onClick={() => {
                    setEnd(null);
                    setRoutes([]);
                    setSelectedId(null);
                  }}
                  className="text-link underline"
                >
                  Change end
                </button>
              </span>
            ) : start ? (
              "Now pick an end point on the map"
            ) : (
              "Pick start and end on the map, or search below"
            )}
          </p>
        </div>

        <div className="planner-sidebar-scroll">
          <FormSection title="Trip type">
            <div className="segment">
              {[
                { value: "roundtrip" as const, label: "Loop" },
                { value: "oneway" as const, label: "One-way" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onRouteTypeChange(opt.value)}
                  className={`segment-btn text-sm ${
                    routeType === opt.value ? "segment-btn-active" : ""
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </FormSection>

          <FormSection title="Locations" description="Search, use GPS, or click the map">
            <div className="grid gap-1">
              <span className="text-sm font-medium text-body">Start</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={startQuery}
                  onChange={(e) => setStartQuery(e.target.value)}
                  placeholder='Address or "37.7749,-122.4194"'
                  className="field flex-1"
                />
                <button
                  type="button"
                  onClick={() => geocodeLocation("start")}
                  disabled={isGeocodingStart || isLocatingStart}
                  className="btn btn-secondary shrink-0"
                  aria-label="Search start"
                >
                  {isGeocodingStart ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={useMyLocation}
                  disabled={isLocatingStart || isGeocodingStart}
                  className="btn btn-secondary shrink-0"
                  aria-label="Use my location"
                >
                  {isLocatingStart ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LocateFixed className="w-4 h-4" />
                  )}
                </button>
              </div>
              {startSuggestions.length > 0 ? (
                <div className="dropdown-menu max-h-40 overflow-auto">
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
                      className="dropdown-item flex items-start gap-2"
                    >
                      <Search className="w-3 h-3 mt-0.5 text-subtle" />
                      <span className="line-clamp-2">{s.name}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {startLabel ? (
                <span className="text-xs text-subtle line-clamp-1">Using: {startLabel}</span>
              ) : null}
              {recentStarts.length > 0 ? (
                <div className="recent-starts">
                  <button
                    type="button"
                    onClick={() => setRecentExpanded((v) => !v)}
                    className="recent-starts-toggle"
                    aria-expanded={recentExpanded}
                  >
                    <History className="w-3.5 h-3.5 shrink-0" aria-hidden />
                    <span className="recent-starts-toggle-label">
                      Recent starts
                      <span className="recent-starts-count">{recentStarts.length}</span>
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 shrink-0 recent-starts-chevron ${recentExpanded ? "recent-starts-chevron-open" : ""}`}
                      aria-hidden
                    />
                  </button>
                  {recentExpanded ? (
                    <ul className="recent-starts-list">
                      {recentStarts.map((s, idx) => {
                        const { short, full } = formatRecentStartLabel(s.label, s.lat, s.lng);
                        return (
                          <li key={`${s.lat}-${s.lng}-${idx}`}>
                            <button
                              type="button"
                              onClick={() => applyRecentStart(s)}
                              className="recent-starts-item"
                              title={full}
                            >
                              <MapPin className="w-3 h-3 shrink-0 text-subtle" aria-hidden />
                              <span className="recent-starts-item-label">{short}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>

            {routeType === "oneway" ? (
              <div className="grid gap-1">
                <span className="text-sm font-medium text-body">End</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={endQuery}
                    onChange={(e) => setEndQuery(e.target.value)}
                    placeholder='Address or "40.7812,-73.9665"'
                    className="field flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => geocodeLocation("end")}
                    disabled={isGeocodingEnd}
                    className="btn btn-secondary shrink-0"
                    aria-label="Search end"
                  >
                    {isGeocodingEnd ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {endSuggestions.length > 0 ? (
                  <div className="dropdown-menu max-h-40 overflow-auto">
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
                        className="dropdown-item flex items-start gap-2"
                      >
                        <Search className="w-3 h-3 mt-0.5 text-subtle" />
                        <span className="line-clamp-2">{s.name}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {endLabel ? (
                  <span className="text-xs text-subtle line-clamp-2">Using: {endLabel}</span>
                ) : null}
              </div>
            ) : null}
          </FormSection>

          <FormSection title="Run settings">
            {routeType === "roundtrip" ? (
              <>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-body flex items-center justify-between gap-2">
                    Target distance
                    <span className="segment p-0.5">
                      <button
                        type="button"
                        onClick={() => setDistanceUnit("km")}
                        className={`segment-btn px-2 py-1 ${
                          distanceUnit === "km" ? "segment-btn-active" : ""
                        }`}
                      >
                        km
                      </button>
                      <button
                        type="button"
                        onClick={() => setDistanceUnit("mi")}
                        className={`segment-btn px-2 py-1 ${
                          distanceUnit === "mi" ? "segment-btn-active" : ""
                        }`}
                      >
                        mi
                      </button>
                    </span>
                  </span>
                  <input
                    type="number"
                    min={0.25}
                    max={distanceUnit === "mi" ? 37 : 60}
                    step={0.25}
                    value={targetDistance}
                    onChange={(e) => setTargetDistance(e.target.value)}
                    onFocus={() => setDistanceFocused(true)}
                    onBlur={() => setDistanceFocused(false)}
                    placeholder={distanceUnit === "mi" ? "e.g. 3.1" : "e.g. 5"}
                    className="field"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-subtle">Quick presets</span>
                  <button type="button" onClick={() => applyPreset("5k-easy")} className="chip">
                    5k easy
                  </button>
                  <button type="button" onClick={() => applyPreset("10k-long")} className="chip">
                    10k long
                  </button>
                  <button type="button" onClick={() => applyPreset("hilly-30")} className="chip">
                    Hilly ~30m
                  </button>
                </div>
              </>
            ) : null}

            <div className="pref-grid">
              <div className="grid gap-2 min-w-0">
                <span className="text-xs font-medium text-subtle">Elevation</span>
                <div className="segment w-full">
                  {(
                    [
                      { value: "flat", label: "Flat" },
                      { value: "rolling", label: "Rolling" },
                      { value: "hilly", label: "Hilly" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setElevation(opt.value)}
                      className={`segment-btn ${
                        elevation === opt.value ? "segment-btn-active" : ""
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2 min-w-0">
                <span className="text-xs font-medium text-subtle">Safety</span>
                <div className="segment w-full">
                  {(
                    [
                      { value: "balanced", label: "Balanced" },
                      { value: "safer", label: "Safer" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSafety(opt.value)}
                      className={`segment-btn ${
                        safety === opt.value ? "segment-btn-active" : ""
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2 min-w-0 pref-grid-wide">
                <span className="text-xs font-medium text-subtle">Surface</span>
                <div className="segment w-full">
                  {(
                    [
                      { value: "road", label: "Road" },
                      { value: "trail", label: "Trail" },
                      { value: "mixed", label: "Mixed" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSurface(opt.value)}
                      className={`segment-btn ${
                        surface === opt.value ? "segment-btn-active" : ""
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </FormSection>

          {sortedRoutes.length > 0 ? (
            <FormSection
              title="Results"
              description="Compare options and pick one on the map"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-subtle">Sort by</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as RouteSortBy)}
                    className="field"
                  >
                    <option value="recommended">Recommended</option>
                    <option value="closest">Closest to target</option>
                    <option value="shortest">Shortest</option>
                    <option value="longest">Longest</option>
                    <option value="fastest">Fastest (map est.)</option>
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-subtle">
                    Pace ({distanceUnit === "mi" ? "min/mi" : "min/km"})
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={distanceUnit === "mi" ? "9:39" : "6:00"}
                    value={paceInput}
                    onChange={(e) => setPaceInput(e.target.value)}
                    onBlur={() => {
                      const parsed = parsePaceMinPerUnit(paceInput);
                      if (parsed !== null) setPaceInput(formatPaceMinPerUnit(parsed));
                    }}
                    className="field"
                  />
                </label>
              </div>

              {sortedRoutes.length > 1 ? (
                <RouteCompareTable
                  routes={sortedRoutes}
                  selectedId={selectedId}
                  topPickId={topPickId}
                  onSelect={setSelectedId}
                  distanceUnit={distanceUnit}
                  paceMinPerUnit={paceMinPerUnit}
                  routeType={routeType}
                  targetDistanceMeters={targetDistanceMeters}
                  sortBy={sortBy}
                  embedded
                />
              ) : selectedRoute ? (
                <div className="route-card route-card-selected">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ background: selectedRoute.color }}
                        aria-hidden
                      />
                      <span className="text-heading font-semibold truncate">
                        {selectedRoute.name}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-heading font-semibold">
                        {fmtDistance(selectedRoute.distanceMeters, distanceUnit)}
                      </div>
                      <div className="text-xs text-subtle">
                        {fmtDuration(
                          durationAtPaceSeconds(
                            selectedRoute.distanceMeters,
                            paceMinPerUnit,
                            distanceUnit,
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </FormSection>
          ) : null}

          {routes.length > 0 ? (
            <FormSection title="Save & share">
              <p className="text-xs text-subtle -mt-1">
                Store this route set and get a link to open later.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Name (optional)"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="field flex-1"
                />
                <button
                  type="button"
                  onClick={saveRoute}
                  disabled={isSaving}
                  className="btn btn-secondary shrink-0"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </button>
              </div>
              {savedId ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-link font-medium">Saved</span>
                  <button type="button" onClick={copySavedLink} className="btn btn-secondary text-xs py-1">
                    {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {linkCopied ? "Copied" : "Copy link"}
                  </button>
                  <a
                    href={`/routes/saved/${savedId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link underline text-sm"
                  >
                    Open
                  </a>
                </div>
              ) : null}
            </FormSection>
          ) : null}

          {selectedRoute ? (
            <FormSection title="Export">
              {(routeElevation || elevationLoading || effortLabel) && (
                <div className="space-y-1.5">
                  {elevationLoading ? (
                    <span className="text-xs text-subtle flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading elevation…
                    </span>
                  ) : routeElevation ? (
                    <>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-body">Climb: {routeElevation.climbMeters} m</span>
                        {effortLabel ? (
                          <span className={effortLabel.color}>Effort: {effortLabel.label}</span>
                        ) : null}
                      </div>
                      {routeElevation.elevations.length > 1 ? (
                        <ElevationSparkline
                          elevations={routeElevation.elevations}
                          className="h-8 w-full"
                        />
                      ) : null}
                    </>
                  ) : effortLabel ? (
                    <span className={`text-xs ${effortLabel.color}`}>
                      Effort: {effortLabel.label}
                    </span>
                  ) : null}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <a
                  href={buildGoogleMapsUrl(selectedRoute.geometry.coordinates)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                >
                  <MapPin className="w-4 h-4" />
                  Google Maps
                </a>
                <button
                  type="button"
                  onClick={() => downloadGPX(selectedRoute)}
                  className="btn btn-secondary"
                >
                  <Download className="w-4 h-4" />
                  Download GPX
                </button>
              </div>
              <p className="text-xs text-subtle">
                Import GPX into Strava, Garmin, or Apple Watch apps.{" "}
                <a href="/routes/export" target="_blank" rel="noopener noreferrer" className="text-link underline">
                  How to export →
                </a>
              </p>
            </FormSection>
          ) : null}
        </div>

        <div className="form-section-action">
          {start ? (
            <div className="flex items-center gap-2 flex-wrap">
              {weatherLoading ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-subtle">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Weather…
                </span>
              ) : weatherBadge ? (
                <span className={`weather-badge ${weatherBadge.variant}`}>
                  <Thermometer className="w-3.5 h-3.5" />
                  {weatherBadge.temp}°F — {weatherBadge.label}
                </span>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            onClick={generate}
            disabled={isLoading}
            className="btn btn-primary w-full"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Generate routes
          </button>

          {error ? <div className="alert-error">{error}</div> : null}
          {warning ? <div className="alert-warning">{warning}</div> : null}
          {preferenceInterpretation && typeof preferenceInterpretation === "string" ? (
            <div className="alert-info">{preferenceInterpretation}</div>
          ) : null}

          {sortedRoutes.length === 0 ? (
            <p className="text-xs text-subtle text-center">
              Set a start point and hit generate to see routes.
            </p>
          ) : null}
        </div>
      </section>

      <section className="panel overflow-hidden p-0">
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

