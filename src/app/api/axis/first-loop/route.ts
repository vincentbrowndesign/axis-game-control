import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { tasks } from "@trigger.dev/sdk/v3";

export const runtime = "nodejs";

type LoopAction = "understand" | "artifact" | "export";
type ArtifactOutcome = "observe" | "improve" | "share" | "extend";

type LoopRequestBody = {
  action?: unknown;
  artifact?: unknown;
  destination?: unknown;
  fileName?: unknown;
  muxPlaybackId?: unknown;
  notes?: unknown;
  outcome?: unknown;
  priorArtifacts?: unknown;
  sessionId?: unknown;
  sourceClipCount?: unknown;
  uploadId?: unknown;
  uploadTimestamp?: unknown;
  userId?: unknown;
  whatWeFound?: unknown;
};

type ArtifactPayload = {
  body: string;
  createdAt: string;
  id: string;
  outcome: ArtifactOutcome;
  sourceClipCount: number;
  title: string;
  uploadId: string;
  whatWeFound: string;
};

const outcomeTitles: Record<ArtifactOutcome, string> = {
  extend: "Next Prompt",
  improve: "Training Focus",
  observe: "What We Found",
  share: "Share Story",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function getNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getOutcome(value: unknown): ArtifactOutcome | null {
  return value === "observe" || value === "improve" || value === "share" || value === "extend" ? value : null;
}

function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function insertSupabase(table: string, values: Record<string, unknown>) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { stored: false, reason: "supabase_not_configured" };

  const { error } = await supabase.from(table).insert(values);
  if (error) {
    console.warn(`Axis first loop could not write ${table}`, error.message);
    return { stored: false, reason: error.message };
  }

  return { stored: true };
}

function fallbackUnderstanding(fileName: string, sourceClipCount: number) {
  const clipLabel = sourceClipCount === 1 ? "clip" : "clips";
  return [
    `${sourceClipCount || 1} ${clipLabel} added from ${fileName || "practice film"}.`,
    "Axis found an early practice signal worth saving.",
    "Choose an outcome to turn this into a usable artifact.",
  ].join(" ");
}

async function generateUnderstanding(body: LoopRequestBody) {
  const fileName = getString(body.fileName, "practice film");
  const sourceClipCount = Math.max(1, getNumber(body.sourceClipCount, 1));
  const uploadTimestamp = getString(body.uploadTimestamp, new Date().toISOString());
  const sessionId = getString(body.sessionId, "axis-session");
  const notes = getString(body.notes);
  const priorArtifacts = Array.isArray(body.priorArtifacts)
    ? body.priorArtifacts.filter((item): item is string => typeof item === "string").slice(0, 4)
    : [];

  let whatWeFound = fallbackUnderstanding(fileName, sourceClipCount);
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey) {
    try {
      const openai = new OpenAI({ apiKey });
      const response = await openai.responses.create({
        input: JSON.stringify({
          fileName,
          notes,
          priorArtifacts,
          sessionId,
          sourceClipCount,
          uploadTimestamp,
        }),
        instructions:
          "You write only useful Axis practice understanding from supplied upload metadata. Do not mention AI, confidence, datasets, models, providers, JSON, files, scoring, or internal IDs. Do not pretend to see video content. If metadata is sparse, say it is an early signal and make the next action useful. Return 2-3 short plain sentences under WHAT WE FOUND.",
        max_output_tokens: 220,
        model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
        store: false,
      });
      whatWeFound = response.output_text.trim() || whatWeFound;
    } catch (error) {
      console.error("Axis first loop understanding unavailable", error);
    }
  }

  const uploadId = getString(body.uploadId, `upload-${crypto.randomUUID()}`);
  await insertSupabase("axis_uploads", {
    file_name: fileName,
    id: uploadId,
    mux_playback_id: getString(body.muxPlaybackId) || null,
    session_id: sessionId,
    source_clip_count: sourceClipCount,
    uploaded_at: uploadTimestamp,
    user_id: getString(body.userId) || null,
    what_we_found: whatWeFound,
  });

  return Response.json({
    sourceClipCount,
    uploadId,
    uploadTimestamp,
    whatWeFound,
  });
}

function buildArtifactBody(outcome: ArtifactOutcome, whatWeFound: string, sourceClipCount: number) {
  if (outcome === "improve") {
    return [
      "Training Focus",
      "",
      whatWeFound,
      "",
      `Next session: keep the camera rolling and repeat the same action for ${Math.max(8, sourceClipCount * 2)} reps.`,
      "Save one clean make, one miss, and one correction so tomorrow has a comparison point.",
    ].join("\n");
  }

  if (outcome === "share") {
    return [
      "Share Story",
      "",
      whatWeFound,
      "",
      "Use this as the short caption and attach the best clip from the session.",
    ].join("\n");
  }

  if (outcome === "extend") {
    return [
      "Next Prompt",
      "",
      whatWeFound,
      "",
      "Next upload: add another clip from the same drill so Axis can compare today against tomorrow.",
    ].join("\n");
  }

  return ["What We Found", "", whatWeFound].join("\n");
}

async function generateArtifact(body: LoopRequestBody) {
  const outcome = getOutcome(body.outcome);
  if (!outcome) return Response.json({ error: "Unknown outcome." }, { status: 400 });

  const whatWeFound = getString(body.whatWeFound);
  if (!whatWeFound) return Response.json({ error: "Understanding is required." }, { status: 400 });

  const sourceClipCount = Math.max(1, getNumber(body.sourceClipCount, 1));
  const uploadId = getString(body.uploadId, `upload-${crypto.randomUUID()}`);
  const artifact: ArtifactPayload = {
    body: buildArtifactBody(outcome, whatWeFound, sourceClipCount),
    createdAt: new Date().toISOString(),
    id: `artifact-${crypto.randomUUID()}`,
    outcome,
    sourceClipCount,
    title: outcomeTitles[outcome],
    uploadId,
    whatWeFound,
  };

  await insertSupabase("axis_artifacts", {
    body: artifact.body,
    created_at: artifact.createdAt,
    id: artifact.id,
    outcome,
    source_clip_count: sourceClipCount,
    title: artifact.title,
    upload_id: uploadId,
    what_we_found: whatWeFound,
  });

  return Response.json({ artifact });
}

function artifactFromUnknown(value: unknown): ArtifactPayload | null {
  if (!isRecord(value)) return null;
  const outcome = getOutcome(value.outcome);
  if (!outcome) return null;

  return {
    body: getString(value.body),
    createdAt: getString(value.createdAt, new Date().toISOString()),
    id: getString(value.id, `artifact-${crypto.randomUUID()}`),
    outcome,
    sourceClipCount: Math.max(1, getNumber(value.sourceClipCount, 1)),
    title: getString(value.title, outcomeTitles[outcome]),
    uploadId: getString(value.uploadId, `upload-${crypto.randomUUID()}`),
    whatWeFound: getString(value.whatWeFound),
  };
}

async function exportArtifact(body: LoopRequestBody) {
  const artifact = artifactFromUnknown(body.artifact);
  if (!artifact) return Response.json({ error: "Artifact is required." }, { status: 400 });

  const destination = getString(body.destination, "download");
  const exportId = `export-${crypto.randomUUID()}`;
  const fileName = `${artifact.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}.md`;
  const content = artifact.body;

  let triggerRunId: string | null = null;
  try {
    const handle = await tasks.trigger("finalize-work", {
      events: [],
      exportQueue: [{ label: artifact.title, sourceCount: artifact.sourceClipCount, status: "available", type: destination }],
      film: { moments: [], status: "unavailable", workId: artifact.uploadId },
      pipeline: [{ capability: "artifact_export", outputs: [artifact.title], provider: "trigger", sourceCount: 1, status: "available" }],
      results: {
        attempts: 0,
        durationSeconds: 0,
        eventsCount: 0,
        fieldGoalPercentage: null,
        filmMomentsCount: 0,
        makes: 0,
        misses: 0,
      },
      work: {
        endedAt: new Date().toISOString(),
        id: artifact.uploadId,
        participantIds: [],
        startedAt: artifact.createdAt,
        status: "complete",
        type: "artifact_export",
      },
    });
    triggerRunId = handle.id;
  } catch (error) {
    console.error("Axis first loop export queue unavailable", error);
  }

  await insertSupabase("axis_exports", {
    artifact_id: artifact.id,
    content,
    created_at: new Date().toISOString(),
    destination,
    file_name: fileName,
    id: exportId,
    trigger_run_id: triggerRunId,
  });

  return Response.json({
    export: {
      content,
      contentType: "text/markdown;charset=utf-8",
      destination,
      fileName,
      id: exportId,
      triggerRunId,
    },
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as LoopRequestBody | null;
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });

  const action = getString(body.action) as LoopAction;
  if (action === "understand") return generateUnderstanding(body);
  if (action === "artifact") return generateArtifact(body);
  if (action === "export") return exportArtifact(body);

  return Response.json({ error: "Unknown loop action." }, { status: 400 });
}
