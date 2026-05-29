"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

export type BallPosition = {
  x: number;
  y: number;
};

export type BallVelocity = {
  x: number;
  y: number;
};

export type BallTrackingState = {
  position?: BallPosition;
  trajectory: BallPosition[];
  velocity?: BallVelocity;
  visible: boolean;
};

const defaultBallTrackingState: BallTrackingState = {
  trajectory: [],
  visible: false,
};

const sampleWidth = 160;
const sampleHeight = 90;
const ballDetectionIntervalMs = 120;
const minimumOrangePixels = 10;
const maximumTrajectoryPoints = 18;

function isBasketballPixel(red: number, green: number, blue: number) {
  return red > 105 && green > 38 && green < 185 && blue < 130 && red > green * 1.08 && red > blue * 1.45;
}

function detectBasketball(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(video, 0, 0, sampleWidth, sampleHeight);

  const frame = context.getImageData(0, 0, sampleWidth, sampleHeight);
  const data = frame.data;
  let count = 0;
  let minX = sampleWidth;
  let minY = sampleHeight;
  let maxX = 0;
  let maxY = 0;
  let totalX = 0;
  let totalY = 0;

  for (let y = 0; y < sampleHeight; y += 2) {
    for (let x = 0; x < sampleWidth; x += 2) {
      const index = (y * sampleWidth + x) * 4;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];

      if (!isBasketballPixel(red, green, blue)) continue;

      count += 1;
      totalX += x;
      totalY += y;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (count < minimumOrangePixels) return null;

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const aspectRatio = width / height;

  if (aspectRatio < 0.45 || aspectRatio > 2.2) return null;

  return {
    position: {
      x: totalX / count / sampleWidth,
      y: totalY / count / sampleHeight,
    },
  };
}

export function useBallTracking(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previousPositionRef = useRef<BallPosition | null>(null);
  const previousTimestampRef = useRef<number | null>(null);
  const trajectoryRef = useRef<BallPosition[]>([]);
  const [state, setState] = useState<BallTrackingState>(defaultBallTrackingState);

  useEffect(() => {
    if (!enabled) {
      previousPositionRef.current = null;
      previousTimestampRef.current = null;
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
        const detection = canvasRef.current ? detectBasketball(video, canvasRef.current) : null;

        if (!detection) {
          previousPositionRef.current = null;
          previousTimestampRef.current = timestamp;
          setState((current) => ({
            ...current,
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
        previousPositionRef.current = detection.position;
        previousTimestampRef.current = timestamp;

        setState({
          position: detection.position,
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
