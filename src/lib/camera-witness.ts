import type { WitnessEvent } from "./axis-core";

// ---------------------------------------------------------------------------
// Camera Witness V1
//
// The camera is a witness. Not a media product.
// Its job: observe one experiment, return one WitnessEvent.
//
// Strategy: sample up to 10 frames at a steady interval during the experiment
// window, compress each to 320×240 JPEG at 60%, send to the vision API.
// ---------------------------------------------------------------------------

export interface WitnessInput {
  intent_id: string;
  experiment_id: string;
  constraint: string;
  hypothesis?: string;
  video: HTMLVideoElement;
  duration_seconds?: number;
}

export interface CameraWitnessHandle {
  stop: () => Promise<WitnessEvent | null>;
}

export function startCameraWitness(input: WitnessInput): CameraWitnessHandle {
  const {
    intent_id,
    experiment_id,
    constraint,
    hypothesis,
    video,
    duration_seconds = 90,
  } = input;

  const frames: string[] = [];
  const startTime = new Date().toISOString();

  // One frame every (duration / 10) seconds — spread evenly across the window
  const intervalMs = Math.floor((duration_seconds / 10) * 1000);

  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 240;
  const ctx = canvas.getContext("2d");

  function captureFrame(): string | null {
    if (!ctx || video.readyState < 2) return null;
    ctx.drawImage(video, 0, 0, 320, 240);
    return canvas.toDataURL("image/jpeg", 0.6);
  }

  const timer = setInterval(() => {
    if (frames.length >= 10) { clearInterval(timer); return; }
    const frame = captureFrame();
    if (frame) frames.push(frame);
  }, intervalMs);

  return {
    async stop(): Promise<WitnessEvent | null> {
      clearInterval(timer);

      // Grab one final frame at the moment of stop
      const final = captureFrame();
      if (final && frames.length < 10) frames.push(final);

      if (frames.length === 0) return null;

      const endTime = new Date().toISOString();

      try {
        const res = await fetch("/api/axis/camera-witness", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ frames, constraint, hypothesis, experiment_id }),
        });

        if (!res.ok) return null;

        const data = await res.json() as {
          verdict: "satisfied" | "partial" | "violated" | "unobservable";
          summary: string;
          confidence: number;
        };

        const event: WitnessEvent = {
          intent_id,
          experiment_id,
          modality: "camera",
          window: { start: startTime, end: endTime },
          claim: {
            verdict: data.verdict,
            summary: data.summary,
            magnitude: data.confidence,
          },
          confidence: data.confidence,
        };

        return event;
      } catch {
        return null;
      }
    },
  };
}
