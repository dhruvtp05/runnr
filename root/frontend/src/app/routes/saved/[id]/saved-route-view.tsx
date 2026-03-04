"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngTuple } from "leaflet";
import { MapPin, Download, Loader2, ThumbsUp, ThumbsDown } from "lucide-react";

type LatLng = { lat: number; lng: number };

type RouteOption = {
  id: string;
  name: string;
  color: string;
  distanceMeters: number;
  durationSeconds: number;
  geometry: { type: "LineString"; coordinates: Array<[number, number]> };
  waypoint: LatLng;
  aiDescription?: string;
  aiTip?: string;
};

type SavedData = {
  id: string;
  name: string | null;
  start: LatLng;
  targetDistanceKm: number;
  distanceUnit: string;
  metrics: Record<string, string>;
  routes: RouteOption[];
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

function downloadGPX(route: { name: string; geometry: { coordinates: Array<[number, number]> } }) {
  const coords = route.geometry.coordinates;
  const trkpts = coords
    .map(([lat, lng]) => `    <trkpt lat="${lat}" lon="${lng}"></trkpt>`)
    .join("\n");
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="runnr" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${route.name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")}</name>
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

function buildGoogleMapsUrl(coords: Array<[number, number]>): string {
  if (coords.length === 0) return "";
  const maxWaypoints = 25;
  const step = Math.max(1, Math.floor(coords.length / maxWaypoints));
  const points = coords.filter((_, i) => i % step === 0 || i === coords.length - 1);
  return `https://www.google.com/maps/dir/${points.map(([lat, lng]) => `${lat},${lng}`).join("/")}`;
}

function FitBounds({ coords }: { coords: Array<[number, number]> | null }) {
  const map = useMap();
  useEffect(() => {
    if (!coords || coords.length < 2) return;
    map.fitBounds(coords as LatLngBoundsExpression, { padding: [24, 24] });
  }, [coords, map]);
  return null;
}

export default function SavedRouteView({ id }: { id: string }) {
  const [data, setData] = useState<SavedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, { thumbsUp: number; thumbsDown: number; tags: string[] }>>({});
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/routes/saved/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then(setData)
      .catch(() => setError("Could not load saved route."));
  }, [id]);

  useEffect(() => {
    fetch(`/api/routes/saved/${id}/feedback`)
      .then((r) => (r.ok ? r.json() : {}))
      .then(setFeedback)
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (data?.routes?.length) setSelectedId(data.routes[0].id);
  }, [data?.routes]);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-200">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="glass rounded-2xl p-8 border border-white/10 flex items-center justify-center gap-2 text-zinc-400">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading…
      </div>
    );
  }

  const deleteThisSavedRoute = async () => {
    if (!id || isDeleting) return;
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/routes/saved/${id}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to delete saved route.");
      }
      try {
        if (typeof window !== "undefined") {
          const key = "runnr:saved-routes";
          const raw = window.localStorage.getItem(key);
          if (raw) {
            const list = JSON.parse(raw) as { id: string }[];
            const next = list.filter((r) => r.id !== id);
            window.localStorage.setItem(key, JSON.stringify(next));
          }
        }
      } catch {
        // ignore localStorage errors
      }
      router.push("/routes/saved");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to delete saved route.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const submitFeedback = async (routeOptionId: string, thumbs?: 1 | -1, tag?: string) => {
    try {
      const res = await fetch(`/api/routes/saved/${id}/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ routeOptionId, thumbs, tag }),
      });
      if (!res.ok) return;
      const list = await fetch(`/api/routes/saved/${id}/feedback`).then((r) => (r.ok ? r.json() : {}));
      setFeedback(list);
    } catch {
      // ignore
    }
  };

  const unit = (data.distanceUnit === "mi" ? "mi" : "km") as "km" | "mi";
  const selectedRoute = data.routes.find((r) => r.id === selectedId) ?? data.routes[0];

  const FEEDBACK_TAGS = ["Too much traffic", "Felt unsafe", "Blocked path"];

  return (
    <div className="grid lg:grid-cols-[420px_1fr] gap-6">
      <section className="glass rounded-2xl p-5 border border-white/10">
        {data.name ? (
          <h2 className="text-white font-semibold text-lg mb-1">{data.name}</h2>
        ) : null}
        <p className="text-sm text-zinc-400 mb-4">
          {data.metrics?.routeType === "oneway" ? (
            <>One-way · {data.distanceUnit === "mi" ? (data.targetDistanceKm / KM_PER_MILE).toFixed(1) : data.targetDistanceKm.toFixed(1)} {data.distanceUnit} total</>
          ) : (
            <>
              Start: {data.start.lat.toFixed(5)}, {data.start.lng.toFixed(5)} · Target:{" "}
              {data.distanceUnit === "mi"
                ? (data.targetDistanceKm / KM_PER_MILE).toFixed(1)
                : data.targetDistanceKm.toFixed(1)}{" "}
              {data.distanceUnit}
            </>
          )}
        </p>
        <div className="grid gap-3">
          {data.routes.map((r) => {
            const isSelected = r.id === selectedId;
            return (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(r.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedId(r.id);
                  }
                }}
                className={`text-left rounded-2xl border p-4 transition-all ${
                  isSelected ? "border-white/20 bg-white/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ background: r.color }}
                    />
                    <div className="min-w-0">
                      <div className="text-white font-semibold">{r.name}</div>
                      {r.aiDescription ? (
                        <div className="text-xs text-zinc-400 mt-0.5">{r.aiDescription}</div>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-white font-semibold">{fmtDistance(r.distanceMeters, unit)}</div>
                    <div className="text-xs text-zinc-400">{fmtDuration(r.durationSeconds)}</div>
                  </div>
                </div>
                {(() => {
                  const fb = feedback[r.id] ?? { thumbsUp: 0, thumbsDown: 0, tags: [] };
                  return (
                    <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1 text-xs text-zinc-400">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); submitFeedback(r.id, 1); }}
                          className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 hover:bg-white/10"
                          aria-label="Thumbs up"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" /> {fb.thumbsUp}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); submitFeedback(r.id, -1); }}
                          className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 hover:bg-white/10"
                          aria-label="Thumbs down"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" /> {fb.thumbsDown}
                        </button>
                      </div>
                      {fb.tags.length > 0 && (
                        <span className="flex flex-wrap gap-1">
                          {fb.tags.map((t) => (
                            <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-zinc-400">
                              {t}
                            </span>
                          ))}
                        </span>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {FEEDBACK_TAGS.filter((t) => !fb.tags.includes(t)).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); submitFeedback(r.id, undefined, t); }}
                            className="text-xs px-1.5 py-0.5 rounded border border-white/20 text-zinc-400 hover:bg-white/10"
                          >
                            + {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
        {selectedRoute ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
              <h3 className="text-sm font-medium text-zinc-300">
                Export this route
              </h3>
              <div className="flex flex-wrap gap-2">
                <a
                  href={buildGoogleMapsUrl(selectedRoute.geometry.coordinates)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/30"
                >
                  <MapPin className="w-4 h-4" /> Open in Google Maps
                </a>
                <button
                  type="button"
                  onClick={() => downloadGPX(selectedRoute)}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/30"
                >
                  <Download className="w-4 h-4" /> Download GPX (for watch)
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={deleteThisSavedRoute}
              disabled={isDeleting}
              className="w-full inline-flex items-center justify-center rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-500/20 disabled:opacity-60"
            >
              {isDeleting ? "Deleting…" : "Delete this saved set"}
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl overflow-hidden border border-white/10 bg-black/20">
        <MapContainer
          center={[data.start.lat, data.start.lng]}
          zoom={14}
          scrollWheelZoom
          style={{ height: "70vh", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />
          <CircleMarker
            center={[data.start.lat, data.start.lng]}
            radius={8}
            pathOptions={{ color: "#fff", weight: 2, fillColor: "#3b82f6", fillOpacity: 1 }}
          />
          {data.metrics?.routeType === "oneway" && selectedRoute?.geometry.coordinates.length ? (
            (() => {
              const last = selectedRoute.geometry.coordinates[selectedRoute.geometry.coordinates.length - 1];
              return (
                <CircleMarker
                  center={[last[0], last[1]]}
                  radius={8}
                  pathOptions={{ color: "#fff", weight: 2, fillColor: "#ec4899", fillOpacity: 1 }}
                />
              );
            })()
          ) : null}
          {data.routes.map((r) => (
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
