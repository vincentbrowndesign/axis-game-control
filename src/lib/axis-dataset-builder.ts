import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";

type DatasetVideoInput = {
  muxPlaybackId?: string;
  videoId?: string;
  videoUrl?: string;
};

export type AxisDatasetBuilderInput = {
  sampleEverySeconds?: number;
  targetFrameCount?: number;
  videos: DatasetVideoInput[];
};

type CandidateFrame = {
  brightness: number;
  candidateIndex: number;
  contrast: number;
  edge: number;
  filePath: string;
  hash: string;
  score: number;
  sourceFrame: number;
  timestamp: number;
  videoId: string;
};

type DatasetFrameMetadata = {
  frame: string;
  score: number;
  source_frame: number;
  timestamp: number;
  video_id: string;
};

export type AxisDatasetBuilderResult = {
  candidate_frames: number;
  dataset_dir: string;
  frame_count: number;
  metadata_path: string;
  sample_every_seconds: number;
  selected_frames: DatasetFrameMetadata[];
  target_frame_count: number;
  videos: Array<{ candidate_frames: number; video_id: string }>;
};

const defaultSampleEverySeconds = 0.25;
const defaultTargetFrameCount = 300;
const maxTargetFrameCount = 500;
const minTargetFrameCount = 200;
const duplicateDistance = 10;

export async function buildAxisDataset(input: AxisDatasetBuilderInput): Promise<AxisDatasetBuilderResult> {
  const videos = normalizeVideos(input.videos);
  if (!videos.length) throw new Error("At least one videoUrl or muxPlaybackId is required.");

  const ffmpegPath = await getFfmpegPath();
  ffmpeg.setFfmpegPath(ffmpegPath);

  const sampleEverySeconds = clampSampleEverySeconds(input.sampleEverySeconds);
  const targetFrameCount = clampTargetFrameCount(input.targetFrameCount);
  const datasetDir = path.join(process.cwd(), "dataset");
  const metadataPath = path.join(datasetDir, "metadata.json");
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "axis-dataset-builder-"));

  await prepareDatasetDir(datasetDir);

  const candidates: CandidateFrame[] = [];
  const videoStats: AxisDatasetBuilderResult["videos"] = [];
  for (const [index, video] of videos.entries()) {
    const videoWorkDir = path.join(workDir, `video_${String(index + 1).padStart(3, "0")}`);
    await fs.mkdir(videoWorkDir, { recursive: true });
    const extracted = await extractCandidateFrames({
      outputDir: videoWorkDir,
      sampleEverySeconds,
      videoUrl: video.videoUrl,
    });
    videoStats.push({ candidate_frames: extracted.length, video_id: video.videoId });

    for (const frame of extracted) {
      const analyzed = await analyzeCandidateFrame({
        candidateIndex: candidates.length + 1,
        filePath: frame.filePath,
        sampleEverySeconds,
        sourceFrame: frame.sourceFrame,
        videoId: video.videoId,
      });
      candidates.push(analyzed);
    }
  }

  const selected = selectUsefulFrames(candidates, targetFrameCount);
  const selectedMetadata = await writeDatasetFrames({
    datasetDir,
    selected,
  });
  await fs.writeFile(
    metadataPath,
    JSON.stringify(
      {
        candidate_frames: candidates.length,
        created_at: new Date().toISOString(),
        frame_count: selectedMetadata.length,
        frames: selectedMetadata,
        sample_every_seconds: sampleEverySeconds,
        target_frame_count: targetFrameCount,
        videos: videoStats,
      },
      null,
      2,
    ),
    "utf8",
  );

  return {
    candidate_frames: candidates.length,
    dataset_dir: datasetDir,
    frame_count: selectedMetadata.length,
    metadata_path: metadataPath,
    sample_every_seconds: sampleEverySeconds,
    selected_frames: selectedMetadata,
    target_frame_count: targetFrameCount,
    videos: videoStats,
  };
}

function normalizeVideos(videos: DatasetVideoInput[]) {
  return videos
    .map((video, index) => {
      const muxPlaybackId = cleanString(video.muxPlaybackId);
      const videoUrl = cleanString(video.videoUrl) || getMuxPlaybackUrl(muxPlaybackId);
      if (!videoUrl) return null;
      return {
        videoId: cleanString(video.videoId) || muxPlaybackId || `video_${index + 1}`,
        videoUrl,
      };
    })
    .filter((video): video is { videoId: string; videoUrl: string } => Boolean(video));
}

function getMuxPlaybackUrl(playbackId?: string) {
  return playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : "";
}

async function prepareDatasetDir(datasetDir: string) {
  await fs.mkdir(datasetDir, { recursive: true });
  const entries = await fs.readdir(datasetDir);
  await Promise.all(
    entries
      .filter((entry) => /^frame_\d+\.jpg$/i.test(entry) || entry === "metadata.json")
      .map((entry) => fs.unlink(path.join(datasetDir, entry))),
  );
}

async function extractCandidateFrames({
  outputDir,
  sampleEverySeconds,
  videoUrl,
}: {
  outputDir: string;
  sampleEverySeconds: number;
  videoUrl: string;
}) {
  const fps = 1 / sampleEverySeconds;
  await runFfmpeg((command) => {
    command
      .input(videoUrl)
      .outputOptions(["-vf", `fps=${fps}`, "-q:v", "2"])
      .output(path.join(outputDir, "candidate_%06d.jpg"));
  });

  const entries = await fs.readdir(outputDir);
  return entries
    .filter((entry) => /^candidate_\d+\.jpg$/i.test(entry))
    .sort()
    .map((entry, index) => ({
      filePath: path.join(outputDir, entry),
      sourceFrame: index + 1,
    }));
}

async function analyzeCandidateFrame({
  candidateIndex,
  filePath,
  sampleEverySeconds,
  sourceFrame,
  videoId,
}: {
  candidateIndex: number;
  filePath: string;
  sampleEverySeconds: number;
  sourceFrame: number;
  videoId: string;
}): Promise<CandidateFrame> {
  const pixels = await readSmallGrayFrame(filePath);
  const hash = createDifferenceHash(pixels);
  const brightness = average(pixels);
  const contrast = standardDeviation(pixels, brightness);
  const edge = averageEdgeDelta(pixels, 9);
  const stats = await fs.stat(filePath);
  const sizeScore = Math.min(1, stats.size / 180000);
  const brightnessScore = 1 - Math.min(1, Math.abs(brightness - 128) / 128);
  const score = contrast * 0.42 + edge * 0.42 + brightnessScore * 28 + sizeScore * 18;

  return {
    brightness,
    candidateIndex,
    contrast,
    edge,
    filePath,
    hash,
    score,
    sourceFrame,
    timestamp: roundTimestamp((sourceFrame - 1) * sampleEverySeconds),
    videoId,
  };
}

async function readSmallGrayFrame(filePath: string) {
  const ffmpegPath = await getFfmpegPath();
  const output = await runBinary(ffmpegPath, [
    "-v",
    "error",
    "-i",
    filePath,
    "-vf",
    "scale=9:8,format=gray",
    "-f",
    "rawvideo",
    "-",
  ]);
  return Array.from(output);
}

function selectUsefulFrames(candidates: CandidateFrame[], targetFrameCount: number) {
  const ranked = [...candidates].sort((a, b) => b.score - a.score);
  const selected: CandidateFrame[] = [];

  for (const candidate of ranked) {
    if (selected.length >= targetFrameCount) break;
    if (selected.every((existing) => hammingDistance(candidate.hash, existing.hash) >= duplicateDistance)) {
      selected.push(candidate);
    }
  }

  for (const candidate of ranked) {
    if (selected.length >= targetFrameCount) break;
    if (!selected.includes(candidate)) selected.push(candidate);
  }

  return selected.sort((a, b) => a.videoId.localeCompare(b.videoId) || a.timestamp - b.timestamp);
}

async function writeDatasetFrames({ datasetDir, selected }: { datasetDir: string; selected: CandidateFrame[] }) {
  const metadata: DatasetFrameMetadata[] = [];
  for (const [index, frame] of selected.entries()) {
    const fileName = `frame_${String(index + 1).padStart(4, "0")}.jpg`;
    await fs.copyFile(frame.filePath, path.join(datasetDir, fileName));
    metadata.push({
      frame: fileName,
      score: Math.round(frame.score * 1000) / 1000,
      source_frame: frame.sourceFrame,
      timestamp: frame.timestamp,
      video_id: frame.videoId,
    });
  }
  return metadata;
}

async function getFfmpegPath() {
  const candidates = [
    typeof ffmpegStatic === "string" ? ffmpegStatic : "",
    path.join(process.cwd(), "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }

  throw new Error(`ffmpeg binary not found. Checked: ${candidates.join(", ")}`);
}

async function runFfmpeg(configure: (command: ffmpeg.FfmpegCommand) => void) {
  await new Promise<void>((resolve, reject) => {
    const command = ffmpeg();
    configure(command);
    command.on("end", () => resolve());
    command.on("error", (error) => reject(error));
    command.run();
  });
}

async function runBinary(command: string, args: string[]) {
  await fs.access(command);
  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(stdout));
      else reject(new Error(Buffer.concat(stderr).toString("utf8") || `Command failed with code ${code}`));
    });
  });
}

function createDifferenceHash(pixels: number[]) {
  const bits: string[] = [];
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      bits.push((pixels[y * 9 + x] ?? 0) > (pixels[y * 9 + x + 1] ?? 0) ? "1" : "0");
    }
  }
  return bits.join("");
}

function hammingDistance(a: string, b: string) {
  const length = Math.min(a.length, b.length);
  let distance = Math.abs(a.length - b.length);
  for (let index = 0; index < length; index += 1) {
    if (a[index] !== b[index]) distance += 1;
  }
  return distance;
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values: number[], mean: number) {
  if (!values.length) return 0;
  const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function averageEdgeDelta(values: number[], width: number) {
  const deltas: number[] = [];
  for (let index = 0; index < values.length; index += 1) {
    if ((index + 1) % width !== 0) deltas.push(Math.abs(values[index] - values[index + 1]));
    if (index + width < values.length) deltas.push(Math.abs(values[index] - values[index + width]));
  }
  return average(deltas);
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function clampSampleEverySeconds(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return defaultSampleEverySeconds;
  return Math.max(0.1, Math.min(2, value));
}

function clampTargetFrameCount(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return defaultTargetFrameCount;
  return Math.max(minTargetFrameCount, Math.min(maxTargetFrameCount, Math.round(value)));
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function roundTimestamp(value: number) {
  return Math.round(value * 1000) / 1000;
}
