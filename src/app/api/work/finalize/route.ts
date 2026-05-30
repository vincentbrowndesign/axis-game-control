import { tasks } from "@trigger.dev/sdk/v3";

export const runtime = "nodejs";

type FinalizeRequestBody = {
  events?: unknown;
  exportQueue?: unknown;
  film?: unknown;
  overlayProfile?: unknown;
  pipeline?: unknown;
  playerReport?: unknown;
  results?: unknown;
  shots?: unknown;
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
  const overlayProfile = isRecord(body.overlayProfile) ? body.overlayProfile : {};
  const pipeline = Array.isArray(body.pipeline) ? body.pipeline : [];
  const playerReport = isRecord(body.playerReport) ? body.playerReport : {};
  const results = isRecord(body.results) ? body.results : {};
  const shots = Array.isArray(body.shots) ? body.shots : [];
  const events = Array.isArray(body.events) ? body.events : [];
  const exportQueue = Array.isArray(body.exportQueue) ? body.exportQueue : [];
  const moments = Array.isArray(film.moments) ? film.moments : [];
  const clips = Array.isArray(film.clips) ? film.clips : [];
  const overlays = Array.isArray(film.overlays) ? film.overlays : moments;
  const playlist = Array.isArray(film.playlist) ? film.playlist : clips;
  const timeline = Array.isArray(film.timeline) ? film.timeline : moments;
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
    exportQueue: exportQueue.slice(0, 12).map((output) => {
      const candidate = isRecord(output) ? output : {};
      const status = getString(candidate.status, "waiting");

      return {
        label: getString(candidate.label, "Export"),
        sourceCount: getNumber(candidate.sourceCount),
        status: status === "available" || status === "processing" || status === "waiting" ? status : "waiting",
        type: getString(candidate.type, "export"),
      };
    }),
    film: {
      clips: clips.slice(0, 120).map((clip) => {
        const candidate = isRecord(clip) ? clip : {};

        return {
          clipEnd: getNumber(candidate.clipEnd),
          clipKind: getString(candidate.clipKind) || undefined,
          clipStart: getNumber(candidate.clipStart),
          eventId: getString(candidate.eventId, crypto.randomUUID()),
          id: getString(candidate.id, crypto.randomUUID()),
          leadInSeconds: getNumber(candidate.leadInSeconds),
          leadOutSeconds: getNumber(candidate.leadOutSeconds),
          playlistOrder: getNumber(candidate.playlistOrder),
          sourceLabel: getString(candidate.sourceLabel) || undefined,
          type: getString(candidate.type, "clip"),
        };
      }),
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
      overlays: overlays.slice(0, 120).map((overlay) => {
        const candidate = isRecord(overlay) ? overlay : {};

        return {
          filmTimeSeconds: getNumber(candidate.filmTimeSeconds),
          id: getString(candidate.id, crypto.randomUUID()),
          label: getString(candidate.label, "Overlay"),
          type: getString(candidate.type, "overlay"),
        };
      }),
      playbackId: getString(film.playbackId) || undefined,
      playlist: playlist.slice(0, 120).map((clip) => {
        const candidate = isRecord(clip) ? clip : {};

        return {
          clipEnd: getNumber(candidate.clipEnd),
          clipKind: getString(candidate.clipKind) || undefined,
          clipStart: getNumber(candidate.clipStart),
          eventId: getString(candidate.eventId, crypto.randomUUID()),
          id: getString(candidate.id, crypto.randomUUID()),
          label: getString(candidate.label, "Clip"),
          order: getNumber(candidate.order),
        };
      }),
      status:
        film.status === "ready" || film.status === "processing" || film.status === "unavailable"
          ? film.status
          : "unavailable",
      timeline: timeline.slice(0, 120).map((moment) => {
        const candidate = isRecord(moment) ? moment : {};

        return {
          filmTimeSeconds: getNumber(candidate.filmTimeSeconds),
          id: getString(candidate.id, crypto.randomUUID()),
          label: getString(candidate.label, "Moment"),
          type: getString(candidate.type, "moment"),
        };
      }),
      thumbnailUrl: getString(film.thumbnailUrl) || undefined,
      workId,
    },
    overlayProfile: Object.fromEntries(
      Object.entries(overlayProfile)
        .filter((entry): entry is [string, boolean] => typeof entry[0] === "string" && typeof entry[1] === "boolean")
        .slice(0, 24),
    ),
    pipeline: pipeline.slice(0, 12).map((stage) => {
      const candidate = isRecord(stage) ? stage : {};
      const outputs = Array.isArray(candidate.outputs)
        ? candidate.outputs.filter((output): output is string => typeof output === "string").slice(0, 8)
        : [];
      const status = getString(candidate.status, "waiting");

      return {
        capability: getString(candidate.capability, "Capability"),
        outputs,
        provider: getString(candidate.provider, "system"),
        sourceCount: getNumber(candidate.sourceCount),
        status: status === "available" || status === "processing" || status === "waiting" ? status : "waiting",
      };
    }),
    playerReport: {
      attendance: getNumber(playerReport.attendance),
      averageReleaseAngle:
        typeof playerReport.averageReleaseAngle === "number" && Number.isFinite(playerReport.averageReleaseAngle)
          ? playerReport.averageReleaseAngle
          : null,
      averageReleaseSpeed:
        typeof playerReport.averageReleaseSpeed === "number" && Number.isFinite(playerReport.averageReleaseSpeed)
          ? playerReport.averageReleaseSpeed
          : null,
      averageReleaseTime:
        typeof playerReport.averageReleaseTime === "number" && Number.isFinite(playerReport.averageReleaseTime)
          ? playerReport.averageReleaseTime
          : null,
      fieldGoalPercentage: getNumber(playerReport.fieldGoalPercentage),
      makes: getNumber(playerReport.makes),
      misses: getNumber(playerReport.misses),
      outputs: Array.isArray(playerReport.outputs)
        ? playerReport.outputs.slice(0, 12).map((output) => {
            const candidate = isRecord(output) ? output : {};
            const status = getString(candidate.status, "waiting");

            return {
              label: getString(candidate.label, "Player Output"),
              sourceCount: getNumber(candidate.sourceCount),
              status: status === "available" || status === "processing" || status === "waiting" ? status : "waiting",
              type: getString(candidate.type, "player_output"),
            };
          })
        : [],
      playerId: getString(playerReport.playerId) || undefined,
      playerName: getString(playerReport.playerName, "Athlete"),
      progressGraph: Array.isArray(playerReport.progressGraph)
        ? playerReport.progressGraph.slice(0, 240).map((point) => {
            const candidate = isRecord(point) ? point : {};

            return {
              attempts: getNumber(candidate.attempts),
              fieldGoalPercentage: getNumber(candidate.fieldGoalPercentage),
              makes: getNumber(candidate.makes),
              timestamp: getString(candidate.timestamp, new Date().toISOString()),
            };
          })
        : [],
      releaseMetrics: Array.isArray(playerReport.releaseMetrics)
        ? playerReport.releaseMetrics.slice(0, 240).map((metric) => {
            const candidate = isRecord(metric) ? metric : {};

            return {
              arcHeightFeet: getNumber(candidate.arcHeightFeet),
              attemptNumber: getNumber(candidate.attemptNumber),
              entryAngle: getNumber(candidate.entryAngle),
              releaseAngle: getNumber(candidate.releaseAngle),
              releaseSpeed: getNumber(candidate.releaseSpeed),
              releaseTime: getNumber(candidate.releaseTime),
            };
          })
        : [],
      sessionHours: getNumber(playerReport.sessionHours),
      shotLocations: Array.isArray(playerReport.shotLocations)
        ? playerReport.shotLocations.slice(0, 240).map((location) => {
            const candidate = isRecord(location) ? location : {};

            return {
              attemptNumber: getNumber(candidate.attemptNumber),
              distance: getNumber(candidate.distance),
              x: getNumber(candidate.x),
              y: getNumber(candidate.y),
            };
          })
        : [],
      timeline: Array.isArray(playerReport.timeline)
        ? playerReport.timeline.slice(0, 240).map((event) => {
            const candidate = isRecord(event) ? event : {};

            return {
              label: getString(candidate.label, "Shot"),
              timestamp: getString(candidate.timestamp, new Date().toISOString()),
              videoTimestamp: getNumber(candidate.videoTimestamp),
            };
          })
        : [],
      totalAttempts: getNumber(playerReport.totalAttempts),
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
    shots: shots.slice(0, 240).map((shot) => {
      const candidate = isRecord(shot) ? shot : {};

      return {
        attemptNumber: getNumber(candidate.attemptNumber),
        athleteId: getString(candidate.athleteId) || undefined,
        athleteName: getString(candidate.athleteName, "Athlete"),
        apexPoint: isRecord(candidate.apexPoint)
          ? {
              x: getNumber(candidate.apexPoint.x),
              y: getNumber(candidate.apexPoint.y),
            }
          : undefined,
        entryPoint: isRecord(candidate.entryPoint)
          ? {
              x: getNumber(candidate.entryPoint.x),
              y: getNumber(candidate.entryPoint.y),
            }
          : undefined,
        entryAngle: getNumber(candidate.entryAngle),
        filmTimeSeconds: getNumber(candidate.filmTimeSeconds),
        makeStreak: getNumber(candidate.makeStreak),
        releaseAngle: getNumber(candidate.releaseAngle),
        releasePoint: isRecord(candidate.releasePoint)
          ? {
              x: getNumber(candidate.releasePoint.x),
              y: getNumber(candidate.releasePoint.y),
            }
          : undefined,
        releaseSpeed: getNumber(candidate.releaseSpeed),
        releaseTime: getNumber(candidate.releaseTime),
        shotArcFeet: getNumber(candidate.shotArcFeet),
        shotDistance: getNumber(candidate.shotDistance),
        shotEndTimestamp: getString(candidate.shotEndTimestamp, new Date().toISOString()),
        shotStartTimestamp: getString(candidate.shotStartTimestamp, new Date().toISOString()),
        timestamp: getString(candidate.timestamp, new Date().toISOString()),
        trajectorySpline: Array.isArray(candidate.trajectorySpline)
          ? candidate.trajectorySpline.slice(0, 32).map((point) => {
              const pointCandidate = isRecord(point) ? point : {};

              return {
                x: getNumber(pointCandidate.x),
                y: getNumber(pointCandidate.y),
              };
            })
          : [],
        type: getString(candidate.type, "shot"),
      };
    }),
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
