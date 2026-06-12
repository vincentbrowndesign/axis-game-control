"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { type AxisEvidence } from "../../../lib/axis-evidence";
import { createHeadPositionEvidence } from "../../../lib/axis-vision-evidence";

type Status = "init" | "loading" | "ready" | "denied";

export default function VisionProbePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [status, setStatus] = useState<Status>("init");
  const [evidence, setEvidence] = useState<AxisEvidence | null>(null);

  const runDetection = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const result = await createHeadPositionEvidence(video);
    setEvidence(result);
  }, []);

  const startCamera = useCallback(async () => {
    setStatus("loading");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }

      setStatus("ready");
      intervalRef.current = setInterval(() => {
        void runDetection();
      }, 500);
    } catch {
      setStatus("denied");
    }
  }, [runDetection]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const evidenceColor =
    evidence?.value === "Head Up"
      ? "#b8ff3d"
      : evidence?.value === "Head Down"
        ? "rgba(247,247,242,0.55)"
        : "rgba(247,247,242,0.25)";

  return (
    <main
      style={{
        background: "#0d0d0a",
        color: "#f7f7f2",
        display: "grid",
        gap: 32,
        gridTemplateRows: "auto 1fr",
        minHeight: "100dvh",
        padding: "clamp(18px, 5vw, 64px)",
      }}
    >
      <p
        style={{
          color: "rgba(247,247,242,0.25)",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.12em",
          margin: 0,
          textTransform: "uppercase",
        }}
      >
        Vision Evidence Probe
      </p>

      <section
        style={{
          alignContent: "start",
          display: "grid",
          gap: 24,
          maxWidth: 480,
        }}
      >
        {/* Camera preview — only rendered when stream is attached */}
        <video
          ref={videoRef}
          muted
          playsInline
          style={{
            borderRadius: 12,
            display: status === "ready" ? "block" : "none",
            maxWidth: "100%",
            transform: "scaleX(-1)", // mirror — feels natural for selfie view
            width: 360,
          }}
        />

        {status === "init" && (
          <button
            onClick={() => void startCamera()}
            style={{
              background: "#f7f7f2",
              border: 0,
              borderRadius: 999,
              color: "#0d0d0a",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 850,
              minHeight: 48,
              padding: "0 22px",
              width: "fit-content",
            }}
            type="button"
          >
            Open Camera
          </button>
        )}

        {status === "loading" && (
          <p
            style={{
              color: "rgba(247,247,242,0.3)",
              fontSize: 13,
              margin: 0,
            }}
          >
            Loading model...
          </p>
        )}

        {status === "denied" && (
          <p
            style={{
              color: "rgba(247,247,242,0.4)",
              fontSize: 13,
              margin: 0,
            }}
          >
            Camera access required.
          </p>
        )}

        {/* Live evidence output — the slot being proven */}
        {evidence && (
          <div
            style={{
              background: "rgba(247,247,242,0.04)",
              borderRadius: 10,
              padding: "18px 20px",
            }}
          >
            <p
              style={{
                color: "rgba(247,247,242,0.25)",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.12em",
                margin: "0 0 12px",
                textTransform: "uppercase",
              }}
            >
              AxisEvidence
            </p>
            <pre
              style={{
                color: evidenceColor,
                fontFamily: "ui-monospace, monospace",
                fontSize: 13,
                lineHeight: 1.6,
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {JSON.stringify(evidence, null, 2)}
            </pre>
          </div>
        )}

        {/* Human-readable signal */}
        {evidence?.value && (
          <p
            style={{
              color: evidenceColor,
              fontSize: "clamp(40px, 8vw, 80px)",
              fontWeight: 900,
              lineHeight: 1,
              margin: 0,
            }}
          >
            {String(evidence.value)}
          </p>
        )}
      </section>
    </main>
  );
}
