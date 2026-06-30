"use client";

import type { AxisLandmarkRequirement } from "../../lib/axis/landmarks";

type Props = {
  requirements: AxisLandmarkRequirement[];
  overallConfidence: number | null;
};

export function AxisLandmarkRequirementPanel({ requirements, overallConfidence }: Props) {
  const required = requirements.filter((r) => r.status === "required" || r.status === "missing" || r.status === "detected" || r.status === "low-confidence");
  const optional = requirements.filter((r) => r.status === "optional");

  return (
    <div className="axis-landmark-panel">
      <div className="axis-panel-header">
        <span>Landmarks</span>
        {overallConfidence !== null && (
          <span className={overallConfidence >= 0.55 ? "axis-conf axis-conf--ok" : "axis-conf axis-conf--low"}>
            {Math.round(overallConfidence * 100)}%
          </span>
        )}
      </div>

      <div className="axis-landmark-group">
        <p className="axis-landmark-group-label">Required</p>
        {required.map((r) => (
          <LandmarkRow key={r.id} requirement={r} />
        ))}
        {required.length === 0 && <p className="axis-landmark-empty">Select a test</p>}
      </div>

      {optional.length > 0 && (
        <div className="axis-landmark-group">
          <p className="axis-landmark-group-label">Optional</p>
          {optional.map((r) => (
            <LandmarkRow key={r.id} requirement={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function LandmarkRow({ requirement }: { requirement: AxisLandmarkRequirement }) {
  const { label, status, confidence } = requirement;
  const statusDot =
    status === "detected"
      ? "axis-dot axis-dot--ok"
      : status === "low-confidence"
        ? "axis-dot axis-dot--warn"
        : status === "missing"
          ? "axis-dot axis-dot--err"
          : "axis-dot axis-dot--idle";

  return (
    <div className="axis-landmark-row">
      <span className={statusDot} />
      <span className="axis-landmark-label">{label}</span>
      {confidence !== undefined && (
        <span className="axis-landmark-conf">{Math.round(confidence * 100)}%</span>
      )}
    </div>
  );
}
