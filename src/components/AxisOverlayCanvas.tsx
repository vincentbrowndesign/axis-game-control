"use client";

import { CSSProperties, useEffect, useMemo, useRef } from "react";
import {
  createAxisOverlayEngineState,
  createMockOverlayAdapter,
  renderAxisOverlayFrame,
  resetAxisOverlayEngineState,
  type AxisOverlayAdapter,
  type AxisOverlayBall,
  type AxisOverlayCoordinateSpace,
  type AxisOverlayFrame,
  type AxisOverlayPlayer,
} from "../lib/axis-overlay-engine";

export type AxisOverlayInput = {
  ball?: AxisOverlayBall;
  coordinateSpace?: AxisOverlayCoordinateSpace;
  players: AxisOverlayPlayer[];
};

export type AxisOverlayCanvasProps = {
  adapter?: AxisOverlayAdapter<{ timestamp: number }>;
  className?: string;
  fit?: "contain" | "cover" | "screen";
  input?: AxisOverlayInput;
  mock?: boolean;
  sourceHeight?: number;
  sourceWidth?: number;
  style?: CSSProperties;
};

const defaultInput: AxisOverlayInput = {
  players: [],
};

export function AxisOverlayCanvas({
  adapter,
  className,
  fit = "contain",
  input = defaultInput,
  mock = false,
  sourceHeight = 1080,
  sourceWidth = 1920,
  style,
}: AxisOverlayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef(input);
  const stateRef = useRef(createAxisOverlayEngineState());
  const startedAtRef = useRef<number | null>(null);
  const mockAdapter = useMemo(() => createMockOverlayAdapter(), []);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    resetAxisOverlayEngineState(stateRef.current);
  }, [adapter, fit, mock, sourceHeight, sourceWidth]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const activeCanvas = canvas;
    const activeCtx = ctx;

    let raf = 0;

    function paint(now: number) {
      const rect = activeCanvas.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const dpr = window.devicePixelRatio || 1;

      if (activeCanvas.width !== Math.round(width * dpr) || activeCanvas.height !== Math.round(height * dpr)) {
        activeCanvas.width = Math.round(width * dpr);
        activeCanvas.height = Math.round(height * dpr);
        activeCanvas.style.width = `${width}px`;
        activeCanvas.style.height = `${height}px`;
      }

      activeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (startedAtRef.current === null) startedAtRef.current = now;
      const timestamp = (now - startedAtRef.current) / 1000;
      const activeAdapter = adapter ?? (mock ? mockAdapter : undefined);
      const sourceFrame = inputRef.current;
      const frame: AxisOverlayFrame = activeAdapter
        ? activeAdapter.getFrame({ timestamp })
        : {
            ball: sourceFrame.ball,
            coordinateSpace: sourceFrame.coordinateSpace,
            players: sourceFrame.players,
            timestamp,
          };

      renderAxisOverlayFrame({
        canvasHeight: height,
        canvasWidth: width,
        ctx: activeCtx,
        frame,
        options: {
          coordinateSpace: sourceFrame.coordinateSpace,
          fit,
          sourceHeight,
          sourceWidth,
        },
        state: stateRef.current,
      });

      raf = requestAnimationFrame(paint);
    }

    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [adapter, fit, mock, mockAdapter, sourceHeight, sourceWidth]);

  return (
    <canvas
      aria-hidden="true"
      className={className}
      ref={canvasRef}
      style={{
        display: "block",
        height: "100%",
        inset: 0,
        pointerEvents: "none",
        position: "absolute",
        width: "100%",
        ...style,
      }}
    />
  );
}
