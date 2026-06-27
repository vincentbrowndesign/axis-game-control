import { task } from "@trigger.dev/sdk/v3";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import OpenAI from "openai";

import { extractAxisFrames, probeAxisVideoMetadata } from "../src/lib/axis-ffmpeg";
import {
  computeClipStats,
  createClipResult,
  getClipSetup,
  insertClipEvents,
  insertClipPlays,
  updateClipResult,
  updateClipSource,
  upsertClipPressPack,
} from "../src/lib/clip-room/db";
import type {
  ClipAudioAnalysis,
  ClipEventType,
  ClipProcessingPayload,
  ClipSetup,
  ClipShotZone,
  ClipSourceQuality,
  ClipSourceType,
} from "../src/lib/clip-room/types";
import { createOriginalClipSignedUrl } from "../src/lib/clip-room/original-storage";

const WHAT_HAPPENED_QUESTION = "What happened in this clip?";

export const clipRoomProcessing = task({
  id: "clip-room-processing",
  maxDuration: 600,
  queue: {
    name: "clip-room-processing",
    concurrencyLimit: 2,
  },
  run: async (payload: ClipProcessingPayload) => {
    const { clipId, ownerId, cloudflareUid, originalStorageUri } = payload;
    let workDir: string | undefined;

    console.log("CLIP_ROOM_PROCESSING_START", {
      clipId,
      cloudflareUid,
      originalSource: originalStorageUri ? "saved_original" : "missing",
    });

    try {
      await updateClipSource(clipId, {
        status: "processing",
        processingStage: "waiting_for_video",
        processingProgress: 10,
      });

      // ── 0. Fetch setup ─────────────────────────────────────────────────────
      const setupResult = await getClipSetup(clipId);
      const setup = setupResult.record ?? null;

      // ── 1. Wait for Cloudflare MP4 ─────────────────────────────────────────
      if (!originalStorageUri) {
        throw new Error("Original MP4 is missing; analysis requires the saved upload source.");
      }

      const original = await createOriginalClipSignedUrl(originalStorageUri);
      if (original.error || !original.url) {
        throw new Error(`Original MP4 could not be opened for analysis: ${original.error ?? "missing signed URL"}`);
      }

      const analysisInput = original.url;
      console.log("CLIP_ROOM_ORIGINAL_READY", {
        clipId,
        cloudflareUid,
        analysisSource: "original_mp4",
      });

      await updateClipSource(clipId, {
        processingStage: "source_probe",
        processingProgress: 20,
      });

      // ── 2. Work directory + probe frames ───────────────────────────────────
      workDir = await fs.mkdtemp(path.join(os.tmpdir(), `clip-${clipId}-`));
      const framesDir = path.join(workDir, "frames");
      const probeDir = path.join(workDir, "probe");
      const audioPath = path.join(workDir, "audio.mp3");

      await fs.mkdir(probeDir, { recursive: true });

      // Probe: 5 evenly distributed frames
      await extractAxisFrames({
        fps: 0.05, // ~1 frame per 20s, we'll take 5 from a short pass
        inputPath: analysisInput,
        outputDir: probeDir,
        operationName: "CLIP_ROOM_PROBE_EXTRACTION",
      });

      const probeFiles = (await fs.readdir(probeDir)).filter((f) => f.endsWith(".jpg")).sort().slice(0, 5);

      console.log("CLIP_ROOM_PROBE_FRAMES_EXTRACTED", {
        clipId,
        probeFrames: probeFiles.length,
        analysisSource: "original_mp4",
      });

      // ── 3. Probe video metadata ────────────────────────────────────────────
      let durationSeconds: number | null = null;
      try {
        const meta = await probeAxisVideoMetadata(analysisInput);
        durationSeconds = meta.duration;
        await updateClipSource(clipId, { durationSeconds });
      } catch { /* non-fatal */ }

      // ── 4. Source probe — LLM for QUALITY ONLY (not stat detection) ────────
      await updateClipSource(clipId, {
        processingStage: "source_probe",
        processingProgress: 30,
      });

      const probe = await runSourceProbe(probeDir, probeFiles, clipId);
      console.log("CLIP_ROOM_PROBE_DONE", { clipId, ...probe });

      // Create clip_result early so it's always available
      await createClipResult({
        clipId,
        ownerId,
        isPlayable: probe.isPlayable,
        sourceType: probe.sourceType,
        courtVisible: probe.courtVisible,
        hoopVisible: probe.hoopVisible,
        playersVisible: probe.playersVisible,
        scoreboardVisible: probe.scoreboardVisible,
        actionWindowFound: probe.actionWindowFound,
        sourceQuality: probe.sourceQuality,
        probeNotes: probe.probeNotes,
        outcome: "pending",
      });

      if (!probe.isPlayable || probe.sourceQuality === "unusable") {
        await Promise.all([
          updateClipResult(clipId, { outcome: "poor_quality", outcomeReason: probe.probeNotes ?? "Source not playable" }),
          updateClipSource(clipId, { status: "ready", processingStage: "complete", processingProgress: 100, error: null }),
        ]);
        // Still create "What happened?" so user can mark it
        await insertClipPlays([{
          clipId,
          eventId: null,
          ownerId,
          question: WHAT_HAPPENED_QUESTION,
          context: probe.probeNotes ?? "Video quality too low for automatic detection.",
          timestampSeconds: null,
        }]);
        await upsertClipPressPack({
          clipId,
          ownerId,
          headline: null,
          summary: probe.probeNotes ?? "Video quality too low for automatic detection.",
          keyMoments: [],
          statLines: computeClipStats([]),
        });
        return { ok: true, clipId, eventCount: 0, outcome: "poor_quality" };
      }

      // ── 5. Extract analysis frames + CV detection stage ────────────────────
      await fs.mkdir(framesDir, { recursive: true });
      await extractAxisFrames({
        fps: 2,
        inputPath: analysisInput,
        outputDir: framesDir,
        operationName: "CLIP_ROOM_ANALYSIS_EXTRACTION",
      });
      const frameFiles = (await fs.readdir(framesDir)).filter((f) => f.endsWith(".jpg")).sort();

      console.log("CLIP_ROOM_FRAMES_EXTRACTED", {
        clipId,
        analysisFrames: frameFiles.length,
        analysisSource: "original_mp4",
      });

      await updateClipSource(clipId, {
        processingStage: "cv_detection",
        processingProgress: 34,
      });
      console.log("CLIP_ROOM_CV_STAGE_READY", {
        clipId,
        framesAvailable: frameFiles.length,
        note: "CV provider hook stage reached; no stat is counted without rules evidence.",
      });

      await updateClipSource(clipId, {
        processingStage: "tracking",
        processingProgress: 38,
      });
      console.log("CLIP_ROOM_TRACKING_STAGE_READY", {
        clipId,
        note: "Tracking support stage reached; no identity or stat claims emitted.",
      });

      // ── 6. Extract audio / pose support ────────────────────────────────────
      await updateClipSource(clipId, {
        processingStage: "ocr_audio_pose",
        processingProgress: 42,
      });

      let audioAnalysis: ClipAudioAnalysis | null = null;
      try {
        await extractAudio(analysisInput, audioPath);
        audioAnalysis = await transcribeAudio(audioPath);
        console.log("CLIP_ROOM_AUDIO_TRANSCRIBED", { clipId, cueCount: audioAnalysis.cues.length });
      } catch (err) {
        console.warn("CLIP_ROOM_AUDIO_SKIPPED", { clipId, reason: String(err) });
      }

      // ── 7. Scoreboard OCR — read source text only, NOT stat detection ─────
      await updateClipSource(clipId, {
        processingStage: "ocr_audio_pose",
        processingProgress: 50,
      });

      let scoreboardReadings: ScoreboardReading[] = [];
      const shouldReadScoreboard = probe.scoreboardVisible || setup?.scoreboardVisible === "yes";

      if (shouldReadScoreboard && frameFiles.length > 0) {
        scoreboardReadings = await runScoreboardOcr(framesDir, frameFiles, clipId);
        console.log("CLIP_ROOM_SCOREBOARD_OCR", { clipId, readings: scoreboardReadings.length });
      }

      await updateClipResult(clipId, { scoreboardsRead: scoreboardReadings.length, framesAnalyzed: frameFiles.length });

      // ── 8. Basketball rules engine — score changes → events ───────────────
      await updateClipSource(clipId, {
        processingStage: "basketball_rules_engine",
        processingProgress: 65,
      });

      const scoreChangeEvents = detectScoreChanges(scoreboardReadings, clipId, ownerId, setup);
      const audioCueEvents = buildAudioCueEvents(audioAnalysis, clipId, ownerId);
      const allEvents = [...scoreChangeEvents, ...audioCueEvents];

      console.log("CLIP_ROOM_EVENTS", {
        clipId,
        fromScoreboard: scoreChangeEvents.length,
        fromAudio: audioCueEvents.length,
      });

      await updateClipResult(clipId, {
        scoreChangesFound: scoreChangeEvents.length,
        eventsDetected: allEvents.length,
        eventsCounted: allEvents.filter((e) => e.status === "counted").length,
      });

      // ── 9. Confidence gate + persist events ───────────────────────────────
      await updateClipSource(clipId, {
        processingStage: "confidence_gate",
        processingProgress: 72,
      });

      if (allEvents.length > 0) {
        await updateClipSource(clipId, {
          processingStage: "activity",
          processingProgress: 76,
        });
        await insertClipEvents(allEvents);
      }

      await updateClipSource(clipId, {
        processingStage: "stats",
        processingProgress: 80,
      });

      // ── 10. Fallback: "What happened?" check play if no counted events ─────
      const countedEvents = allEvents.filter((e) => e.status === "counted");

      if (countedEvents.length === 0) {
        await updateClipSource(clipId, {
          processingStage: "check_plays",
          processingProgress: 84,
        });
        await insertClipPlays([{
          clipId,
          eventId: null,
          ownerId,
          question: WHAT_HAPPENED_QUESTION,
          context: buildWhatHappenedContext(probe, setup),
          timestampSeconds: null,
        }]);
      }

      // ── 11. Stats + press pack ────────────────────────────────────────────
      await updateClipSource(clipId, {
        processingStage: "press_pack",
        processingProgress: 90,
      });

      const stats = computeClipStats(
        allEvents.map((e) => ({ ...e, id: "x", createdAt: "", updatedAt: "" })),
      );

      let headline: string | null = null;
      let summary: string | null = null;

      if (countedEvents.length > 0) {
        const pressPack = await generatePressPack(countedEvents, stats, setup);
        headline = pressPack.headline;
        summary = pressPack.summary;
      } else {
        // Press Pack Starter from probe data
        const starter = await generatePressPackStarter(probe, setup, clipId);
        headline = starter.headline;
        summary = starter.summary;
      }

      const keyMoments = countedEvents
        .filter((e) => e.timestampSeconds !== null)
        .slice(0, 10)
        .map((e) => ({
          timestampSeconds: e.timestampSeconds!,
          description: simpleEventLabel(e.eventType, e.shotZone, e.points),
        }));

      await upsertClipPressPack({ clipId, ownerId, headline, summary, keyMoments, statLines: stats });

      // ── 12. Final clip_result + mark complete ─────────────────────────────
      const outcome = countedEvents.length > 0 ? "success" : "no_events";
      const outcomeReason = countedEvents.length > 0
        ? `${countedEvents.length} event(s) counted from scoreboard`
        : scoreboardReadings.length > 0
          ? "Scoreboard read, no score changes detected"
          : probe.scoreboardVisible
            ? "Scoreboard visible but no readings extracted"
            : "No scoreboard visible — manual review required";

      await updateClipResult(clipId, { outcome, outcomeReason });
      await updateClipSource(clipId, {
        status: "ready",
        processingStage: "complete",
        processingProgress: 100,
        error: null,
      });

      console.log("CLIP_ROOM_PROCESSING_COMPLETE", { clipId, eventCount: allEvents.length, outcome });
      return { ok: true, clipId, eventCount: allEvents.length, outcome };

    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error("CLIP_ROOM_PROCESSING_FAILED", { clipId, reason });
      await updateClipResult(clipId, { outcome: "failed", outcomeReason: reason }).catch(() => null);
      await updateClipSource(clipId, {
        status: "failed",
        processingStage: "failed",
        error: reason,
      }).catch(() => null);
      throw err;

    } finally {
      if (workDir) {
        await fs.rm(workDir, { recursive: true, force: true }).catch(() => null);
      }
    }
  },
});

// ─── Source probe ─────────────────────────────────────────────────────────────
// LLM role: QUALITY ASSESSMENT ONLY. Does not detect stat events.

type ProbeResult = {
  isPlayable: boolean;
  sourceType: ClipSourceType;
  courtVisible: boolean;
  hoopVisible: boolean;
  playersVisible: boolean;
  scoreboardVisible: boolean;
  actionWindowFound: boolean;
  sourceQuality: ClipSourceQuality;
  probeNotes: string | null;
};

async function runSourceProbe(
  probeDir: string,
  probeFiles: string[],
  clipId: string,
): Promise<ProbeResult> {
  const fallback: ProbeResult = {
    isPlayable: true,
    sourceType: "unknown",
    courtVisible: false,
    hoopVisible: false,
    playersVisible: false,
    scoreboardVisible: false,
    actionWindowFound: false,
    sourceQuality: "fair",
    probeNotes: null,
  };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || probeFiles.length === 0) return fallback;

  const openai = new OpenAI({ apiKey });
  const imageContents: OpenAI.Chat.ChatCompletionContentPart[] = [];

  for (const file of probeFiles.slice(0, 5)) {
    const buf = await fs.readFile(path.join(probeDir, file)).catch(() => null);
    if (!buf) continue;
    imageContents.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${buf.toString("base64")}`, detail: "low" },
    });
  }

  if (imageContents.length === 0) return fallback;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 400,
      messages: [
        {
          role: "system",
          content: `You assess basketball video quality. Do NOT detect stat events. Only assess source quality.
Return JSON only. No explanation. No markdown.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Assess these video frames. Return JSON:
{
  "isPlayable": true,
  "sourceType": "raw_game",
  "courtVisible": true,
  "hoopVisible": true,
  "playersVisible": true,
  "scoreboardVisible": false,
  "actionWindowFound": true,
  "sourceQuality": "good",
  "probeNotes": null
}
sourceType: raw_game | screen_recording | gallery_playback | unknown
sourceQuality: good | fair | poor | unusable
probeNotes: brief note if quality is poor/unusable, null otherwise`,
            },
            ...imageContents,
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "";
    const parsed = extractJsonObject(raw);
    if (!parsed) return fallback;

    return {
      isPlayable: Boolean(parsed.isPlayable ?? true),
      sourceType: (parsed.sourceType as ClipSourceType) ?? "unknown",
      courtVisible: Boolean(parsed.courtVisible),
      hoopVisible: Boolean(parsed.hoopVisible),
      playersVisible: Boolean(parsed.playersVisible),
      scoreboardVisible: Boolean(parsed.scoreboardVisible),
      actionWindowFound: Boolean(parsed.actionWindowFound),
      sourceQuality: (parsed.sourceQuality as ClipSourceQuality) ?? "fair",
      probeNotes: typeof parsed.probeNotes === "string" ? parsed.probeNotes : null,
    };
  } catch (err) {
    console.warn("CLIP_ROOM_PROBE_ERROR", { clipId, reason: String(err) });
    return fallback;
  }
}

// ─── Scoreboard OCR ───────────────────────────────────────────────────────────
// LLM role: READ NUMBERS from scoreboard only. Not detecting events.

type ScoreboardReading = {
  frameIndex: number;
  timestampSeconds: number;
  homeScore: number | null;
  awayScore: number | null;
  quarter: number | null;
};

async function runScoreboardOcr(
  framesDir: string,
  frameFiles: string[],
  clipId: string,
): Promise<ScoreboardReading[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || frameFiles.length === 0) return [];

  const openai = new OpenAI({ apiKey });
  const results: ScoreboardReading[] = [];

  // Sample every 10th frame (every 5s at 2fps) to limit API calls
  const sampledIndices: number[] = [];
  for (let i = 0; i < frameFiles.length; i += 10) {
    sampledIndices.push(i);
  }

  // Batch in groups of 4
  const BATCH_SIZE = 4;
  for (let b = 0; b < sampledIndices.length; b += BATCH_SIZE) {
    const batch = sampledIndices.slice(b, b + BATCH_SIZE);
    const imageContents: OpenAI.Chat.ChatCompletionContentPart[] = [];
    const batchMeta: Array<{ frameIndex: number; ts: number }> = [];

    for (const idx of batch) {
      const file = frameFiles[idx];
      const buf = await fs.readFile(path.join(framesDir, file)).catch(() => null);
      if (!buf) continue;
      const ts = idx * 0.5;
      imageContents.push({ type: "text", text: `Frame ${idx} at ${ts.toFixed(1)}s:` });
      imageContents.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${buf.toString("base64")}`, detail: "low" },
      });
      batchMeta.push({ frameIndex: idx, ts });
    }

    if (imageContents.length === 0) continue;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content: `Read scoreboard numbers in basketball video frames. Return JSON array only.
If no scoreboard visible in a frame, omit that frame. No explanation. No markdown.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Read the scoreboard in each frame. Return JSON array:
[{"frameIndex": 0, "timestampSeconds": 0.0, "homeScore": 42, "awayScore": 38, "quarter": 3}]
Use null for values you cannot read. Omit frames with no scoreboard.`,
              },
              ...imageContents,
            ],
          },
        ],
      });

      const raw = response.choices[0]?.message?.content?.trim() ?? "";
      const parsed = extractJsonArray(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === "object") {
            const r = item as Record<string, unknown>;
            results.push({
              frameIndex: typeof r.frameIndex === "number" ? r.frameIndex : 0,
              timestampSeconds: typeof r.timestampSeconds === "number" ? r.timestampSeconds : 0,
              homeScore: typeof r.homeScore === "number" ? r.homeScore : null,
              awayScore: typeof r.awayScore === "number" ? r.awayScore : null,
              quarter: typeof r.quarter === "number" ? r.quarter : null,
            });
          }
        }
      }
    } catch (err) {
      console.warn("CLIP_ROOM_SCOREBOARD_OCR_BATCH_ERROR", { clipId, batch: b, reason: String(err) });
    }

    if (b + BATCH_SIZE < sampledIndices.length) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  return results;
}

// ─── Basketball rules engine ──────────────────────────────────────────────────
// Pure function — no LLM. Score changes → events.

type EventInsert = {
  clipId: string;
  ownerId: string;
  eventType: ClipEventType;
  status: "counted" | "suggested" | "check" | "skipped";
  timestampSeconds: number | null;
  playerLabel: string | null;
  points: number;
  shotZone: ClipShotZone | null;
  proof: "scoreboard changed" | "audio cue" | "user marked";
  metadata: Record<string, unknown>;
  sortOrder: number;
};

function detectScoreChanges(
  readings: ScoreboardReading[],
  clipId: string,
  ownerId: string,
  setup: ClipSetup | null,
): EventInsert[] {
  if (readings.length < 2) return [];

  const events: EventInsert[] = [];
  let sortOrder = 0;
  const playerLabel = setup?.subjectName ?? null;

  // Sort by timestamp
  const sorted = [...readings].sort((a, b) => a.timestampSeconds - b.timestampSeconds);

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    const prevHome = prev.homeScore;
    const currHome = curr.homeScore;
    const prevAway = prev.awayScore;
    const currAway = curr.awayScore;

    if (prevHome === null || currHome === null || prevAway === null || currAway === null) continue;

    const homeDelta = currHome - prevHome;
    const awayDelta = currAway - prevAway;
    const delta = homeDelta + awayDelta;

    // Only consider positive score changes in range 1-3
    if (delta <= 0 || delta > 3) continue;

    const ts = curr.timestampSeconds;

    // Delta 1 → free throw, 2 → 2pt, 3 → 3pt
    const shotZone: ClipShotZone | null =
      delta === 1 ? "free_throw" :
      delta === 3 ? "three_point" :
      "paint";

    const eventType: ClipEventType = delta === 1 ? "free_throw" : "make";

    events.push({
      clipId,
      ownerId,
      eventType,
      status: "counted",
      timestampSeconds: ts,
      playerLabel,
      points: delta,
      shotZone,
      proof: "scoreboard changed",
      metadata: {
        homeDelta,
        awayDelta,
        homeScore: currHome,
        awayScore: currAway,
        prevHomeScore: prevHome,
        prevAwayScore: prevAway,
      },
      sortOrder: sortOrder++,
    });
  }

  return events;
}

function buildAudioCueEvents(
  audioAnalysis: ClipAudioAnalysis | null,
  clipId: string,
  ownerId: string,
): EventInsert[] {
  if (!audioAnalysis) return [];

  const events: EventInsert[] = [];
  let sortOrder = 1000;

  for (const cue of audioAnalysis.cues) {
    if (cue.type === "whistle") {
      events.push({
        clipId,
        ownerId,
        eventType: "foul",
        status: "check",
        timestampSeconds: cue.timestampSeconds,
        playerLabel: null,
        points: 0,
        shotZone: null,
        proof: "audio cue",
        metadata: { cue: cue.cue, source: "audio" },
        sortOrder: sortOrder++,
      });
    }
  }

  return events;
}

// ─── Audio extraction + transcription ────────────────────────────────────────

async function extractAudio(inputPath: string, outputPath: string) {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { resolveAxisFfmpeg } = await import("../src/lib/axis-ffmpeg");

  const resolved = await resolveAxisFfmpeg();
  const execAsync = promisify(execFile);

  await execAsync(resolved.ffmpeg.command, [
    "-i", inputPath,
    "-vn",
    "-ar", "16000",
    "-ac", "1",
    "-f", "mp3",
    "-y",
    outputPath,
  ]);
}

async function transcribeAudio(audioPath: string): Promise<ClipAudioAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { transcript: "", cues: [] };

  const stat = await fs.stat(audioPath).catch(() => null);
  if (!stat || stat.size < 1024) return { transcript: "", cues: [] };

  const openai = new OpenAI({ apiKey });
  const fileBuffer = await fs.readFile(audioPath);
  const audioFile = new File([fileBuffer], "audio.mp3", { type: "audio/mp3" });

  const transcription = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file: audioFile,
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
  });

  const text = transcription.text ?? "";
  const cues = extractAudioCues(text);
  return { transcript: text, cues };
}

function extractAudioCues(transcript: string): ClipAudioAnalysis["cues"] {
  const cues: ClipAudioAnalysis["cues"] = [];
  const lower = transcript.toLowerCase();

  const patterns: Array<{ pattern: RegExp; cue: string; type: ClipAudioAnalysis["cues"][number]["type"] }> = [
    { pattern: /whistle|foul|stop/i,    cue: "Whistle or foul call",   type: "whistle" },
    { pattern: /and one|and-one/i,      cue: "And-one call",           type: "whistle" },
    { pattern: /good|yes|nice|that's it/i, cue: "Positive verbal cue", type: "coach" },
    { pattern: /buzzer|time|clock/i,    cue: "Clock or buzzer",        type: "buzzer" },
  ];

  for (const { pattern, cue, type } of patterns) {
    if (pattern.test(lower)) {
      cues.push({ timestampSeconds: 0, cue, type });
    }
  }

  return cues;
}

// ─── Press pack generation ────────────────────────────────────────────────────
// LLM role: NARRATIVE only, from source-linked activity data.

async function generatePressPack(
  events: EventInsert[],
  stats: ReturnType<typeof computeClipStats>,
  setup: ClipSetup | null,
): Promise<{ headline: string | null; summary: string | null }> {
  const apiKey = process.env.OPENAI_API_KEY;
  const subjectName = setup?.subjectName ?? (setup?.subjectType === "team" ? "the team" : "the player");
  const sessionType = setup?.sessionType ?? "session";
  const statSummary = `${stats.pts} PTS, ${stats.fgm}/${stats.fga} FG, ${stats.reb} REB, ${stats.ast} AST`;
  const fallback = {
    headline: `${subjectName} clip reviewed`,
    summary: `Axis created a source-linked activity summary for this ${sessionType}. Counted activity: ${statSummary}.`,
  };

  if (!apiKey || events.length === 0) return fallback;

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content: "You write brief, factual basketball press pack summaries. No hype. No emojis. Short sentences.",
        },
        {
          role: "user",
          content: `Write a headline and short summary for this ${sessionType} clip.
Subject: ${subjectName}
Stats: ${statSummary}
Evidence source: scoreboard score changes

Format:
HEADLINE: [one sentence]
SUMMARY: [2-3 sentences]`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    const headlineMatch = text.match(/HEADLINE:\s*(.+)/i);
    const summaryMatch = text.match(/SUMMARY:\s*([\s\S]+)/i);
    return {
      headline: headlineMatch?.[1]?.trim() ?? null,
      summary: summaryMatch?.[1]?.trim() ?? null,
    };
  } catch (err) {
    console.warn("CLIP_ROOM_PRESS_PACK_ERROR", { reason: String(err) });
    return fallback;
  }
}

async function generatePressPackStarter(
  probe: ProbeResult,
  setup: ClipSetup | null,
  clipId: string,
): Promise<{ headline: string | null; summary: string | null }> {
  const subjectName = setup?.subjectName ?? (setup?.subjectType === "team" ? "the team" : "the player");
  const sessionType = setup?.sessionType ?? "clip";
  const qualityNote = probe.sourceQuality === "poor"
    ? "Limited visibility in this clip."
    : probe.scoreboardVisible
      ? "Scoreboard visible but no score changes detected."
      : "No scoreboard detected — manual review may be needed.";
  const fallback = {
    headline: `${subjectName} clip ready for review`,
    summary: `${qualityNote} Axis created a Check Play so the ${sessionType} can be marked without inventing stats.`,
  };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 150,
      messages: [
        {
          role: "system",
          content: "You write brief basketball clip summaries. Factual, concise. No invented stats.",
        },
        {
          role: "user",
          content: `Write a brief clip summary for this ${sessionType}.
Subject: ${subjectName}
Court visible: ${probe.courtVisible}
Players visible: ${probe.playersVisible}
Scoreboard visible: ${probe.scoreboardVisible}
Note: ${qualityNote}
No automatic stats were counted. User will mark the play.

Format:
HEADLINE: [one line]
SUMMARY: [1-2 sentences, factual, no invented stats]`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    const headlineMatch = text.match(/HEADLINE:\s*(.+)/i);
    const summaryMatch = text.match(/SUMMARY:\s*([\s\S]+)/i);
    return {
      headline: headlineMatch?.[1]?.trim() ?? null,
      summary: summaryMatch?.[1]?.trim() ?? null,
    };
  } catch (err) {
    console.warn("CLIP_ROOM_PRESS_PACK_STARTER_ERROR", { clipId, reason: String(err) });
    return fallback;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildWhatHappenedContext(probe: ProbeResult, setup: ClipSetup | null): string {
  const parts: string[] = [];
  if (setup?.sessionType) parts.push(`${setup.sessionType} clip`);
  if (probe.sourceQuality) parts.push(`Quality: ${probe.sourceQuality}`);
  if (!probe.scoreboardVisible) parts.push("No scoreboard detected");
  else parts.push("Scoreboard visible, no score changes found");
  if (probe.probeNotes) parts.push(probe.probeNotes);
  return parts.join(". ");
}

function simpleEventLabel(type: string, shotZone: ClipShotZone | null, points: number): string {
  if (type === "make") {
    if (shotZone === "three_point" || points === 3) return "Three-point make";
    if (shotZone === "free_throw") return "Free throw made";
    return "Field goal";
  }
  if (type === "free_throw") return "Free throw";
  if (type === "miss") return "Missed shot";
  if (type === "rebound") return "Rebound";
  if (type === "assist") return "Assist";
  if (type === "turnover") return "Turnover";
  if (type === "steal") return "Steal";
  if (type === "block") return "Block";
  if (type === "foul") return "Foul";
  return type;
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractJsonArray(text: string): unknown[] | null {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
