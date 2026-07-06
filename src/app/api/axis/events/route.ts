import {
  AXIS_EVENT_TYPES,
  AXIS_SOURCE_MODES,
  asTrimmedString,
  isOneOf,
} from "../../../../lib/axis-event-container";
import { getAxisContainerClient } from "../../../../lib/axis-event-container-server";

export const runtime = "nodejs";

const ACTIVE_STATUSES = ["draft", "recording", "live", "review", "processing"];

export async function GET() {
  const client = getAxisContainerClient();
  if (!client.ok) return Response.json({ code: client.code, error: client.reason }, { status: 503 });

  const { data, error } = await client.supabase
    .from("axis_event_containers")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) return Response.json({ error: error.message }, { status: 502 });

  const events = data ?? [];
  return Response.json({
    active: events.filter((event) => ACTIVE_STATUSES.includes(event.status)),
    recent: events.filter((event) => !ACTIVE_STATUSES.includes(event.status)),
  });
}

export async function POST(request: Request) {
  const client = getAxisContainerClient();
  if (!client.ok) return Response.json({ code: client.code, error: client.reason }, { status: 503 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "invalid JSON body" }, { status: 400 });

  const title = asTrimmedString(body.title);
  if (!title) return Response.json({ error: "title is required" }, { status: 400 });
  if (!isOneOf(body.event_type, AXIS_EVENT_TYPES)) {
    return Response.json({ error: "event_type is invalid" }, { status: 400 });
  }
  if (!isOneOf(body.source_mode, AXIS_SOURCE_MODES)) {
    return Response.json({ error: "source_mode is invalid" }, { status: 400 });
  }

  const { data, error } = await client.supabase
    .from("axis_event_containers")
    .insert({
      event_type: body.event_type,
      location: asTrimmedString(body.location),
      notes: asTrimmedString(body.notes),
      opponent_name: asTrimmedString(body.opponent_name),
      source_mode: body.source_mode,
      team_name: asTrimmedString(body.team_name),
      title,
    })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 502 });

  return Response.json({ event: data }, { status: 201 });
}
