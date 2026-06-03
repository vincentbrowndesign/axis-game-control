"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ANIM_DURATION_MS,
  ANIM_FPS,
  ANIM_H,
  ANIM_W,
  type AnimationFact,
  type AnimationScene,
  factsToScene,
  renderFrame,
  sceneHasUnderstandingEvent,
  sceneToReplayTimeline,
} from "../lib/axis-animation-renderer";

type ExportState = "idle" | "playing" | "encoding" | "saved";

function getBestMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

function fileExtForMime(mime: string) {
  return mime.startsWith("video/mp4") ? "mp4" : "webm";
}

function FactBadges({ scene }: { scene: AnimationScene }) {
  const badges: Array<{ label: string; cls: string }> = [];
  if (scene.drive) badges.push({ label: "DRIVE", cls: "axis-badge-drive" });
  if (scene.paintTouch) badges.push({ label: "PAINT TOUCH", cls: "axis-badge-paint" });
  if (scene.shotAttempt) badges.push({ label: "SHOT ATTEMPT", cls: "axis-badge-shot" });
  if (scene.makeMiss === "make") badges.push({ label: "MAKE", cls: "axis-badge-make" });
  if (scene.makeMiss === "miss") badges.push({ label: "MISS", cls: "axis-badge-miss" });

  if (!badges.length) return null;

  return (
    <div className="axis-fact-badges" aria-label="Detected events">
      {badges.map((b) => (
        <span className={`axis-fact-badge ${b.cls}`} key={b.label}>
          {b.label}
        </span>
      ))}
    </div>
  );
}

export function AxisAnimationPlayer({
  facts,
  onReplaySaved,
  videoUrl,
}: {
  facts: AnimationFact[];
  onReplaySaved?: () => void;
  videoUrl?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [supportsRecorder, setSupportsRecorder] = useState(true);
  const [supportsNativeShare, setSupportsNativeShare] = useState(false);

  const scene: AnimationScene = factsToScene(facts);
  const timeline = sceneToReplayTimeline(scene);
  const canReplay = sceneHasUnderstandingEvent(scene);

  const stopLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const runAnimation = useCallback(
    (onDone?: () => void) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      stopLoop();
      startRef.current = performance.now();

      function frame() {
        const t = Math.min(1, (performance.now() - startRef.current) / ANIM_DURATION_MS);
        renderFrame(ctx!, scene, t);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(frame);
        } else {
          onDone?.();
        }
      }

      rafRef.current = requestAnimationFrame(frame);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stopLoop, facts],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) renderFrame(ctx, scene, 0.12);
    return () => stopLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopLoop, facts]);

  useEffect(() => {
    setSupportsRecorder(typeof MediaRecorder !== "undefined" && Boolean(getBestMimeType()));
    setSupportsNativeShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    );
  }, []);

  function handlePlay() {
    if (exportState !== "idle" && exportState !== "saved") return;
    setExportState("playing");
    runAnimation(() => setExportState("idle"));
  }

  async function recordReplay(): Promise<{ blob: Blob; ext: string } | null> {
    const canvas = canvasRef.current;
    if (!canvas || exportState !== "idle") return null;

    const mimeType = getBestMimeType();
    if (!mimeType) {
      setSupportsRecorder(false);
      return null;
    }

    try {
      return await new Promise((resolve) => {
        const stream = canvas.captureStream(ANIM_FPS);
        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 6_000_000,
        });
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.onerror = () => { setExportState("idle"); resolve(null); };
        recorder.onstop = () => {
          resolve({ blob: new Blob(chunks, { type: mimeType }), ext: fileExtForMime(mimeType) });
        };

        recorder.start();
        setExportState("playing");

        runAnimation(() => {
          setExportState("encoding");
          setTimeout(() => recorder.stop(), 200);
        });
      });
    } catch (error) {
      console.error("Axis overlay film export failed", error);
      setExportState("idle");
      return null;
    }
  }

  async function handleSaveOverlayFilm() {
    const recording = await recordReplay();
    if (!recording) return;

    const fileName = `axis-overlay-film-${Date.now()}.${recording.ext}`;
    const file = new File([recording.blob], fileName, { type: recording.blob.type });
    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };

    try {
      if (supportsNativeShare && nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: "Axis Overlay Film" });
      } else {
        downloadBlob(recording.blob, fileName);
      }

      onReplaySaved?.();
      setExportState("saved");
    } catch {
      setExportState("idle");
    }
  }

  const busy = exportState === "playing" || exportState === "encoding";

  if (!canReplay) {
    return (
      <p className="axis-cloud-empty">
        Need clearer footage for overlay film.
      </p>
    );
  }

  return (
    <div className="axis-anim-shell">
      {/* ── Video player with fact badges ─────────────────────────────── */}
      {videoUrl ? (
        <div className="axis-video-wrapper">
          <video
            className="axis-source-video"
            controls
            playsInline
            src={videoUrl}
          />
          <FactBadges scene={scene} />
        </div>
      ) : null}

      {/* ── What Axis saw label ───────────────────────────────────────── */}
      <div className="axis-replay-section-label">
        {videoUrl ? "What Axis saw" : "Overlay Film"}
      </div>

      {/* ── Canvas animation ──────────────────────────────────────────── */}
      <div className="axis-anim-viewport">
        <canvas
          className="axis-anim-canvas"
          height={ANIM_H}
          ref={canvasRef}
          width={ANIM_W}
        />
      </div>

      {/* ── Callout chips ─────────────────────────────────────────────── */}
      {timeline.callouts.length ? (
        <div className="axis-replay-callouts" aria-label="Replay callouts">
          {timeline.callouts.map((callout) => (
            <span key={callout}>{callout}</span>
          ))}
        </div>
      ) : null}

      {/* ── Controls ──────────────────────────────────────────────────── */}
      <div className="axis-anim-controls">
        <button
          className="axis-cloud-primary"
          disabled={busy}
          onClick={handlePlay}
          type="button"
        >
          {exportState === "playing" ? "Playing" : "Play"}
        </button>

        {supportsRecorder ? (
          <button
            className="axis-cloud-primary"
            disabled={exportState !== "idle"}
            onClick={() => void handleSaveOverlayFilm()}
            type="button"
          >
            {exportState === "encoding"
              ? "Encoding"
              : exportState === "saved"
                ? "Saved"
                : "Save Overlay Film"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
