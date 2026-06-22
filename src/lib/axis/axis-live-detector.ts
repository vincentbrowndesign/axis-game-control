export type AxisLiveDetection = {
  id: string;
  label: string;
  score: number;
  bbox: [number, number, number, number];
  kind: "person" | "ball" | "other";
};

export type AxisLiveDetector = {
  detect(video: HTMLVideoElement): Promise<AxisLiveDetection[]>;
};

export async function loadAxisLiveDetector(): Promise<AxisLiveDetector> {
  const tf = await import("@tensorflow/tfjs");
  await import("@tensorflow/tfjs-backend-webgl");
  const cocoSsd = await import("@tensorflow-models/coco-ssd");

  try {
    await tf.setBackend("webgl");
  } catch {
    // TensorFlow will keep its available fallback backend.
  }
  await tf.ready();

  const model = await cocoSsd.load({ base: "lite_mobilenet_v2" });

  return {
    async detect(video: HTMLVideoElement) {
      const predictions = await model.detect(video, 20, 0.45);

      return predictions
        .filter((prediction) => prediction.class === "person" || prediction.class === "sports ball")
        .map((prediction, index) => {
          const kind = prediction.class === "sports ball" ? "ball" : "person";
          const bbox = prediction.bbox as [number, number, number, number];

          return {
            bbox,
            id: `${kind}-${index}-${Math.round(bbox[0])}-${Math.round(bbox[1])}`,
            kind,
            label: prediction.class === "sports ball" ? "Ball" : "Person",
            score: prediction.score,
          };
        });
    },
  };
}
