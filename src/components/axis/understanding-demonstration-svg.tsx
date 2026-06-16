"use client";

import {
  motionBlueprintFromUnderstanding,
  type MotionBlueprintObject,
} from "../../lib/axis-motion-blueprint";
import type { AxisUnderstanding } from "../../lib/axis-server";

type DemonstrationInput = Pick<
  AxisUnderstanding,
  "concept" | "primitives" | "currentPattern" | "targetPattern"
> & { id?: string };

interface UnderstandingDemonstrationSvgProps {
  understanding: DemonstrationInput;
}

export function UnderstandingDemonstrationSvg({
  understanding,
}: UnderstandingDemonstrationSvgProps) {
  const blueprint = motionBlueprintFromUnderstanding(understanding);
  const duration = `${blueprint.durationMs}ms`;

  return (
    <figure className="understanding-demo" aria-label="Generated movement demonstration">
      <svg className="understanding-svg" viewBox="0 0 520 220" role="img">
        <rect x="0" y="0" width="520" height="220" rx="18" fill="rgba(26, 26, 24, 0.025)" />

        <g transform="translate(34 28)">
          <text x="0" y="0" className="demo-label">
            NOW
          </text>
          <rect x="0" y="16" width="210" height="168" rx="12" fill="rgba(255,255,255,0.62)" />
          <BlueprintFrame mode="now" objects={blueprint.objects} />
        </g>

        <g transform="translate(276 28)">
          <text x="0" y="0" className="demo-label demo-label--target">
            TARGET
          </text>
          <rect x="0" y="16" width="210" height="168" rx="12" fill="rgba(120, 170, 60, 0.045)" />
          <BlueprintFrame mode="target" objects={blueprint.objects} />
        </g>

        <g transform="translate(155 28)">
          {blueprint.paths.map((path) => (
            <path key={path.id} d={path.d} className="motion-path" pathLength="1">
              <animate attributeName="stroke-dashoffset" values="1;0;0" dur={duration} repeatCount="indefinite" />
            </path>
          ))}
          {blueprint.objects.map((object) => (
            <AnimatedObject key={object.id} object={object} duration={duration} />
          ))}
        </g>

        <line x1="254" y1="64" x2="254" y2="188" stroke="rgba(26,26,24,0.08)" />
      </svg>

      <style jsx>{`
        .understanding-demo {
          margin: 22px 0;
          width: 100%;
        }

        .understanding-svg {
          display: block;
          height: auto;
          max-width: 100%;
          width: 100%;
        }

        .demo-label {
          fill: rgba(26, 26, 24, 0.38);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
          font-size: 11px;
          font-weight: 760;
          letter-spacing: 0.16em;
        }

        .demo-label--target {
          fill: rgba(120, 170, 60, 0.92);
        }

        .motion-path {
          fill: none;
          stroke: rgba(120, 170, 60, 0.42);
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          stroke-linecap: round;
          stroke-width: 2.5;
        }
      `}</style>
    </figure>
  );
}

function BlueprintFrame({
  mode,
  objects,
}: {
  mode: "now" | "target";
  objects: MotionBlueprintObject[];
}) {
  const isTarget = mode === "target";
  const stroke = isTarget ? "rgba(120, 170, 60, 0.92)" : "rgba(26, 26, 24, 0.56)";
  const softStroke = isTarget ? "rgba(120, 170, 60, 0.28)" : "rgba(26, 26, 24, 0.14)";
  const player = objects.find((object) => object.kind === "player")!;
  const ball = objects.find((object) => object.kind === "ball")!;
  const target = objects.find((object) => object.kind === "target")!;
  const center = objects.find((object) => object.kind === "center_of_mass")!;
  const plant = objects.find((object) => object.kind === "plant_foot")!;
  const point = (object: MotionBlueprintObject) => (isTarget ? object.target : object.now);
  const playerPoint = point(player);

  return (
    <>
      <line x1="30" y1="138" x2="190" y2="138" stroke={softStroke} strokeWidth="1" />
      <path
        d={`M${player.now.x} ${player.now.y} Q${(player.now.x + player.target.x) / 2} ${
          Math.min(player.now.y, player.target.y) - 22
        } ${player.target.x} ${player.target.y}`}
        fill="none"
        stroke={softStroke}
        strokeLinecap="round"
        strokeWidth="2"
      />
      <circle cx={playerPoint.x} cy={playerPoint.y} r={player.radius} fill="none" stroke={stroke} strokeWidth="2" />
      <line x1={playerPoint.x} y1={playerPoint.y + 15} x2={playerPoint.x} y2="132" stroke={stroke} strokeWidth="2" />
      <line x1={playerPoint.x - 18} y1="132" x2={playerPoint.x + 18} y2="132" stroke={stroke} strokeWidth="2" />
      <circle cx={point(ball).x} cy={point(ball).y} r={ball.radius} fill={stroke} />
      <circle cx={point(target).x} cy={point(target).y} r={target.radius} fill="none" stroke={softStroke} strokeWidth="2" />
      <line x1={playerPoint.x} y1="50" x2={point(center).x} y2={point(center).y} stroke={stroke} strokeDasharray="4 5" strokeWidth="1.5" />
      <circle cx={point(center).x} cy={point(center).y} r={center.radius} fill={stroke} />
      <circle cx={point(plant).x} cy={point(plant).y} r={plant.radius} fill={softStroke} stroke={stroke} strokeWidth="1.5" />
    </>
  );
}

function AnimatedObject({
  object,
  duration,
}: {
  object: MotionBlueprintObject;
  duration: string;
}) {
  if (object.kind === "target") return null;

  return (
    <circle
      cx={object.now.x}
      cy={object.now.y}
      r={Math.max(3, object.radius * 0.62)}
      fill={object.kind === "ball" ? "rgba(120, 170, 60, 0.86)" : "rgba(26, 26, 24, 0.62)"}
      opacity="0.72"
    >
      <animate attributeName="cx" values={`${object.now.x};${object.target.x};${object.target.x}`} dur={duration} repeatCount="indefinite" />
      <animate attributeName="cy" values={`${object.now.y};${object.target.y};${object.target.y}`} dur={duration} repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.28;0.86;0.28" dur={duration} repeatCount="indefinite" />
    </circle>
  );
}
