"use client";

export type AxisRep = {
  id: string;
  index: number;
  timestampMs: number;
  durationMs?: number;
  label?: string;
  selected: boolean;
};

type Props = {
  reps: AxisRep[];
  onSelect: (repId: string) => void;
};

export function AxisRepTimeline({ reps, onSelect }: Props) {
  return (
    <div className="axis-rep-timeline">
      <div className="axis-panel-header">
        <span>Reps</span>
        <span className="axis-rep-count">{reps.length}</span>
      </div>

      {reps.length === 0 && (
        <p className="axis-rep-empty">No reps recorded yet.</p>
      )}

      <div className="axis-rep-list">
        {reps.map((rep) => (
          <button
            key={rep.id}
            type="button"
            className={rep.selected ? "axis-rep-chip axis-rep-chip--selected" : "axis-rep-chip"}
            onClick={() => onSelect(rep.id)}
          >
            <span className="axis-rep-index">Rep {rep.index + 1}</span>
            {rep.durationMs !== undefined && (
              <span className="axis-rep-duration">{rep.durationMs} ms</span>
            )}
            {rep.label && <span className="axis-rep-label">{rep.label}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
