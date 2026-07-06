import {
  AXIS_EVENT_STATUSES,
  asTrimmedString,
  isOneOf,
} from "../../../../../lib/axis-event-container";
import { getAxisContainerClient } from "../../../../../lib/axis-event-container-server";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const client = getAxisContainerClient();
  if (!client.ok) return Response.json({ code: client.code, error: client.reason }, { status: 503 });

  const { id } = await context.params;
  const eventId = id.trim();
  if (!eventId) return Response.json({ error: "event id is required" }, { status: 400 });

  const { data: event, error } = await client.supabase
    .from("axis_event_containers")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 502 });
  if (!event) return Response.json({ error: "event not found" }, { status: 404 });

  const [media, players, moments, reports, accessLinks] = await Promise.all([
    client.supabase.from("axis_event_media").select("*").eq("event_id", eventId).order("created_at"),
    client.supabase.from("axis_event_players").select("*").eq("event_id", eventId).order("created_at"),
    client.supabase.from("axis_moments").select("*").eq("event_id", eventId).order("timestamp_seconds"),
    client.supabase.from("axis_reports").select("*").eq("event_id", eventId).order("created_at"),
    client.supabase.from("axis_access_links").select("*").eq("event_id", eventId).order("created_at"),
  ]);
  const child = media.error ?? players.error ?? moments.error ?? reports.error ?? accessLinks.error;
  if (child) return Response.json({ error: child.message }, { status: 502 });

  return Response.json({
    accessLinks: accessLinks.data ?? [],
    event,
    media: media.data ?? [],
    moments: moments.data ?? [],
    players: players.data ?? [],
    reports: reports.data ?? [],
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const client = getAxisContainerClient();
  if (!client.ok) return Response.json({ code: client.code, error: client.reason }, { status: 503 });

  const { id } = await context.params;
  const eventId = id.trim();
  if (!eventId) return Response.json({ error: "event id is required" }, { status: 400 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "invalid JSON body" }, { status: 400 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status !== undefined) {
    if (!isOneOf(body.status, AXIS_EVENT_STATUSES)) {
      return Response.json({ error: "status is invalid" }, { status: 400 });
    }
    update.status = body.status;
  }
  if (body.title !== undefined) {
    const title = asTrimmedString(body.title);
    if (!title) return Response.json({ error: "title cannot be empty" }, { status: 400 });
    update.title = title;
  }
  if (body.notes !== undefined) update.notes = asTrimmedString(body.notes);
  if (body.location !== undefined) update.location = asTrimmedString(body.location);
  if (body.team_name !== undefined) update.team_name = asTrimmedString(body.team_name);
  if (body.opponent_name !== undefined) update.opponent_name = asTrimmedString(body.opponent_name);
  // start_clock: sets the live timer origin once; KEEP/FIX timestamps are measured from it.
  if (body.start_clock === true) update.recording_started_at = new Date().toISOString();

  const { data, error } = await client.supabase
    .from("axis_event_containers")
    .update(update)
    .eq("id", eventId)
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 502 });

  return Response.json({ event: data });
}
