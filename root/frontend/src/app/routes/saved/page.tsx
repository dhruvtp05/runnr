import Navbar from "@/app/components/Navbar";
import SavedRoutesClient from "./saved-routes-client";

export default function SavedRoutesPage() {
  return (
    <div className="min-h-screen bg-(--background) bg-grid overflow-x-hidden">
      <Navbar />
      <main className="pt-28 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              Saved routes
            </h1>
            <p className="text-zinc-400">
              Routes you&apos;ve saved from this browser. Use the shareable
              links if you want to open them on another device.
            </p>
          </div>
          <SavedRoutesClient />
        </div>
      </main>
    </div>
  );
}

