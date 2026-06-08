import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";

import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";

const execFileAsync = promisify(execFile);
const runtimeRequire = createRequire(import.meta.url);

export type AxisFfmpegErrorCode =
  | "EXPORT_FAILED"
  | "FFMPEG_NOT_FOUND"
  | "FFPROBE_FAILED"
  | "FFPROBE_NOT_FOUND"
  | "FRAME_EXTRACTION_FAILED"
  | "THUMBNAIL_FAILED"
  | "ZERO_FRAMES_EXTRACTED";

export type AxisFfmpegBinary = {
  command: string;
  source: string;
};

export type AxisFfmpegResolution = {
  ffmpeg: AxisFfmpegBinary;
  ffprobe?: AxisFfmpegBinary;
};

export type AxisVideoMetadata = {
  codec: string | null;
  container: string | null;
  duration: number | null;
  fps: number | null;
  height: number | null;
  rotation: number | null;
  width: number | null;
};

export type AxisReplayExportResult = {
  codec: string | null;
  duration: number | null;
  export_path: string;
  height: number | null;
  size_bytes: number;
  width: number | null;
};

type RunOperationInput = {
  configure: (command: ffmpeg.FfmpegCommand) => void;
  errorCode: AxisFfmpegErrorCode;
  inputPath: string;
  operationName: string;
  outputPath: string;
  requireFfprobe?: boolean;
  timeoutMs?: number;
};

type FrameOutputInspection = {
  count: number;
  sizeBytes: number;
  sizeMb: number;
};

const ffmpegBinaryName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
const ffprobeBinaryName = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
const frameExtractionTimeoutMs = 45_000;
const maxFrameExtractionDurationSeconds = 10;
const maxFrameExtractionFrames = 75;
const safeFrameExtractionFps = 5;
const safeFrameExtractionQuality = 5;
const safeFrameExtractionScale = "960:-2";
let cachedResolution: AxisFfmpegResolution | null = null;

export class AxisFfmpegError extends Error {
  code: AxisFfmpegErrorCode;

  constructor(code: AxisFfmpegErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "AxisFfmpegError";
    this.code = code;
    if (cause !== undefined) {
      Object.defineProperty(this, "cause", {
        configurable: true,
        enumerable: false,
        value: cause,
        writable: true,
      });
    }
  }
}

export async function resolveAxisFfmpeg({ requireFfprobe = false }: { requireFfprobe?: boolean } = {}) {
  if (cachedResolution && (!requireFfprobe || cachedResolution.ffprobe)) return cachedResolution;

  const ffmpegBinary = await resolveFfmpegBinary();
  const ffprobeBinary = await resolveFfprobeBinary(ffmpegBinary);
  if (requireFfprobe && !ffprobeBinary) {
    throw new AxisFfmpegError("FFPROBE_NOT_FOUND", "ffprobe binary not found or failed verification.");
  }

  cachedResolution = {
    ffmpeg: ffmpegBinary,
    ...(ffprobeBinary ? { ffprobe: ffprobeBinary } : {}),
  };
  logResolvedSource(cachedResolution);
  return cachedResolution;
}

export async function configureAxisFfmpeg({ requireFfprobe = false }: { requireFfprobe?: boolean } = {}) {
  const resolution = await resolveAxisFfmpeg({ requireFfprobe });
  ffmpeg.setFfmpegPath(resolution.ffmpeg.command);
  if (resolution.ffprobe) ffmpeg.setFfprobePath(resolution.ffprobe.command);
  return resolution;
}

export async function probeAxisVideoMetadata(inputPath: string): Promise<AxisVideoMetadata> {
  const started = Date.now();
  const resolution = await configureAxisFfmpeg({ requireFfprobe: true });
  logOperationStart({
    inputPath,
    operationName: "FFPROBE_METADATA",
    outputPath: "metadata",
    resolution,
  });

  try {
    const { stdout } = await execFileAsync(resolution.ffprobe?.command ?? "ffprobe", [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      inputPath,
    ]);
    const metadata = parseFfprobeMetadata(stdout);
    logOperationComplete({
      elapsedMs: Date.now() - started,
      inputPath,
      operationName: "FFPROBE_METADATA",
      outputPath: "metadata",
      resolution,
    });
    return metadata;
  } catch (error) {
    logOperationFailed({
      elapsedMs: Date.now() - started,
      error,
      errorCode: "FFPROBE_FAILED",
      inputPath,
      operationName: "FFPROBE_METADATA",
      outputPath: "metadata",
      resolution,
    });
    throw new AxisFfmpegError("FFPROBE_FAILED", `ffprobe failed for ${inputPath}: ${getErrorMessage(error)}`, error);
  }
}

export async function extractAxisFrames({
  filePattern = "frame_%04d.jpg",
  fps,
  inputPath,
  operationName = "FRAME_EXTRACTION",
  outputDir,
}: {
  filePattern?: string;
  fps: number;
  inputPath: string;
  operationName?: string;
  outputDir: string;
}) {
  await fs.mkdir(outputDir, { recursive: true });
  const metadata = await probeAxisVideoMetadata(inputPath).catch((error) => {
    console.error("FFPROBE_METADATA_OPTIONAL_FAILED", {
      error: getErrorMessage(error),
      inputPath,
      operationName,
    });
    return null;
  });
  const extractionDuration = getSafeExtractionDuration(metadata?.duration ?? null);
  const extractionFilter = `fps=${safeFrameExtractionFps},scale=${safeFrameExtractionScale}`;
  console.log("FRAME_EXTRACTION_CONFIG", {
    duration: metadata?.duration ?? null,
    effectiveFps: safeFrameExtractionFps,
    maxFrames: maxFrameExtractionFrames,
    inputPath,
    outputDir,
    requestedFps: fps,
    safeDuration: extractionDuration,
    scale: safeFrameExtractionScale,
    sourceFps: metadata?.fps ?? null,
    timeoutMs: frameExtractionTimeoutMs,
  });

  console.log("FRAME_EXTRACTION_FFMPEG_COMMAND_BEFORE", {
    duration: metadata?.duration ?? null,
    effectiveFps: safeFrameExtractionFps,
    filterChain: [extractionFilter],
    inputPath,
    maxFrames: maxFrameExtractionFrames,
    mode: "image_sequence_to_disk",
    outputDir,
    outputPattern: path.join(outputDir, filePattern),
    quality: safeFrameExtractionQuality,
    requestedFps: fps,
    safeDuration: extractionDuration,
    scale: safeFrameExtractionScale,
    sourceFps: metadata?.fps ?? null,
    transport: "disk_files",
  });
  await runAxisFfmpegOperation({
    configure: (command) => {
      command
        .input(inputPath)
        .inputOptions(["-nostdin", "-hide_banner", "-loglevel", "error", "-threads", "1"])
        .outputOptions([
          "-t",
          String(extractionDuration),
          "-vf",
          extractionFilter,
          "-q:v",
          String(safeFrameExtractionQuality),
          "-frames:v",
          String(maxFrameExtractionFrames),
        ])
        .output(path.join(outputDir, filePattern));
    },
    errorCode: "FRAME_EXTRACTION_FAILED",
    inputPath,
    operationName,
    outputPath: outputDir,
    timeoutMs: frameExtractionTimeoutMs,
  });
  console.log("FRAME_EXTRACTION_FFMPEG_COMMAND_AFTER", {
    duration: metadata?.duration ?? null,
    effectiveFps: safeFrameExtractionFps,
    inputPath,
    maxFrames: maxFrameExtractionFrames,
    outputDir,
    requestedFps: fps,
    safeDuration: extractionDuration,
    sourceFps: metadata?.fps ?? null,
  });

  const output = await inspectFrameOutput({
    directory: outputDir,
    inputPath,
    operationName,
    pattern: framePatternToRegex(filePattern),
    requestedFps: safeFrameExtractionFps,
    sourceDuration: metadata?.duration ?? null,
    sourceFps: metadata?.fps ?? null,
  });
  console.log("FRAME_EXTRACTION_RESULT", {
    duration: metadata?.duration ?? null,
    effectiveFps: safeFrameExtractionFps,
    frameCount: output.count,
    inputPath,
    maxFrames: maxFrameExtractionFrames,
    outputDir,
    outputDirectorySizeMb: output.sizeMb,
    requestedFps: fps,
    safeDuration: extractionDuration,
    sourceFps: metadata?.fps ?? null,
  });
  if (output.count === 0) {
    throw new AxisFfmpegError("ZERO_FRAMES_EXTRACTED", `No frames were extracted from ${inputPath}.`);
  }

  return {
    frameCount: output.count,
    metadata,
  };
}

export async function generateAxisThumbnail({
  inputPath,
  outputPath,
  timestampSeconds = 0.5,
}: {
  inputPath: string;
  outputPath: string;
  timestampSeconds?: number;
}) {
  const metadata = await probeAxisVideoMetadata(inputPath).catch(() => null);
  const safeTimestamp = clampSafeTimestamp(timestampSeconds, metadata?.duration ?? null);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await runAxisFfmpegOperation({
    configure: (command) => {
      command.input(inputPath).seekInput(safeTimestamp).frames(1).outputOptions(["-q:v", "2"]).output(outputPath);
    },
    errorCode: "THUMBNAIL_FAILED",
    inputPath,
    operationName: "THUMBNAIL_GENERATION",
    outputPath,
  });
  return {
    metadata,
    thumbnailPath: outputPath,
  };
}

export async function exportAxisReplayMp4({
  createFilters,
  inputPath,
  maxDurationSeconds = 10,
  maxWidth = 960,
  outputFps = 15,
  outputPath,
}: {
  createFilters?: (metadata: AxisVideoMetadata) => string[];
  inputPath: string;
  maxDurationSeconds?: number;
  maxWidth?: number;
  outputFps?: number;
  outputPath: string;
}): Promise<AxisReplayExportResult> {
  const metadata = await probeAxisVideoMetadata(inputPath);
  const exportDuration = getSafeExportDuration(metadata.duration, maxDurationSeconds);
  const overlayFilters = createFilters?.(metadata) ?? [];
  const filterChain = [...overlayFilters, `scale='min(${maxWidth},iw)':-2`];
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  console.log("REPLAY_EXPORT_CONFIG", {
    filterCount: filterChain.length,
    inputDuration: metadata.duration,
    inputFps: metadata.fps,
    inputHeight: metadata.height,
    inputPath,
    inputWidth: metadata.width,
    maxDurationSeconds,
    maxWidth,
    memoryBefore: getMemorySnapshot(),
    outputFps,
    outputPath,
    safeDuration: exportDuration,
  });
  await runAxisFfmpegOperation({
    configure: (command) => {
      command
        .input(inputPath)
        .inputOptions(["-nostdin", "-hide_banner", "-loglevel", "error", "-threads", "1"])
        .outputOptions([
          "-t",
          String(exportDuration),
          "-r",
          String(outputFps),
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "20",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-movflags",
          "+faststart",
        ]);
      command.videoFilters(filterChain);
      command.output(outputPath);
    },
    errorCode: "EXPORT_FAILED",
    inputPath,
    operationName: "REPLAY_EXPORT",
    outputPath,
    requireFfprobe: true,
    timeoutMs: 120_000,
  });

  const stats = await fs.stat(outputPath);
  console.log("REPLAY_EXPORT_RESULT", {
    duration: exportDuration,
    export_path: outputPath,
    frame_count_estimate: Math.ceil(exportDuration * outputFps),
    inputDuration: metadata.duration,
    memoryAfter: getMemorySnapshot(),
    outputFps,
    size_bytes: stats.size,
  });
  return {
    codec: "h264/aac",
    duration: exportDuration,
    export_path: outputPath,
    height: metadata.height,
    size_bytes: stats.size,
    width: metadata.width,
  };
}

export async function runAxisFfmpegOperation({
  configure,
  errorCode,
  inputPath,
  operationName,
  outputPath,
  requireFfprobe = false,
  timeoutMs,
}: RunOperationInput) {
  const started = Date.now();
  const resolution = await configureAxisFfmpeg({ requireFfprobe });
  logOperationStart({ inputPath, operationName, outputPath, resolution });

  try {
    await new Promise<void>((resolve, reject) => {
      const command = ffmpeg();
      let finished = false;
      let timedOut = false;
      const timeout =
        timeoutMs && timeoutMs > 0
          ? setTimeout(() => {
              if (finished) return;
              timedOut = true;
              console.error("FFMPEG_OPERATION_TIMEOUT", {
                input_path: inputPath,
                operation: operationName,
                output_path: outputPath,
                timeout_ms: timeoutMs,
              });
              command.kill("SIGKILL");
            }, timeoutMs)
          : null;
      const complete = (callback: () => void) => {
        finished = true;
        if (timeout) clearTimeout(timeout);
        callback();
      };
      configure(command);
      command.on("start", (commandLine) => {
        console.log("FFMPEG_COMMAND_START", {
          argv: parseFfmpegCommandLine(commandLine),
          command_line: commandLine,
          input_path: inputPath,
          operation: operationName,
          output_path: outputPath,
        });
      });
      command.on("end", () => complete(resolve));
      command.on("error", (error) =>
        complete(() => reject(timedOut ? new Error(`${operationName} timed out after ${timeoutMs}ms.`) : error)),
      );
      console.log("FFMPEG_FINAL_INPUT_SOURCE", {
        input_path: inputPath,
        operation: operationName,
        output_path: outputPath,
      });
      command.run();
    });
    logOperationComplete({
      elapsedMs: Date.now() - started,
      inputPath,
      operationName,
      outputPath,
      resolution,
    });
  } catch (error) {
    logOperationFailed({
      elapsedMs: Date.now() - started,
      error,
      errorCode,
      inputPath,
      operationName,
      outputPath,
      resolution,
    });
    throw new AxisFfmpegError(errorCode, `${operationName} failed: ${getErrorMessage(error)}`, error);
  }
}

export async function runAxisFfmpegBinary(args: string[]) {
  const resolution = await resolveAxisFfmpeg();
  const { stdout } = await execFileAsync(resolution.ffmpeg.command, args, { encoding: "buffer" });
  return Buffer.from(stdout);
}

async function resolveFfmpegBinary() {
  const candidates = uniqueCandidates([
    { command: process.env.FFMPEG_PATH, source: "FFMPEG_PATH" },
    { command: process.env.FFMPEG_BINARY, source: "FFMPEG_BINARY" },
    { command: process.env.FFMPEG_BIN, source: "FFMPEG_BIN" },
    { command: typeof ffmpegStatic === "string" ? ffmpegStatic : "", source: "runtime require(\"ffmpeg-static\")" },
    { command: getFfmpegStaticResolvedBinary(), source: "runtime require.resolve(\"ffmpeg-static\")" },
    {
      command: path.join(process.cwd(), "node_modules", "ffmpeg-static", ffmpegBinaryName),
      source: "process.cwd()/node_modules/ffmpeg-static",
    },
  ]);

  for (const candidate of candidates) {
    if (await canAccess(candidate.command) && (await canRun(candidate.command, ["-version"]))) return candidate;
  }

  if (await canRun("ffmpeg", ["-version"])) return { command: "ffmpeg", source: "system ffmpeg on PATH" };
  throw new AxisFfmpegError("FFMPEG_NOT_FOUND", `ffmpeg binary not found. Checked: ${candidates.map((item) => item.command).join(", ")}, ffmpeg`);
}

async function resolveFfprobeBinary(ffmpegBinary: AxisFfmpegBinary) {
  const sibling = ffmpegBinary.command === "ffmpeg" ? "" : path.join(path.dirname(ffmpegBinary.command), ffprobeBinaryName);
  const candidates = uniqueCandidates([
    { command: process.env.FFPROBE_PATH, source: "FFPROBE_PATH" },
    ...getFfprobeStaticPackageCandidates(),
    { command: sibling, source: "sibling binary near resolved ffmpeg" },
  ]);

  for (const candidate of candidates) {
    if (await canAccess(candidate.command) && (await canRun(candidate.command, ["-version"]))) return candidate;
  }

  if (await canRun("ffprobe", ["-version"])) return { command: "ffprobe", source: "system ffprobe on PATH" };
  return null;
}

function getFfmpegStaticResolvedBinary() {
  try {
    return path.join(path.dirname(runtimeRequire.resolve("ffmpeg-static")), ffmpegBinaryName);
  } catch {
    return "";
  }
}

function getFfprobeStaticPackageCandidates() {
  const packageDir = path.join(process.cwd(), "node_modules", "ffprobe-static");
  const platform = process.platform;
  const arch = process.arch;
  return [
    { command: path.join(packageDir, ffprobeBinaryName), source: "ffprobe-static" },
    { command: path.join(packageDir, "bin", platform, arch, ffprobeBinaryName), source: "ffprobe-static" },
    { command: path.join(packageDir, "bin", platform, ffprobeBinaryName), source: "ffprobe-static" },
  ];
}

function uniqueCandidates(candidates: Array<{ command?: string; source: string }>) {
  const seen = new Set<string>();
  return candidates
    .map((candidate) => ({ command: candidate.command?.trim() ?? "", source: candidate.source }))
    .filter((candidate) => {
      if (!candidate.command || seen.has(candidate.command)) return false;
      seen.add(candidate.command);
      return true;
    });
}

async function canAccess(command: string) {
  try {
    await fs.access(command);
    return true;
  } catch {
    return false;
  }
}

async function canRun(command: string, args: string[]) {
  try {
    await execFileAsync(command, args);
    return true;
  } catch {
    return false;
  }
}

function parseFfprobeMetadata(stdout: string | Buffer): AxisVideoMetadata {
  const parsed = JSON.parse(Buffer.isBuffer(stdout) ? stdout.toString("utf8") : stdout) as {
    format?: { duration?: string; format_name?: string };
    streams?: Array<Record<string, unknown>>;
  };
  const videoStream = parsed.streams?.find((stream) => stream.codec_type === "video") ?? {};
  return {
    codec: getString(videoStream.codec_name),
    container: getString(parsed.format?.format_name),
    duration: getNumber(parsed.format?.duration) ?? getNumber(videoStream.duration) ?? null,
    fps: parseFps(getString(videoStream.avg_frame_rate) || getString(videoStream.r_frame_rate)),
    height: getNumber(videoStream.height),
    rotation: getRotation(videoStream),
    width: getNumber(videoStream.width),
  };
}

function parseFps(value: string | null) {
  if (!value || value === "0/0") return null;
  const [numerator, denominator] = value.split("/").map(Number);
  if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0) {
    return Math.round((numerator / denominator) * 1000) / 1000;
  }
  const direct = Number(value);
  return Number.isFinite(direct) && direct > 0 ? direct : null;
}

function getRotation(stream: Record<string, unknown>) {
  const tags = stream.tags && typeof stream.tags === "object" && !Array.isArray(stream.tags) ? (stream.tags as Record<string, unknown>) : {};
  const tagRotation = getNumber(tags.rotate);
  if (tagRotation !== null) return tagRotation;
  const sideData = Array.isArray(stream.side_data_list) ? stream.side_data_list : [];
  for (const item of sideData) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rotation = getNumber((item as Record<string, unknown>).rotation);
    if (rotation !== null) return rotation;
  }
  return null;
}

async function inspectFrameOutput({
  directory,
  inputPath,
  operationName,
  pattern,
  requestedFps,
  sourceDuration,
  sourceFps,
}: {
  directory: string;
  inputPath: string;
  operationName: string;
  pattern: RegExp;
  requestedFps: number;
  sourceDuration: number | null;
  sourceFps: number | null;
}): Promise<FrameOutputInspection> {
  const entries = await fs.readdir(directory);
  const frames = entries.filter((entry) => pattern.test(entry)).sort();
  let sizeBytes = 0;

  for (const [index, entry] of frames.entries()) {
    const stat = await fs.stat(path.join(directory, entry));
    sizeBytes += stat.size;
    const frameCount = index + 1;
    if (frameCount % 100 === 0) {
      console.log("FRAME_EXTRACTION_DISCOVERED_FRAMES", {
        duration: sourceDuration,
        frameCount,
        inputPath,
        operation: operationName,
        outputDirectorySizeMb: bytesToMb(sizeBytes),
        outputDir: directory,
        requestedFps,
        sourceFps,
      });
    }
  }

  console.log("FRAME_EXTRACTION_OUTPUT_SIZE", {
    duration: sourceDuration,
    frameCount: frames.length,
    inputPath,
    operation: operationName,
    outputDirectorySizeMb: bytesToMb(sizeBytes),
    outputDir: directory,
    requestedFps,
    sourceFps,
  });

  return {
    count: frames.length,
    sizeBytes,
    sizeMb: bytesToMb(sizeBytes),
  };
}

function framePatternToRegex(filePattern: string) {
  const escaped = filePattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%0?\d*d/g, "\\d+");
  return new RegExp(`^${escaped}$`, "i");
}

function clampSafeTimestamp(value: number, duration: number | null) {
  const fallback = 0.5;
  const requested = Number.isFinite(value) && value >= 0 ? value : fallback;
  if (!duration || duration <= 0) return requested;
  return Math.max(0, Math.min(requested, Math.max(0, duration - 0.1)));
}

function getSafeExtractionDuration(duration: number | null) {
  if (!duration || duration <= 0) return maxFrameExtractionDurationSeconds;
  return Math.max(0.1, Math.min(duration, maxFrameExtractionDurationSeconds));
}

function getSafeExportDuration(duration: number | null, maxDurationSeconds: number) {
  const safeMax = Math.max(1, Math.min(maxDurationSeconds, 20));
  if (!duration || duration <= 0) return safeMax;
  return Math.max(0.1, Math.min(duration, safeMax));
}

function logResolvedSource(resolution: AxisFfmpegResolution) {
  console.log("FFMPEG_RESOLVED_SOURCE", {
    ffmpeg_path: resolution.ffmpeg.command,
    ffmpeg_source: resolution.ffmpeg.source,
    ffprobe_path: resolution.ffprobe?.command ?? null,
    ffprobe_source: resolution.ffprobe?.source ?? null,
  });
}

function logOperationStart({
  inputPath,
  operationName,
  outputPath,
  resolution,
}: {
  inputPath: string;
  operationName: string;
  outputPath: string;
  resolution: AxisFfmpegResolution;
}) {
  console.log("FFMPEG_OPERATION_START", {
    ffmpeg_source: resolution.ffmpeg.source,
    ffprobe_source: resolution.ffprobe?.source ?? null,
    input_path: inputPath,
    operation: operationName,
    output_path: outputPath,
  });
}

function logOperationComplete({
  elapsedMs,
  inputPath,
  operationName,
  outputPath,
  resolution,
}: {
  elapsedMs: number;
  inputPath: string;
  operationName: string;
  outputPath: string;
  resolution: AxisFfmpegResolution;
}) {
  console.log("FFMPEG_OPERATION_COMPLETE", {
    elapsed_ms: elapsedMs,
    ffmpeg_source: resolution.ffmpeg.source,
    ffprobe_source: resolution.ffprobe?.source ?? null,
    input_path: inputPath,
    operation: operationName,
    output_path: outputPath,
  });
}

function logOperationFailed({
  elapsedMs,
  error,
  errorCode,
  inputPath,
  operationName,
  outputPath,
  resolution,
}: {
  elapsedMs: number;
  error: unknown;
  errorCode: AxisFfmpegErrorCode;
  inputPath: string;
  operationName: string;
  outputPath: string;
  resolution: AxisFfmpegResolution;
}) {
  console.error("FFMPEG_OPERATION_FAILED", {
    elapsed_ms: elapsedMs,
    error: getErrorMessage(error),
    error_code: errorCode,
    ffmpeg_source: resolution.ffmpeg.source,
    ffprobe_source: resolution.ffprobe?.source ?? null,
    input_path: inputPath,
    operation: operationName,
    output_path: outputPath,
  });
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function bytesToMb(value: number) {
  return Math.round((value / 1024 / 1024) * 100) / 100;
}

function parseFfmpegCommandLine(commandLine: string) {
  const args: string[] = [];
  let current = "";
  let quote: "'" | "\"" | null = null;
  let escaped = false;

  for (const char of commandLine) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if ((char === "'" || char === "\"") && (!quote || quote === char)) {
      quote = quote ? null : char;
      continue;
    }
    if (char === " " && !quote) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }

  if (current) args.push(current);
  return args;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getMemorySnapshot() {
  const memory = process.memoryUsage();
  return {
    external: memory.external,
    heapTotal: memory.heapTotal,
    heapUsed: memory.heapUsed,
    rss: memory.rss,
  };
}
