import Navbar from "./components/Navbar";
import {
  Route,
  Sparkles,
  Gauge,
  MapPin,
  ArrowRight,
  Zap,
  Shield,
  BarChart3,
} from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-(--background) bg-grid overflow-x-hidden">
      <Navbar />

      <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-6 pt-28 pb-20">
        <div
          className="glow-orb w-150 h-150 -top-40 -left-40 bg-blue-500"
          aria-hidden
        />
        <div
          className="glow-orb w-100 h-100 top-1/2 -right-40 bg-violet-500"
          aria-hidden
        />
        <div
          className="glow-orb w-75 h-75 bottom-20 left-1/3 bg-pink-500/60"
          aria-hidden
        />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-zinc-300 mb-8">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>AI-powered route generation</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-6">
            Run smarter.
            <br />
            <span className="gradient-text">Routes that adapt to you.</span>
          </h1>

          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Set your distance, elevation, and terrain. Our AI designs the perfect
            running route in seconds—so you can focus on the run, not the map.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/routes"
              className="group inline-flex items-center gap-2 rounded-full bg-white text-zinc-900 font-semibold px-6 py-3.5 hover:bg-zinc-200 transition-all shadow-lg shadow-white/10"
            >
              Start building routes
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3.5 font-medium text-white hover:bg-white/10 transition-colors"
            >
              See how it works
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="relative py-24 px-6 border-t border-white/5"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Built for runners, powered by AI
            </h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              One tool for distance, elevation, surface, and safety. Get a route
              that matches your goals every time.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Gauge,
                title: "Distance",
                description:
                  "Set target distance. AI finds loops and out-and-backs that fit.",
              },
              {
                icon: BarChart3,
                title: "Elevation control",
                description:
                  "Choose flat, rolling, or hilly. Control total climb so every run matches your plan.",
              },
              {
                icon: MapPin,
                title: "Terrain & surface",
                description:
                  "Road, trail, track, or mix. Routes stay on the surfaces you want.",
              },
              {
                icon: Shield,
                title: "Safe & well-lit",
                description:
                  "Prefer well-lit, populated areas? AI can bias routes toward safer options.",
              },
            ].map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group rounded-2xl border border-white/5 bg-white/2 p-6 hover:bg-white/4 hover:border-white/10 transition-all"
              >
                <div className="rounded-xl bg-white/5 border border-white/5 w-10 h-10 flex items-center justify-center mb-4 group-hover:bg-white/10 transition-colors">
                  <Icon className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="relative py-24 px-6 border-t border-white/5"
      >
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            How it works
          </h2>
          <p className="text-zinc-400 text-lg mb-16">
            Three steps from your goals to a ready-to-run route.
          </p>

          <div className="grid md:grid-cols-3 gap-8 text-left">
            {[
              {
                step: "1",
                title: "Set your parameters",
                description:
                  "Enter distance, elevation preference, start point, and surface type.",
                icon: Zap,
              },
              {
                step: "2",
                title: "AI generates routes",
                description:
                  "Our model explores the map and returns several options that match your criteria.",
                icon: Route,
              },
              {
                step: "3",
                title: "Pick and go",
                description:
                  "Choose a route, export to your watch or app, and head out.",
                icon: Sparkles,
              },
            ].map(({ step, title, description, icon: Icon }) => (
              <div key={step} className="relative">
                <div className="flex items-start gap-4">
                  <span className="shrink-0 w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-sm font-bold text-white">
                    {step}
                  </span>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-4 h-4 text-violet-400" />
                      <h3 className="font-semibold text-white">{title}</h3>
                    </div>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                      {description}
                    </p>
                  </div>
                </div>
                {step !== "3" && (
                  <div className="hidden md:block absolute top-5 -right-4 w-8 border-t border-dashed border-white/10" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-24 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <div className="rounded-3xl border border-white/10 bg-linear-to-b from-white/5 to-transparent p-12 sm:p-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Ready to run better routes?
            </h2>
            <p className="text-zinc-400 mb-8">
              Join runners who plan less and run more.
            </p>
            <Link
              href="/routes"
              className="inline-flex items-center gap-2 rounded-full bg-white text-zinc-900 font-semibold px-6 py-3.5 hover:bg-zinc-200 transition-colors"
            >
              Get started free
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <Link
            href="/"
            className="text-lg font-semibold text-white"
          >
            runn<span className="gradient-text">r</span>
          </Link>
          <div className="flex items-center gap-8 text-sm text-zinc-400">
            <Link href="https://www.linkedin.com/in/dhruv-patel-747748293/" className="hover:text-white transition-colors">
              Contact
            </Link>
          </div>
        </div>
        <p className="max-w-6xl mx-auto mt-6 text-center sm:text-left text-sm text-zinc-500">
          © {new Date().getFullYear()} runnr. AI-powered running route generator.
        </p>
      </footer>
    </div>
  );
}
