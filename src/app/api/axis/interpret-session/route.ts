import OpenAI from "openai";

export const runtime = "nodejs";

type TimelineSummary = {
  directionChanges?: number;
  distanceTraveled?: number;
  entries?: number;
  exits?: number;
  timeMovingSeconds?: number;
  timeStationarySeconds?: number;
  timeTrackedSeconds?: number;
  timeVisibleSeconds?: number;
  trackingLosses?: number;
  trackingRecoveries?: number;
};

type TimelineSample = {
  directionChanges?: number;
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

type InterpretRequestBody = {
  durationSeconds?: unknown;
  sessionId?: unknown;
  timeline?: unknown;
  timelineSummary?: unknown;
};

const allowedSummaryKeys = [
  "directionChanges",
  "distanceTraveled",
  "entries",
  "exits",
  "timeMovingSeconds",
  "timeStationarySeconds",
  "timeTrackedSeconds",
  "timeVisibleSeconds",
  "trackingLosses",
  "trackingRecoveries",
] as const;

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sanitizeSummary(summary: unknown): TimelineSummary {
  if (!summary || typeof summary !== "object") return {};

  const candidate = summary as Record<string, unknown>;

  return allowedSummaryKeys.reduce<TimelineSummary>((cleanSummary, key) => {
    cleanSummary[key] = getNumber(candidate[key]);
    return cleanSummary;
  }, {});
}

function sanitizeTimeline(timeline: unknown): TimelineSample[] {
  if (!Array.isArray(timeline)) return [];

  return timeline.slice(0, 720).map((sample) => {
    const candidate = sample && typeof sample === "object" ? (sample as Record<string, unknown>) : {};

    return {
      directionChanges: getNumber(candidate.directionChanges),
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

function hasRecordedMeasurements(summary: TimelineSummary, timeline: TimelineSample[]) {
  return (
    timeline.length > 0 &&
    (getNumber(summary.timeVisibleSeconds) > 0 ||
      getNumber(summary.timeTrackedSeconds) > 0 ||
      getNumber(summary.timeMovingSeconds) > 0 ||
      getNumber(summary.distanceTraveled) > 0 ||
      getNumber(summary.directionChanges) > 0 ||
      getNumber(summary.trackingLosses) > 0 ||
      getNumber(summary.trackingRecoveries) > 0)
  );
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json({ error: "Interpretation is not configured." }, { status: 503 });
  }

  const body = (await request.json()) as InterpretRequestBody;
  const timelineSummary = sanitizeSummary(body.timelineSummary);
  const timeline = sanitizeTimeline(body.timeline);
  const durationSeconds = getNumber(body.durationSeconds);
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "axis-session";

  if (!hasRecordedMeasurements(timelineSummary, timeline)) {
    return Response.json({
      insights: [
        {
          evidence: {
            metric: "timeline",
            value: timeline.length,
          },
          text: "Not enough recorded movement to interpret.",
        },
      ],
    });
  }

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.create({
      input: JSON.stringify({
        durationSeconds,
        sessionId,
        timeline,
        timelineSummary,
      }),
      instructions:
        "You interpret only recorded Axis movement measurements. Do not invent data, causes, emotions, pressure, engagement, influence, momentum, or coaching judgments. Use only the provided summary and per-second samples. If a claim cannot be tied to supplied timestamps or supplied totals, omit it. Return concise, plain sports-equipment language.",
      max_output_tokens: 500,
      model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
      store: false,
      text: {
        format: {
          name: "axis_movement_interpretation",
          schema: {
            additionalProperties: false,
            properties: {
              insights: {
                items: {
                  additionalProperties: false,
                  properties: {
                    evidence: {
                      additionalProperties: false,
                      properties: {
                        endTimestamp: {
                          type: ["string", "null"],
                        },
                        metric: {
                          type: "string",
                        },
                        startTimestamp: {
                          type: ["string", "null"],
                        },
                        value: {
                          type: ["number", "string"],
                        },
                      },
                      required: ["metric", "value", "startTimestamp", "endTimestamp"],
                      type: "object",
                    },
                    text: {
                      type: "string",
                    },
                  },
                  required: ["text", "evidence"],
                  type: "object",
                },
                maxItems: 4,
                type: "array",
              },
            },
            required: ["insights"],
            type: "object",
          },
          strict: true,
          type: "json_schema",
        },
      },
    });

    return Response.json(JSON.parse(response.output_text));
  } catch (error) {
    console.error("Unable to generate Axis interpretation", error);
    return Response.json({ error: "Interpretation unavailable." }, { status: 502 });
  }
}
