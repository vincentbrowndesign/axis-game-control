"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import { type PlayerTrack } from "./usePersonDetection";

export type BallPosition = {
  x: number;
  y: number;
};

export type BallVelocity = {
  x: number;
  y: number;
};

export type BallTrackingState = {
  confidence: number;
  lostCount: number;
  position?: BallPosition;
  recoveryCount: number;
  status: "lost" | "make" | "miss" | "rebound" | "recovered" | "shot" | "visible";
  trajectory: BallPosition[];
  velocity?: BallVelocity;
  visible: boolean;
  boundingBox?: {
    height: number;
    width: number;
    x: number;
    y: number;
  };
};

const defaultBallTrackingState: BallTrackingState = {
  confidence: 0,
  lostCount: 0,
  recoveryCount: 0,
  status: "lost",
  trajectory: [],
  visible: false,
};

const sampleWidth = 160;
const sampleHeight = 90;
const ballDetectionIntervalMs = 16;
const minimumOrangePixels = 14;
const maximumTrajectoryPoints = 18;
const recoveredStateMs = 900;
const minimumBallConfidence = 0.8;

type BallCandidate = {
  boundingBox: NonNullable<BallTrackingState["boundingBox"]>;
  confidence: number;
  count: number;
  position: BallPosition;
};

type PlayerExclusionBox = PlayerTrack["boundingBox"];

function isBasketballPixel(red: number, green: number, blue: number) {
  return red > 105 && green > 38 && green < 185 && blue < 130 && red > green * 1.08 && red > blue * 1.45;
}

function getBoxOverlap(a: NonNullable<BallTrackingState["boundingBox"]>, b: PlayerExclusionBox) {
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

function isPointInsideBox(point: BallPosition, box: PlayerExclusionBox) {
  return point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height;
}

function getPlayerPenalty(candidate: BallCandidate, playerBoxes: PlayerExclusionBox[]) {
  return playerBoxes.reduce((penalty, box) => {
    const overlap = getBoxOverlap(candidate.boundingBox, box);
    const centerInsidePlayer = isPointInsideBox(candidate.position, box);
    const candidateArea = candidate.boundingBox.width * candidate.boundingBox.height;
    const largeCandidateInsidePlayer = centerInsidePlayer && candidateArea > 0.012;

    return Math.max(penalty, overlap * 1.45 + (largeCandidateInsidePlayer ? 0.28 : 0));
  }, 0);
}

function scoreBallCandidate(candidate: BallCandidate, playerBoxes: PlayerExclusionBox[]) {
  const area = candidate.boundingBox.width * candidate.boundingBox.height;
  const aspectRatio = candidate.boundingBox.width / candidate.boundingBox.height;
  const circularity = 1 - Math.min(1, Math.abs(1 - aspectRatio));
  const densityArea = candidate.boundingBox.width * sampleWidth * candidate.boundingBox.height * sampleHeight;
  const density = densityArea > 0 ? Math.min(1, candidate.count / densityArea) : 0;
  const sizeScore = area >= 0.0003 && area <= 0.018 ? 1 : 0.35;
  const pixelScore = Math.min(1, candidate.count / 42);
  const playerPenalty = getPlayerPenalty(candidate, playerBoxes);

  return Math.max(0, Math.min(1, pixelScore * 0.34 + circularity * 0.3 + density * 0.22 + sizeScore * 0.14 - playerPenalty));
}

function detectBasketball(video: HTMLVideoElement, canvas: HTMLCanvasElement, playerBoxes: PlayerExclusionBox[]) {
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(video, 0, 0, sampleWidth, sampleHeight);

  const frame = context.getImageData(0, 0, sampleWidth, sampleHeight);
  const data = frame.data;
  const mask = new Uint8Array(sampleWidth * sampleHeight);
  const visited = new Uint8Array(sampleWidth * sampleHeight);

  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      const index = (y * sampleWidth + x) * 4;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];

      if (isBasketballPixel(red, green, blue)) {
        mask[y * sampleWidth + x] = 1;
      }
    }
  }

  const candidates: BallCandidate[] = [];

  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      const startIndex = y * sampleWidth + x;
      if (!mask[startIndex] || visited[startIndex]) continue;

      const stack = [startIndex];
      visited[startIndex] = 1;
      let count = 0;
      let minX = sampleWidth;
      let minY = sampleHeight;
      let maxX = 0;
      let maxY = 0;
      let totalX = 0;
      let totalY = 0;

      while (stack.length) {
        const current = stack.pop() as number;
        const currentX = current % sampleWidth;
        const currentY = Math.floor(current / sampleWidth);

        count += 1;
        totalX += currentX;
        totalY += currentY;
        minX = Math.min(minX, currentX);
        minY = Math.min(minY, currentY);
        maxX = Math.max(maxX, currentX);
        maxY = Math.max(maxY, currentY);

        const neighbors = [current - 1, current + 1, current - sampleWidth, current + sampleWidth];
        for (const neighbor of neighbors) {
          if (neighbor < 0 || neighbor >= mask.length || visited[neighbor] || !mask[neighbor]) continue;
          const neighborX = neighbor % sampleWidth;
          if (Math.abs(neighborX - currentX) > 1) continue;

          visited[neighbor] = 1;
          stack.push(neighbor);
        }
      }

      if (count < minimumOrangePixels) continue;

      const width = Math.max(1, maxX - minX);
      const height = Math.max(1, maxY - minY);
      const aspectRatio = width / height;
      const normalizedWidth = width / sampleWidth;
      const normalizedHeight = height / sampleHeight;

      if (aspectRatio < 0.62 || aspectRatio > 1.62) continue;
      if (normalizedWidth > 0.16 || normalizedHeight > 0.24) continue;

      const position = {
        x: totalX / count / sampleWidth,
        y: totalY / count / sampleHeight,
      };
      const boundingBox = {
        height: normalizedHeight,
        width: normalizedWidth,
        x: minX / sampleWidth,
        y: minY / sampleHeight,
      };
      const candidate = {
        boundingBox,
        confidence: 0,
        count,
        position,
      };

      candidates.push({
        ...candidate,
        confidence: scoreBallCandidate(candidate, playerBoxes),
      });
    }
  }

  const bestCandidate = candidates.sort((a, b) => b.confidence - a.confidence)[0];
  if (!bestCandidate || bestCandidate.confidence < minimumBallConfidence) return null;

  return bestCandidate;
}

export function useBallTracking(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  playerTracks: PlayerTrack[] = [],
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerBoxesRef = useRef<PlayerExclusionBox[]>([]);
  const previousPositionRef = useRef<BallPosition | null>(null);
  const previousTimestampRef = useRef<number | null>(null);
  const previousVisibleRef = useRef(false);
  const recoveredUntilRef = useRef(0);
  const lostCountRef = useRef(0);
  const recoveryCountRef = useRef(0);
  const trajectoryRef = useRef<BallPosition[]>([]);
  const [state, setState] = useState<BallTrackingState>(defaultBallTrackingState);

  useEffect(() => {
    playerBoxesRef.current = playerTracks
      .filter((track) => track.status !== "lost")
      .map((track) => track.boundingBox);
  }, [playerTracks]);

  useEffect(() => {
    if (!enabled) {
      previousPositionRef.current = null;
      previousTimestampRef.current = null;
      previousVisibleRef.current = false;
      recoveredUntilRef.current = 0;
      lostCountRef.current = 0;
      recoveryCountRef.current = 0;
      trajectoryRef.current = [];
      setState(defaultBallTrackingState);
      return;
    }

    let animationFrame = 0;
    let cancelled = false;
    let lastDetectionAt = 0;
    canvasRef.current ??= document.createElement("canvas");

    function detect(timestamp: number) {
      if (cancelled) return;

      const video = videoRef.current;

      if (video && video.videoWidth && video.videoHeight && timestamp - lastDetectionAt >= ballDetectionIntervalMs) {
        lastDetectionAt = timestamp;
        const detection = canvasRef.current ? detectBasketball(video, canvasRef.current, playerBoxesRef.current) : null;

        if (!detection) {
          if (previousVisibleRef.current) {
            lostCountRef.current += 1;
          }
          previousPositionRef.current = null;
          previousTimestampRef.current = timestamp;
          previousVisibleRef.current = false;
          setState((current) => ({
            ...current,
            confidence: 0,
            lostCount: lostCountRef.current,
            status: "lost",
            visible: false,
          }));
          animationFrame = requestAnimationFrame(detect);
          return;
        }

        const previousPosition = previousPositionRef.current;
        const previousTimestamp = previousTimestampRef.current;
        const elapsedSeconds = previousTimestamp ? Math.max(0.001, (timestamp - previousTimestamp) / 1000) : 0;
        const velocity =
          previousPosition && elapsedSeconds > 0
            ? {
                x: (detection.position.x - previousPosition.x) / elapsedSeconds,
                y: (detection.position.y - previousPosition.y) / elapsedSeconds,
              }
            : {
                x: 0,
                y: 0,
              };

        trajectoryRef.current = [...trajectoryRef.current, detection.position].slice(-maximumTrajectoryPoints);
        if (!previousVisibleRef.current) {
          recoveryCountRef.current += 1;
          recoveredUntilRef.current = timestamp + recoveredStateMs;
        }
        previousPositionRef.current = detection.position;
        previousTimestampRef.current = timestamp;
        previousVisibleRef.current = true;

        setState({
          boundingBox: detection.boundingBox,
          confidence: detection.confidence,
          lostCount: lostCountRef.current,
          position: detection.position,
          recoveryCount: recoveryCountRef.current,
          status: timestamp <= recoveredUntilRef.current ? "recovered" : "visible",
          trajectory: trajectoryRef.current,
          velocity,
          visible: true,
        });
      }

      animationFrame = requestAnimationFrame(detect);
    }

    animationFrame = requestAnimationFrame(detect);

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
    };
  }, [enabled, videoRef]);

  return state;
}
