# runnr

Running route builder. You pick a start on the map and a target distance; it gives you a few round-trip options. Prefers parks and paths when you ask for trails, and stays close to the distance you asked for.

---

## Run it

```bash
cd runnr/root/frontend
npm install
npm run dev
```

Open http://localhost:3000. Click the map to set a start point, set your distance (and units), hit Generate routes.

---

## What it does

**Route generation**  
Uses [Trail Router](https://trailrouter.com) when it can: round-trip routes that prefer green space and avoid busy roads. If that doesn’t return anything (e.g. area not covered), it falls back to OSRM and builds out-and-back routes by guessing a turn-around point and refining until the length is close to your target. You get up to three options per run.

**Distance and units**  
Target distance can be in km or miles. The app tries to keep each route within about 7–15% of that target so you’re not way over or under.

**Trail vs road**  
Surface options are Road, Trail, and Mixed. Trail/Mixed push the engine toward paths and parks; Road keeps it on streets. Elevation (flat / rolling / hilly) and safety (balanced / safer) tweak the waypoints and, where supported, the routing behaviour.

**AI layer**  
If you set `OPENAI_API_KEY`, the app sends the three routes to the model and gets back:

- Short names and one-line descriptions for each route  
- A run tip per route (surface, hills, when to run it)  
- A ranking of the three (e.g. “best for morning run”)  
- An optional “rank by” (e.g. “easiest”, “most scenic”) and free-text preferences (e.g. “avoid main road”); the model uses those to reorder and describe. The top-ranked route is marked as the AI pick and selected by default.

No API key = no AI; you still get Option A/B/C and full routing.

**Saving routes**  
With Supabase configured, you can save the current set of routes (optional name). You get a link like `/routes/saved/<id>`. Anyone with the link can open that page and see the same map and options. Handy for sharing or coming back later.

**Export**  
For the route you have selected:

- **Open in Google Maps** — opens Directions with the route’s points as waypoints so you can follow it in Google Maps.  
- **Download GPX** — downloads a GPX file you can import into Garmin Connect, Apple Watch apps (e.g. WorkOutDoors), Strava, or similar.

---

## Setup (optional)

**AI**  
In `runnr/root/frontend` add a `.env.local` (see `.env.local.example`):

- `OPENAI_API_KEY` — from [OpenAI](https://platform.openai.com/api-keys). Used for route names, descriptions, tips, and ranking.

**Saving routes**  
- Create a project at [Supabase](https://supabase.com).  
- In the SQL editor, run the statements in `supabase-schema.sql` (creates `saved_routes` and policies).  
- In `.env.local` set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the project’s API settings.

Without these, the app still runs; you just won’t get AI polish or the save/link feature.

---

## Tech

Next.js (App Router), React, Leaflet for the map. Route data from Trail Router and OSRM; AI from OpenAI; storage in Supabase.
