import { getAxisRequestUser } from "../../../../../lib/axis-request-auth";
import {
  computeClipStats,
  getClipEvents,
  getClipSetup,
  getClipSource,
  insertClipEvents,
  resolveClipPlay,
  updateClipEvent,
  upsertClipPressPack,
} from "../../../../../lib/clip-room/db";
import type { ClipEventType, ClipShotZone, ResolveClipPlayRequest } from "../../../../../lib/clip-room/types";

export const runtime = "nodejs";

const WHAT_HAPPENED_QUESTION = "What happened in this clip?";

type EventSpec = { eventType: ClipEventType; points: number; shotZone: ClipShotZone | null; label: string };

const RESOLUTION_EVENT: Record<string, EventSpec> = {
  made_2:   { eventType: "make",     points: 2, shotZone: "paint",       label: "2-point make" },
  made_3:   { eventType: "make",     points: 3, shotZone: "three_point", label: "3-point make" },
  miss:     { eventType: "miss",     points: 0, shotZone: null,          label: "Missed shot" },
  rebound:  { eventType: "rebound",  points: 0, shotZone: null,          label: "Rebound" },
  turnover: { eventType: "turnover", points: 0, shotZone: null,          label: "Turnover" },
  assist:   { eventType: "assist",   points: 0, shotZone: null,          label: "Assist" },
  skip:     { eventType: "shot_attempt", points: 0, shotZone: null,       label: "Skipped manual count" },
};

export async function PATCH(request: Request, context: { params: Promise<{ playId: string }> }) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ error: auth.reason }, { status: 401 });

  const { playId } = await context.params;

  const body = (await request.json().catch(() => null)) as ResolveClipPlayRequest | null;
  if (!body || typeof body.resolution !== "string") {
    return Response.json({ error: "resolution is required" }, { status: 400 });
  }

  const resolved = await resolveClipPlay(playId, body.resolution);
  if (resolved.error || !resolved.record) {
    return Response.json({ error: resolved.error ?? "play not found" }, { status: 404 });
  }

  const play = resolved.record;
  const source = await getClipSource(play.clipId);
  if (!source.record || source.record.ownerId !== auth.userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const isWhatHappenedPlay = play.question === WHAT_HAPPENED_QUESTION;

  if (isWhatHappenedPlay) {
    // Create an Activity row for every manual choice, including Skip.
    const spec = RESOLUTION_EVENT[body.resolution];
    if (spec) {
      await insertClipEvents([{
        clipId: play.clipId,
        ownerId: auth.userId,
        eventType: spec.eventType,
        status: body.resolution === "skip" ? "skipped" : "counted",
        timestampSeconds: play.timestampSeconds,
        playerLabel: null,
        points: spec.points,
        shotZone: spec.shotZone,
        proof: "user marked",
        metadata: { resolution: body.resolution },
        sortOrder: 0,
      }]);
    }
  } else if (play.eventId) {
    const newStatus = body.resolution === "skipped" ? "skipped" : "counted";
    await updateClipEvent(play.eventId, { status: newStatus });
  }

  const eventsResult = await getClipEvents(play.clipId);
  const stats = computeClipStats(eventsResult.records);

  // Build press pack starter from events
  const countedEvents = eventsResult.records.filter((e) => e.status === "counted");
  const keyMoments = countedEvents
    .filter((e) => e.timestampSeconds !== null)
    .slice(0, 10)
    .map((e) => ({ timestampSeconds: e.timestampSeconds!, description: simpleEventLabel(e.eventType) }));

  let headline: string | null = null;
  let summary: string | null = null;

  if (isWhatHappenedPlay && countedEvents.length > 0) {
    const setup = await getClipSetup(play.clipId);
    const subject = setup.record?.subjectName ?? "Player";
    const session = setup.record?.sessionType ?? "clip";
    const spec = RESOLUTION_EVENT[body.resolution];
    if (spec) {
      headline = `${subject} - ${session} clip reviewed`;
      summary = `${subject} recorded a ${spec.label} in this ${session} clip.`;
    }
  } else if (isWhatHappenedPlay) {
    headline = "Clip reviewed";
    summary = body.resolution === "skip"
      ? "The play was skipped after review. No stat was added."
      : "The clip was reviewed and saved to Activity.";
  }

  await upsertClipPressPack({
    clipId: play.clipId,
    ownerId: auth.userId,
    headline,
    summary,
    keyMoments,
    statLines: stats,
  });

  return Response.json({ play, stats });
}

function simpleEventLabel(type: string) {
  const labels: Record<string, string> = {
    make: "Field goal",
    miss: "Missed shot",
    rebound: "Rebound",
    assist: "Assist",
    turnover: "Turnover",
    steal: "Steal",
    block: "Block",
    foul: "Foul",
    free_throw: "Free throw",
  };
  return labels[type] ?? type;
}
