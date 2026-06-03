import OpenAI from "openai";
import { tasks } from "@trigger.dev/sdk/v3";
import {
  decodeAndPersistRealityFacts,
  buildHistoricalMeaningWithClaude,
  factsToPlainLanguage,
  getMuxPlaybackUrl,
  getStoredRealityFacts,
  type AxisDecodedFact,
  type AxisEntityTrack,
} from "../../../../lib/axis-reality-decoder";
import {
  getAxisArtifactFactHistory,
  getAxisArtifactHistory,
  persistAxisArtifactFacts,
  persistAxisArtifact,
  persistAxisExport,
  type AxisArtifactFactRecord,
  type AxisArtifactRecord,
} from "../../../../lib/axis-persistence";

export const runtime = "nodejs";

type LoopAction = "understand" | "artifact" | "export" | "save";
type ArtifactOutcome = "observe" | "improve" | "share" | "extend";

type LoopRequestBody = {
  action?: unknown;
  artifact?: unknown;
  destination?: unknown;
  fileName?: unknown;
  facts?: unknown;
  muxPlaybackId?: unknown;
  notes?: unknown;
  outcome?: unknown;
  priorArtifacts?: unknown;
  sessionId?: unknown;
  sourceClipCount?: unknown;
  uploadId?: unknown;
  uploadTimestamp?: unknown;
  userId?: unknown;
  videoUrl?: unknown;
  whatWeFound?: unknown;
};

type ArtifactPayload = {
  body: string;
  createdAt: string;
  facts: AxisFactInput[];
  id: string;
  outcome: ArtifactOutcome;
  sourceClipCount: number;
  title: string;
  uploadId: string;
  whatWeFound: string;
};

type AxisFactInput = {
  fact_key: string;
  fact_label: string;
  fact_text_value: string | null;
  fact_unit: string;
  fact_value: number;
  sample_size: number;
  source?: string | null;
  support_level?: "strong" | "medium" | "weak" | null;
  temporal_support?: string | null;
  verification_status?: "accepted" | "needs_review" | "rejected" | null;
};

const outcomeTitles: Record<ArtifactOutcome, string> = {
  extend: "Next Prompt",
  improve: "Training Focus",
  observe: "What We Found",
  share: "Share Story",
};

type PriorArtifactSummary = {
  artifact_body: string;
  artifact_title: string;
  artifact_type: string;
  source_clip_count: number;
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

function fallbackUnderstanding(fileName: string, sourceClipCount: number) {
  const clipLabel = sourceClipCount === 1 ? "clip" : "clips";
  return [
    `${sourceClipCount || 1} ${clipLabel} added from ${fileName || "practice film"}.`,
    "Axis found an early practice signal worth saving.",
    "Choose an outcome to turn this into a usable artifact.",
  ].join(" ");
}

function factBackedUnderstanding(facts: AxisDecodedFact[], sourceClipCount: number) {
  const factLanguage = factsToPlainLanguage(facts);
  if (!factLanguage) return "";

  const clipLabel = sourceClipCount === 1 ? "clip" : "clips";
  return [
    `${sourceClipCount} ${clipLabel} decoded: ${factLanguage}.`,
    "Axis found an early practice signal worth saving.",
    "Choose an outcome to turn this into a usable artifact.",
  ].join(" ");
}

async function generateUnderstanding(body: LoopRequestBody) {
  const fileName = getString(body.fileName, "practice film");
  const sourceClipCount = Math.max(1, getNumber(body.sourceClipCount, 1));
  const uploadTimestamp = getString(body.uploadTimestamp, new Date().toISOString());
  const sessionId = getString(body.sessionId, "axis-session");
  const uploadId = getString(body.uploadId, `upload-${crypto.randomUUID()}`);
  const muxPlaybackId = getString(body.muxPlaybackId);
  const videoUrl = getString(body.videoUrl) || getMuxPlaybackUrl(muxPlaybackId);
  const notes = getString(body.notes);
  const metadataFacts = extractFactsFromInputs({
    fileName,
    notes,
    sessionId,
    sourceClipCount,
  });
  let decodedFacts: AxisDecodedFact[] = [];
  let tracks: AxisEntityTrack[] = [];
  if (videoUrl || muxPlaybackId) {
    console.log("DECODE_STARTED", {
      action: "understand",
      hasMuxPlaybackId: Boolean(muxPlaybackId),
      hasVideoUrl: Boolean(videoUrl),
      uploadId,
    });
    const decoded = await decodeAndPersistRealityFacts({
      artifactId: `decode-${uploadId}`,
      muxPlaybackId,
      sourceClipCount,
      uploadId,
      videoUrl,
    });
    decodedFacts = decoded.facts;
    tracks = decoded.tracks;
  }
  if (videoUrl || muxPlaybackId) {
    console.log("DECODE_COMPLETE", {
      action: "understand",
      factCount: decodedFacts.length,
      uploadId,
    });
  }
  const extractedFacts = decodedFacts.length ? decodedFacts : metadataFacts;
  const clientPriorArtifacts = Array.isArray(body.priorArtifacts)
    ? body.priorArtifacts.filter((item): item is string => typeof item === "string").slice(0, 4)
    : [];
  const storedPriorArtifacts = await getPriorArtifacts(uploadId);
  const priorArtifacts = [
    ...storedPriorArtifacts.map((artifact) => ({
      body: artifact.artifact_body,
      sourceClipCount: artifact.source_clip_count,
      title: artifact.artifact_title,
      type: artifact.artifact_type,
    })),
    ...clientPriorArtifacts.map((artifact) => ({ body: artifact, title: "Previous output" })),
  ].slice(0, 4);

  let whatWeFound = factBackedUnderstanding(decodedFacts, sourceClipCount) || fallbackUnderstanding(fileName, sourceClipCount);
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey) {
    try {
      const openai = new OpenAI({ apiKey });
      const response = await openai.responses.create({
        input: JSON.stringify({
          facts: extractedFacts,
          fileName,
          notes,
          priorArtifacts,
          sessionId,
          sourceClipCount,
          uploadTimestamp,
        }),
        instructions:
          "You write only useful Axis practice understanding from supplied stored facts and upload metadata. Do not mention AI, confidence, datasets, models, providers, JSON, files, scoring, or internal IDs. Use stored facts first. If facts are sparse, say it is an early signal and make the next action useful. Return 2-3 short plain sentences under WHAT WE FOUND.",
        max_output_tokens: 220,
        model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
        store: false,
      });
      whatWeFound = response.output_text.trim() || whatWeFound;
      console.log("OPENAI_COMPLETE", { action: "understand", status: "PASS", uploadId });
    } catch (error) {
      console.error("OPENAI_COMPLETE", {
        action: "understand",
        reason: error instanceof Error ? error.message : String(error),
        status: "FAIL",
        uploadId,
      });
      console.error("Axis first loop understanding unavailable", error);
    }
  } else {
    console.log("OPENAI_COMPLETE", { action: "understand", reason: "OPENAI_API_KEY missing", status: "FAIL", uploadId });
  }

  return Response.json({
    sourceClipCount,
    facts: extractedFacts,
    muxPlaybackId,
    tracks,
    uploadId,
    uploadTimestamp,
    videoUrl,
    whatWeFound,
  });
}

async function buildArtifactBody(
  outcome: ArtifactOutcome,
  whatWeFound: string,
  sourceClipCount: number,
  priorArtifacts: PriorArtifactSummary[],
  currentFacts: AxisFactInput[],
  priorFacts: AxisArtifactFactRecord[],
) {
  const comparison = await buildHistoricalComparison(outcome, sourceClipCount, priorArtifacts, currentFacts, priorFacts);
  const withComparison = (lines: string[]) => [...lines, ...comparison].join("\n");
  const basketballFactBody = buildBasketballFactArtifactBody(currentFacts);
  if (basketballFactBody) return withComparison(basketballFactBody);

  if (outcome === "improve") {
    return withComparison([
      "Training Focus",
      "",
      whatWeFound,
      "",
      `Next session: keep the camera rolling and repeat the same action for ${Math.max(8, sourceClipCount * 2)} reps.`,
      "Save one clean make, one miss, and one correction so tomorrow has a comparison point.",
    ]);
  }

  if (outcome === "share") {
    return withComparison([
      "Share Story",
      "",
      whatWeFound,
      "",
      "Use this as the short caption and attach the best clip from the session.",
    ]);
  }

  if (outcome === "extend") {
    return withComparison([
      "Next Prompt",
      "",
      whatWeFound,
      "",
      "Next upload: add another clip from the same drill so Axis can compare today against tomorrow.",
    ]);
  }

  return withComparison(["What We Found", "", whatWeFound]);
}

function buildBasketballFactArtifactBody(facts: AxisFactInput[]) {
  const supported = facts.filter((fact) => fact.verification_status !== "rejected");
  const hasBasketballFacts = ["shot_attempt", "make_miss", "paint_touch", "drive"].some((key) =>
    supported.some((fact) => fact.fact_key === key),
  );
  if (!hasBasketballFacts) return null;

  const paintTouches = formatBinaryCount(supported, "paint_touch");
  const drives = formatBinaryCount(supported, "drive");
  const shotAttempts = formatBinaryCount(supported, "shot_attempt");
  const makes = formatMakes(supported);

  return [
    "What We Found",
    "",
    `Paint Touches: ${paintTouches}`,
    `Drives: ${drives}`,
    `Shot Attempts: ${shotAttempts}`,
    `Makes: ${makes}`,
    "",
    "What It Means",
    "",
    ...buildBasketballMeaning(supported),
    "",
    "What To Do Next",
    "",
    ...buildBasketballNextStep(supported),
  ];
}

function formatBinaryCount(facts: AxisFactInput[], factKey: string) {
  const fact = facts.find((item) => item.fact_key === factKey);
  if (!fact) return "not established";
  const value = fact.fact_value === 1 ? "1" : "0";
  return fact.verification_status === "needs_review" ? `appears to be ${value}` : value;
}

function formatMakes(facts: AxisFactInput[]) {
  const fact = facts.find((item) => item.fact_key === "make_miss");
  if (!fact?.fact_text_value || fact.fact_text_value === "unknown") {
    return fact?.verification_status === "needs_review" ? "appears unknown" : "unknown";
  }
  const value = fact.fact_text_value === "make" ? "1" : "0";
  return fact.verification_status === "needs_review" ? `appears to be ${value}` : value;
}

function buildBasketballMeaning(facts: AxisFactInput[]) {
  const lines: string[] = [];
  const shotAttempt = facts.find((fact) => fact.fact_key === "shot_attempt");
  const makeMiss = facts.find((fact) => fact.fact_key === "make_miss");
  const paintTouch = facts.find((fact) => fact.fact_key === "paint_touch");
  const drive = facts.find((fact) => fact.fact_key === "drive");

  if (paintTouch) lines.push(qualitySentence(paintTouch, paintTouch.fact_value === 1 ? "The ball reached the paint." : "No paint touch was verified."));
  if (drive) lines.push(qualitySentence(drive, drive.fact_value === 1 ? "The clip includes a downhill drive." : "No drive was verified."));
  if (shotAttempt) {
    lines.push(qualitySentence(shotAttempt, shotAttempt.fact_value === 1 ? "The possession produced a shot attempt." : "No shot attempt was verified."));
  }
  if (makeMiss?.fact_text_value === "make") lines.push(qualitySentence(makeMiss, "The shot result was a make."));
  if (makeMiss?.fact_text_value === "miss") lines.push(qualitySentence(makeMiss, "The shot result was a miss."));
  if (makeMiss?.fact_text_value === "unknown") lines.push("The shot result is not visible enough to call.");

  return lines.length ? lines : ["No supported basketball pattern is established yet."];
}

function buildBasketballNextStep(facts: AxisFactInput[]) {
  const needsReview = facts.some((fact) => fact.verification_status === "needs_review");
  const shotAttempt = facts.find((fact) => fact.fact_key === "shot_attempt");
  const makeMiss = facts.find((fact) => fact.fact_key === "make_miss");
  const lines: string[] = [];

  if (needsReview) {
    lines.push("Use another clear clip of the same action to verify the early signal.");
  }
  if (shotAttempt?.fact_value === 1 && makeMiss?.fact_text_value === "unknown") {
    lines.push("Capture the rim through the end of the shot so the result can be verified.");
  }

  return lines.length ? lines : ["Keep the next clip framed on the ball and rim so these same facts can be compared."];
}

function qualitySentence(fact: AxisFactInput, sentence: string) {
  if (fact.verification_status !== "needs_review") return sentence;
  return `Early signal: ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`;
}

async function generateArtifact(body: LoopRequestBody) {
  const outcome = getOutcome(body.outcome);
  if (!outcome) return Response.json({ error: "Unknown outcome." }, { status: 400 });

  const whatWeFound = getString(body.whatWeFound);
  if (!whatWeFound) return Response.json({ error: "Understanding is required." }, { status: 400 });

  const sourceClipCount = Math.max(1, getNumber(body.sourceClipCount, 1));
  const uploadId = getString(body.uploadId, `upload-${crypto.randomUUID()}`);
  const muxPlaybackId = getString(body.muxPlaybackId);
  const videoUrl = getString(body.videoUrl) || getMuxPlaybackUrl(muxPlaybackId);
  const artifactId = `artifact-${crypto.randomUUID()}`;
  if (videoUrl || muxPlaybackId) {
    await decodeAndPersistRealityFacts({
      artifactId,
      muxPlaybackId,
      sourceClipCount,
      uploadId,
      videoUrl,
    });
  }
  const priorArtifacts = await getPriorArtifacts(uploadId);
  const storedRealityFacts = await getStoredRealityFacts(uploadId);
  const fallbackFacts = extractFactsFromInputs({
    artifactType: outcome,
    notes: whatWeFound,
    sourceClipCount,
  });
  const currentFacts = sanitizeFacts(
    storedRealityFacts.length
      ? [
          ...storedRealityFacts,
          ...extractFactsFromInputs({
            artifactType: outcome,
            sourceClipCount,
          }),
        ]
      : [...fallbackFacts, ...getArray(body.facts)],
    sourceClipCount,
  );
  const priorFacts = await getPriorFacts(uploadId, currentFacts.map((fact) => fact.fact_key));
  const artifactFacts = factsForArtifact(currentFacts);
  const artifact: ArtifactPayload = {
    body: await buildArtifactBody(outcome, softenWhatWeFound(whatWeFound, currentFacts), sourceClipCount, priorArtifacts, artifactFacts, priorFacts),
    createdAt: new Date().toISOString(),
    facts: artifactFacts,
    id: artifactId,
    outcome,
    sourceClipCount,
    title: outcomeTitles[outcome],
    uploadId,
    whatWeFound,
  };

  const persistence = await persistArtifactPayload(artifact);
  if (!persistence.stored) return Response.json({ error: persistence.reason }, { status: 502 });
  const factPersistence = await persistArtifactFacts(artifact);
  if (!factPersistence.stored) return Response.json({ error: factPersistence.reason }, { status: 502 });

  return Response.json({ artifact, stored: true });
}

async function getPriorArtifacts(uploadId: string): Promise<PriorArtifactSummary[]> {
  const history = await getAxisArtifactHistory({ limit: 3, uploadId });
  if (history.error) return [];

  return history.records.map((artifact) => ({
    artifact_body: artifact.artifact_body,
    artifact_title: artifact.artifact_title,
    artifact_type: artifact.artifact_type,
    source_clip_count: artifact.source_clip_count,
  }));
}

async function buildHistoricalComparison(
  outcome: ArtifactOutcome,
  sourceClipCount: number,
  priorArtifacts: PriorArtifactSummary[],
  currentFacts: AxisFactInput[],
  priorFacts: AxisArtifactFactRecord[],
) {
  if (!priorArtifacts.length) return [];

  const acceptedCurrentFacts = currentFacts.filter((fact) => fact.verification_status === "accepted");
  const acceptedPriorFacts = priorFacts.filter((fact) => fact.verification_status === "accepted");
  const factComparisons = buildFactComparisons(acceptedCurrentFacts, acceptedPriorFacts);
  const historicalMeaning = await buildHistoricalMeaningWithClaude({
    currentFacts: acceptedCurrentFacts,
    priorFacts: acceptedPriorFacts,
  });

  const prior = priorArtifacts[0];
  const changed: string[] = [];
  const stayed: string[] = [];

  if (prior.artifact_type !== outcome) {
    changed.push(`The requested outcome changed from ${formatArtifactType(prior.artifact_type)} to ${formatArtifactType(outcome)}.`);
  }

  if (prior.source_clip_count !== sourceClipCount) {
    changed.push(`The source clip count changed from ${prior.source_clip_count} to ${sourceClipCount}.`);
  } else {
    stayed.push(`The source clip count stayed at ${sourceClipCount}.`);
  }

  if (prior.artifact_type === outcome) {
    stayed.push(`The outcome stayed ${formatArtifactType(outcome)}.`);
  }

  if (!changed.length && !stayed.length) {
    return ["", "History", "", "Not enough history yet to compare."];
  }

  if (!factComparisons.length) {
    return [
      "",
      "History",
      "",
      "Not enough history yet to compare.",
    ];
  }

  return [
    "",
    "History",
    "",
    ...factComparisons,
    ...(historicalMeaning ? [historicalMeaning] : []),
    "What remains unresolved: The available record does not show whether the underlying practice pattern changed.",
  ];
}

function buildFactComparisons(currentFacts: AxisFactInput[], priorFacts: AxisArtifactFactRecord[]) {
  const priorByKey = new Map<string, AxisArtifactFactRecord>();

  for (const priorFact of priorFacts) {
    if (!priorByKey.has(priorFact.fact_key)) priorByKey.set(priorFact.fact_key, priorFact);
  }

  return currentFacts
    .map((fact) => {
      const prior = priorByKey.get(fact.fact_key);
      if (!prior) return null;
      return `${fact.fact_label}: ${formatFact(prior)} \u2192 ${formatFact(fact)}`;
    })
    .filter((line): line is string => Boolean(line));
}

function formatFact(fact: Pick<AxisArtifactFactRecord, "fact_text_value" | "fact_unit" | "fact_value"> | AxisFactInput) {
  if (fact.fact_text_value) return fact.fact_text_value;
  return formatFactValue(Number(fact.fact_value), fact.fact_unit);
}

function formatFactValue(value: number, unit: string) {
  if (unit === "%") return `${Math.round(value)}%`;
  return `${Number.isInteger(value) ? value : Number(value.toFixed(1))}${unit ? ` ${unit}` : ""}`;
}

function formatArtifactType(type: string) {
  if (type === "improve") return "Improve";
  if (type === "share") return "Share";
  if (type === "extend") return "Extend";
  return "Observe";
}

function artifactFromUnknown(value: unknown): ArtifactPayload | null {
  if (!isRecord(value)) return null;
  const outcome = getOutcome(value.outcome);
  if (!outcome) return null;

  return {
    body: getString(value.body),
    createdAt: getString(value.createdAt, new Date().toISOString()),
    facts: sanitizeFacts((value as Record<string, unknown>).facts, Math.max(1, getNumber(value.sourceClipCount, 1))),
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

  const artifactPersistence = await persistArtifactPayload(artifact);
  if (!artifactPersistence.stored) return Response.json({ error: artifactPersistence.reason }, { status: 502 });
  const factPersistence = await persistArtifactFacts(artifact);
  if (!factPersistence.stored) return Response.json({ error: factPersistence.reason }, { status: 502 });

  const exportPersistence = await persistAxisExport({
    artifact_id: artifact.id,
    created_at: new Date().toISOString(),
    destination,
    export_id: exportId,
    export_type: destination,
  });
  if (!exportPersistence.stored) return Response.json({ error: exportPersistence.reason }, { status: 502 });

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

async function saveArtifact(body: LoopRequestBody) {
  const artifact = artifactFromUnknown(body.artifact);
  if (!artifact) return Response.json({ error: "Artifact is required." }, { status: 400 });

  const persistence = await persistArtifactPayload(artifact);
  if (!persistence.stored) return Response.json({ error: persistence.reason }, { status: 502 });
  const factPersistence = await persistArtifactFacts(artifact);
  if (!factPersistence.stored) return Response.json({ error: factPersistence.reason }, { status: 502 });

  return Response.json({ artifact, stored: true });
}

function artifactRecordFromPayload(artifact: ArtifactPayload): AxisArtifactRecord {
  return {
    artifact_body: artifact.body,
    artifact_id: artifact.id,
    artifact_title: artifact.title,
    artifact_type: artifact.outcome,
    created_at: artifact.createdAt,
    source_clip_count: artifact.sourceClipCount,
    upload_id: artifact.uploadId,
  };
}

async function persistArtifactPayload(artifact: ArtifactPayload) {
  return persistAxisArtifact(artifactRecordFromPayload(artifact));
}

function sanitizeFacts(value: unknown, sourceClipCount: number): AxisFactInput[] {
  const suppliedFacts = getArray(value)
        .map((fact): AxisFactInput | null => {
          if (!isRecord(fact)) return null;
          const factValue = getNumber(fact.fact_value);
          const sampleSize = Math.max(0, getNumber(fact.sample_size, sourceClipCount));
          const factKey = getString(fact.fact_key);
          const factLabel = getString(fact.fact_label);
          if (!factKey || !factLabel) return null;

          return {
            fact_key: factKey,
            fact_label: factLabel,
            fact_text_value: getString(fact.fact_text_value) || null,
            fact_unit: getString(fact.fact_unit),
            fact_value: factValue,
            sample_size: sampleSize,
            source: getString(fact.source) || null,
            support_level: getQualityValue(fact.support_level, ["strong", "medium", "weak"] as const),
            temporal_support: getString(fact.temporal_support) || null,
            verification_status: getQualityValue(fact.verification_status, ["accepted", "needs_review", "rejected"] as const),
          };
        })
        .filter((fact): fact is AxisFactInput => Boolean(fact));

  const uniqueFacts = Array.from(
    new Map(suppliedFacts.map((fact) => [fact.fact_key, fact])).values(),
  );

  const hasSourceClipCount = uniqueFacts.some((fact) => fact.fact_key === "source_clip_count");
  if (hasSourceClipCount) return uniqueFacts;

  return [
    ...uniqueFacts,
    {
      fact_key: "source_clip_count",
      fact_label: "Source clip count",
      fact_text_value: null,
      fact_unit: "clips",
      fact_value: sourceClipCount,
      sample_size: sourceClipCount,
      source: "axis",
      support_level: "strong",
      temporal_support: null,
      verification_status: "accepted",
    },
  ];
}

function factsForArtifact(facts: AxisFactInput[]) {
  return facts.filter((fact) => fact.verification_status !== "rejected");
}

function softenWhatWeFound(whatWeFound: string, facts: AxisFactInput[]) {
  const playerCount = facts.find((fact) => fact.fact_key === "player_count");
  if (playerCount?.verification_status !== "needs_review") return whatWeFound;

  return whatWeFound.replace(
    /\b\d+\s+visible\s+players?\b/i,
    playerCount.fact_value > 1 ? "multiple players appear visible" : "a player appears visible",
  );
}

function getQualityValue<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : null;
}

function getArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function extractFactsFromInputs({
  artifactType,
  fileName,
  notes,
  sessionId,
  sourceClipCount,
}: {
  artifactType?: ArtifactOutcome;
  fileName?: string;
  notes?: string;
  sessionId?: string;
  sourceClipCount: number;
}): AxisFactInput[] {
  const text = normalizeFactText([fileName, notes, sessionId].filter(Boolean).join(" "));
  const facts: AxisFactInput[] = [];
  const area = extractDominantArea(text);
  const action = extractAction(text);
  const outcome = extractOutcome(text);

  if (area) facts.push(createTextFact("dominant_area_guess", "Shot area", area, sourceClipCount));
  if (outcome) facts.push(createTextFact("outcome_guess", "Outcome", outcome, sourceClipCount));
  if (action) facts.push(createTextFact("action_guess", "Action", action, sourceClipCount));
  if (artifactType) {
    facts.push(createTextFact("artifact_type", "Artifact type", artifactType, sourceClipCount));
    facts.push(createTextFact("direction_type", "Direction", artifactType, sourceClipCount));
  }

  return facts;
}

function createTextFact(factKey: string, factLabel: string, value: string, sampleSize: number): AxisFactInput {
  return {
    fact_key: factKey,
    fact_label: factLabel,
    fact_text_value: value,
    fact_unit: "label",
    fact_value: 0,
    sample_size: sampleSize,
    source: "metadata",
    support_level: "weak",
    temporal_support: null,
    verification_status: "needs_review",
  };
}

function normalizeFactText(value: string) {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9% ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDominantArea(text: string) {
  if (hasAll(text, ["right", "wing"]) || text.includes("right wing")) return "right wing";
  if (hasAll(text, ["left", "wing"]) || text.includes("left wing")) return "left wing";
  if (text.includes("paint")) return "paint";
  if (text.includes("corner")) return text.includes("right") ? "right corner" : text.includes("left") ? "left corner" : "corner";
  if (text.includes("mid range") || text.includes("midrange")) return "mid range";
  if (text.includes("top of key") || text.includes("top key")) return "top of key";
  return null;
}

function extractAction(text: string) {
  if (text.includes("catch shoot") || text.includes("catch and shoot")) return "catch and shoot";
  if (text.includes("pull up") || text.includes("pullup")) return "pull up";
  if (text.includes("left hand")) return "left hand";
  if (text.includes("right hand")) return "right hand";
  if (text.includes("drive")) return "drive";
  if (text.includes("attack")) return "attack";
  return null;
}

function extractOutcome(text: string) {
  if (text.includes("make") || text.includes("made")) return "make";
  if (text.includes("miss") || text.includes("missed")) return "miss";
  return null;
}

function hasAll(text: string, tokens: string[]) {
  return tokens.every((token) => text.includes(token));
}

async function getPriorFacts(uploadId: string, factKeys: string[]) {
  const history = await getAxisArtifactFactHistory({ limit: 30, uploadId });
  if (history.error) return [];
  const keys = new Set(factKeys);
  return history.records.filter((fact) => keys.has(fact.fact_key));
}

async function persistArtifactFacts(artifact: ArtifactPayload) {
  return persistAxisArtifactFacts(
    artifact.facts.map((fact) => ({
      artifact_id: artifact.id,
      created_at: artifact.createdAt,
      fact_id: `${artifact.id}-${fact.fact_key}`,
      fact_key: fact.fact_key,
      fact_label: fact.fact_label,
      fact_text_value: fact.fact_text_value ?? null,
      fact_unit: fact.fact_unit,
      fact_value: fact.fact_value,
      sample_size: fact.sample_size,
      source: fact.source ?? null,
      support_level: fact.support_level ?? null,
      temporal_support: fact.temporal_support ?? null,
      upload_id: artifact.uploadId,
      verification_status: fact.verification_status ?? null,
    })),
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as LoopRequestBody | null;
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });

  const action = getString(body.action) as LoopAction;
  if (action === "understand") return generateUnderstanding(body);
  if (action === "artifact") return generateArtifact(body);
  if (action === "export") return exportArtifact(body);
  if (action === "save") return saveArtifact(body);

  return Response.json({ error: "Unknown loop action." }, { status: 400 });
}
