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
} from "../lib/axis-animation-renderer";

type ExportState = "idle" | "playing" | "encoding" | "ready";

function getBestMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

function fileExtForMime(mime: string) {
  return mime.startsWith("video/mp4") ? "mp4" : "webm";
}

export function AxisAnimationPlayer({ facts }: { facts: AnimationFact[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadExt, setDownloadExt] = useState("webm");

  const scene: AnimationScene = factsToScene(facts);

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
    // scene changes only when facts change — safe to include
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stopLoop, facts],
  );

  // Paint the first frame on mount so the canvas isn't blank
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) renderFrame(ctx, scene, 0.12);
    return () => stopLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopLoop, facts]);

  function handlePlay() {
    if (exportState !== "idle" && exportState !== "ready") return;
    setExportState("playing");
    runAnimation(() => setExportState("idle"));
  }

  async function handleExport() {
    const canvas = canvasRef.current;
    if (!canvas || exportState !== "idle") return;

    const mimeType = getBestMimeType();
    if (!mimeType) {
      alert("Video recording is not supported in this browser.");
      return;
    }

    try {
      const stream = canvas.captureStream(ANIM_FPS);
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 6_000_000,
      });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const ext = fileExtForMime(mimeType);
        setDownloadUrl(url);
        setDownloadExt(ext);
        setExportState("ready");
      };

      recorder.start();
      setExportState("playing");

      runAnimation(() => {
        setExportState("encoding");
        // Small pause before stopping so the final frame is captured
        setTimeout(() => recorder.stop(), 200);
      });
    } catch (error) {
      console.error("Axis animation export failed", error);
      setExportState("idle");
    }
  }

  const busy = exportState === "playing" || exportState === "encoding";

  return (
    <div className="axis-anim-shell">
      <div className="axis-anim-viewport">
        <canvas
          className="axis-anim-canvas"
          height={ANIM_H}
          ref={canvasRef}
          width={ANIM_W}
        />
      </div>

      <div className="axis-anim-controls">
        <button
          className="axis-cloud-primary"
          disabled={busy}
          onClick={handlePlay}
          type="button"
        >
          {exportState === "playing" ? "Playing" : "Play"}
        </button>

        <button
          className="axis-cloud-primary"
          disabled={exportState !== "idle"}
          onClick={() => void handleExport()}
          type="button"
        >
          {exportState === "encoding" ? "Encoding" : "Export"}
        </button>

        {downloadUrl ? (
          <a
            className="axis-cloud-primary"
            download={`axis-artifact.${downloadExt}`}
            href={downloadUrl}
          >
            Download
          </a>
        ) : null}
      </div>
    </div>
  );
}
