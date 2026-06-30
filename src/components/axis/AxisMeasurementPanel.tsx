"use client";

import type { AxisMeasurement } from "../../lib/axis/measurements";
import { formatMeasurement } from "../../lib/axis/measurements";

type Props = {
  measurements: AxisMeasurement[];
};

export function AxisMeasurementPanel({ measurements }: Props) {
  return (
    <div className="axis-measurement-panel">
      <div className="axis-panel-header">
        <span>Measurements</span>
      </div>

      {measurements.length === 0 && (
        <p className="axis-measurement-empty">Select a test to see measurements.</p>
      )}

      {measurements.map((m) => (
        <MeasurementRow key={m.id} measurement={m} />
      ))}
    </div>
  );
}

function MeasurementRow({ measurement }: { measurement: AxisMeasurement }) {
  const { label, unit, value, baseline, delta } = measurement;

  return (
    <div className="axis-measurement-row">
      <span className="axis-measurement-label">{label}</span>
      <span className="axis-measurement-value">
        {value !== null ? formatMeasurement(value, unit) : "—"}
      </span>
      {baseline !== null && (
        <span className={`axis-measurement-delta ${delta !== null && delta >= 0 ? "axis-delta--pos" : "axis-delta--neg"}`}>
          {delta !== null ? (delta >= 0 ? `+${formatMeasurement(delta, unit)}` : formatMeasurement(delta, unit)) : "—"}
        </span>
      )}
    </div>
  );
}
