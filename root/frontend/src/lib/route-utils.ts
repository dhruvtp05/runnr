export const KM_PER_MILE = 1.60934;

export type RouteSortBy =
  | "recommended"
  | "closest"
  | "shortest"
  | "longest"
  | "fastest";

type SortableRoute = {
  id: string;
  distanceMeters: number;
  durationSeconds: number;
};

export function parsePaceMinPerUnit(input: string): number | null {
  const trimmed = input.trim();
  const colon = trimmed.match(/^(\d+)\s*:\s*(\d{1,2})$/);
  if (colon) {
    const mins = Number(colon[1]);
    const secs = Number(colon[2]);
    if (!Number.isFinite(mins) || !Number.isFinite(secs) || secs >= 60) return null;
    return mins + secs / 60;
  }
  const decimal = Number(trimmed);
  if (Number.isFinite(decimal) && decimal > 0 && decimal < 60) return decimal;
  return null;
}

export function formatPaceMinPerUnit(minPerUnit: number): string {
  const mins = Math.floor(minPerUnit);
  const secs = Math.round((minPerUnit - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function durationAtPaceSeconds(
  distanceMeters: number,
  minPerUnit: number,
  unit: "km" | "mi",
): number {
  const km = distanceMeters / 1000;
  const units = unit === "mi" ? km / KM_PER_MILE : km;
  return units * minPerUnit * 60;
}

export function fmtDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export function fmtDistance(meters: number, unit: "km" | "mi" = "km"): string {
  if (unit === "mi") {
    const miles = meters / 1000 / KM_PER_MILE;
    return `${miles.toFixed(miles < 10 ? 2 : 1)} mi`;
  }
  const km = meters / 1000;
  return `${km.toFixed(km < 10 ? 2 : 1)} km`;
}

export function sortRoutes<T extends SortableRoute>(
  routes: T[],
  sortBy: RouteSortBy,
  targetDistanceMeters?: number,
): T[] {
  const copy = [...routes];
  switch (sortBy) {
    case "shortest":
      return copy.sort((a, b) => a.distanceMeters - b.distanceMeters);
    case "longest":
      return copy.sort((a, b) => b.distanceMeters - a.distanceMeters);
    case "fastest":
      return copy.sort((a, b) => a.durationSeconds - b.durationSeconds);
    case "closest":
      if (!targetDistanceMeters || targetDistanceMeters <= 0) return copy;
      return copy.sort(
        (a, b) =>
          Math.abs(a.distanceMeters - targetDistanceMeters) -
          Math.abs(b.distanceMeters - targetDistanceMeters),
      );
    case "recommended":
    default:
      return copy;
  }
}

export function distanceDeltaLabel(
  distanceMeters: number,
  targetDistanceMeters: number,
  unit: "km" | "mi",
): string {
  const deltaMeters = distanceMeters - targetDistanceMeters;
  const abs = Math.abs(deltaMeters);
  if (abs < 50) return "On target";
  const formatted = fmtDistance(abs, unit);
  return deltaMeters > 0 ? `+${formatted}` : `−${formatted}`;
}

export type DistanceDeltaVariant = "good" | "ok" | "warn";

export function distanceDeltaInfo(
  distanceMeters: number,
  targetDistanceMeters: number,
  unit: "km" | "mi",
): { label: string; variant: DistanceDeltaVariant } {
  const deltaMeters = distanceMeters - targetDistanceMeters;
  const abs = Math.abs(deltaMeters);
  const label = distanceDeltaLabel(distanceMeters, targetDistanceMeters, unit);
  if (abs < 50) return { label, variant: "good" };
  if (abs <= targetDistanceMeters * 0.05) return { label, variant: "ok" };
  return { label, variant: "warn" };
}

export const SORT_BY_LABELS: Record<RouteSortBy, string> = {
  recommended: "Recommended order",
  closest: "Closest to target distance",
  shortest: "Shortest distance",
  longest: "Longest distance",
  fastest: "Fastest router estimate",
};

const COORD_LABEL = /^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/;

export function formatRecentStartLabel(
  label: string | null,
  lat: number,
  lng: number,
): { short: string; full: string } {
  const coords = `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
  if (!label?.trim()) {
    return { short: coords, full: coords };
  }
  const trimmed = label.trim();
  if (COORD_LABEL.test(trimmed)) {
    return { short: coords, full: coords };
  }
  const first = trimmed.split(",")[0]?.trim() ?? trimmed;
  const short =
    first.length > 24 ? `${first.slice(0, 22)}…` : trimmed.length > 36 ? first : trimmed;
  return { short, full: trimmed };
}
