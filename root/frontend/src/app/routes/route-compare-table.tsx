"use client";

import { useMemo, type ReactNode } from "react";
import {
  durationAtPaceSeconds,
  distanceDeltaInfo,
  fmtDistance,
  fmtDuration,
  formatPaceMinPerUnit,
  SORT_BY_LABELS,
  type RouteSortBy,
} from "@/lib/route-utils";

export type CompareRoute = {
  id: string;
  name: string;
  color: string;
  distanceMeters: number;
  durationSeconds: number;
};

type Props = {
  routes: CompareRoute[];
  selectedId: string | null;
  topPickId: string | null;
  onSelect: (id: string) => void;
  distanceUnit: "km" | "mi";
  paceMinPerUnit: number;
  routeType: "roundtrip" | "oneway";
  targetDistanceMeters: number;
  sortBy: RouteSortBy;
  embedded?: boolean;
};

function MetricCell({
  label,
  value,
  isBest,
  children,
}: {
  label: string;
  value: string;
  isBest?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`compare-metric ${isBest ? "compare-metric-best" : ""}`}>
      <span className="compare-metric-label">{label}</span>
      <span className="compare-metric-value">{value}</span>
      {children}
    </div>
  );
}

export default function RouteCompareTable({
  routes,
  selectedId,
  topPickId,
  onSelect,
  distanceUnit,
  paceMinPerUnit,
  routeType,
  targetDistanceMeters,
  sortBy,
  embedded = false,
}: Props) {
  const showTarget = routeType === "roundtrip" && targetDistanceMeters > 0;

  const rows = useMemo(
    () =>
      routes.map((r) => ({
        ...r,
        paceSeconds: durationAtPaceSeconds(r.distanceMeters, paceMinPerUnit, distanceUnit),
      })),
    [routes, paceMinPerUnit, distanceUnit],
  );

  const maxDistance = useMemo(
    () => Math.max(...rows.map((r) => r.distanceMeters), 1),
    [rows],
  );

  const best = useMemo(() => {
    if (rows.length === 0) {
      return {
        closestId: null as string | null,
        shortestId: null as string | null,
        paceId: null as string | null,
        routerId: null as string | null,
      };
    }

    let closestId = rows[0].id;
    let closestDiff = showTarget
      ? Math.abs(rows[0].distanceMeters - targetDistanceMeters)
      : Infinity;

    let shortestId = rows[0].id;
    let shortest = rows[0].distanceMeters;

    let paceId = rows[0].id;
    let bestPace = rows[0].paceSeconds;

    let routerId = rows[0].id;
    let bestRouter = rows[0].durationSeconds;

    for (const r of rows) {
      if (showTarget) {
        const diff = Math.abs(r.distanceMeters - targetDistanceMeters);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestId = r.id;
        }
      }
      if (r.distanceMeters < shortest) {
        shortest = r.distanceMeters;
        shortestId = r.id;
      }
      if (r.paceSeconds < bestPace) {
        bestPace = r.paceSeconds;
        paceId = r.id;
      }
      if (r.durationSeconds < bestRouter) {
        bestRouter = r.durationSeconds;
        routerId = r.id;
      }
    }

    return { closestId, shortestId, paceId, routerId };
  }, [rows, showTarget, targetDistanceMeters]);

  const paceLabel = formatPaceMinPerUnit(paceMinPerUnit);
  const paceUnitLabel = distanceUnit === "mi" ? "min/mi" : "min/km";

  if (embedded) {
    return (
      <div className="compare-cards">
        {rows.map((r) => {
          const isSelected = r.id === selectedId;
          const isTopPick = r.id === topPickId;
          const delta = showTarget
            ? distanceDeltaInfo(r.distanceMeters, targetDistanceMeters, distanceUnit)
            : null;

          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelect(r.id)}
              className={`compare-card ${isSelected ? "compare-card-selected" : ""}`}
            >
              <div className="compare-card-head">
                <span className="compare-route-dot" style={{ background: r.color }} aria-hidden />
                <span className="compare-card-name">{r.name}</span>
                {isTopPick ? <span className="pick-badge compare-card-pick">Top pick</span> : null}
              </div>
              <div
                className="compare-card-stats"
                style={{
                  gridTemplateColumns: showTarget
                    ? "repeat(4, minmax(0, 1fr))"
                    : "repeat(3, minmax(0, 1fr))",
                }}
              >
                <div className="compare-card-stat">
                  <span className="compare-card-stat-label">Distance</span>
                  <span className="compare-card-stat-value">
                    {fmtDistance(r.distanceMeters, distanceUnit)}
                  </span>
                </div>
                <div className="compare-card-stat">
                  <span className="compare-card-stat-label">Your time</span>
                  <span className="compare-card-stat-value">{fmtDuration(r.paceSeconds)}</span>
                </div>
                <div className="compare-card-stat">
                  <span className="compare-card-stat-label">Map est.</span>
                  <span className="compare-card-stat-value">{fmtDuration(r.durationSeconds)}</span>
                </div>
                {showTarget && delta ? (
                  <div className="compare-card-stat">
                    <span className="compare-card-stat-label">vs target</span>
                    <span className={`delta-badge delta-badge-${delta.variant}`}>{delta.label}</span>
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={embedded ? "compare-panel border border-default rounded-md overflow-hidden" : "panel compare-panel"}>
      {!embedded ? (
        <div className="compare-header">
          <div>
            <h3 className="text-sm font-semibold text-heading">Compare routes</h3>
            <p className="text-xs text-subtle mt-0.5">{SORT_BY_LABELS[sortBy]}</p>
          </div>
          <p className="text-xs text-body">
            Pace: <span className="font-medium text-heading">{paceLabel}</span> {paceUnitLabel}
          </p>
        </div>
      ) : null}

      <div
        className="compare-grid-head"
        style={{
          gridTemplateColumns: showTarget
            ? undefined
            : "minmax(0, 1.4fr) minmax(4.5rem, 0.7fr) minmax(4.5rem, 0.7fr) minmax(4.5rem, 0.7fr)",
        }}
      >
        <span>Route</span>
        <span>Distance</span>
        <span>Your time</span>
        <span>Map est.</span>
        {showTarget ? <span>vs target</span> : null}
      </div>

      <div>
        {rows.map((r) => {
          const isSelected = r.id === selectedId;
          const isTopPick = r.id === topPickId;
          const delta = showTarget
            ? distanceDeltaInfo(r.distanceMeters, targetDistanceMeters, distanceUnit)
            : null;
          const barWidth = Math.max(12, (r.distanceMeters / maxDistance) * 100);

          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelect(r.id)}
              className={`compare-row ${isSelected ? "compare-row-selected" : ""}`}
              style={{
                gridTemplateColumns: showTarget
                  ? undefined
                  : "minmax(0, 1.4fr) minmax(4.5rem, 0.7fr) minmax(4.5rem, 0.7fr) minmax(4.5rem, 0.7fr)",
              }}
            >
              <div className="min-w-0">
                <div className="compare-route-name">
                  <span className="compare-route-dot" style={{ background: r.color }} aria-hidden />
                  <span className="truncate">{r.name}</span>
                  {isTopPick ? <span className="pick-badge shrink-0">Top pick</span> : null}
                </div>
                <div className="compare-distance-bar" aria-hidden>
                  <div
                    className="compare-distance-bar-fill"
                    style={{ width: `${barWidth}%`, background: r.color }}
                  />
                </div>
              </div>

              <div className="compare-row-metrics">
                <MetricCell
                  label="Distance"
                  value={fmtDistance(r.distanceMeters, distanceUnit)}
                  isBest={r.id === best.shortestId && rows.length > 1}
                />

                <MetricCell
                  label="Your time"
                  value={fmtDuration(r.paceSeconds)}
                  isBest={r.id === best.paceId && rows.length > 1}
                />

                <MetricCell
                  label="Map est."
                  value={fmtDuration(r.durationSeconds)}
                  isBest={r.id === best.routerId && rows.length > 1}
                />

                {showTarget && delta ? (
                  <div className="compare-metric">
                    <span className="compare-metric-label">vs target</span>
                    <span
                      className={`delta-badge delta-badge-${delta.variant}${
                        r.id === best.closestId && rows.length > 1 ? " compare-delta-best" : ""
                      }`}
                    >
                      {delta.label}
                    </span>
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
