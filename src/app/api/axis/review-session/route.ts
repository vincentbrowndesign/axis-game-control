import OpenAI from "openai";

export const runtime = "nodejs";

type ReviewEvent = {
  athleteName?: string;
  label?: string;
  timestamp?: string;
  type?: string;
};

type ReviewTimelineSample = {
  distanceTraveled?: number;
  entered?: boolean;
  exited?: boolean;
  moving?: boolean;
  stationary?: boolean;
  timestamp?: string;
  tracked?: boolean;
  trackingLost?: boolean;
  trackingRecovered?: boolean;
  visible?: boolean;
};

type ReviewClip = {
  clipEnd?: number;
  clipStart?: number;
  eventType?: string;
  replayLabel?: string;
};

type ReviewRequestBody = {
  eventTimeline?: unknown;
  movementTimeline?: unknown;
  replayClips?: unknown;
  sessionDuration?: unknown;
  sessionId?: unknown;
  trackingTimeline?: unknown;
};

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sanitizeEvents(events: unknown): ReviewEvent[] {
  if (!Array.isArray(events)) return [];

  return events.slice(0, 120).map((event) => {
    const candidate = event && typeof event === "object" ? (event as Record<string, unknown>) : {};

    return {
      athleteName: typeof candidate.athleteName === "string" ? candidate.athleteName : undefined,
      label: typeof candidate.label === "string" ? candidate.label : undefined,
      timestamp: typeof candidate.timestamp === "string" ? candidate.timestamp : undefined,
      type: typeof candidate.type === "string" ? candidate.type : undefined,
    };
  });
}

function sanitizeTimeline(timeline: unknown): ReviewTimelineSample[] {
  if (!Array.isArray(timeline)) return [];

  return timeline.slice(0, 720).map((sample) => {
    const candidate = sample && typeof sample === "object" ? (sample as Record<string, unknown>) : {};

    return {
      distanceTraveled: getNumber(candidate.distanceTraveled),
      entered: Boolean(candidate.entered),
      exited: Boolean(candidate.exited),
      moving: Boolean(candidate.moving),
      stationary: Boolean(candidate.stationary),
      timestamp: typeof candidate.timestamp === "string" ? candidate.timestamp : undefined,
      tracked: Boolean(candidate.tracked),
      trackingLost: Boolean(candidate.trackingLost),
      trackingRecovered: Boolean(candidate.trackingRecovered),
      visible: Boolean(candidate.visible),
    };
  });
}

function sanitizeClips(clips: unknown): ReviewClip[] {
  if (!Array.isArray(clips)) return [];

  return clips.slice(0, 40).map((clip) => {
    const candidate = clip && typeof clip === "object" ? (clip as Record<string, unknown>) : {};

    return {
      clipEnd: getNumber(candidate.clipEnd),
      clipStart: getNumber(candidate.clipStart),
      eventType: typeof candidate.eventType === "string" ? candidate.eventType : undefined,
      replayLabel: typeof candidate.replayLabel === "string" ? candidate.replayLabel : undefined,
    };
  });
}

function hasReplayEvidence(events: ReviewEvent[], movementTimeline: ReviewTimelineSample[], trackingTimeline: ReviewTimelineSample[]) {
  return events.length > 0 || movementTimeline.length > 0 || trackingTimeline.length > 0;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json({ error: "Review is not configured." }, { status: 503 });
  }

  const body = (await request.json()) as ReviewRequestBody;
  const eventTimeline = sanitizeEvents(body.eventTimeline);
  const movementTimeline = sanitizeTimeline(body.movementTimeline);
  const trackingTimeline = sanitizeTimeline(body.trackingTimeline);
  const replayClips = sanitizeClips(body.replayClips);
  const sessionDuration = getNumber(body.sessionDuration);
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "axis-session";

  if (!hasReplayEvidence(eventTimeline, movementTimeline, trackingTimeline)) {
    return Response.json({
      review: {
        generatedAt: new Date().toISOString(),
        largestInterruption: "No interruption recorded.",
        mostActiveMoment: "No active moment recorded.",
        notableEvents: [],
        reviewNotes: ["Not enough replay events were recorded to review this session."],
        sessionSummary: "Session saved. Replay review will improve as events are recorded.",
      },
    });
  }

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.create({
      input: JSON.stringify({
        eventTimeline,
        movementTimeline,
        replayClips,
        sessionDuration,
        sessionId,
        trackingTimeline,
      }),
      instructions:
        "You are the Axis review engine. Interpret only the recorded replay evidence provided. Do not create measurements, infer emotions, invent causes, invent events, or use data that is not present. Do not use analytics jargon. Produce concise sports review language for a coach, parent, or athlete. Focus on what happened in the replay: session summary, most active moment, largest interruption, notable events, and review notes.",
      max_output_tokens: 700,
      model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
      store: false,
      text: {
        format: {
          name: "axis_replay_review",
          schema: {
            additionalProperties: false,
            properties: {
              largestInterruption: {
                type: "string",
              },
              mostActiveMoment: {
                type: "string",
              },
              notableEvents: {
                items: {
                  type: "string",
                },
                maxItems: 5,
                type: "array",
              },
              reviewNotes: {
                items: {
                  type: "string",
                },
                maxItems: 5,
                type: "array",
              },
              sessionSummary: {
                type: "string",
              },
            },
            required: ["sessionSummary", "mostActiveMoment", "largestInterruption", "notableEvents", "reviewNotes"],
            type: "object",
          },
          strict: true,
          type: "json_schema",
        },
      },
    });
    const review = JSON.parse(response.output_text) as Record<string, unknown>;

    return Response.json({
      review: {
        generatedAt: new Date().toISOString(),
        largestInterruption:
          typeof review.largestInterruption === "string" ? review.largestInterruption : "No interruption recorded.",
        mostActiveMoment: typeof review.mostActiveMoment === "string" ? review.mostActiveMoment : "No active moment recorded.",
        notableEvents: Array.isArray(review.notableEvents)
          ? review.notableEvents.filter((event): event is string => typeof event === "string").slice(0, 5)
          : [],
        reviewNotes: Array.isArray(review.reviewNotes)
          ? review.reviewNotes.filter((note): note is string => typeof note === "string").slice(0, 5)
          : [],
        sessionSummary: typeof review.sessionSummary === "string" ? review.sessionSummary : "Session reviewed.",
      },
    });
  } catch (error) {
    console.error("Unable to generate Axis review", error);
    return Response.json({ error: "Review unavailable." }, { status: 502 });
  }
}
