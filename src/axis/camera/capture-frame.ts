import type { AxisEvidence } from "../core/types";
import { createAxisEvidenceId } from "./camera-source";

export function captureAxisFrame(video: HTMLVideoElement, sessionId: string): AxisEvidence | null {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  try {
    context.drawImage(video, 0, 0, width, height);
  } catch {
    return null;
  }

  let dataUrl: string | undefined;
  try {
    dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    dataUrl = undefined;
  }

  return {
    capabilityId: "camera.browser",
    capturedAt: new Date().toISOString(),
    id: createAxisEvidenceId("axis-frame"),
    kind: "frame",
    media: {
      dataUrl,
      height,
      mimeType: "image/jpeg",
      width,
    },
    sessionId,
    summary: "Captured frame",
    trust: "user_captured",
  };
}
