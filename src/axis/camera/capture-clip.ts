import type { AxisEvidence } from "../core/types";
import { createAxisEvidenceId } from "./camera-source";

export type AxisClipRecorder = {
  start: () => void;
  stop: () => void;
};

export function createAxisClipRecorder(
  stream: MediaStream,
  sessionId: string,
  onClip: (evidence: AxisEvidence) => void,
  onError?: (message: string) => void,
): AxisClipRecorder | null {
  if (typeof MediaRecorder === "undefined") return null;

  const mimeType = getClipMimeType();
  let recorder: MediaRecorder;
  try {
    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch {
    return null;
  }

  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.onerror = () => onError?.("Clip capture failed.");
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
    if (blob.size <= 0) {
      onError?.("No clip was captured.");
      return;
    }
    onClip({
      capabilityId: "camera.browser",
      capturedAt: new Date().toISOString(),
      id: createAxisEvidenceId("axis-clip"),
      kind: "clip",
      media: {
        blob,
        mimeType: blob.type,
        objectUrl: URL.createObjectURL(blob),
      },
      sessionId,
      summary: "Captured clip",
      trust: "user_captured",
    });
  };

  return {
    start: () => recorder.start(),
    stop: () => {
      if (recorder.state === "recording") recorder.stop();
    },
  };
}

function getClipMimeType() {
  if (!MediaRecorder.isTypeSupported) return "";
  return ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((type) =>
    MediaRecorder.isTypeSupported(type),
  ) ?? "";
}
