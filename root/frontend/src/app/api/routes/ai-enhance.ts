import OpenAI from "openai";

export type RouteSummary = {
  id: string;
  name: string;
  distanceMeters: number;
  durationSeconds: number;
  surface: string;
  elevation: string;
  waypointDirection?: string;
};

export type AIEnhancement = {
  routeNames: string[];
  routeDescriptions: string[];
  runTips: string[];
  ranking: number[];
  preferenceInterpretation?: string;
};

const systemPrompt = `You are a running route assistant for an app that generates round-trip running routes. Given 3 route options (distance, duration, surface, elevation), you must return JSON only (no markdown) with:
- routeNames: 3 short catchy names (e.g. "Riverside loop", "Park out-and-back", "North hills")
- routeDescriptions: 3 one-line descriptions of what makes each route special (e.g. "Mostly flat along the water")
- runTips: 3 short tips per route (surface, hills, best time of day, one sentence each)
- ranking: array of 3 indices [0,1,2] in order of preference (best first). If the user asked to "rank by" something (e.g. morning run, easy), use that. Otherwise pick a sensible default (e.g. most scenic, best variety).
- preferenceInterpretation: if the user gave free-text preferences, one sentence summarizing how you applied them; otherwise omit or empty string.`;

function routeSummaryForLLM(
  r: { id: string; name: string; distanceMeters: number; durationSeconds: number; waypoint: { lat: number; lng: number } },
  metrics: { surface: string; elevation: string },
  start: { lat: number; lng: number }
): RouteSummary {
  const bearingNames = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
  const waypoint = r.waypoint;
  const dy = waypoint.lat - start.lat;
  const dx = waypoint.lng - start.lng;
  const angle = (Math.atan2(dx, dy) * 180) / Math.PI;
  const bearingIdx = Math.round(((angle + 180) / 360) * 8) % 8;
  const direction = bearingNames[bearingIdx];
  return {
    id: r.id,
    name: r.name,
    distanceMeters: r.distanceMeters,
    durationSeconds: r.durationSeconds,
    surface: metrics.surface,
    elevation: metrics.elevation,
    waypointDirection: direction,
  };
}

export async function enhanceRoutesWithAI(
  routes: Array<{
    id: string;
    name: string;
    distanceMeters: number;
    durationSeconds: number;
    waypoint: { lat: number; lng: number };
  }>,
  metrics: { surface: string; elevation: string },
  start: { lat: number; lng: number },
  userPreferences?: string,
  rankBy?: string
): Promise<AIEnhancement | null> {
  const summaries = routes.map((r) => routeSummaryForLLM(r, metrics, start));

  const userMessage = [
    "Route options (in order):",
    summaries
      .map(
        (s, i) =>
          `[${i}] ${(s.distanceMeters / 1000).toFixed(1)} km, ~${Math.round(s.durationSeconds / 60)} min, ${s.surface}, ${s.elevation}, general direction: ${s.waypointDirection}`
      )
      .join("\n"),
    userPreferences?.trim() ? `\nUser preferences: ${userPreferences.trim()}` : "",
    rankBy?.trim() ? `\nRank by: ${rankBy.trim()} (put the best matching route first in ranking).` : "",
  ].join("\n");

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const useLocal = !openaiKey;

  const buildResult = (content: string): AIEnhancement | null => {
    const parsed = JSON.parse(content) as {
      routeNames?: string[];
      routeDescriptions?: string[];
      runTips?: string[];
      ranking?: number[];
      preferenceInterpretation?: string;
    };

    const routeNames = Array.isArray(parsed.routeNames) ? parsed.routeNames.slice(0, 3) : [];
    const routeDescriptions = Array.isArray(parsed.routeDescriptions)
      ? parsed.routeDescriptions.slice(0, 3)
      : [];
    const runTips = Array.isArray(parsed.runTips) ? parsed.runTips.slice(0, 3) : [];
    let ranking = Array.isArray(parsed.ranking) ? parsed.ranking.filter((n) => n >= 0 && n <= 2) : [0, 1, 2];
    if (ranking.length !== 3) ranking = [0, 1, 2];

    return {
      routeNames:
        routeNames.length >= 3
          ? routeNames
          : [...routeNames, ...routes.map((_, i) => `Option ${String.fromCharCode(65 + i)}`)].slice(0, 3),
      routeDescriptions:
        routeDescriptions.length >= 3
          ? routeDescriptions
          : [...routeDescriptions, ...Array(3).fill("Round-trip run.")].slice(0, 3),
      runTips: runTips.length >= 3 ? runTips : [...runTips, ...Array(3).fill("Good for a steady run.")].slice(0, 3),
      ranking,
      preferenceInterpretation:
        typeof parsed.preferenceInterpretation === "string" ? parsed.preferenceInterpretation : undefined,
    };
  };

  try {
    if (useLocal) {
      const model = process.env.LOCAL_LLM_MODEL?.trim() || "llama3.2";
      const res = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          stream: false,
        }),
      });

      if (!res.ok) return null;
      const json = (await res.json()) as { message?: { content?: string } };
      const content = json.message?.content;
      if (!content) return null;
      return buildResult(content);
    }

    const client = new OpenAI({ apiKey: openaiKey! });
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      max_tokens: 800,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return null;
    return buildResult(content);
  } catch {
    return null;
  }
}
