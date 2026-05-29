"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker, type PoseLandmarkerResult } from "@mediapipe/tasks-vision";

type PlayerTrackStatus = "visible" | "lost" | "recovered";
type PlayerDirection = "down" | "left" | "right" | "stationary" | "up";

export type PlayerLocation = {
  x: number;
  y: number;
};

export type PlayerMovement = {
  direction: PlayerDirection;
  distanceTraveled: number;
  moving: boolean;
  stationary: boolean;
};

export type PlayerTrack = {
  boundingBox: {
    height: number;
    width: number;
    x: number;
    y: number;
  };
  displayName: string;
  id: string;
  location: PlayerLocation;
  lostCount: number;
  movement: PlayerMovement;
  recoveryCount: number;
  status: PlayerTrackStatus;
  visibleTimeMs: number;
};

type PoseDetection = {
  boundingBox: PlayerTrack["boundingBox"];
  center: {
    x: number;
    y: number;
  };
  confidence: number;
};

type InternalPlayerTrack = PlayerTrack & {
  center: {
    x: number;
    y: number;
  };
  lastTimestamp: number;
  missingFrames: number;
  recoveredUntil: number;
  velocityX: number;
  velocityY: number;
};

type PoseLandmarks = PoseLandmarkerResult["landmarks"][number];

type PersonDetectionState = {
  bodyDetected: boolean;
  detectionsReturned: number;
  inferenceRunning: boolean;
  modelLoaded: boolean;
  tracks: PlayerTrack[];
  videoHeight: number;
  videoWidth: number;
  visiblePeople: number;
};

const defaultDetectionState: PersonDetectionState = {
  bodyDetected: false,
  detectionsReturned: 0,
  inferenceRunning: false,
  modelLoaded: false,
  tracks: [],
  videoHeight: 0,
  videoWidth: 0,
  visiblePeople: 0,
};

const poseModelUrl =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";
const visionWasmUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const detectionIntervalMs = 140;
const maxOcclusionFrames = 12;
const maxRetainedLostFrames = 36;
const recoveredStateMs = 1200;
const trackingMatchDistance = 0.22;
const lostTrackMatchDistance = 0.36;
const movingDistanceThreshold = 0.015;
const visibleBodyThreshold = 0.35;
const maxVisiblePlayers = 10;

function getLandmarkConfidence(landmarks: PoseLandmarks) {
  const confidenceValues = landmarks
    .map((landmark) => landmark.visibility ?? null)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (!confidenceValues.length) return 1;

  return confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length;
}

function getBoundingBox(landmarks: PoseLandmarks) {
  const visibleLandmarks = landmarks.filter((landmark) => (landmark.visibility ?? 1) >= 0.25);
  const points = visibleLandmarks.length ? visibleLandmarks : landmarks;
  const xs = points.map((landmark) => landmark.x).filter((value) => Number.isFinite(value));
  const ys = points.map((landmark) => landmark.y).filter((value) => Number.isFinite(value));

  if (!xs.length || !ys.length) return null;

  const minX = Math.max(0, Math.min(...xs));
  const maxX = Math.min(1, Math.max(...xs));
  const minY = Math.max(0, Math.min(...ys));
  const maxY = Math.min(1, Math.max(...ys));
  const width = Math.max(0.03, maxX - minX);
  const height = Math.max(0.05, maxY - minY);

  return {
    height,
    width,
    x: Math.max(0, minX),
    y: Math.max(0, minY),
  };
}

function getPoseDetections(result: PoseLandmarkerResult): PoseDetection[] {
  return result.landmarks
    .map((landmarks) => {
      const boundingBox = getBoundingBox(landmarks);
      if (!boundingBox) return null;

      const confidence = getLandmarkConfidence(landmarks);

      return {
        boundingBox,
        center: {
          x: boundingBox.x + boundingBox.width / 2,
          y: boundingBox.y + boundingBox.height / 2,
        },
        confidence,
      };
    })
    .filter((detection): detection is PoseDetection => Boolean(detection));
}

function getPlayerDisplayName(index: number) {
  const alphabetIndex = (index - 1) % 26;
  const cycle = Math.floor((index - 1) / 26);
  const suffix = cycle > 0 ? ` ${cycle + 1}` : "";

  return `Player ${String.fromCharCode(65 + alphabetIndex)}${suffix}`;
}

function getPoseConfidence(result: PoseLandmarkerResult) {
  const detections = getPoseDetections(result);
  const poseConfidences = detections.map((detection) => detection.confidence);

  return {
    detections,
    detectionsReturned: detections.length,
    visiblePeople: poseConfidences.filter((confidence) => confidence >= visibleBodyThreshold).length,
  };
}

function getDistance(a: PoseDetection["center"], b: PoseDetection["center"]) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getPredictedCenter(track: InternalPlayerTrack, timestamp: number) {
  const elapsedSeconds = Math.max(0, (timestamp - track.lastTimestamp) / 1000);

  return {
    x: Math.min(1, Math.max(0, track.center.x + track.velocityX * elapsedSeconds)),
    y: Math.min(1, Math.max(0, track.center.y + track.velocityY * elapsedSeconds)),
  };
}

function getBoundingBoxOverlap(a: PlayerTrack["boundingBox"], b: PlayerTrack["boundingBox"]) {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  const intersection = width * height;
  const union = a.width * a.height + b.width * b.height - intersection;

  return union > 0 ? intersection / union : 0;
}

function getTrackDetectionScore(track: InternalPlayerTrack, detection: PoseDetection, timestamp: number) {
  const predictedCenter = getPredictedCenter(track, timestamp);
  const distance = getDistance(predictedCenter, detection.center);
  const overlap = getBoundingBoxOverlap(track.boundingBox, detection.boundingBox);
  const trackArea = track.boundingBox.width * track.boundingBox.height;
  const detectionArea = detection.boundingBox.width * detection.boundingBox.height;
  const areaRatio = trackArea > 0 && detectionArea > 0 ? Math.min(trackArea, detectionArea) / Math.max(trackArea, detectionArea) : 0;
  const verticalDifference = Math.abs(track.center.y - detection.center.y);

  return distance - overlap * 0.18 - areaRatio * 0.06 + verticalDifference * 0.04;
}

function getDirection(deltaX: number, deltaY: number, distance: number): PlayerDirection {
  if (distance < movingDistanceThreshold) return "stationary";

  return Math.abs(deltaX) > Math.abs(deltaY)
    ? deltaX > 0
      ? "right"
      : "left"
    : deltaY > 0
      ? "down"
      : "up";
}

function createStationaryMovement(): PlayerMovement {
  return {
    direction: "stationary",
    distanceTraveled: 0,
    moving: false,
    stationary: true,
  };
}

function createVisibleTrackSnapshot(track: InternalPlayerTrack): PlayerTrack {
  return {
    boundingBox: track.boundingBox,
    displayName: track.displayName,
    id: track.id,
    location: track.location,
    lostCount: track.lostCount,
    movement: track.movement,
    recoveryCount: track.recoveryCount,
    status: track.status,
    visibleTimeMs: track.visibleTimeMs,
  };
}

function updatePlayerTracks(
  currentTracks: InternalPlayerTrack[],
  detections: PoseDetection[],
  timestamp: number,
  nextPlayerIndexRef: { current: number },
) {
  const unmatchedTracks = new Set(currentTracks.map((_, index) => index));
  const updatedTracks = [...currentTracks];
  const unmatchedDetections = new Set(detections.map((_, index) => index));
  const candidateMatches = detections
    .flatMap((detection, detectionIndex) =>
      updatedTracks.map((track, trackIndex) => {
        const distance = getDistance(getPredictedCenter(track, timestamp), detection.center);
        const allowedDistance = track.status === "lost" ? lostTrackMatchDistance : trackingMatchDistance;

        return {
          detection,
          detectionIndex,
          score: getTrackDetectionScore(track, detection, timestamp),
          trackIndex,
          valid: distance <= allowedDistance,
        };
      }),
    )
    .filter((candidate) => candidate.valid)
    .sort((a, b) => a.score - b.score);

  candidateMatches.forEach((match) => {
    if (!unmatchedTracks.has(match.trackIndex) || !unmatchedDetections.has(match.detectionIndex)) return;

    const matchedTrack = updatedTracks[match.trackIndex];
    const wasLost = matchedTrack.status === "lost";
    const elapsedSeconds = Math.max(0.001, (timestamp - matchedTrack.lastTimestamp) / 1000);
    const deltaX = match.detection.center.x - matchedTrack.center.x;
    const deltaY = match.detection.center.y - matchedTrack.center.y;
    const distanceTraveled = Math.hypot(deltaX, deltaY);
    updatedTracks[match.trackIndex] = {
      ...matchedTrack,
      boundingBox: match.detection.boundingBox,
      center: match.detection.center,
      lastTimestamp: timestamp,
      location: match.detection.center,
      missingFrames: 0,
      movement: {
        direction: getDirection(deltaX, deltaY, distanceTraveled),
        distanceTraveled,
        moving: distanceTraveled >= movingDistanceThreshold,
        stationary: distanceTraveled < movingDistanceThreshold,
      },
      recoveredUntil: wasLost ? timestamp + recoveredStateMs : matchedTrack.recoveredUntil,
      recoveryCount: wasLost ? matchedTrack.recoveryCount + 1 : matchedTrack.recoveryCount,
      status: wasLost ? "recovered" : "visible",
      velocityX: deltaX / elapsedSeconds,
      velocityY: deltaY / elapsedSeconds,
      visibleTimeMs: matchedTrack.visibleTimeMs + elapsedSeconds * 1000,
    };
    unmatchedTracks.delete(match.trackIndex);
    unmatchedDetections.delete(match.detectionIndex);
  });

  unmatchedDetections.forEach((detectionIndex) => {
    const detection = detections[detectionIndex];
    const activeTrackCount = updatedTracks.filter((track) => track.missingFrames < maxOcclusionFrames).length;

    if (activeTrackCount < maxVisiblePlayers) {
      const nextId = `PLAYER_${nextPlayerIndexRef.current}`;
      const displayName = getPlayerDisplayName(nextPlayerIndexRef.current);
      nextPlayerIndexRef.current += 1;
      updatedTracks.push({
        boundingBox: detection.boundingBox,
        center: detection.center,
        displayName,
        id: nextId,
        lastTimestamp: timestamp,
        location: detection.center,
        lostCount: 0,
        missingFrames: 0,
        movement: createStationaryMovement(),
        recoveredUntil: 0,
        recoveryCount: 0,
        status: "visible",
        velocityX: 0,
        velocityY: 0,
        visibleTimeMs: 0,
      });
    }
  });

  unmatchedTracks.forEach((trackIndex) => {
    const track = updatedTracks[trackIndex];
    const missingFrames = track.missingFrames + 1;
    const isNewlyLost = missingFrames === maxOcclusionFrames;
    updatedTracks[trackIndex] = {
      ...track,
      lastTimestamp: timestamp,
      lostCount: isNewlyLost ? track.lostCount + 1 : track.lostCount,
      missingFrames,
      movement: missingFrames >= maxOcclusionFrames ? createStationaryMovement() : track.movement,
      status: missingFrames >= maxOcclusionFrames ? "lost" : track.status,
      velocityX: missingFrames >= maxOcclusionFrames ? 0 : track.velocityX,
      velocityY: missingFrames >= maxOcclusionFrames ? 0 : track.velocityY,
    };
  });

  return updatedTracks
    .filter((track) => track.missingFrames <= maxRetainedLostFrames)
    .map((track) =>
      track.status === "recovered" && timestamp > track.recoveredUntil
        ? {
            ...track,
            status: "visible" as const,
          }
        : track,
    );
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
    numPoses: 10,
    runningMode: "VIDEO",
  });
}

export function usePersonDetection(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean) {
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const nextPlayerIndexRef = useRef(1);
  const playerTracksRef = useRef<InternalPlayerTrack[]>([]);
  const [state, setState] = useState<PersonDetectionState>(defaultDetectionState);

  useEffect(() => {
    if (!enabled) {
      nextPlayerIndexRef.current = 1;
      playerTracksRef.current = [];
      setState(defaultDetectionState);
      return;
    }

    let animationFrame = 0;
    let cancelled = false;
    let lastDetectionAt = 0;

    async function runDetectionLoop() {
      try {
        landmarkerRef.current ??= await createPoseLandmarker();
        if (!cancelled) {
          setState((current) => ({
            ...current,
            modelLoaded: true,
          }));
        }
      } catch (error) {
        console.error("Unable to start MediaPipe pose detection", error);
        if (!cancelled) setState(defaultDetectionState);
        return;
      }

      function detect(timestamp: number) {
        if (cancelled) return;

        const video = videoRef.current;
        const landmarker = landmarkerRef.current;
        const videoWidth = video?.videoWidth ?? 0;
        const videoHeight = video?.videoHeight ?? 0;

        if (video && landmarker && timestamp - lastDetectionAt >= detectionIntervalMs) {
          lastDetectionAt = timestamp;

          if (!videoWidth || !videoHeight) {
            setState((current) => ({
              ...current,
              bodyDetected: false,
              detectionsReturned: 0,
              inferenceRunning: false,
              tracks: playerTracksRef.current.map(createVisibleTrackSnapshot),
              videoHeight,
              videoWidth,
              visiblePeople: 0,
            }));
            animationFrame = requestAnimationFrame(detect);
            return;
          }

          const result = landmarker.detectForVideo(video, timestamp);
          const nextDetection = getPoseConfidence(result);
          const visibleDetections = nextDetection.detections
            .filter((detection) => detection.confidence >= visibleBodyThreshold)
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, maxVisiblePlayers);

          playerTracksRef.current = updatePlayerTracks(
            playerTracksRef.current,
            visibleDetections,
            timestamp,
            nextPlayerIndexRef,
          );

          setState({
            bodyDetected: nextDetection.visiblePeople > 0,
            detectionsReturned: nextDetection.detectionsReturned,
            inferenceRunning: true,
            modelLoaded: true,
            tracks: playerTracksRef.current.map(createVisibleTrackSnapshot),
            videoHeight,
            videoWidth,
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
