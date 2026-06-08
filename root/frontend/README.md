## runnr – AI-powered running route builder

runnr is a Next.js app for designing smarter running routes. You set your **distance, elevation, surface, and safety bias**, and the app returns multiple route options with elevation profiles, effort estimates, live weather, and an export path to Strava / Garmin / Apple.

---

## Features

### Route generation

- **Interactive map-first UX**
  - Click directly on the map to set a **start point** (roundtrip) or **start + end** (one-way).
  - Or type an address / landmark (via OpenStreetMap Nominatim) and jump there.
  - **Use my location** sets start from GPS and reverse-geocodes the label.
  - Works globally – any place OSM has coverage.

- **Sectioned sidebar planner**
  - **Trip type** → **Locations** → **Run settings** before generate.
  - After generate: **Results** (sort + pace + compare cards), **Save & share**, **Export**.
  - Light/dark theme toggle (CSS variables, persisted in `localStorage`).

- **Roundtrip vs one-way**
  - **There and back**: choose a target distance; the router finds out-and-back loops that roughly hit your goal.
  - **One-way**: choose a start and end; the router finds a foot route between them.

- **Distance control with presets**
  - Enter a target distance in **km** or **mi** with validation (0.25–60 km / ~0.25–37 mi).
  - Quick presets:
    - **5k easy**
    - **10k long run**
    - **Hilly ~30 min**
  - Presets prefill distance + elevation + surface + safety + a short preference blurb so you can click “Generate routes” immediately.

- **Elevation, surface, and safety bias**
  - **Elevation**: Flat / Rolling / Hilly.
  - **Surface**: Road / Trail / Mixed.
  - **Safety bias**: Balanced / Safer.
  - These are passed through to Trail Router (when available) and to the optional AI layer for descriptions/ranking.

- **Sort, pace & compare (no AI required)**
  - **Sort by**: Recommended, Closest to target, Shortest, Longest, Fastest (map estimate).
  - **Pace** input (`6:00` per km/mi) for “your time” estimates.
  - **Compare cards** in the sidebar show distance, your time, map estimate, and vs-target delta for each option.
  - With AI enabled, “Recommended” can follow the AI pick; otherwise routes stay in server order.

- **Multiple route options**
  - For each set of parameters, the app returns up to **3 options**:
    - Name (e.g. Option A/B/C, or AI-renamed when configured).
    - Distance and estimated duration.
    - Optional AI-generated description and tip.
    - A visual color-coded polyline on the map for each option.
  - One option is highlighted as the **top pick** (AI pick when available).

### Route quality, safety & feedback

- **Weather-aware suggestions**
  - Uses [Open-Meteo](https://open-meteo.com/) to fetch **current temperature & weather code** for the chosen start location.
  - Shows a compact, high-contrast badge near the **Generate routes** button:
    - Temperature in **°F**.
    - Evidence-based label tuned for running performance:
      - ≤ 20°F: “Very cold for running”.
      - 20–40°F: “Cold – layer up”.
      - 40–60°F: **“Great running weather”** (roughly 45–55°F sweet spot from endurance research).
      - 60–75°F: “Warm – stay hydrated”.
      - 75–85°F: “Hot – go easy”.
      - > 85°F: “Very hot – use caution”.
    - For heavy rain / storms (WMO codes ≥95, or 61–67): label becomes “Stormy – consider another time”.

- **Crowd feedback per route**
  - On the **Saved route** view, each route card shows:
    - **Thumbs up / thumbs down** with counts.
    - Safety-quality tags:
      - “Too much traffic”
      - “Felt unsafe”
      - “Blocked path”
  - Clicking:
    - Thumbs up/down creates a feedback row for that route option.
    - Tag buttons add one of the safety tags.
  - Feedback is persisted via Supabase (`route_feedback` table) and aggregated per `route_option_id`:
    - `thumbsUp`, `thumbsDown`
    - Unique list of tags.

### Elevation & effort insights

- **Elevation sparkline**
  - For the selected route, the app samples up to **25 points** along the polyline and calls `/api/elevation`.
  - Backend uses [Open-Elevation](https://open-elevation.com/) to return elevations.
  - A small **SVG sparkline** is rendered under “Export selected route” showing relative ups/downs along the route.

- **Total climb & effort**
  - Climb is calculated as the sum of positive elevation deltas between sampled points and displayed in meters.
  - A simple **effort label** is computed from distance and climb:
    - Uses thresholds like:
      - Short + low climb → “Easy”.
      - Long or very hilly → “Hard”.
      - Otherwise → “Moderate”.
  - Effort is shown even if elevation data is missing (distance-only heuristic).

### Export & workflow

- **Open in Google Maps**
  - For the selected route, build a `/dir/lat,lng/...` URL to open the route as a sequence of waypoints in Google Maps.

- **Download GPX for watches & apps**
  - Generate a GPX track from the route geometry with `<trkpt lat="…" lon="…">`.
  - File name uses a slugified version of the route name.
  - Works with:
    - Garmin devices.
    - Apple Watch via third-party GPX-running apps.
    - Strava and many other running platforms.

- **Export help page**
  - Dedicated page at `/routes/export` explains:
    - How to download GPX from the app.
    - How to import into:
      - **Strava** (web upload).
      - **Garmin Connect** (Import Data → Course).
      - **Apple Watch** via third-party apps that support GPX.
  - Includes quick links to Strava / Garmin import pages and best-practice tips for maintaining a library of favorite routes.

### Personalization & saved routes

- **Recent start locations**
  - The last few start points you’ve used are stored in `localStorage` (`runnr:recent-starts`).
  - Shown as a collapsible **Recent starts** list under the Start input (compact labels, full name on hover).
  - Clicking an entry reuses that start point with one tap.

- **Saved route sets (Supabase-backed)**
  - You can **save** the entire set of generated routes with:
    - Optional name.
    - Start point.
    - Target distance and unit.
    - Metrics (elevation, surface, safety, route type).
    - The actual route options (polylines + metadata).
  - Saved data is stored in Supabase in `saved_routes` (via server API using the service role key).
  - The app keeps a **local list of saved route IDs** in `localStorage` (`runnr:saved-routes`); the saved-routes page hydrates from Supabase and drops stale IDs.

- **Saved routes overview**
  - `/routes/saved` lists route sets saved from this browser, synced from Supabase.
  - Each entry links to `/routes/saved/[id]` for a detailed map view.

- **Share previews (OG) & PWA**
  - Saved route pages expose dynamic Open Graph images for link previews.
  - Set `NEXT_PUBLIC_SITE_URL` in production so OG URLs resolve correctly.
  - `manifest.json` + icons support add-to-home-screen install.

- **Saved route detail view**
  - Shows:
    - Overview of the saved configuration (start, target distance, type).
    - The list of routes (with AI descriptions/tips) and color-coded segments on the map.
    - Elevation + effort box identical to the live generator.
    - Export controls (Open in Google Maps, Download GPX).
    - **Feedback UI** (thumbs + tags) per route option.
  - You can also **delete** the saved set; this:
    - Deletes from Supabase.
    - Cleans it out of your local `runnr:saved-routes`.

### AI integration (optional)

- AI is used when configured for:
  - Route **naming / descriptions** and short **run tips** per option.
  - Ranking routes for the **Recommended** sort order.
  - A one-line **preference interpretation** when applicable.

- Without `OPENAI_API_KEY` (or local LLM), routing, sorting, pace comparison, save/share, and export all still work.

- Implementation details:
  - AI logic is in `src/app/api/routes/ai-enhance.ts`.
  - Supports:
    - **Local LLM** via Ollama (e.g. `LOCAL_LLM_MODEL=llama3.2`) for development.
    - **OpenAI** (`OPENAI_API_KEY`) for hosted inference (`gpt-4o-mini`), with `response_format: json_object`.
  - The AI layer returns structured JSON:
    - `routeNames[]`, `routeDescriptions[]`, `runTips[]`, `ranking[]`, `preferenceInterpretation?`.
  - The client guards against malformed AI output (e.g. objects instead of strings) so the UI doesn’t crash.

---

## Architecture

- **Framework**: Next.js App Router (`src/app`), React 19, TypeScript.
- **Styling**: Tailwind-style utilities + CSS design tokens (Inter, teal accent, light/dark theme).
- **Map & routing**:
  - [React Leaflet](https://react-leaflet.js.org/) + [Leaflet](https://leafletjs.com/) for map rendering.
  - [OpenStreetMap](https://www.openstreetmap.org) tiles.
  - [Trail Router](https://trailrouter.com/) for green, park- and water-preferred routes when possible.
  - [OSRM](http://project-osrm.org/) for walking routes (public router by default, overrideable via `OSRM_BASE_URL`).
- **Backend**:
  - Supabase (PostgreSQL + RLS) for persistent storage.
  - Next.js route handlers under `src/app/api/**` for:
    - `/api/routes` – route generation + optional AI enhancement.
    - `/api/geocode` – forward search or reverse geocode (lat/lon).
    - `/api/elevation` – elevation samples via Open-Elevation.
    - `/api/routes/save` – create `saved_routes` rows.
    - `/api/routes/saved` – batch fetch saved routes by ID (list page).
    - `/api/routes/saved/[id]` – fetch/delete saved sets.
    - `/api/routes/saved/[id]/feedback` – thumbs/tags storage and aggregation.
- **State & data fetching**:
  - Mostly React `useState`/`useEffect` and direct `fetch` to API routes.
  - React Query is available in dependencies but not heavily used yet.

---

## Setup

### 1. Prerequisites

- **Node.js**: v20+ recommended.
- **Supabase project**:
  - Create a project at `https://supabase.com`.
  - Grab:
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY` (from Settings → API → service_role).
- **Optional** (but recommended):
  - **OpenAI API key** (`OPENAI_API_KEY`) _or_ a local LLM via Ollama.
  - Custom `OSRM_BASE_URL` if you run your own OSRM instance.
  - Custom `TRAIL_ROUTER_URL` if you proxy Trail Router.

### 2. Env configuration

In `frontend/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Server-only – DO NOT expose in the browser
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional: AI via OpenAI
OPENAI_API_KEY=sk-...

# Optional: local LLM via Ollama (dev)
LOCAL_LLM_MODEL=llama3.2

# Optional: custom routers
# OSRM_BASE_URL=https://your-osrm.example.com
# TRAIL_ROUTER_URL=https://trailrouter.com/ors/experimentalroutes

# Production: correct OG / metadata URLs for saved route links
# NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

> The Supabase client on the server uses **`SUPABASE_SERVICE_ROLE_KEY`**; the anon key has no RLS policies and cannot access data directly, which keeps the DB secure even if the anon key is visible in frontend code.

### 3. Database schema

In the Supabase SQL editor, run the contents of:

- `frontend/supabase-schema.sql`

This:

- Creates / updates:
  - `public.saved_routes`
  - `public.route_feedback`
- Enables **row level security** on both tables.
- Drops the old permissive policies so the **anon key has no direct access**.
- Relies on service-role access via your Next.js API routes.

### 4. Install & run

From `runnr/root/frontend`:

```bash
npm install

# Dev server (uses webpack variant for this project)
npm run dev:webpack

# Or standard Next.js dev
# npm run dev
```

Then open `http://localhost:3000`.

---

## Security notes

- **All Supabase access goes through server-side API routes.**
  - `getSupabase()` uses `SUPABASE_SERVICE_ROLE_KEY` on the server and the anon key only client-side (and the current UI doesn’t call Supabase from the browser).
  - Because RLS is enabled and anon policies are removed, the browser **cannot** directly read/write DB tables using the anon key.
- **No user accounts**:
  - This app is currently anonymous and stateless per user; “your” saved routes are basically any rows you can link to plus what’s stored in your browser’s `localStorage`.
  - If you later add auth, you can easily extend the schema with a `user_id` column and user-scoped RLS policies.

---

## Development notes & next ideas

- The architecture intentionally keeps:
  - **Routing** logic in `api/routes/route.ts`.
  - **AI interpretation** in `api/routes/ai-enhance.ts`.
  - **Presentation** in `routes-client.tsx` and saved-route views.
- Natural next steps (if you revisit later):
  - Proper user accounts + truly private saved routes.
  - More powerful filters (lighting, sidewalks, traffic noise).
  - Offline export bundles for trips / races.
  - Heatmap overlays from public data sources.

For now, the project is a complete, globally-usable **running route builder** with thoughtful UX and a deep feature set geared toward real runners.
