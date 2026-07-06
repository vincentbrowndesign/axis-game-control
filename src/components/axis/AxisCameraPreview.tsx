"use client";

import { useEffect, useRef, useState } from "react";

// Preview-only camera layer for the broadcast stage. getUserMedia in, nothing
// saved: no recording, no upload, no tracking. Tracks stop on Stop Camera,
// on device-side end, and on unmount.

export type AxisCameraState = "off" | "requesting" | "ready" | "denied" | "notfound" | "unsupported" | "error";

const STATUS_LABELS: Partial<Record<AxisCameraState, string>> = {
  denied: "Camera blocked · allow camera in browser settings",
  error: "Camera unavailable",
  notfound: "No camera found",
  requesting: "Requesting camera",
  unsupported: "Camera not supported in this browser",
};

function mapCameraError(error: unknown): AxisCameraState {
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") {
    return "notfound";
  }
  if (name === "NotSupportedError" || name === "TypeError") return "unsupported";
  return "error";
}

export function AxisCameraPreview({ onStateChange }: { onStateChange?: (state: AxisCameraState) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Invalidates in-flight getUserMedia requests after Stop Camera or unmount.
  const requestToken = useRef(0);
  const [state, setState] = useState<AxisCameraState>("off");

  function transition(next: AxisCameraState) {
    setState(next);
    onStateChange?.(next);
  }

  function releaseStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  useEffect(() => {
    return () => {
      requestToken.current += 1;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  async function startCamera() {
    if (state === "requesting" || state === "ready") return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      transition("unsupported");
      return;
    }
    const token = ++requestToken.current;
    transition("requesting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    } catch (error) {
      if (token === requestToken.current) transition(mapCameraError(error));
      return;
    }
    if (token !== requestToken.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    streamRef.current = stream;
    stream.getTracks().forEach((track) => {
      track.addEventListener("ended", () => {
        if (streamRef.current !== stream) return;
        releaseStream();
        transition("off");
      });
    });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => undefined);
    }
    transition("ready");
  }

  function stopCamera() {
    requestToken.current += 1;
    releaseStream();
    transition("off");
  }

  const status = STATUS_LABELS[state];

  return (
    <>
      <video aria-label="Camera preview" autoPlay className="axis-os-stage-video" muted playsInline ref={videoRef} />
      {status && <span className="axis-os-stage-camera-status">{status}</span>}
      <button
        className="axis-os-stage-camera-button"
        disabled={state === "requesting"}
        onClick={state === "ready" ? stopCamera : startCamera}
        type="button"
      >
        {state === "ready" ? "Stop Camera" : state === "requesting" ? "Starting…" : "Start Camera"}
      </button>
    </>
  );
}
