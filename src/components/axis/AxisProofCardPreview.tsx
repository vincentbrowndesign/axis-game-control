"use client";

import type { AxisMeasurement } from "../../lib/axis/measurements";
import { formatMeasurement } from "../../lib/axis/measurements";

type Props = {
  athleteName: string | null;
  testName: string | null;
  measurements: AxisMeasurement[];
  repCount: number;
  recordedAt: string | null;
};

export function AxisProofCardPreview({ athleteName, testName, measurements, repCount, recordedAt }: Props) {
  const hasMeasurements = measurements.some((m) => m.value !== null);

  return (
    <div className="axis-proof-card">
      <div className="axis-proof-card-header">
        <span className="axis-proof-card-label">AXIS MEASURES</span>
        <div className="axis-proof-card-meta">
          <strong>{athleteName ?? "No athlete selected"}</strong>
          <span>{testName ?? "No test selected"}</span>
          {recordedAt && <span>{recordedAt}</span>}
        </div>
      </div>

      {!hasMeasurements && (
        <p className="axis-proof-card-empty">Run reps to populate proof card.</p>
      )}

      {hasMeasurements && (
        <div className="axis-proof-card-measurements">
          {measurements
            .filter((m) => m.value !== null)
            .map((m) => (
              <div key={m.id} className="axis-proof-card-row">
                <span>{m.label}</span>
                <strong>{formatMeasurement(m.value, m.unit)}</strong>
                {m.baseline !== null && m.delta !== null && (
                  <span className={m.delta >= 0 ? "axis-proof-delta--pos" : "axis-proof-delta--neg"}>
                    {m.delta >= 0 ? "+" : ""}{formatMeasurement(m.delta, m.unit)}
                  </span>
                )}
              </div>
            ))}
        </div>
      )}

      <div className="axis-proof-card-footer">
        <span>{repCount} rep{repCount !== 1 ? "s" : ""}</span>
        <span>ontheaxis.com</span>
      </div>
    </div>
  );
}
