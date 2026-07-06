import {
  AXIS_MEDIA_KINDS,
  asTrimmedString,
  isOneOf,
} from "../../../../../../lib/axis-event-container";
import { getAxisContainerClient } from "../../../../../../lib/axis-event-container-server";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const client = getAxisContainerClient();
  if (!client.ok) return Response.json({ code: client.code, error: client.reason }, { status: 503 });

  const { id } = await context.params;
  const eventId = id.trim();
  if (!eventId) return Response.json({ error: "event id is required" }, { status: 400 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "invalid JSON body" }, { status: 400 });

  if (!isOneOf(body.kind, AXIS_MEDIA_KINDS)) {
    return Response.json({ error: "kind is invalid" }, { status: 400 });
  }
  const url = asTrimmedString(body.url);
  if (!url) return Response.json({ error: "url is required" }, { status: 400 });

  const { data, error } = await client.supabase
    .from("axis_event_media")
    .insert({
      event_id: eventId,
      kind: body.kind,
      provider: asTrimmedString(body.provider),
      upload_status: "ready",
      url,
    })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 502 });

  return Response.json({ media: data }, { status: 201 });
}
