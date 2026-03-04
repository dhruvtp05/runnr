# 🏃‍♂️ runnr

![Next.js](https://img.shields.io/badge/Next.js-black?style=flat-square&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Leaflet](https://img.shields.io/badge/Leaflet-199900?style=flat-square&logo=Leaflet&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-FFFFFF?style=flat-square&logo=ollama&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)

> **runnr** is a smart, interactive running route builder designed to help you discover the perfect loop. Simply drop a pin on the map, set your target distance, and let runnr generate custom round-trip options tailored to your preferences—whether you're looking for quiet park trails or paved city roads. 

---

## ✨ Features

* 🗺️ **Smart Route Generation** Powered by [Trail Router](https://trailrouter.com/) to prioritize green spaces and avoid busy streets. If an area isn't covered, it seamlessly falls back to OSRM to build intelligent, out-and-back routes that closely match your target distance (within 7–15% variance).
* ⛰️ **Tailored to Your Run** Choose between **Road, Trail, or Mixed** surfaces. Customize further by setting your preferred elevation (flat, rolling, hilly) and safety levels (balanced, safer) to tweak waypoints and routing behavior.
* 🤖 **AI-Powered Insights (Optional)** Connect **OpenAI** or run locally with **Ollama** to transform raw routes into curated experiences. The AI provides:
  * Catchy short names and one-line descriptions.
  * Personalized run tips (terrain info, hill warnings, best time to run).
  * Intelligent rankings based on your free-text preferences (e.g., *"most scenic"*, *"avoid main roads"*).
* 💾 **Save & Share (Optional)** Backed by **Supabase**, you can save your generated route sets, name them, and generate shareable links (`/routes/saved/<id>`). Perfect for planning group runs or saving a favorite loop for later.
* 📤 **Export Anywhere** * **Google Maps:** Open your route directly in Google Maps, and follow it on your phone.
  * **GPX Download:** Export the route as a `.gpx` file to import into Strava, Garmin Connect, Apple Watch (via WorkOutDoors), and more.

---

## 🚀 Quick Start

Get up and running locally in just a few steps:

```bash
# Navigate to the frontend directory
cd runnr/root/frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Click the map to set a start point, choose your distance/units, and hit **Generate routes**.

---

## 🔑 Configuration & API Keys (Optional)

The app works perfectly out of the box for basic routing. However, you can unlock AI polish and cloud-saving features by configuring a `.env.local` file in the `runnr/root/frontend` directory. 

Create a `.env.local` file and add the relevant keys below based on the features you want to enable. 

**Here is an example of what your `.env.local` file should look like:**

```env
# ==========================================
# RUNNR Environment Variables Example
# ==========================================

# 🤖 AI Provider (Choose one: 'openai' or 'ollama')
AI_PROVIDER=openai

# Option A: OpenAI (Cloud)
# Get your key here: [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
OPENAI_API_KEY=sk-your-openai-api-key-goes-here

# Option B: Ollama (Local AI)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3

# 💾 Supabase (For saving & sharing routes)
# Get these from your Supabase Project Settings > API
NEXT_PUBLIC_SUPABASE_URL=[https://your-project-id.supabase.co](https://your-project-id.supabase.co)
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-goes-here
```

### Setup Notes:
* **For OpenAI:** You just need a standard API key from their developer platform.
* **For Ollama:** Ensure Ollama is running locally (e.g., `ollama run llama3`) on the port specified above.
* **For Supabase:** You will need to create a project, then run the `supabase-schema.sql` file (located in this repository) in your Supabase SQL editor to create the necessary `saved_routes` table and security policies.

---

## 💻 Tech Stack

* **Framework:** Next.js (App Router)
* **UI/Components:** React
* **Mapping:** Leaflet
* **Routing Engines:** Trail Router API, OSRM
* **AI:** OpenAI API / Ollama
* **Database:** Supabase (PostgreSQL)
