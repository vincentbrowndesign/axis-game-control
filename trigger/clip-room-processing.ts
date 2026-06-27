import { task } from "@trigger.dev/sdk/v3";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import OpenAI from "openai";

import { extractAxisFrames, probeAxisVideoMetadata } from "../src/lib/axis-ffmpeg";
import {
  computeClipStats,
  insertClipEvents,
  insertClipPlays,
  updateClipSource,
  upsertClipPressPack,
} from "../src/lib/clip-room/db";
import type {
  ClipAudioAnalysis,
  ClipEventType,
  ClipFrameAnalysis,
  ClipProcessingPayload,
  ClipProof,
  ClipSetup,
  ClipShotZone,
} from "../src/lib/clip-room/types";
import { waitForCloudflareMp4Download } from "../src/lib/cloudflare-stream";

export const clipRoomProcessing = task({
  id: "clip-room-processing",
  maxDuration: 600,
  queue: {
    name: "clip-room-processing",
    concurrencyLimit: 2,
  },
  run: async (payload: ClipProcessingPayload) => {
    const { clipId, ownerId, cloudflareUid, setup } = payload;
    let workDir: string | undefined;

    console.log("CLIP_ROOM_PROCESSING_START", { clipId, cloudflareUid });

    try {
      await updateClipSource(clipId, {
        status: "processing",
        processingStage: "waiting_for_video",
        processingProgress: 10,
      });

      // ── 1. Wait for Cloudflare MP4 ──────────────────────────────────────────
      const mp4Url = await waitForCloudflareMp4Download(cloudflareUid);
      console.log("CLIP_ROOM_MP4_READY", { clipId, mp4Url });

      await updateClipSource(clipId, {
        processingStage: "extracting_frames",
        processingProgress: 20,
      });

      // ── 2. Set up work directory and extract frames ─────────────────────────
      workDir = await fs.mkdtemp(path.join(os.tmpdir(), `clip-${clipId}-`));
      const framesDir = path.join(workDir, "frames");
      const audioPath = path.join(workDir, "audio.mp3");

      await extractAxisFrames({
        fps: 2,
        inputPath: mp4Url,
        outputDir: framesDir,
        operationName: "CLIP_ROOM_FRAME_EXTRACTION",
      });

      const frameFiles = (await fs.readdir(framesDir))
        .filter((f) => f.endsWith(".jpg"))
        .sort();

      console.log("CLIP_ROOM_FRAMES_EXTRACTED", { clipId, frameCount: frameFiles.length });

      // ── 3. Probe video metadata ─────────────────────────────────────────────
      let durationSeconds: number | null = null;
      try {
        const meta = await probeAxisVideoMetadata(mp4Url);
        durationSeconds = meta.duration;
        await updateClipSource(clipId, { durationSeconds });
      } catch { /* non-fatal */ }

      await updateClipSource(clipId, {
        processingStage: "extracting_audio",
        processingProgress: 30,
      });

      // ── 4. Extract audio ────────────────────────────────────────────────────
      let audioAnalysis: ClipAudioAnalysis | null = null;
      try {
        await extractAudio(mp4Url, audioPath);
        audioAnalysis = await transcribeAudio(audioPath);
        console.log("CLIP_ROOM_AUDIO_TRANSCRIBED", { clipId, cueCount: audioAnalysis.cues.length });
      } catch (err) {
        console.warn("CLIP_ROOM_AUDIO_SKIPPED", { clipId, reason: String(err) });
      }

      await updateClipSource(clipId, {
        processingStage: "analyzing_frames",
        processingProgress: 40,
      });

      // ── 5. Vision analysis in batches ───────────────────────────────────────
      const frameAnalyses = await analyzeFramesWithVision(
        framesDir,
        frameFiles,
        setup,
        clipId,
      );

      console.log("CLIP_ROOM_VISION_DONE", { clipId, analysisCount: frameAnalyses.length });

      await updateClipSource(clipId, {
        processingStage: "applying_basketball_logic",
        processingProgress: 65,
      });

      // ── 6. Basketball logic — generate events from evidence ─────────────────
      const { events, checkPlays } = applyBasketballLogic(
        frameAnalyses,
        audioAnalysis,
        setup,
        clipId,
        ownerId,
      );

      // ── 7. Scoreboard reconciliation (if visible) ───────────────────────────
      if (setup?.scoreboardVisible === "yes") {
        reconcileScoreboard(frameAnalyses, events);
      }

      // ── 8. Persist events ───────────────────────────────────────────────────
      if (events.length > 0) {
        await insertClipEvents(events);
      }

      await updateClipSource(clipId, {
        processingStage: "creating_check_plays",
        processingProgress: 75,
      });

      // ── 9. Persist check plays ──────────────────────────────────────────────
      if (checkPlays.length > 0) {
        await insertClipPlays(checkPlays);
      }

      await updateClipSource(clipId, {
        processingStage: "generating_press_pack",
        processingProgress: 85,
      });

      // ── 10. Generate press pack ─────────────────────────────────────────────
      const stats = computeClipStats(
        events.map((e) => ({ ...e, id: "x", createdAt: "", updatedAt: "" })),
      );

      const pressPack = await generatePressPack(events, stats, setup, clipId, ownerId);

      await upsertClipPressPack(pressPack);

      // ── 11. Mark complete ───────────────────────────────────────────────────
      await updateClipSource(clipId, {
        status: "ready",
        processingStage: "complete",
        processingProgress: 100,
        error: null,
      });

      console.log("CLIP_ROOM_PROCESSING_COMPLETE", {
        clipId,
        eventCount: events.length,
        checkPlayCount: checkPlays.length,
      });

      return { ok: true, clipId, eventCount: events.length, checkPlayCount: checkPlays.length };

    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error("CLIP_ROOM_PROCESSING_FAILED", { clipId, reason });
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

function extractAudioCues(
  transcript: string,
): ClipAudioAnalysis["cues"] {
  const cues: ClipAudioAnalysis["cues"] = [];
  const lower = transcript.toLowerCase();

  const keywords: Array<{ pattern: RegExp; cue: string; type: ClipAudioAnalysis["cues"][number]["type"] }> = [
    { pattern: /whistle|foul|stop/i, cue: "Whistle or foul call", type: "whistle" },
    { pattern: /and one|and-one/i, cue: "And-one call", type: "whistle" },
    { pattern: /good|yes|nice|that's it/i, cue: "Positive verbal cue", type: "coach" },
    { pattern: /no|miss|out|off/i, cue: "Negative verbal cue", type: "coach" },
    { pattern: /buzzer|time|clock/i, cue: "Clock or buzzer", type: "buzzer" },
  ];

  for (const { pattern, cue, type } of keywords) {
    if (pattern.test(lower)) {
      cues.push({ timestampSeconds: 0, cue, type });
    }
  }

  return cues;
}

// ─── Vision analysis ──────────────────────────────────────────────────────────

async function analyzeFramesWithVision(
  framesDir: string,
  frameFiles: string[],
  setup: ClipSetup | null,
  clipId: string,
): Promise<ClipFrameAnalysis[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || frameFiles.length === 0) return [];

  const openai = new OpenAI({ apiKey });
  const results: ClipFrameAnalysis[] = [];
  const BATCH_SIZE = 6;

  for (let i = 0; i < frameFiles.length; i += BATCH_SIZE) {
    const batch = frameFiles.slice(i, i + BATCH_SIZE);
    const batchAnalyses = await analyzeFrameBatch(openai, framesDir, batch, i, setup);
    results.push(...batchAnalyses);
    // Short pause to avoid rate limits
    if (i + BATCH_SIZE < frameFiles.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return results;
}

async function analyzeFrameBatch(
  openai: OpenAI,
  framesDir: string,
  frameFiles: string[],
  startIndex: number,
  setup: ClipSetup | null,
): Promise<ClipFrameAnalysis[]> {
  const imageContents: OpenAI.Chat.ChatCompletionContentPart[] = [];

  for (let i = 0; i < frameFiles.length; i++) {
    const framePath = path.join(framesDir, frameFiles[i]);
    const imageBuffer = await fs.readFile(framePath).catch(() => null);
    if (!imageBuffer) continue;

    const base64 = imageBuffer.toString("base64");
    const timestampSeconds = (startIndex + i) * 0.5; // 2fps = 0.5s per frame

    imageContents.push({
      type: "text",
      text: `Frame ${startIndex + i + 1} at t=${timestampSeconds.toFixed(1)}s:`,
    });
    imageContents.push({
      type: "image_url",
      image_url: {
        url: `data:image/jpeg;base64,${base64}`,
        detail: "low",
      },
    });
  }

  if (imageContents.length === 0) return [];

  const contextNote = setup
    ? `Context: ${setup.sessionType} session, tracking ${setup.subjectType} "${setup.subjectName ?? "unknown"}". Jersey color: ${setup.jerseyColor ?? "unknown"}. Scoreboard expected: ${setup.scoreboardVisible ?? "unknown"}.`
    : "Context: basketball game or practice clip.";

  const systemPrompt = `You are a basketball video analyst. Analyze these video frames and detect basketball events.
${contextNote}

For each frame, identify:
- Is a player visible?
- Is the basketball visible?
- Is a basketball rim/hoop visible?
- Is a scoreboard visible?
- What basketball events are happening? (shot attempts, makes, misses, rebounds, assists, turnovers, fouls, blocks, steals, free throws)
- Shot zone: paint (within 6ft of basket), mid_range (inside arc), three_point (behind arc), free_throw (line)
- Scoreboard reading if visible (home score, away score, quarter, time)

Respond with a JSON array — one object per frame — in this exact format:
[
  {
    "frameIndex": 0,
    "timestampSeconds": 0.0,
    "hasPlayer": true,
    "hasBall": false,
    "hasRim": true,
    "hasScoreboard": false,
    "events": [
      {
        "type": "shot_attempt",
        "confidence": "medium",
        "shotZone": "mid_range",
        "points": 2,
        "description": "Player releases shot from mid-range"
      }
    ],
    "scoreboardReading": null
  }
]

Event types: shot_attempt, make, miss, rebound, assist, turnover, foul, block, steal, free_throw
Confidence: high, medium, low
Points: 1 (free throw), 2 (2-point), 3 (three pointer), 0 (no score event)
If no events, return empty events array.
Only return valid JSON. No explanation. No markdown.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 2000,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: imageContents,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "";
    const parsed = extractJson(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is ClipFrameAnalysis => item && typeof item === "object")
      .map((item, idx) => ({
        frameIndex: typeof item.frameIndex === "number" ? item.frameIndex : startIndex + idx,
        timestampSeconds: typeof item.timestampSeconds === "number" ? item.timestampSeconds : (startIndex + idx) * 0.5,
        hasPlayer: Boolean(item.hasPlayer),
        hasBall: Boolean(item.hasBall),
        hasRim: Boolean(item.hasRim),
        hasScoreboard: Boolean(item.hasScoreboard),
        events: Array.isArray(item.events) ? item.events : [],
        scoreboardReading: item.scoreboardReading ?? undefined,
      }));
  } catch (err) {
    console.warn("CLIP_ROOM_VISION_BATCH_ERROR", { startIndex, reason: String(err) });
    return [];
  }
}

function extractJson(text: string): unknown {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// ─── Basketball logic ─────────────────────────────────────────────────────────

type EventInsert = {
  clipId: string;
  ownerId: string;
  eventType: ClipEventType;
  status: "counted" | "suggested" | "check" | "skipped";
  timestampSeconds: number | null;
  playerLabel: string | null;
  points: number;
  shotZone: ClipShotZone | null;
  proof: ClipProof | null;
  metadata: Record<string, unknown>;
  sortOrder: number;
};

type PlayInsert = {
  clipId: string;
  eventId: string | null;
  ownerId: string;
  question: string;
  context: string | null;
  timestampSeconds: number | null;
};

function applyBasketballLogic(
  frameAnalyses: ClipFrameAnalysis[],
  audioAnalysis: ClipAudioAnalysis | null,
  setup: ClipSetup | null,
  clipId: string,
  ownerId: string,
): { events: EventInsert[]; checkPlays: PlayInsert[] } {
  const events: EventInsert[] = [];
  const checkPlays: PlayInsert[] = [];
  let sortOrder = 0;

  // Deduplicate events: only emit one event per 2-second window per type
  const emittedWindows = new Map<string, number>();

  function shouldEmit(type: string, timestampSeconds: number): boolean {
    const windowKey = `${type}-${Math.floor(timestampSeconds / 2)}`;
    if (emittedWindows.has(windowKey)) return false;
    emittedWindows.set(windowKey, timestampSeconds);
    return true;
  }

  for (const frame of frameAnalyses) {
    for (const detection of frame.events) {
      if (!shouldEmit(detection.type, frame.timestampSeconds)) continue;

      const eventType = detection.type as ClipEventType;
      const confidence = detection.confidence;
      const shotZone = (detection.shotZone as ClipShotZone | undefined) ?? null;
      const points = typeof detection.points === "number" ? detection.points : 0;

      // High confidence → counted, medium → suggested, low → check
      let status: EventInsert["status"];
      let proof: ClipProof;

      if (eventType === "make") {
        proof = "make detected";
        status = confidence === "high" ? "counted" : confidence === "medium" ? "suggested" : "check";
      } else if (eventType === "miss") {
        proof = "miss detected";
        status = confidence === "high" ? "counted" : confidence === "medium" ? "suggested" : "check";
      } else if (eventType === "shot_attempt") {
        proof = "shot detected";
        status = confidence === "high" ? "counted" : "suggested";
      } else if (eventType === "rebound") {
        proof = "rebound detected";
        status = confidence === "high" ? "counted" : "suggested";
      } else if (eventType === "assist") {
        proof = "assist detected";
        status = confidence === "high" ? "suggested" : "check";
      } else if (eventType === "turnover") {
        proof = "turnover detected";
        status = confidence === "high" ? "counted" : "check";
      } else if (eventType === "steal") {
        proof = "steal detected";
        status = confidence === "high" ? "counted" : "suggested";
      } else if (eventType === "block") {
        proof = "block detected";
        status = confidence === "high" ? "counted" : "suggested";
      } else if (eventType === "foul") {
        proof = "possession changed";
        status = confidence === "high" ? "counted" : "check";
      } else {
        proof = "shot detected";
        status = "suggested";
      }

      // If player detection is unreliable, downgrade
      if (!frame.hasPlayer) {
        proof = "player unclear";
        if (status === "counted") status = "check";
      }

      const event: EventInsert = {
        clipId,
        ownerId,
        eventType,
        status,
        timestampSeconds: frame.timestampSeconds,
        playerLabel: setup?.subjectName ?? null,
        points,
        shotZone,
        proof,
        metadata: {
          confidence,
          description: detection.description,
          hasPlayer: frame.hasPlayer,
          hasBall: frame.hasBall,
          hasRim: frame.hasRim,
        },
        sortOrder: sortOrder++,
      };

      events.push(event);

      // Generate check play for ambiguous events
      if (status === "check") {
        checkPlays.push({
          clipId,
          eventId: null, // Will be linked after insert returns IDs — simplified for MVP
          ownerId,
          question: buildQuestion(eventType, shotZone),
          context: buildContext(frame, detection.description),
          timestampSeconds: frame.timestampSeconds,
        });
      }
    }
  }

  // Add audio cues as events if relevant
  if (audioAnalysis) {
    for (const cue of audioAnalysis.cues) {
      if (cue.type === "whistle" && shouldEmit("foul_audio", cue.timestampSeconds)) {
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

        checkPlays.push({
          clipId,
          eventId: null,
          ownerId,
          question: "Was this a foul call?",
          context: `Audio cue detected: "${cue.cue}"`,
          timestampSeconds: cue.timestampSeconds,
        });
      }
    }
  }

  // If we got very few or no events but frames were analyzed, add a blurry note
  if (events.length === 0 && frameAnalyses.length > 0) {
    const anyPlayer = frameAnalyses.some((f) => f.hasPlayer);
    if (!anyPlayer) {
      events.push({
        clipId,
        ownerId,
        eventType: "shot_attempt",
        status: "check",
        timestampSeconds: 0,
        playerLabel: null,
        points: 0,
        shotZone: null,
        proof: "clip blurry",
        metadata: { note: "No players detected in any frame" },
        sortOrder: 0,
      });
    }
  }

  return { events, checkPlays };
}

function buildQuestion(eventType: ClipEventType, shotZone: ClipShotZone | null): string {
  if (eventType === "make") {
    if (shotZone === "three_point") return "Was this a three-point make?";
    if (shotZone === "free_throw") return "Was this free throw made?";
    return "Was this shot made?";
  }
  if (eventType === "miss") return "Was this shot missed?";
  if (eventType === "shot_attempt") return "Was this a shot attempt?";
  if (eventType === "rebound") return "Did the player get this rebound?";
  if (eventType === "assist") return "Was there an assist on this basket?";
  if (eventType === "turnover") return "Was this a turnover?";
  if (eventType === "foul") return "Was this a foul?";
  if (eventType === "block") return "Was this shot blocked?";
  if (eventType === "steal") return "Was this a steal?";
  return "What happened here?";
}

function buildContext(frame: ClipFrameAnalysis, description: string): string {
  const parts: string[] = [];
  if (description) parts.push(description);
  if (!frame.hasPlayer) parts.push("Player position unclear");
  if (!frame.hasBall) parts.push("Ball not visible");
  if (frame.hasRim) parts.push("Rim visible");
  return parts.join(". ") || null!;
}

function reconcileScoreboard(
  frameAnalyses: ClipFrameAnalysis[],
  events: EventInsert[],
) {
  const scoreboardFrames = frameAnalyses.filter(
    (f) => f.hasScoreboard && f.scoreboardReading,
  );

  for (let i = 1; i < scoreboardFrames.length; i++) {
    const prev = scoreboardFrames[i - 1].scoreboardReading;
    const curr = scoreboardFrames[i].scoreboardReading;
    if (!prev || !curr) continue;

    const prevTotal = (prev.homeScore ?? 0) + (prev.awayScore ?? 0);
    const currTotal = (curr.homeScore ?? 0) + (curr.awayScore ?? 0);
    const diff = currTotal - prevTotal;

    if (diff > 0 && diff <= 3) {
      const ts = scoreboardFrames[i].timestampSeconds;
      // Find the nearest shot event and mark it counted
      const nearestShot = events.find(
        (e) =>
          (e.eventType === "make" || e.eventType === "shot_attempt") &&
          e.timestampSeconds !== null &&
          Math.abs(e.timestampSeconds - ts) < 5,
      );
      if (nearestShot) {
        nearestShot.status = "counted";
        nearestShot.points = diff;
        nearestShot.proof = "scoreboard changed";
        if (diff === 3) nearestShot.shotZone = "three_point";
      }
    }
  }
}

// ─── Press Pack generation ────────────────────────────────────────────────────

async function generatePressPack(
  events: EventInsert[],
  stats: ReturnType<typeof computeClipStats>,
  setup: ClipSetup | null,
  clipId: string,
  ownerId: string,
) {
  const apiKey = process.env.OPENAI_API_KEY;
  const subjectName = setup?.subjectName ?? (setup?.subjectType === "team" ? "the team" : "the player");
  const sessionType = setup?.sessionType ?? "session";

  const countedEvents = events.filter((e) => e.status === "counted");
  const keyMoments = countedEvents
    .filter((e) => e.timestampSeconds !== null)
    .slice(0, 10)
    .map((e) => ({
      timestampSeconds: e.timestampSeconds!,
      description: simpleEventLabel(e.eventType, e.shotZone, e.points),
    }));

  let headline: string | null = null;
  let summary: string | null = null;

  if (apiKey && countedEvents.length > 0) {
    try {
      const openai = new OpenAI({ apiKey });
      const statSummary = `${stats.pts} PTS, ${stats.fgm}/${stats.fga} FG, ${stats.reb} REB, ${stats.ast} AST, ${stats.stl} STL, ${stats.blk} BLK, ${stats.to} TO`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 200,
        messages: [
          {
            role: "system",
            content: `You write brief, factual basketball press pack summaries. No hype. No emojis. Short sentences.`,
          },
          {
            role: "user",
            content: `Write a one-sentence headline and one short paragraph (2-3 sentences) for this ${sessionType} clip.
Subject: ${subjectName}
Stats: ${statSummary}
Key events: ${countedEvents.map((e) => e.proof).filter(Boolean).join(", ")}

Format:
HEADLINE: [one sentence]
SUMMARY: [2-3 sentences]`,
          },
        ],
      });

      const text = response.choices[0]?.message?.content ?? "";
      const headlineMatch = text.match(/HEADLINE:\s*(.+)/i);
      const summaryMatch = text.match(/SUMMARY:\s*([\s\S]+)/i);
      headline = headlineMatch?.[1]?.trim() ?? null;
      summary = summaryMatch?.[1]?.trim() ?? null;
    } catch (err) {
      console.warn("CLIP_ROOM_PRESS_PACK_AI_SKIPPED", { reason: String(err) });
    }
  }

  return {
    clipId,
    ownerId,
    headline,
    summary,
    keyMoments,
    statLines: stats,
  };
}

function simpleEventLabel(type: string, shotZone: ClipShotZone | null, points: number): string {
  if (type === "make") {
    if (shotZone === "three_point" || points === 3) return "Three-point make";
    if (shotZone === "free_throw") return "Free throw made";
    return "Field goal";
  }
  if (type === "miss") return "Missed shot";
  if (type === "rebound") return "Rebound";
  if (type === "assist") return "Assist";
  if (type === "turnover") return "Turnover";
  if (type === "steal") return "Steal";
  if (type === "block") return "Block";
  if (type === "foul") return "Foul";
  return type;
}
