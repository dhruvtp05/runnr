import Navbar from "./components/Navbar";
import { Gauge, MapPin, ArrowRight, Shield, BarChart3 } from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-(--background)">
      <Navbar />

      <section className="border-b border-default bg-surface">
        <div className="max-w-3xl mx-auto px-6 py-20 sm:py-28 text-center">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-heading mb-5">
            Plan your next run
          </h1>
          <p className="text-lg text-body max-w-xl mx-auto mb-8 leading-relaxed">
            Set your distance, elevation, and surface preferences. Get a few
            route options on the map in seconds.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/routes" className="btn btn-primary px-5 py-2.5">
              Start planning
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="#how-it-works" className="btn btn-secondary px-5 py-2.5">
              How it works
            </Link>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-heading mb-2">
              What you can control
            </h2>
            <p className="text-body">
              One tool for distance, elevation, surface, and safety preferences.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: Gauge,
                title: "Distance",
                description: "Target a specific length for loops or out-and-backs.",
              },
              {
                icon: BarChart3,
                title: "Elevation",
                description: "Choose flat, rolling, or hilly terrain.",
              },
              {
                icon: MapPin,
                title: "Surface",
                description: "Road, trail, or a mix depending on where you run.",
              },
              {
                icon: Shield,
                title: "Safety bias",
                description: "Optionally favor well-lit, populated areas.",
              },
            ].map(({ icon: Icon, title, description }) => (
              <div key={title} className="panel p-5">
                <Icon className="w-5 h-5 icon-accent mb-3" strokeWidth={1.75} />
                <h3 className="font-medium text-heading mb-1.5">{title}</h3>
                <p className="text-sm text-body leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 px-6 border-t border-default bg-surface">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold text-heading mb-2">How it works</h2>
          <p className="text-body mb-10">
            Three steps from your preferences to a route you can export.
          </p>

          <ol className="space-y-8">
            {[
              {
                title: "Set your parameters",
                description:
                  "Pick a start point, distance, elevation preference, and surface type.",
              },
              {
                title: "Compare route options",
                description:
                  "The app generates several candidates and shows them on the map.",
              },
              {
                title: "Export and go",
                description:
                  "Download GPX or open in Google Maps, then head out.",
              },
            ].map(({ title, description }, i) => (
              <li key={title} className="flex gap-4">
                <span className="shrink-0 w-8 h-8 rounded-md bg-(--segment-bg) border border-default flex items-center justify-center text-sm font-medium text-body">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-medium text-heading mb-1">{title}</h3>
                  <p className="text-sm text-body leading-relaxed">{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-16 px-6 border-t border-default">
        <div className="max-w-xl mx-auto text-center panel p-8">
          <h2 className="text-xl font-semibold text-heading mb-2">
            Ready to plan a route?
          </h2>
          <p className="text-body text-sm mb-6">
            No account required to generate routes.
          </p>
          <Link href="/routes" className="btn btn-primary">
            Open route planner
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-default py-10 px-6 bg-surface">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm font-medium text-heading">runnr</span>
          <Link
            href="https://www.linkedin.com/in/dhruv-patel-747748293/"
            className="text-sm text-body hover:text-heading transition-colors"
          >
            Contact
          </Link>
        </div>
        <p className="max-w-5xl mx-auto mt-4 text-center sm:text-left text-xs text-subtle">
          © {new Date().getFullYear()} runnr
        </p>
      </footer>
    </div>
  );
}
