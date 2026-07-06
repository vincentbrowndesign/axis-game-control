import {
  AXIS_LENS_TAGS,
  AXIS_OUTPUT_TARGETS,
  asStringArray,
  asTrimmedString,
} from "../../../../../lib/axis-event-container";
import { getAxisContainerClient } from "../../../../../lib/axis-event-container-server";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const client = getAxisContainerClient();
  if (!client.ok) return Response.json({ code: client.code, error: client.reason }, { status: 503 });

  const { id } = await context.params;
  const momentId = id.trim();
  if (!momentId) return Response.json({ error: "moment id is required" }, { status: 400 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "invalid JSON body" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.note !== undefined) update.note = asTrimmedString(body.note);
  if (body.event_player_id !== undefined) {
    update.event_player_id = asTrimmedString(body.event_player_id);
  }
  if (body.player_id !== undefined) update.player_id = asTrimmedString(body.player_id);
  if (body.lens_tags !== undefined) {
    const tags = asStringArray(body.lens_tags);
    if (!tags) return Response.json({ error: "lens_tags must be a string array" }, { status: 400 });
    const known = tags.filter((tag) => (AXIS_LENS_TAGS as readonly string[]).includes(tag));
    if (known.length !== tags.length) {
      return Response.json({ error: "lens_tags contains an unknown tag" }, { status: 400 });
    }
    update.lens_tags = known;
  }
  if (body.outcome_tags !== undefined) {
    const tags = asStringArray(body.outcome_tags);
    if (!tags) return Response.json({ error: "outcome_tags must be a string array" }, { status: 400 });
    update.outcome_tags = tags;
  }
  if (body.output_targets !== undefined) {
    const targets = asStringArray(body.output_targets);
    if (!targets) return Response.json({ error: "output_targets must be a string array" }, { status: 400 });
    const known = targets.filter((target) => (AXIS_OUTPUT_TARGETS as readonly string[]).includes(target));
    if (known.length !== targets.length) {
      return Response.json({ error: "output_targets contains an unknown target" }, { status: 400 });
    }
    update.output_targets = known;
  }
  if (!Object.keys(update).length) {
    return Response.json({ error: "no valid fields to update" }, { status: 400 });
  }

  const { data, error } = await client.supabase
    .from("axis_moments")
    .update(update)
    .eq("id", momentId)
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 502 });

  return Response.json({ moment: data });
}
