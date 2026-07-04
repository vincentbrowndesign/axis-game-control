import type { AxisEvidence } from "../core/types";

export type AxisCameraState = "idle" | "opening" | "live" | "denied" | "unavailable" | "unsupported" | "error";
export type AxisCameraFacingMode = "user" | "environment";

export type AxisCameraSource = {
  message: string;
  state: AxisCameraState;
  stream: MediaStream | null;
  stop: () => void;
};

export async function openAxisCameraSource(
  video: HTMLVideoElement,
  facingMode: AxisCameraFacingMode = "environment",
): Promise<AxisCameraSource> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return stoppedSource("unsupported", "Camera is not supported on this device.");
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: facingMode },
        height: { ideal: 1080 },
        width: { ideal: 1920 },
      },
    });

    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();

    return {
      message: "Camera ready",
      state: "live",
      stream,
      stop: () => stopAxisCameraSource(stream, video),
    };
  } catch (error) {
    const denied = error instanceof DOMException && error.name === "NotAllowedError";
    return stoppedSource(denied ? "denied" : "unavailable", denied ? "Camera permission denied." : "Camera unavailable.");
  }
}

export function stopAxisCameraSource(stream: MediaStream | null, video?: HTMLVideoElement | null) {
  stream?.getTracks().forEach((track) => track.stop());
  if (video) {
    video.pause();
    video.srcObject = null;
  }
}

export function createCameraUnavailableEvidence(sessionId: string, message: string): AxisEvidence {
  return {
    capabilityId: "camera.browser",
    capturedAt: new Date().toISOString(),
    id: createAxisEvidenceId("camera-unavailable"),
    kind: "frame",
    sessionId,
    summary: message,
    trust: "user_captured",
  };
}

export function createAxisEvidenceId(prefix = "axis-evidence") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function stoppedSource(state: Exclude<AxisCameraState, "idle" | "opening" | "live">, message: string): AxisCameraSource {
  return {
    message,
    state,
    stream: null,
    stop: () => undefined,
  };
}
