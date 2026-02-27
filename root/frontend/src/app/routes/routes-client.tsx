"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngTuple } from "leaflet";
import { Loader2 } from "lucide-react";

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
};

type RoutesResponse = {
  start: LatLng;
  targetDistanceKm: number;
  metrics: Metrics;
  routes: RouteOption[];
};

function fmtDistance(meters: number) {
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
  const [targetDistanceKm, setTargetDistanceKm] = useState<number>(5);
  const [elevation, setElevation] = useState<ElevationPreference>("rolling");
  const [surface, setSurface] = useState<SurfacePreference>("road");
  const [effort, setEffort] = useState<EffortPreference>("steady");
  const [safety, setSafety] = useState<SafetyPreference>("balanced");
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRoute = useMemo(
    () => routes.find((r) => r.id === selectedId) ?? null,
    [routes, selectedId],
  );

  const onPickStart = useCallback((p: LatLng) => {
    setStart(p);
    setRoutes([]);
    setSelectedId(null);
    setError(null);
  }, []);

  const generate = useCallback(async () => {
    setError(null);
    if (!start) {
      setError("Click the map to set a start point first.");
      return;
    }
    if (!Number.isFinite(targetDistanceKm) || targetDistanceKm <= 0.25 || targetDistanceKm > 60) {
      setError("Enter a target distance between 0.25 km and 60 km.");
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
        }),
      });

      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof json === "object" && json !== null && "error" in json
            ? String((json as { error: unknown }).error)
            : "Failed to generate routes.";
        throw new Error(msg);
      }

      const data = json as RoutesResponse;
      setRoutes(data.routes);
      setSelectedId(data.routes[0]?.id ?? null);
      if (data.routes.length === 0) setError("No routes found near that point. Try another location.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate routes.");
    } finally {
      setIsLoading(false);
    }
  }, [start, targetDistanceKm]);

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
            <span className="text-sm font-medium text-zinc-300">Target distance (km)</span>
            <input
              type="number"
              min={0.25}
              max={60}
              step={0.25}
              value={targetDistanceKm}
              onChange={(e) => setTargetDistanceKm(Number(e.target.value))}
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
        </div>

        <div className="grid gap-3">
          {routes.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
              Generate routes to see options here.
            </div>
          ) : (
            routes.map((r) => {
              const isSelected = r.id === selectedId;
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
                        className="inline-block w-3 h-3 rounded-full"
                        style={{ background: r.color }}
                        aria-hidden
                      />
                      <div>
                        <div className="text-white font-semibold">{r.name}</div>
                        <div className="text-xs text-zinc-400">
                          Waypoint: {r.waypoint.lat.toFixed(4)}, {r.waypoint.lng.toFixed(4)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-semibold">{fmtDistance(r.distanceMeters)}</div>
                      <div className="text-xs text-zinc-400">{fmtDuration(r.durationSeconds)}</div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
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

