import { tasks } from "@trigger.dev/sdk/v3";

export const runtime = "nodejs";

type FinalizeRequestBody = {
  events?: unknown;
  film?: unknown;
  results?: unknown;
  work?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function getNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sanitizeFinalizePayload(body: FinalizeRequestBody) {
  const work = isRecord(body.work) ? body.work : {};
  const film = isRecord(body.film) ? body.film : {};
  const results = isRecord(body.results) ? body.results : {};
  const events = Array.isArray(body.events) ? body.events : [];
  const moments = Array.isArray(film.moments) ? film.moments : [];
  const workId = getString(work.id);

  if (!workId) return null;

  return {
    events: events.slice(0, 240).map((event) => {
      const candidate = isRecord(event) ? event : {};

      return {
        filmTimeSeconds: getNumber(candidate.filmTimeSeconds),
        id: getString(candidate.id, crypto.randomUUID()),
        label: getString(candidate.label, "Event"),
        participantId: getString(candidate.participantId) || undefined,
        timestamp: getString(candidate.timestamp, new Date().toISOString()),
        type: getString(candidate.type, "event"),
      };
    }),
    film: {
      id: getString(film.id) || undefined,
      moments: moments.slice(0, 120).map((moment) => {
        const candidate = isRecord(moment) ? moment : {};

        return {
          filmTimeSeconds: getNumber(candidate.filmTimeSeconds),
          id: getString(candidate.id, crypto.randomUUID()),
          label: getString(candidate.label, "Moment"),
          type: getString(candidate.type, "moment"),
        };
      }),
      muxAssetId: getString(film.muxAssetId) || undefined,
      playbackId: getString(film.playbackId) || undefined,
      status:
        film.status === "ready" || film.status === "processing" || film.status === "unavailable"
          ? film.status
          : "unavailable",
      thumbnailUrl: getString(film.thumbnailUrl) || undefined,
      workId,
    },
    results: {
      attempts: getNumber(results.attempts),
      durationSeconds: getNumber(results.durationSeconds),
      eventsCount: getNumber(results.eventsCount),
      fieldGoalPercentage:
        typeof results.fieldGoalPercentage === "number" && Number.isFinite(results.fieldGoalPercentage)
          ? results.fieldGoalPercentage
          : null,
      filmMomentsCount: getNumber(results.filmMomentsCount),
      makes: getNumber(results.makes),
      misses: getNumber(results.misses),
    },
    work: {
      endedAt: getString(work.endedAt, new Date().toISOString()),
      id: workId,
      participantIds: Array.isArray(work.participantIds)
        ? work.participantIds.filter((participantId): participantId is string => typeof participantId === "string")
        : [],
      startedAt: getString(work.startedAt, new Date().toISOString()),
      status: "complete" as const,
      type: getString(work.type, "work"),
    },
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as FinalizeRequestBody | null;
  if (!body) return Response.json({ queued: false }, { status: 400 });

  const payload = sanitizeFinalizePayload(body);
  if (!payload) return Response.json({ queued: false }, { status: 400 });

  try {
    const handle = await tasks.trigger("finalize-work", payload);

    return Response.json({ queued: true, runId: handle.id }, { status: 202 });
  } catch (error) {
    console.error("Unable to queue finalizeWork", error);
    return Response.json({ queued: false }, { status: 202 });
  }
}
