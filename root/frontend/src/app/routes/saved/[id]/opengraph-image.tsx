import { ImageResponse } from "next/og";
import { getSavedRouteSummary } from "@/lib/saved-routes-server";
import { KM_PER_MILE } from "@/lib/route-utils";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const route = await getSavedRouteSummary(id);

  const title = route?.name?.trim() || "Saved running route";
  const unit = route?.distanceUnit === "mi" ? "mi" : "km";
  const distance = route
    ? unit === "mi"
      ? (route.targetDistanceKm / KM_PER_MILE).toFixed(1)
      : route.targetDistanceKm.toFixed(1)
    : "—";
  const options = route ? `${route.routeCount} route option${route.routeCount === 1 ? "" : "s"}` : "Running route";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "#111113",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "#0f766e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            r
          </div>
          <span style={{ fontSize: 28, fontWeight: 600, opacity: 0.9 }}>runnr</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.1, maxWidth: 900 }}>
            {title}
          </div>
          <div style={{ fontSize: 32, color: "#a1a1aa" }}>
            {options} · ~{distance} {unit} target
          </div>
        </div>

        <div style={{ fontSize: 24, color: "#71717a" }}>Plan · compare · export GPX</div>
      </div>
    ),
    { ...size },
  );
}
