"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker, type PoseLandmarkerResult } from "@mediapipe/tasks-vision";

type PersonDetectionState = {
  bodyDetected: boolean;
  confidence: number | null;
  visiblePeople: number;
};

const defaultDetectionState: PersonDetectionState = {
  bodyDetected: false,
  confidence: null,
  visiblePeople: 0,
};

const poseModelUrl =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";
const visionWasmUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const detectionIntervalMs = 140;
const visibleBodyThreshold = 0.35;

function getPoseConfidence(result: PoseLandmarkerResult) {
  const poseConfidences = result.landmarks.map((landmarks) => {
    const confidenceValues = landmarks
      .map((landmark) => landmark.visibility ?? null)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    if (!confidenceValues.length) return 1;

    return confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length;
  });

  return {
    confidence: poseConfidences.length ? Math.max(...poseConfidences) : null,
    visiblePeople: poseConfidences.filter((confidence) => confidence >= visibleBodyThreshold).length,
  };
}

async function createPoseLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(visionWasmUrl);

  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      delegate: "GPU",
      modelAssetPath: poseModelUrl,
    },
    minPoseDetectionConfidence: visibleBodyThreshold,
    minPosePresenceConfidence: visibleBodyThreshold,
    minTrackingConfidence: visibleBodyThreshold,
    numPoses: 2,
    runningMode: "VIDEO",
  });
}

export function usePersonDetection(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean) {
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const [state, setState] = useState<PersonDetectionState>(defaultDetectionState);

  useEffect(() => {
    if (!enabled) {
      setState(defaultDetectionState);
      return;
    }

    let animationFrame = 0;
    let cancelled = false;
    let lastDetectionAt = 0;

    async function runDetectionLoop() {
      try {
        landmarkerRef.current ??= await createPoseLandmarker();
      } catch (error) {
        console.error("Unable to start MediaPipe pose detection", error);
        if (!cancelled) setState(defaultDetectionState);
        return;
      }

      function detect(timestamp: number) {
        if (cancelled) return;

        const video = videoRef.current;
        const landmarker = landmarkerRef.current;

        if (video && landmarker && video.videoWidth && video.videoHeight && timestamp - lastDetectionAt >= detectionIntervalMs) {
          lastDetectionAt = timestamp;
          const result = landmarker.detectForVideo(video, timestamp);
          const nextDetection = getPoseConfidence(result);

          setState({
            bodyDetected: nextDetection.visiblePeople > 0,
            confidence: nextDetection.confidence,
            visiblePeople: nextDetection.visiblePeople,
          });
        }

        animationFrame = requestAnimationFrame(detect);
      }

      animationFrame = requestAnimationFrame(detect);
    }

    void runDetectionLoop();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
    };
  }, [enabled, videoRef]);

  return state;
}
