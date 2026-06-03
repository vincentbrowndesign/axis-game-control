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
  const candidates = [
    "video/mp4;codecs=avc1",
    "video/mp4",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

export function AxisAnimationPlayer({
  facts,
  onReplaySaved,
}: {
  facts: AnimationFact[];
  onReplaySaved?: () => void;
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

  async function recordReplay() {
    const canvas = canvasRef.current;
    if (!canvas || exportState !== "idle") return null;

    const mimeType = getBestMimeType();
    if (!mimeType) {
      setSupportsRecorder(false);
      return null;
    }

    try {
      return await new Promise<{ blob: Blob; mimeType: string } | null>((resolve) => {
        const stream = canvas.captureStream(ANIM_FPS);
        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 6_000_000,
        });
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onerror = () => {
          setExportState("idle");
          resolve(null);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          resolve({ blob, mimeType });
        };

        recorder.start();
        setExportState("playing");

        runAnimation(() => {
          setExportState("encoding");
          setTimeout(() => recorder.stop(), 200);
        });
      });
    } catch (error) {
      console.error("Axis animation export failed", error);
      setExportState("idle");
      return null;
    }
  }

  async function handleSaveToCameraRoll() {
    const recording = await recordReplay();
    if (!recording) return;

    const fileName = `axis-tactical-replay-${Date.now()}.mp4`;
    const file = new File([recording.blob], fileName, { type: recording.mimeType });
    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };

    try {
      if (supportsNativeShare && nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: "Axis Tactical Replay" });
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
    return <p className="axis-cloud-empty">Not enough understanding yet.</p>;
  }

  return (
    <div className="axis-anim-shell">
      <div className="axis-replay-ready">
        <span>Replay Ready</span>
        <strong>{timeline.finding}</strong>
      </div>

      <div className="axis-anim-viewport">
        <canvas
          className="axis-anim-canvas"
          height={ANIM_H}
          ref={canvasRef}
          width={ANIM_W}
        />
      </div>

      {timeline.callouts.length ? (
        <div className="axis-replay-callouts" aria-label="Replay callouts">
          {timeline.callouts.map((callout) => (
            <span key={callout}>{callout}</span>
          ))}
        </div>
      ) : null}

      <div className="axis-anim-controls">
        <button
          className="axis-cloud-primary"
          disabled={busy}
          onClick={handlePlay}
          type="button"
        >
          {exportState === "playing" ? "Playing" : "Play"}
        </button>

        {supportsRecorder && onReplaySaved ? (
          <button
            className="axis-cloud-primary"
            disabled={exportState !== "idle"}
            onClick={() => void handleSaveToCameraRoll()}
            type="button"
          >
            {exportState === "encoding"
              ? "Encoding"
              : exportState === "saved"
                ? "Saved"
                : "Save To Camera Roll"}
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
