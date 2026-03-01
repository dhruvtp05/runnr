"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngTuple } from "leaflet";
import { Loader2, Save, MapPin, Download, Copy, Check } from "lucide-react";

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

function fmtDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
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

function ClickToSetStart({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
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

export default function RoutesClient() {
  const [start, setStart] = useState<LatLng | null>(null);
  const [targetDistance, setTargetDistance] = useState<number>(5);
  const [distanceUnit, setDistanceUnit] = useState<"km" | "mi">("km");
  const [elevation, setElevation] = useState<ElevationPreference>("rolling");
  const [surface, setSurface] = useState<SurfacePreference>("road");
  const [effort, setEffort] = useState<EffortPreference>("steady");
  const [safety, setSafety] = useState<SafetyPreference>("balanced");
  const [userPreferences, setUserPreferences] = useState("");
  const [rankBy, setRankBy] = useState("");
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

  const selectedRoute = useMemo(
    () => routes.find((r) => r.id === selectedId) ?? null,
    [routes, selectedId],
  );

  const onPickStart = useCallback((p: LatLng) => {
    setStart(p);
    setRoutes([]);
    setSelectedId(null);
    setError(null);
    setWarning(null);
    setPreferenceInterpretation(null);
    setAiRecommendedId(null);
    setSavedId(null);
  }, []);

  const saveRoute = useCallback(async () => {
    if (!start || routes.length === 0) return;
    setIsSaving(true);
    setError(null);
    try {
      const targetDistanceKm = distanceUnit === "mi" ? targetDistance * KM_PER_MILE : targetDistance;
      const res = await fetch("/api/routes/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: saveName.trim() || undefined,
          startLat: start.lat,
          startLng: start.lng,
          targetDistanceKm,
          distanceUnit,
          metrics: { elevation, surface, effort, safety },
          routes,
        }),
      });
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      setSavedId(json.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save route.");
    } finally {
      setIsSaving(false);
    }
  }, [start, routes, distanceUnit, targetDistance, elevation, surface, effort, safety, saveName]);

  const copySavedLink = useCallback(() => {
    if (!savedId) return;
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/routes/saved/${savedId}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }, [savedId]);

  const generate = useCallback(async () => {
    setError(null);
    setWarning(null);
    setSavedId(null);
    if (!start) {
      setError("Click the map to set a start point first.");
      return;
    }
    const targetDistanceKm =
      distanceUnit === "mi" ? targetDistance * KM_PER_MILE : targetDistance;
    if (
      !Number.isFinite(targetDistanceKm) ||
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

    setIsLoading(true);
    try {
      const res = await fetch("/api/routes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startLat: start.lat,
          startLng: start.lng,
          targetDistanceKm,
          elevation,
          surface,
          effort,
          safety,
          userPreferences: userPreferences.trim() || undefined,
          rankBy: rankBy.trim() || undefined,
        }),
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

      const data = json as RoutesResponse;
      setRoutes(data.routes);
      setAiRecommendedId(data.aiRecommendedId ?? null);
      setPreferenceInterpretation(data.preferenceInterpretation ?? null);
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
  }, [start, targetDistance, distanceUnit, elevation, surface, effort, safety, userPreferences, rankBy]);

  return (
    <div className="grid lg:grid-cols-[420px_1fr] gap-6">
      <section className="glass rounded-2xl p-5 border border-white/10">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-white font-semibold text-lg">Route options</h2>
            <p className="text-sm text-zinc-400">
              {start ? (
                <>
                  Start: {start.lat.toFixed(5)}, {start.lng.toFixed(5)}
                </>
              ) : (
                "Click the map to choose your start point."
              )}
            </p>
          </div>
        </div>

        <div className="grid gap-3 mb-4">
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
              onChange={(e) => setTargetDistance(Number(e.target.value))}
              className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white outline-none focus:border-white/20"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <span className="text-sm font-medium text-zinc-300">Elevation</span>
              <div className="inline-flex gap-1 rounded-xl bg-black/30 p-1 border border-white/10">
                {[
                  { value: "flat", label: "Flat" },
                  { value: "rolling", label: "Rolling" },
                  { value: "hilly", label: "Hilly" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setElevation(opt.value as ElevationPreference)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                      elevation === opt.value
                        ? "bg-white text-zinc-900"
                        : "text-zinc-300 hover:bg-white/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-1">
              <span className="text-sm font-medium text-zinc-300">Surface</span>
              <div className="inline-flex gap-1 rounded-xl bg-black/30 p-1 border border-white/10">
                {[
                  { value: "road", label: "Road" },
                  { value: "trail", label: "Trail" },
                  { value: "mixed", label: "Mixed" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSurface(opt.value as SurfacePreference)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                      surface === opt.value
                        ? "bg-white text-zinc-900"
                        : "text-zinc-300 hover:bg-white/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <span className="text-sm font-medium text-zinc-300">Effort</span>
              <div className="inline-flex gap-1 rounded-xl bg-black/30 p-1 border border-white/10">
                {[
                  { value: "easy", label: "Easy" },
                  { value: "steady", label: "Steady" },
                  { value: "tempo", label: "Tempo" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEffort(opt.value as EffortPreference)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                      effort === opt.value
                        ? "bg-white text-zinc-900"
                        : "text-zinc-300 hover:bg-white/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-1">
              <span className="text-sm font-medium text-zinc-300">Safety bias</span>
              <div className="inline-flex gap-1 rounded-xl bg-black/30 p-1 border border-white/10">
                {[
                  { value: "balanced", label: "Balanced" },
                  { value: "safer", label: "Safer" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSafety(opt.value as SafetyPreference)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                      safety === opt.value
                        ? "bg-white text-zinc-900"
                        : "text-zinc-300 hover:bg-white/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-300">
              Preferences (optional) — e.g. avoid main road, more shade
            </span>
            <input
              type="text"
              placeholder="Any preferences for your run?"
              value={userPreferences}
              onChange={(e) => setUserPreferences(e.target.value)}
              className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white placeholder:text-zinc-500 outline-none focus:border-white/20"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-300">
              Rank by (optional) — e.g. best for morning run, easiest
            </span>
            <input
              type="text"
              placeholder="e.g. morning run, most scenic"
              value={rankBy}
              onChange={(e) => setRankBy(e.target.value)}
              className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white placeholder:text-zinc-500 outline-none focus:border-white/20"
            />
          </label>

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
          {preferenceInterpretation ? (
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
                        {r.aiDescription ? (
                          <div className="text-xs text-zinc-400 mt-0.5">{r.aiDescription}</div>
                        ) : (
                          <div className="text-xs text-zinc-400">
                            Waypoint: {r.waypoint.lat.toFixed(4)}, {r.waypoint.lng.toFixed(4)}
                          </div>
                        )}
                        {r.aiTip ? (
                          <div className="text-xs text-zinc-500 mt-1 italic">Tip: {r.aiTip}</div>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-white font-semibold">
                        {fmtDistance(r.distanceMeters, distanceUnit)}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {fmtDuration(r.durationSeconds)}
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
            <p className="text-xs text-zinc-500">GPX works with Garmin, Apple Watch (via apps), Strava, and other running apps.</p>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl overflow-hidden border border-white/10 bg-black/20">
        <MapContainer
          center={start ? ([start.lat, start.lng] as LatLngTuple) : ([37.7749, -122.4194] as LatLngTuple)}
          zoom={start ? 14 : 11}
          scrollWheelZoom
          style={{ height: "70vh", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          <ClickToSetStart onPick={onPickStart} />

          {start ? (
            <CircleMarker
              center={[start.lat, start.lng]}
              radius={8}
              pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#3b82f6", fillOpacity: 1 }}
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

          <FitBounds coords={selectedRoute?.geometry.coordinates ?? null} />
        </MapContainer>
      </section>
    </div>
  );
}

