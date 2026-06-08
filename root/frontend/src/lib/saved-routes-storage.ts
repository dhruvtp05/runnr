export type SavedRouteMeta = {
  id: string;
  name: string | null;
  createdAt: string;
};

export const SAVED_ROUTES_STORAGE_KEY = "runnr:saved-routes";

export function readSavedRouteIds(): SavedRouteMeta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_ROUTES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedRouteMeta[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function upsertSavedRouteMeta(entry: SavedRouteMeta) {
  if (typeof window === "undefined") return;
  try {
    const existing = readSavedRouteIds();
    const filtered = existing.filter((r) => r.id !== entry.id);
    window.localStorage.setItem(
      SAVED_ROUTES_STORAGE_KEY,
      JSON.stringify([entry, ...filtered].slice(0, 50)),
    );
  } catch {
    // ignore
  }
}

export function removeSavedRouteMeta(id: string) {
  if (typeof window === "undefined") return;
  try {
    const next = readSavedRouteIds().filter((r) => r.id !== id);
    window.localStorage.setItem(SAVED_ROUTES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function writeSavedRouteIds(items: SavedRouteMeta[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SAVED_ROUTES_STORAGE_KEY, JSON.stringify(items.slice(0, 50)));
  } catch {
    // ignore
  }
}
