import OpenAI from "openai";
import {
  getAxisArtifactFactHistory,
  persistAxisArtifact,
  persistAxisArtifactFacts,
  type AxisArtifactFactRecord,
} from "./axis-persistence";

export type AxisDecodedFact = {
  fact_key: string;
  fact_label: string;
  fact_text_value: string | null;
  fact_unit: string;
  fact_value: number;
  sample_size: number;
  source: string;
  support_level: "strong" | "medium" | "weak";
  temporal_support: string | null;
  verification_status: "accepted" | "needs_review" | "rejected";
};

type DecodeVideoInput = {
  artifactId: string;
  muxPlaybackId?: string;
  sourceClipCount: number;
  uploadId: string;
  videoUrl?: string;
};

type EvidenceFrame = {
  base64: string;
  contentType: string;
  index: number;
  time: number;
  url: string;
};

type RawDecodedFact = {
  key: string;
  label: string;
  source?: string;
  temporalSupport?: string | null;
  textValue?: string | null;
  unit?: string;
  value?: number | null;
};

type FactCandidate = AxisDecodedFact & {
  value_signature: string;
};

type DetectionBox = {
  className: string;
  confidence?: number;
  frameIndex: number;
  height?: number;
  width?: number;
  x?: number;
  y?: number;
};

type TrackSummary = {
  ballFrames: number;
  hoopFrames: number;
  playerCounts: number[];
};

type GeminiResult = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
};

type DecoderStepStatus = {
  reason?: string;
  status: "PASS" | "FAIL";
};

type RealityDecoderStatus = {
  factExtraction: DecoderStepStatus;
  frameExtraction: DecoderStepStatus & { frameCount: number };
  gemini: DecoderStepStatus;
  roboflow: DecoderStepStatus;
  storedFactsCount: number;
  uploadId: string;
};

const frameTimes = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5];
const playerLabels = new Set(["person", "player", "athlete"]);
const factKeys = new Set([
  "player_count",
  "ball_detected",
  "hoop_detected",
  "shot_attempt",
  "make_miss",
  "dominant_area_guess",
  "paint_touch",
  "drive",
  "left_hand_guess",
  "right_hand_guess",
  "defender_pressure_guess",
  "movement_path",
  "shot_window",
]);
const makeMissValues = new Set(["make", "miss", "unknown"]);
const areaValues = new Set(["paint", "right wing", "left wing", "corner", "top", "unknown"]);
const pressureValues = new Set(["open", "light", "contested", "unknown"]);
const pathValues = new Set(["stationary", "left", "right", "toward rim", "away from rim", "unknown"]);
const shotWindowValues = new Set(["early", "middle", "late", "unknown"]);

export function getMuxPlaybackUrl(playbackId?: string) {
  return playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : undefined;
}

function getMuxThumbnailUrl(playbackId: string, time: number) {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}`;
}

export async function decodeAndPersistRealityFacts(input: DecodeVideoInput) {
  const status = createDecoderStatus(input.uploadId);
  console.log("DECODE_STARTED", {
    artifactId: input.artifactId,
    hasMuxPlaybackId: Boolean(input.muxPlaybackId),
    hasVideoUrl: Boolean(input.videoUrl),
    uploadId: input.uploadId,
  });
  const decoded = await decodeRealityFacts(input, status);
  const records = decoded.map((fact) => factToRecord(fact, input));
  await persistAxisArtifact({
    artifact_body: "Reality facts extracted from uploaded video.",
    artifact_id: input.artifactId,
    artifact_title: "Reality Decode",
    artifact_type: "reality_decode",
    created_at: new Date().toISOString(),
    source_clip_count: input.sourceClipCount,
    upload_id: input.uploadId,
  });
  const persistence = await persistAxisArtifactFacts(records);
  status.factExtraction = decoded.length
    ? { status: "PASS" }
    : { reason: "No supported facts were produced by available decoders.", status: "FAIL" };
  status.storedFactsCount = persistence.stored ? records.length : 0;
  if (!persistence.stored) {
    status.factExtraction = { reason: `Fact persistence failed: ${persistence.reason}`, status: "FAIL" };
  }
  logRealityDecoderStatus(status);
  console.log("DECODE_COMPLETE", {
    factCount: decoded.length,
    storedFactsCount: status.storedFactsCount,
    uploadId: input.uploadId,
  });

  return {
    facts: decoded,
    persistence,
  };
}

export async function getStoredRealityFacts(uploadId: string, limit = 30): Promise<AxisDecodedFact[]> {
  const history = await getAxisArtifactFactHistory({ limit, uploadId });
  if (history.error) return [];

  return recordsToFacts(history.records).filter((fact) => factKeys.has(fact.fact_key));
}

export function recordsToFacts(records: AxisArtifactFactRecord[]): AxisDecodedFact[] {
  const byKey = new Map<string, AxisDecodedFact>();

  for (const record of records) {
    if (!factKeys.has(record.fact_key) && record.fact_key !== "source_clip_count") continue;
    if (byKey.has(record.fact_key)) continue;
    byKey.set(record.fact_key, {
      fact_key: record.fact_key,
      fact_label: record.fact_label,
      fact_text_value: record.fact_text_value ?? null,
      fact_unit: record.fact_unit,
      fact_value: record.fact_value,
      sample_size: record.sample_size,
      source: record.source ?? "unknown",
      support_level: record.support_level ?? "weak",
      temporal_support: record.temporal_support ?? null,
      verification_status: record.verification_status ?? "needs_review",
    });
  }

  return Array.from(byKey.values());
}

export function factsToPlainLanguage(facts: AxisDecodedFact[]) {
  const parts = facts
    .map((fact) => {
      if (fact.verification_status === "rejected") return null;
      const soft = fact.verification_status === "needs_review";
      if (fact.fact_key === "player_count" && Number.isFinite(fact.fact_value)) {
        if (soft) return fact.fact_value > 1 ? "multiple players appear visible" : "a player appears visible";
        return `${fact.fact_value} visible ${fact.fact_value === 1 ? "player" : "players"}`;
      }
      if (fact.fact_key === "shot_attempt" && fact.fact_value === 1) return soft ? "what looks like a shot attempt" : "a shot attempt";
      if (fact.fact_key === "make_miss" && fact.fact_text_value && fact.fact_text_value !== "unknown") {
        return `the shot appears to be a ${fact.fact_text_value}`;
      }
      if (fact.fact_key === "dominant_area_guess" && fact.fact_text_value && fact.fact_text_value !== "unknown") {
        return soft ? `an early signal around the ${fact.fact_text_value}` : `action around the ${fact.fact_text_value}`;
      }
      if (fact.fact_key === "paint_touch" && fact.fact_value === 1) return soft ? "what looks like a paint touch" : "a paint touch";
      if (fact.fact_key === "drive" && fact.fact_value === 1) return soft ? "what looks like a drive" : "a drive";
      if (fact.fact_key === "ball_detected" && fact.fact_value === 1) return soft ? "the ball appears visible" : "the ball is visible";
      if (fact.fact_key === "hoop_detected" && fact.fact_value === 1) return soft ? "the rim appears visible" : "the rim is visible";
      return null;
    })
    .filter((part): part is string => Boolean(part));

  return parts.length ? parts.join(", ") : "";
}

async function decodeRealityFacts(input: DecodeVideoInput, status: RealityDecoderStatus): Promise<AxisDecodedFact[]> {
  const frames = await extractEvidenceFrames(input);
  status.frameExtraction = frames.length
    ? { frameCount: frames.length, status: "PASS" }
    : { frameCount: 0, reason: "No Mux playback frames could be loaded.", status: "FAIL" };
  const rawFacts: RawDecodedFact[] = [];
  const detections: DetectionBox[] = [];

  const yolo = await optionalDecoder("yolo", () => runYolo(frames));
  rawFacts.push(...yolo.facts);
  detections.push(...yolo.detections);

  const tracks = await optionalDecoder("bytetrack", () => runByteTrack(detections));
  rawFacts.push(...tracks.facts);

  rawFacts.push(...(await optionalFacts("mediapipe_pose", () => runMediaPipePose(frames))).facts);
  rawFacts.push(...(await optionalFacts("court_calibration", () => runCourtCalibration(detections, tracks.trackSummary))).facts);

  const roboflow = await optionalDecoder("roboflow", () => runRoboflow(frames));
  status.roboflow = roboflow.facts.length || roboflow.detections.length
    ? { status: "PASS" }
    : { reason: roboflow.reason ?? "Roboflow produced no detections.", status: "FAIL" };
  console.log("ROBOFLOW_COMPLETE", {
    detectionCount: roboflow.detections.length,
    factCount: roboflow.facts.length,
    reason: status.roboflow.reason,
    status: status.roboflow.status,
    uploadId: input.uploadId,
  });
  rawFacts.push(...roboflow.facts);
  detections.push(...roboflow.detections);

  const gemini = await optionalFacts("gemini", () =>
    runGemini({
      frames,
      videoUrl: input.videoUrl ?? getMuxPlaybackUrl(input.muxPlaybackId),
    }),
  );
  status.gemini = gemini.facts.length
    ? { status: "PASS" }
    : { reason: gemini.reason ?? "Gemini produced no supported facts.", status: "FAIL" };
  console.log("GEMINI_COMPLETE", {
    factCount: gemini.facts.length,
    reason: status.gemini.reason,
    status: status.gemini.status,
    uploadId: input.uploadId,
  });
  rawFacts.push(...gemini.facts);

  const normalized = process.env.OPENAI_API_KEY ? await normalizeWithOpenAI(rawFacts) : rawFacts;
  console.log("OPENAI_COMPLETE", {
    factCount: normalized.length,
    reason: process.env.OPENAI_API_KEY ? undefined : "OPENAI_API_KEY missing",
    status: process.env.OPENAI_API_KEY ? "PASS" : "FAIL",
    uploadId: input.uploadId,
  });
  return qualifyDecodedFacts(normalized, Math.max(input.sourceClipCount, frames.length || 1));
}

async function optionalFacts(name: string, run: () => Promise<RawDecodedFact[]> | RawDecodedFact[]) {
  try {
    return { facts: await run() };
  } catch (error) {
    console.error(`Axis reality decoder ${name} pass unavailable`, error);
    return { facts: [], reason: getErrorReason(error) };
  }
}

async function optionalDecoder(
  name: string,
  run: () => Promise<{ detections: DetectionBox[]; facts: RawDecodedFact[]; reason?: string; trackSummary?: TrackSummary }> | {
    detections: DetectionBox[];
    facts: RawDecodedFact[];
    reason?: string;
    trackSummary?: TrackSummary;
  },
) {
  try {
    const result = await run();
    return { detections: result.detections, facts: result.facts, reason: result.reason, trackSummary: result.trackSummary };
  } catch (error) {
    console.error(`Axis reality decoder ${name} pass unavailable`, error);
    return { detections: [], facts: [], reason: getErrorReason(error), trackSummary: undefined };
  }
}

async function extractEvidenceFrames(input: DecodeVideoInput): Promise<EvidenceFrame[]> {
  if (!input.muxPlaybackId) return [];

  const frames = await Promise.all(
    frameTimes.map(async (time, index) => {
      const url = getMuxThumbnailUrl(input.muxPlaybackId as string, time);
      try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const contentType = response.headers.get("content-type") ?? "image/jpeg";
        const buffer = Buffer.from(await response.arrayBuffer());
        return {
          base64: buffer.toString("base64"),
          contentType,
          index,
          time,
          url,
        };
      } catch {
        return null;
      }
    }),
  );

  return frames.filter((frame): frame is EvidenceFrame => Boolean(frame));
}

async function runYolo(frames: EvidenceFrame[]) {
  const endpoint = process.env.AXIS_YOLO_ENDPOINT;
  const apiKey = process.env.AXIS_YOLO_API_KEY;
  if (!endpoint) return { detections: [], facts: [], reason: "AXIS_YOLO_ENDPOINT is not configured." };
  if (!frames.length) return { detections: [], facts: [], reason: "No frames available for YOLO." };

  const response = await fetch(endpoint, {
    body: JSON.stringify({
      frames: frames.map((frame) => ({
        data: frame.base64,
        index: frame.index,
        mime_type: frame.contentType,
        time: frame.time,
      })),
    }),
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    method: "POST",
  });
  const result = (await response.json().catch(() => null)) as { detections?: unknown } | null;
  if (!response.ok) return { detections: [], facts: [], reason: `YOLO endpoint returned HTTP ${response.status}.` };
  if (!Array.isArray(result?.detections)) return { detections: [], facts: [], reason: "YOLO response did not include detections." };

  const detections = normalizeDetections(result.detections);
  return factsFromDetections(detections);
}

async function runRoboflow(frames: EvidenceFrame[]) {
  const apiKey = process.env.ROBOFLOW_API_KEY;
  const workspace = process.env.ROBOFLOW_WORKSPACE;
  const project = process.env.ROBOFLOW_PROJECT;
  const version = process.env.ROBOFLOW_VERSION;
  if (!apiKey || !workspace || !project || !version) {
    return { detections: [], facts: [], reason: "Roboflow env is incomplete." };
  }
  if (!frames.length) return { detections: [], facts: [], reason: "No frames available for Roboflow." };

  const versionStatus = await verifyRoboflowVersion({ apiKey, project, version, workspace });
  if (!versionStatus.ok) return { detections: [], facts: [], reason: versionStatus.reason };

  const detectionSets = await Promise.all(
    frames.map(async (frame) => {
      const endpoint = `https://detect.roboflow.com/${encodeURIComponent(project)}/${encodeURIComponent(
        version,
      )}?api_key=${encodeURIComponent(apiKey)}&confidence=35&overlap=30`;
      const response = await fetch(endpoint, {
        body: frame.base64,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as { predictions?: unknown[] } | null;
      if (!response.ok || !Array.isArray(result?.predictions)) {
        console.error("Axis reality decoder Roboflow frame failed", {
          frameIndex: frame.index,
          reason: !response.ok ? `HTTP ${response.status}` : "invalid_predictions",
        });
        return [];
      }
      return normalizeDetections(result.predictions, frame.index);
    }),
  );

  const detections = detectionSets.flat();
  const output = factsFromDetections(detections);
  return output.facts.length || output.detections.length
    ? output
    : { ...output, reason: "Roboflow returned zero usable detections." };
}

function runByteTrack(detections: DetectionBox[]) {
  const summary: TrackSummary = {
    ballFrames: new Set(detections.filter((box) => isBall(box.className)).map((box) => box.frameIndex)).size,
    hoopFrames: new Set(detections.filter((box) => isHoop(box.className)).map((box) => box.frameIndex)).size,
    playerCounts: frameTimes.map((_, frameIndex) =>
      detections.filter((box) => box.frameIndex === frameIndex && isPlayer(box.className)).length,
    ),
  };
  const facts: RawDecodedFact[] = [];

  if (summary.ballFrames > 0) facts.push({ key: "ball_detected", label: "Ball detected", source: "bytetrack", value: 1 });
  if (summary.hoopFrames > 0) facts.push({ key: "hoop_detected", label: "Hoop detected", source: "bytetrack", value: 1 });
  if (ballMovesTowardHoop(detections)) {
    facts.push({ key: "shot_attempt", label: "Shot attempt", source: "bytetrack", value: 1 });
  }

  return { detections: [], facts, trackSummary: summary };
}

async function runMediaPipePose(frames: EvidenceFrame[]) {
  const endpoint = process.env.AXIS_MEDIAPIPE_POSE_ENDPOINT;
  if (!endpoint || !frames.length) return [];

  const response = await fetch(endpoint, {
    body: JSON.stringify({
      frames: frames.map((frame) => ({
        data: frame.base64,
        index: frame.index,
        mime_type: frame.contentType,
      })),
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const result = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || !result) return [];

  return rawFactsFromObject(result);
}

function runCourtCalibration(detections: DetectionBox[], trackSummary?: TrackSummary) {
  const facts: RawDecodedFact[] = [];
  const polygon = process.env.AXIS_COURT_POLYGON;
  const playerBoxes = detections.filter((box) => isPlayer(box.className));
  const hoopBoxes = detections.filter((box) => isHoop(box.className));
  const ballBoxes = detections.filter((box) => isBall(box.className));

  if (!polygon && !hoopBoxes.length && !playerBoxes.length) return facts;

  const avgBallX = average(ballBoxes.map((box) => box.x).filter(isNumber));
  const avgBallY = average(ballBoxes.map((box) => box.y).filter(isNumber));

  if (isNumber(avgBallX)) {
    if (avgBallX < 0.32) facts.push({ key: "dominant_area_guess", label: "Shot area", source: "court_calibration", textValue: "left wing" });
    else if (avgBallX > 0.68) facts.push({ key: "dominant_area_guess", label: "Shot area", source: "court_calibration", textValue: "right wing" });
    else if (isNumber(avgBallY) && avgBallY < 0.34) facts.push({ key: "dominant_area_guess", label: "Shot area", source: "court_calibration", textValue: "top" });
    else if (isNumber(avgBallY) && avgBallY > 0.68) facts.push({ key: "dominant_area_guess", label: "Shot area", source: "court_calibration", textValue: "paint" });
  }

  if ((trackSummary?.ballFrames ?? 0) >= 2 && hoopBoxes.length) {
    facts.push({ key: "shot_window", label: "Shot window", source: "court_calibration", textValue: "middle" });
  }

  return facts;
}

async function runGemini({ frames, videoUrl }: { frames: EvidenceFrame[]; videoUrl?: string }) {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey || (!frames.length && !videoUrl)) return [];

  const parts: Array<Record<string, unknown>> = [
    {
      text:
        "You are a basketball video judge. Return JSON only. Evaluate only these basketball facts plus basic visibility. player_count: number or null. ball_detected: boolean or null. hoop_detected: boolean or null. shot_attempt: true only if the ball clearly moves toward the hoop/rim area or a clear shooting motion is visible; false if no real attempt is visible; null if unclear. make_miss: make, miss, or unknown; if the result is not visible return unknown. paint_touch: true only if the tracked ball carrier visibly enters the painted lane; false if the ball carrier does not enter the paint; null if unclear. drive: true only when the ball handler starts from perimeter/wing, moves downhill toward the rim, and enters the paint; false if that sequence is not visible; null if unclear. Do not infer. Do not estimate. Also return dominant_area_guess only if clearly visible: paint, right wing, left wing, corner, top, unknown.",
    },
  ];

  if (frames.length) {
    for (const frame of frames.slice(0, 9)) {
      parts.push({ text: `${getTemporalLabel(frame.index, frames.length)} frame ${frame.index + 1} at ${frame.time}s` });
      parts.push({ inline_data: { data: frame.base64, mime_type: frame.contentType } });
    }
  } else if (videoUrl) {
    parts.push({ file_data: { file_uri: videoUrl, mime_type: getVideoMimeType(videoUrl) } });
  }

  const model = process.env.GOOGLE_AI_MODEL ?? "gemini-2.5-flash";
  let response: Response | null = null;
  let result: GeminiResult | null = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model,
      )}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        body: JSON.stringify({
          contents: [{ parts, role: "user" }],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
    result = (await response.json().catch(() => null)) as GeminiResult | null;
    if (response.ok) break;

    const retryable = response.status === 429 || response.status === 500 || response.status === 503;
    console.error("Axis reality decoder Gemini request failed", {
      attempt,
      model,
      reason: result?.error?.message ?? `HTTP ${response.status}`,
      retryable,
      status: response.status,
    });
    if (!retryable || attempt === 3) return [];
    await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
  }

  if (!response?.ok) return [];

  const text = result?.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === "string")?.text ?? "";
  const parsed = JSON.parse(text) as Record<string, unknown>;
  return rawFactsFromObject(parsed, "gemini", frames.length);
}

async function normalizeWithOpenAI(facts: RawDecodedFact[]): Promise<RawDecodedFact[]> {
  if (!facts.length) return [];

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      input: JSON.stringify({ facts }),
      instructions:
        "Normalize supported basketball facts into the Axis schema. Preserve each fact source when present. Keep only supported claims. Return JSON with a facts array. Allowed keys: player_count, ball_detected, hoop_detected, shot_attempt, make_miss, dominant_area_guess, paint_touch, drive, left_hand_guess, right_hand_guess, defender_pressure_guess, movement_path, shot_window. Numeric facts use value. Categorical facts use textValue. Omit unsupported claims.",
      max_output_tokens: 500,
      model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
      store: false,
    });
    const parsed = JSON.parse(response.output_text) as { facts?: unknown };
    return Array.isArray(parsed.facts) ? rawFactsFromArray(parsed.facts) : facts;
  } catch (error) {
    console.error("Axis reality decoder normalization unavailable", error);
    return facts;
  }
}

export async function buildHistoricalMeaningWithClaude(input: {
  currentFacts: Array<{
    fact_key: string;
    fact_label: string;
    fact_text_value?: string | null;
    fact_unit?: string | null;
    fact_value: number;
    sample_size?: number;
    source?: string | null;
    support_level?: "strong" | "medium" | "weak" | null;
    verification_status?: "accepted" | "needs_review" | "rejected" | null;
  }>;
  priorFacts: AxisArtifactFactRecord[];
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !input.priorFacts.length || !input.currentFacts.length) return "";

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      body: JSON.stringify({
        max_tokens: 220,
        messages: [
          {
            content: JSON.stringify(input),
            role: "user",
          },
        ],
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
        system:
          "Write one short historical comparison from stored Axis facts only. Do not mention providers, databases, JSON, IDs, or uncertainty math. If the facts do not support comparison, say: Not enough history yet to compare.",
      }),
      headers: {
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      method: "POST",
    });
    const result = (await response.json().catch(() => null)) as
      | { content?: Array<{ text?: string; type?: string }> }
      | null;
    if (!response.ok) return "";
    return result?.content?.find((part) => part.type === "text" && part.text)?.text?.trim() ?? "";
  } catch (error) {
    console.error("Axis historical meaning unavailable", error);
    return "";
  }
}

function normalizeDetections(values: unknown[], fallbackFrameIndex = 0): DetectionBox[] {
  return values
    .map((value): DetectionBox | null => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const record = value as Record<string, unknown>;
      const className = String(record.class ?? record.class_name ?? record.label ?? record.name ?? "").toLowerCase();
      if (!className) return null;
      return {
        className,
        confidence: getOptionalNumber(record.confidence),
        frameIndex: getOptionalNumber(record.frameIndex) ?? getOptionalNumber(record.frame_index) ?? fallbackFrameIndex,
        height: normalizeCoordinate(record.height),
        width: normalizeCoordinate(record.width),
        x: normalizeCoordinate(record.x),
        y: normalizeCoordinate(record.y),
      };
    })
    .filter(isDetectionBox);
}

function isDetectionBox(value: DetectionBox | null): value is DetectionBox {
  return Boolean(value);
}

function factsFromDetections(detections: DetectionBox[]) {
  const facts: RawDecodedFact[] = [];
  const playerCounts = frameTimes.map((_, frameIndex) =>
    detections.filter((box) => box.frameIndex === frameIndex && isPlayer(box.className)).length,
  );
  const playerCount = Math.max(0, ...playerCounts);
  const ballDetected = detections.some((box) => isBall(box.className));
  const hoopDetected = detections.some((box) => isHoop(box.className));

  if (playerCount > 0) facts.push({ key: "player_count", label: "Player count", source: "object_detection", value: playerCount });
  if (ballDetected) facts.push({ key: "ball_detected", label: "Ball detected", source: "object_detection", value: 1 });
  if (hoopDetected) facts.push({ key: "hoop_detected", label: "Hoop detected", source: "object_detection", value: 1 });

  return { detections, facts };
}

function ballMovesTowardHoop(detections: DetectionBox[]) {
  const hoop = detections.find((box) => isHoop(box.className) && isNumber(box.x) && isNumber(box.y));
  if (!hoop || !isNumber(hoop.x) || !isNumber(hoop.y)) return false;
  const hoopX = hoop.x;
  const hoopY = hoop.y;

  const ballByFrame = detections
    .filter((box) => isBall(box.className) && isNumber(box.x) && isNumber(box.y))
    .sort((a, b) => a.frameIndex - b.frameIndex);
  if (ballByFrame.length < 2) return false;

  const distances = ballByFrame.map((ball) => Math.hypot((ball.x as number) - hoopX, (ball.y as number) - hoopY));
  const first = distances[0];
  const last = distances[distances.length - 1];
  if (!isNumber(first) || !isNumber(last)) return false;

  return first - last > 0.08;
}

function rawFactsFromObject(value: Record<string, unknown>, source = "gemini", temporalFrameCount = 1) {
  const facts: RawDecodedFact[] = [];
  const temporalSupport = `${temporalFrameCount}/${temporalFrameCount}`;
  pushNumberFact(facts, value.player_count, "player_count", "Player count", source, temporalSupport);
  pushBooleanFact(facts, value.ball_detected, "ball_detected", "Ball detected", source, temporalSupport);
  pushBooleanFact(facts, value.hoop_detected, "hoop_detected", "Hoop detected", source, temporalSupport);
  pushBooleanFact(facts, value.shot_attempt, "shot_attempt", "Shot attempt", source, temporalSupport);
  pushTextFact(facts, value.make_miss, "make_miss", "Make / miss", source, temporalSupport);
  pushTextFact(facts, value.dominant_area_guess, "dominant_area_guess", "Shot area", source, temporalSupport);
  pushBooleanFact(facts, value.paint_touch, "paint_touch", "Paint touch", source, temporalSupport);
  pushBooleanFact(facts, value.drive, "drive", "Drive", source, temporalSupport);
  pushBooleanFact(facts, value.drive_guess, "drive", "Drive", source, temporalSupport);
  pushBooleanFact(facts, value.left_hand_guess, "left_hand_guess", "Left hand", source, temporalSupport);
  pushBooleanFact(facts, value.right_hand_guess, "right_hand_guess", "Right hand", source, temporalSupport);
  pushTextFact(facts, value.defender_pressure_guess, "defender_pressure_guess", "Defender pressure", source, temporalSupport);
  pushTextFact(facts, value.movement_path, "movement_path", "Movement path", source, temporalSupport);
  pushTextFact(facts, value.shot_window, "shot_window", "Shot window", source, temporalSupport);
  return facts;
}

function pushNumberFact(facts: RawDecodedFact[], value: unknown, key: string, label: string, source: string, temporalSupport: string) {
  if (typeof value === "number") facts.push({ key, label, source, temporalSupport, value });
}

function pushBooleanFact(facts: RawDecodedFact[], value: unknown, key: string, label: string, source: string, temporalSupport: string) {
  if (typeof value === "boolean") facts.push({ key, label, source, temporalSupport, value: value ? 1 : 0 });
  if (typeof value === "number") facts.push({ key, label, source, temporalSupport, value });
}

function pushTextFact(facts: RawDecodedFact[], value: unknown, key: string, label: string, source: string, temporalSupport: string) {
  if (typeof value === "string") facts.push({ key, label, source, temporalSupport, textValue: value });
}

function rawFactsFromArray(values: unknown[]): RawDecodedFact[] {
  return values
    .map((value): RawDecodedFact | null => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const record = value as Record<string, unknown>;
      const key = typeof record.key === "string" ? record.key : typeof record.fact_key === "string" ? record.fact_key : "";
      const label = typeof record.label === "string" ? record.label : typeof record.fact_label === "string" ? record.fact_label : key;
      const source = typeof record.source === "string" ? record.source : "normalized";
      const temporalSupport =
        typeof record.temporalSupport === "string"
          ? record.temporalSupport
          : typeof record.temporal_support === "string"
            ? record.temporal_support
            : null;
      const textValue =
        typeof record.textValue === "string"
          ? record.textValue
          : typeof record.fact_text_value === "string"
            ? record.fact_text_value
            : null;
      const valueNumber =
        typeof record.value === "number"
          ? record.value
          : typeof record.fact_value === "number"
            ? record.fact_value
            : null;
      return { key, label, source, temporalSupport, textValue, value: valueNumber };
    })
    .filter((fact): fact is RawDecodedFact => Boolean(fact));
}

function qualifyDecodedFacts(rawFacts: RawDecodedFact[], sampleSize: number): AxisDecodedFact[] {
  const candidates = rawFacts
    .map((rawFact) => sanitizeDecodedFact(rawFact, sampleSize))
    .filter((fact): fact is FactCandidate => Boolean(fact));
  const byKey = new Map<string, FactCandidate[]>();

  for (const candidate of candidates) {
    byKey.set(candidate.fact_key, [...(byKey.get(candidate.fact_key) ?? []), candidate]);
  }

  return Array.from(byKey.values())
    .map(chooseQualifiedFact)
    .filter((fact): fact is AxisDecodedFact => Boolean(fact))
    .filter((fact) => fact.verification_status !== "rejected");
}

function sanitizeDecodedFact(rawFact: RawDecodedFact, sampleSize: number): FactCandidate | null {
  const key = rawFact.key;
  const source = rawFact.source ?? "unknown";
  const withSource = (fact: FactCandidate | null) =>
    fact ? { ...fact, source, temporal_support: rawFact.temporalSupport ?? fact.temporal_support } : null;
  if (key === "player_count") {
    const value = getWholeNumber(rawFact.value);
    return withSource(value > 0 ? createNumberFact(key, "Player count", value, "players", sampleSize) : null);
  }

  if (
    key === "ball_detected" ||
    key === "hoop_detected" ||
    key === "shot_attempt" ||
    key === "paint_touch" ||
    key === "drive" ||
    key === "left_hand_guess" ||
    key === "right_hand_guess"
  ) {
    const value = getBinary(rawFact.value);
    return withSource(value === null ? null : createNumberFact(key, rawFact.label, value, "boolean", sampleSize));
  }

  if (key === "make_miss") return withSource(createChoiceFact(key, "Make / miss", rawFact.textValue, makeMissValues, sampleSize));
  if (key === "dominant_area_guess") return withSource(createChoiceFact(key, "Shot area", rawFact.textValue, areaValues, sampleSize));
  if (key === "defender_pressure_guess") {
    return withSource(createChoiceFact(key, "Defender pressure", rawFact.textValue, pressureValues, sampleSize));
  }
  if (key === "movement_path") return withSource(createChoiceFact(key, "Movement path", rawFact.textValue, pathValues, sampleSize));
  if (key === "shot_window") return withSource(createChoiceFact(key, "Shot window", rawFact.textValue, shotWindowValues, sampleSize));

  return null;
}

function chooseQualifiedFact(candidates: FactCandidate[]): AxisDecodedFact | null {
  if (!candidates.length) return null;

  const byValue = new Map<string, FactCandidate[]>();
  for (const candidate of candidates) {
    byValue.set(candidate.value_signature, [...(byValue.get(candidate.value_signature) ?? []), candidate]);
  }

  const groups = Array.from(byValue.values()).sort((a, b) => b.length - a.length);
  const winning = groups[0];
  const hasConflict = groups.length > 1;
  if (hasConflict && groups[1]?.length === winning.length) return null;

  const sources = Array.from(new Set(winning.map((fact) => fact.source).filter(Boolean)));
  const sourceCount = sources.length;
  const base = winning[0];
  const support_level = getSupportLevel(base, sourceCount, hasConflict);
  const verification_status = getVerificationStatus(base, support_level, sourceCount, hasConflict);

  if (verification_status === "rejected") return null;

  return {
    fact_key: base.fact_key,
    fact_label: base.fact_label,
    fact_text_value: base.fact_text_value,
    fact_unit: base.fact_unit,
    fact_value: base.fact_value,
    sample_size: Math.max(...winning.map((fact) => fact.sample_size)),
    source: sources.join("+") || "unknown",
    support_level,
    temporal_support: combineTemporalSupport(winning),
    verification_status,
  };
}

function getSupportLevel(fact: FactCandidate, sourceCount: number, hasConflict: boolean): AxisDecodedFact["support_level"] {
  if (hasConflict) return sourceCount > 1 ? "medium" : "weak";
  if (sourceCount > 1) return "strong";
  if (fact.fact_key === "ball_detected" || fact.fact_key === "hoop_detected") return "medium";
  if (fact.fact_key === "player_count") return "medium";
  return "weak";
}

function getVerificationStatus(
  fact: FactCandidate,
  supportLevel: AxisDecodedFact["support_level"],
  sourceCount: number,
  hasConflict: boolean,
): AxisDecodedFact["verification_status"] {
  if (hasConflict && sourceCount <= 1) return "rejected";
  if (supportLevel === "strong") return "accepted";
  if (fact.fact_key === "ball_detected" || fact.fact_key === "hoop_detected") return "accepted";
  return "needs_review";
}

function combineTemporalSupport(facts: FactCandidate[]) {
  const parsed = facts
    .map((fact) => parseTemporalSupport(fact.temporal_support))
    .filter((support): support is { supported: number; total: number } => Boolean(support));
  if (!parsed.length) return null;

  const supported = Math.max(...parsed.map((support) => support.supported));
  const total = Math.max(...parsed.map((support) => support.total));
  return `${supported}/${total}`;
}

function parseTemporalSupport(value: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d+)\/(\d+)$/);
  if (!match) return null;
  const supported = Number.parseInt(match[1], 10);
  const total = Number.parseInt(match[2], 10);
  if (!Number.isFinite(supported) || !Number.isFinite(total) || total <= 0) return null;
  return { supported, total };
}

function createChoiceFact(key: string, label: string, value: string | null | undefined, allowed: Set<string>, sampleSize: number) {
  const normalized = normalizeChoice(value, allowed);
  return normalized ? createTextFact(key, label, normalized, sampleSize) : null;
}

function createNumberFact(key: string, label: string, value: number, unit: string, sampleSize: number): FactCandidate {
  const fact = {
    fact_key: key,
    fact_label: label,
    fact_text_value: null,
    fact_unit: unit,
    fact_value: value,
    sample_size: sampleSize,
    source: "unknown",
    support_level: "weak" as const,
    temporal_support: null,
    value_signature: `n:${value}`,
    verification_status: "needs_review" as const,
  };
  return fact;
}

function createTextFact(key: string, label: string, value: string, sampleSize: number): FactCandidate {
  return {
    fact_key: key,
    fact_label: label,
    fact_text_value: value,
    fact_unit: "label",
    fact_value: 0,
    sample_size: sampleSize,
    source: "unknown",
    support_level: "weak",
    temporal_support: null,
    value_signature: `t:${value}`,
    verification_status: "needs_review",
  };
}

function normalizeChoice(value: string | null | undefined, allowed: Set<string>) {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return allowed.has(normalized) ? normalized : null;
}

function getWholeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function getBinary(value: number | null | undefined) {
  if (value === 0 || value === 1) return value;
  if (typeof value === "number" && Number.isFinite(value)) return value > 0 ? 1 : 0;
  return null;
}

function getOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeCoordinate(value: unknown) {
  const numberValue = getOptionalNumber(value);
  if (numberValue === undefined) return undefined;
  return numberValue > 1 ? numberValue / 1000 : numberValue;
}

function average(values: number[]) {
  if (!values.length) return undefined;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPlayer(label: string) {
  return playerLabels.has(label) || label.includes("person") || label.includes("player") || label.includes("athlete");
}

function isBall(label: string) {
  return label.includes("ball");
}

function isHoop(label: string) {
  return label.includes("hoop") || label.includes("rim") || label.includes("basket");
}

function factToRecord(fact: AxisDecodedFact, input: DecodeVideoInput): AxisArtifactFactRecord {
  return {
    artifact_id: input.artifactId,
    created_at: new Date().toISOString(),
    fact_id: `${input.artifactId}-${fact.fact_key}`,
    fact_key: fact.fact_key,
    fact_label: fact.fact_label,
    fact_text_value: fact.fact_text_value,
    fact_unit: fact.fact_unit,
    fact_value: fact.fact_value,
    sample_size: fact.sample_size,
    source: fact.source,
    support_level: fact.support_level,
    temporal_support: fact.temporal_support,
    upload_id: input.uploadId,
    verification_status: fact.verification_status,
  };
}

function getVideoMimeType(videoUrl: string) {
  if (videoUrl.includes(".m3u8")) return "application/vnd.apple.mpegurl";
  if (videoUrl.includes(".mov")) return "video/quicktime";
  return "video/mp4";
}

function getTemporalLabel(index: number, total: number) {
  if (index < Math.ceil(total / 3)) return "Early";
  if (index < Math.ceil((total * 2) / 3)) return "Middle";
  return "Late";
}

async function verifyRoboflowVersion({
  apiKey,
  project,
  version,
  workspace,
}: {
  apiKey: string;
  project: string;
  version: string;
  workspace: string;
}) {
  try {
    const response = await fetch(
      `https://api.roboflow.com/${encodeURIComponent(workspace)}/${encodeURIComponent(project)}/${encodeURIComponent(
        version,
      )}?api_key=${encodeURIComponent(apiKey)}`,
    );
    const result = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    if (response.ok) return { ok: true, reason: "" };

    const workspaceResponse = await fetch(`https://api.roboflow.com/${encodeURIComponent(workspace)}?api_key=${encodeURIComponent(apiKey)}`);
    const workspaceResult = (await workspaceResponse.json().catch(() => null)) as
      | { workspace?: { projects?: Array<{ name?: string; versions?: number }> } }
      | null;
    const projectNames = workspaceResult?.workspace?.projects?.map((item) => `${item.name ?? "unknown"}:${item.versions ?? 0}`).join(", ");

    return {
      ok: false,
      reason: `Roboflow version metadata failed HTTP ${response.status}: ${
        result?.error?.message ?? "unknown"
      }${projectNames ? `; visible projects=${projectNames}` : ""}`,
    };
  } catch (error) {
    return { ok: false, reason: `Roboflow version verification threw: ${getErrorReason(error)}` };
  }
}

function createDecoderStatus(uploadId: string): RealityDecoderStatus {
  return {
    factExtraction: { reason: "Not run.", status: "FAIL" },
    frameExtraction: { frameCount: 0, reason: "Not run.", status: "FAIL" },
    gemini: { reason: "Not run.", status: "FAIL" },
    roboflow: { reason: "Not run.", status: "FAIL" },
    storedFactsCount: 0,
    uploadId,
  };
}

function logRealityDecoderStatus(status: RealityDecoderStatus) {
  console.log("Reality Decoder Status", {
    "Fact Extraction": formatStep(status.factExtraction),
    "Frame Extraction": `${status.frameExtraction.status} (${status.frameExtraction.frameCount} frames)${
      status.frameExtraction.reason ? `: ${status.frameExtraction.reason}` : ""
    }`,
    Gemini: formatStep(status.gemini),
    Roboflow: formatStep(status.roboflow),
    "Stored Facts Count": status.storedFactsCount,
    uploadId: status.uploadId,
  });
}

function formatStep(step: DecoderStepStatus) {
  return step.reason ? `${step.status}: ${step.reason}` : step.status;
}

function getErrorReason(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
