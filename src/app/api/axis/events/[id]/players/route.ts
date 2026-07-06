import { asTrimmedString } from "../../../../../../lib/axis-event-container";
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

  const displayName = asTrimmedString(body.display_name);
  if (!displayName) return Response.json({ error: "display_name is required" }, { status: 400 });

  // Keep a durable axis_players row so the same athlete compounds across events.
  const { data: player, error: playerError } = await client.supabase
    .from("axis_players")
    .insert({
      display_name: displayName,
      jersey_number: asTrimmedString(body.jersey_number),
      team_name: asTrimmedString(body.team_name),
    })
    .select()
    .single();
  if (playerError) return Response.json({ error: playerError.message }, { status: 502 });

  const { data, error } = await client.supabase
    .from("axis_event_players")
    .insert({
      display_name: displayName,
      event_id: eventId,
      jersey_number: asTrimmedString(body.jersey_number),
      player_id: player.id,
      team_name: asTrimmedString(body.team_name),
    })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 502 });

  return Response.json({ eventPlayer: data, player }, { status: 201 });
}
