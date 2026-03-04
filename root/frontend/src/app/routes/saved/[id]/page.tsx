import Navbar from "@/app/components/Navbar";
import SavedRouteViewClient from "./saved-route-view-client";

type Props = { params: Promise<{ id: string }> };

export default async function SavedRoutePage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="min-h-screen bg-(--background) bg-grid overflow-x-hidden">
      <Navbar />
      <main className="pt-28 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Saved route</h1>
            <p className="text-zinc-400">View and export your saved route.</p>
          </div>
          <SavedRouteViewClient id={id} />
        </div>
      </main>
    </div>
  );
}
