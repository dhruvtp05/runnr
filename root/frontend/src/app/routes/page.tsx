import Navbar from "@/app/components/Navbar";
import RoutesClientLoader from "./routes-client-loader";

export default function RoutesPage() {
  return (
    <div className="min-h-screen bg-(--background)">
      <Navbar />
      <main className="py-8 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-semibold text-heading mb-1">
              Route planner
            </h1>
            <p className="text-body text-sm">
              Set a start point on the map, search for an address, or use your current location.
            </p>
          </div>

          <RoutesClientLoader />
        </div>
      </main>
    </div>
  );
}

