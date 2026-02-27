import Navbar from "@/app/components/Navbar";
import RoutesClientLoader from "./routes-client-loader";

export default function RoutesPage() {
  return (
    <div className="min-h-screen bg-(--background) bg-grid overflow-x-hidden">
      <Navbar />
      <main className="pt-28 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              Build a run
            </h1>
            <p className="text-zinc-400">
              Click the map to set your start point, then generate a few route
              options.
            </p>
          </div>

          <RoutesClientLoader />
        </div>
      </main>
    </div>
  );
}

