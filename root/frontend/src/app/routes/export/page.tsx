export default function ExportHelpPage() {
  return (
    <main className="max-w-3xl mx-auto py-16 px-4">
      <div className="glass rounded-2xl border border-white/10 bg-black/40 p-6 space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold text-white">
            Send your route to Strava, Garmin, and Apple
          </h1>
          <p className="text-sm text-zinc-400">
            Every route you generate can be exported as a GPX file. Most running apps and watches
            let you import that GPX as a course or workout.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-300">
            1. Download the GPX from Runnr
          </h2>
          <p className="text-sm text-zinc-400">
            On the routes page, pick a route card, then use{" "}
            <span className="font-medium text-zinc-100">Export selected route → Download GPX</span>.
            Save the file somewhere you can find it (e.g. Downloads).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-300">
            2. Import into your running app
          </h2>

          <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
              <h3 className="text-sm font-medium text-white">Strava</h3>
              <ol className="list-decimal list-inside text-sm text-zinc-400 space-y-1">
                <li>Go to Strava on the web (not the mobile app).</li>
                <li>
                  Open{" "}
                  <a
                    href="https://www.strava.com/upload/select"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-zinc-100"
                  >
                    the upload page
                  </a>{" "}
                  and choose <span className="font-medium">File</span>.
                </li>
                <li>Select the GPX file you downloaded from Runnr.</li>
                <li>Save it as a route, then send it to your device as usual.</li>
              </ol>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
              <h3 className="text-sm font-medium text-white">Garmin</h3>
              <ol className="list-decimal list-inside text-sm text-zinc-400 space-y-1">
                <li>Open Garmin Connect on the web.</li>
                <li>
                  Go to{" "}
                  <a
                    href="https://connect.garmin.com/modern/import-data"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-zinc-100"
                  >
                    Import Data
                  </a>{" "}
                  and upload the GPX.
                </li>
                <li>Save it as a course, then sync to your watch.</li>
              </ol>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
              <h3 className="text-sm font-medium text-white">Apple Watch / Apple Fitness</h3>
              <p className="text-sm text-zinc-400">
                Apple&apos;s built-in apps don&apos;t import GPX directly, but many third‑party apps do:
                for example WorkOutdoors, RunGap, or Footpath. The usual flow is:
              </p>
              <ol className="list-decimal list-inside text-sm text-zinc-400 space-y-1">
                <li>Install a GPX-friendly running app on your iPhone and Apple Watch.</li>
                <li>Import the GPX file into that app (usually via “Open in…” or “Import route”).</li>
                <li>Start the workout from that app on your watch and follow the course.</li>
              </ol>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-300">
            Tip: keep a small library of favorite GPX routes
          </h2>
          <p className="text-sm text-zinc-400">
            Once you&apos;ve imported a few good routes into your apps, you can re-use them anytime
            without coming back here—Runnr is best for exploring new loops and variations.
          </p>
        </section>
      </div>
    </main>
  );
}

