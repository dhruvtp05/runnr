🏃‍♂️ runnr
runnr is a smart, interactive running route builder designed to help you discover the perfect loop. Simply drop a pin on the map, set your target distance, and let runnr generate custom round-trip options tailored to your preferences—whether you're looking for quiet park trails or paved city roads.

✨ Features
🗺️ Smart Route Generation Powered by Trail Router to prioritize green spaces and avoid busy streets. If an area isn't covered, it seamlessly falls back to OSRM to build intelligent, out-and-back routes that closely match your target distance (within 7–15% variance).

⛰️ Tailored to Your Run Choose between Road, Trail, or Mixed surfaces. Customize further by setting your preferred elevation (flat, rolling, hilly) and safety levels (balanced, safer) to tweak waypoints and routing behavior.

🤖 AI-Powered Insights (Optional) Connect your OpenAI API key to transform raw routes into curated experiences. The AI provides:

Catchy short names and one-line descriptions.

Personalized run tips (terrain info, hill warnings, best time to run).

Intelligent rankings based on your free-text preferences (e.g., "most scenic", "avoid main roads").

💾 Save & Share (Optional) Backed by Supabase, you can save your generated route sets, name them, and generate shareable links (/routes/saved/<id>). Perfect for planning group runs or saving a favorite loop for later.

📤 Export Anywhere * Google Maps: Open your route directly in Google Maps Directions to follow on your phone.

GPX Download: Export the route as a .gpx file to import into Strava, Garmin Connect, Apple Watch (via WorkOutDoors), and more.

🚀 Quick Start
Get up and running locally in just a few steps:

Bash

# Navigate to the frontend directory
cd runnr/root/frontend

# Install dependencies
npm install

# Start the development server
npm run dev
Open http://localhost:3000 in your browser. Click the map to set a start point, choose your distance/units, and hit Generate routes.

🛠️ Configuration (Optional)
The app works perfectly out-of-the-box for basic routing. However, you can unlock AI polish and saving features by configuring a .env.local file in the runnr/root/frontend directory (see .env.local.example for reference).

1. Enable AI Features
To get AI-generated route names, tips, and custom rankings:

Get an API key from OpenAI.

Add it to your environment variables:

Code snippet

OPENAI_API_KEY=your_openai_api_key_here
2. Enable Cloud Saving
To allow users to save and share route URLs:

Create a new project on Supabase.

Run the provided supabase-schema.sql file in the Supabase SQL editor to create the saved_routes table and necessary policies.

Add your project keys to your environment variables:

Code snippet

NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
💻 Tech Stack
Framework: Next.js (App Router)

UI/Components: React

Mapping: Leaflet

Routing Engines: Trail Router API, OSRM

AI: OpenAI API

Database: Supabase (PostgreSQL)
