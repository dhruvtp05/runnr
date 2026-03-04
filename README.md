# 🏃‍♂️ runnr

![Next.js](https://img.shields.io/badge/Next.js-black?style=flat-square&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Leaflet](https://img.shields.io/badge/Leaflet-199900?style=flat-square&logo=Leaflet&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)

> **runnr** is a smart, interactive running route builder designed to help you discover the perfect loop. Simply drop a pin on the map, set your target distance, and let runnr generate custom round-trip options tailored to your preferences—whether you're looking for quiet park trails or paved city roads. 

---

## ✨ Features

* 🗺️ **Smart Route Generation** Powered by [Trail Router](https://trailrouter.com/) to prioritize green spaces and avoid busy streets. If an area isn't covered, it seamlessly falls back to OSRM to build intelligent, out-and-back routes that closely match your target distance (within 7–15% variance).
* ⛰️ **Tailored to Your Run** Choose between **Road, Trail, or Mixed** surfaces. Customize further by setting your preferred elevation (flat, rolling, hilly) and safety levels (balanced, safer) to tweak waypoints and routing behavior.
* 🤖 **AI-Powered Insights (Optional)** Connect your OpenAI API key to transform raw routes into curated experiences. The AI provides:
  * Catchy short names and one-line descriptions.
  * Personalized run tips (terrain info, hill warnings, best time to run).
  * Intelligent rankings based on your free-text preferences (e.g., *"most scenic"*, *"avoid main roads"*).
* 💾 **Save & Share (Optional)** Backed by Supabase, you can save your generated route sets, name them, and generate shareable links (`/routes/saved/<id>`). Perfect for planning group runs or saving a favorite loop for later.
* 📤 **Export Anywhere** * **Google Maps:** Open your route directly in Google Maps Directions to follow on your phone.
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
