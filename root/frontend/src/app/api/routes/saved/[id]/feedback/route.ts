import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const supabase = getSupabase();
    const { data: rows, error } = await supabase
      .from("route_feedback")
      .select("route_option_id, thumbs, tag")
      .eq("saved_route_id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const byOption: Record<string, { thumbsUp: number; thumbsDown: number; tags: string[] }> = {};
    for (const r of rows ?? []) {
      const opt = r.route_option_id ?? "opt_0";
      if (!byOption[opt]) byOption[opt] = { thumbsUp: 0, thumbsDown: 0, tags: [] };
      if (r.thumbs === 1) byOption[opt].thumbsUp += 1;
      if (r.thumbs === -1) byOption[opt].thumbsDown += 1;
      if (r.tag && typeof r.tag === "string" && !byOption[opt].tags.includes(r.tag)) {
        byOption[opt].tags.push(r.tag);
      }
    }
    return NextResponse.json(byOption);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load feedback." },
      { status: 500 },
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    let body: { routeOptionId?: string; thumbs?: number; tag?: string };
    try {
      body = (await req.json()) as { routeOptionId?: string; thumbs?: number; tag?: string };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const routeOptionId = typeof body.routeOptionId === "string" ? body.routeOptionId : "opt_0";
    const thumbs = body.thumbs === 1 || body.thumbs === -1 ? body.thumbs : null;
    const tag = typeof body.tag === "string" ? body.tag.trim() || null : null;
    if (thumbs === null && !tag) {
      return NextResponse.json({ error: "Provide thumbs (1 or -1) and/or tag." }, { status: 400 });
    }
    const supabase = getSupabase();

    const rowsToInsert: { saved_route_id: string; route_option_id: string; thumbs: number; tag: string | null }[] = [];
    if (thumbs !== null) {
      rowsToInsert.push({ saved_route_id: id, route_option_id: routeOptionId, thumbs, tag: null });
    }
    if (tag) {
      rowsToInsert.push({ saved_route_id: id, route_option_id: routeOptionId, thumbs: 0, tag });
    }

    for (const row of rowsToInsert) {
      const { error: e } = await supabase.from("route_feedback").insert(row);
      if (e) {
        console.error("[feedback POST] Supabase error:", e.message, e.details, e.code);
        return NextResponse.json(
          { error: e.message, details: e.details, code: e.code },
          { status: 500 },
        );
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[feedback POST] Exception:", e);
    const message = e instanceof Error ? e.message : "Failed to submit feedback.";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
