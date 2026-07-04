import type { AxisPlayerCandidate } from "./player-read-normalizer";

type CocoPrediction = {
  bbox?: [number, number, number, number];
  class?: string;
  score?: number;
};

type CocoModel = {
  detect: (video: HTMLVideoElement) => Promise<CocoPrediction[]>;
};

let modelPromise: Promise<CocoModel | null> | null = null;

export async function detectTensorFlowPersonCandidate(
  video: HTMLVideoElement,
  timestampMs: number,
): Promise<AxisPlayerCandidate | null> {
  if (!video.videoWidth || !video.videoHeight) return null;
  const model = await loadCocoModel();
  if (!model) return null;

  try {
    const predictions = await model.detect(video);
    const person = predictions
      .filter((prediction) => mapPersonLabel(prediction.class) && typeof prediction.score === "number")
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .at(0);
    if (!person?.bbox) return null;

    const [x, y, width, height] = person.bbox;
    const box = {
      height: clamp01(Math.max(1, height) / video.videoHeight),
      width: clamp01(Math.max(1, width) / video.videoWidth),
      x: clamp01(Math.max(0, x) / video.videoWidth),
      y: clamp01(Math.max(0, y) / video.videoHeight),
    };

    return {
      box,
      confidence: Math.max(0, Math.min(1, person.score ?? 0)),
      id: `axis-player-tensorflow-${timestampMs}`,
      point: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      source: "tensorflow-coco-ssd",
    };
  } catch {
    return null;
  }
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

async function loadCocoModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      try {
        await import("@tensorflow/tfjs-backend-webgl");
        const tf = await import("@tensorflow/tfjs");
        await tf.setBackend("webgl").catch(() => undefined);
        await tf.ready();
        const coco = await import("@tensorflow-models/coco-ssd");
        return await coco.load();
      } catch {
        return null;
      }
    })();
  }

  return modelPromise;
}

function mapPersonLabel(label: string | undefined) {
  const normalized = (label ?? "").toLowerCase().trim();
  return normalized === "person" || normalized === "human" || normalized === "athlete" || normalized === "player";
}
