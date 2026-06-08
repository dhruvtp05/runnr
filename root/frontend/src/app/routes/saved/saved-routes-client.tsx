"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Clock, ExternalLink, Loader2, Trash2 } from "lucide-react";
import {
  readSavedRouteIds,
  removeSavedRouteMeta,
  writeSavedRouteIds,
  type SavedRouteMeta,
} from "@/lib/saved-routes-storage";

type SavedRouteListItem = SavedRouteMeta & {
  targetDistanceKm?: number;
  distanceUnit?: string;
  routeCount?: number;
};

export default function SavedRoutesClient() {
  const [items, setItems] = useState<SavedRouteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    const local = readSavedRouteIds();
    if (local.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/routes/saved", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: local.map((r) => r.id) }),
      });
      const json = (await res.json()) as {
        items?: SavedRouteListItem[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to load saved routes.");
      }

      const remote = json.items ?? [];
      const remoteIds = new Set(remote.map((r) => r.id));
      const prunedLocal = local.filter((r) => remoteIds.has(r.id));
      if (prunedLocal.length !== local.length) {
        writeSavedRouteIds(prunedLocal);
      }

      const merged = remote.map((remoteItem) => {
        const cached = prunedLocal.find((r) => r.id === remoteItem.id);
        return {
          id: remoteItem.id,
          name: remoteItem.name ?? cached?.name ?? null,
          createdAt: remoteItem.createdAt ?? cached?.createdAt ?? "",
          targetDistanceKm: remoteItem.targetDistanceKm,
          distanceUnit: remoteItem.distanceUnit,
          routeCount: remoteItem.routeCount,
        };
      });

      setItems(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load saved routes.");
      setItems(local);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const remove = async (id: string) => {
    setRemovingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/routes/saved/${id}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to delete saved route.");
      }
      removeSavedRouteMeta(id);
      setItems((curr) => curr.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete saved route.");
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="panel p-6 flex items-center gap-2 text-body text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading saved routes…
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="panel p-6 text-sm text-body">
        <p className="mb-2">No saved routes yet.</p>
        <p className="text-subtle mb-4">
          Generate routes on the planner page, then save a set to get a shareable link.
        </p>
        <Link href="/routes" className="btn btn-primary">
          Plan a route
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <div className="alert-error">{error}</div> : null}
      <div className="space-y-2">
        {items.map((item) => {
          const label = item.name?.trim() || "Unnamed route set";
          const date = item.createdAt ? new Date(item.createdAt).toLocaleString() : "";
          const href = `/routes/saved/${item.id}`;
          const unit = item.distanceUnit === "mi" ? "mi" : "km";
          const distance =
            item.targetDistanceKm !== undefined
              ? unit === "mi"
                ? (item.targetDistanceKm / 1.60934).toFixed(1)
                : item.targetDistanceKm.toFixed(1)
              : null;
          return (
            <div
              key={item.id}
              className="panel flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="font-medium text-heading truncate">{label}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle">
                  {date ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {date}
                    </span>
                  ) : null}
                  {distance ? (
                    <span>
                      Target {distance} {unit}
                    </span>
                  ) : null}
                  {item.routeCount ? <span>{item.routeCount} options</span> : null}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link href={href} className="btn btn-secondary text-xs py-1.5">
                  <ExternalLink className="w-3 h-3" />
                  Open
                </Link>
                <button
                  type="button"
                  onClick={() => void remove(item.id)}
                  disabled={removingId === item.id}
                  className="btn-ghost rounded-md p-1.5"
                  aria-label="Delete saved route"
                >
                  {removingId === item.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
