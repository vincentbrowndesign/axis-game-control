import { asTrimmedString } from "../../../../../../lib/axis-event-container";
import { getAxisContainerClient } from "../../../../../../lib/axis-event-container-server";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const client = getAxisContainerClient();
  if (!client.ok) return Response.json({ code: client.code, error: client.reason }, { status: 503 });

  const { id } = await context.params;
  const eventId = id.trim();
  if (!eventId) return Response.json({ error: "event id is required" }, { status: 400 });

  const { data, error } = await client.supabase
    .from("axis_moments")
    .select("*")
    .eq("event_id", eventId)
    .order("timestamp_seconds");
  if (error) return Response.json({ error: error.message }, { status: 502 });

  return Response.json({ moments: data ?? [] });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const client = getAxisContainerClient();
  if (!client.ok) return Response.json({ code: client.code, error: client.reason }, { status: 503 });

  const { id } = await context.params;
  const eventId = id.trim();
  if (!eventId) return Response.json({ error: "event id is required" }, { status: 400 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "invalid JSON body" }, { status: 400 });

  const label = body.ui_label;
  if (label !== "KEEP" && label !== "FIX") {
    return Response.json({ error: "ui_label must be KEEP or FIX" }, { status: 400 });
  }
  const timestampSeconds =
    typeof body.timestamp_seconds === "number" && Number.isFinite(body.timestamp_seconds)
      ? Math.max(0, body.timestamp_seconds)
      : 0;

  const { data, error } = await client.supabase
    .from("axis_moments")
    .insert({
      event_id: eventId,
      intent: label === "KEEP" ? "asset" : "coaching",
      note: asTrimmedString(body.note),
      source: "manual",
      timestamp_seconds: timestampSeconds,
      ui_label: label,
    })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 502 });

  return Response.json({ moment: data }, { status: 201 });
}
