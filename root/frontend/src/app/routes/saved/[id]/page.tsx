import type { Metadata } from "next";
import Navbar from "@/app/components/Navbar";
import SavedRouteViewClient from "./saved-route-view-client";
import { getSavedRouteSummary } from "@/lib/saved-routes-server";
import { KM_PER_MILE } from "@/lib/route-utils";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const route = await getSavedRouteSummary(id);

  if (!route) {
    return {
      title: "Saved route | runnr",
      description: "View a saved running route on runnr.",
    };
  }

  const label = route.name?.trim() || "Saved running route";
  const unit = route.distanceUnit === "mi" ? "mi" : "km";
  const distance =
    unit === "mi"
      ? (route.targetDistanceKm / KM_PER_MILE).toFixed(1)
      : route.targetDistanceKm.toFixed(1);
  const description = `${route.routeCount} route option${route.routeCount === 1 ? "" : "s"} · ~${distance} ${unit} target · Open, compare, and export GPX.`;

  const ogUrl = `/routes/saved/${id}/opengraph-image`;

  return {
    title: `${label} | runnr`,
    description,
    openGraph: {
      title: label,
      description,
      type: "website",
      images: [{ url: ogUrl, width: 1200, height: 630, alt: label }],
    },
    twitter: {
      card: "summary_large_image",
      title: label,
      description,
      images: [ogUrl],
    },
  };
}

export default async function SavedRoutePage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="min-h-screen bg-(--background)">
      <Navbar />
      <main className="py-8 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-semibold text-heading mb-1">Saved route</h1>
            <p className="text-body text-sm">View and export your saved route.</p>
          </div>
          <SavedRouteViewClient id={id} />
        </div>
      </main>
    </div>
  );
}
