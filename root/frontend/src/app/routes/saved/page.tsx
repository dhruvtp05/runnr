import Navbar from "@/app/components/Navbar";
import SavedRoutesClient from "./saved-routes-client";

export default function SavedRoutesPage() {
  return (
    <div className="min-h-screen bg-(--background)">
      <Navbar />
      <main className="py-8 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-semibold text-heading mb-1">
              Saved routes
            </h1>
            <p className="text-body text-sm">
              Routes saved from this browser, synced from Supabase. Share links to open them anywhere.
            </p>
          </div>
          <SavedRoutesClient />
        </div>
      </main>
    </div>
  );
}

