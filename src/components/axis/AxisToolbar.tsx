"use client";

type AxisToolbarProps = {
  instruction: string;
  isLoading: boolean;
  onCreatePlan: () => void;
  onInstructionChange: (instruction: string) => void;
};

const quickChips = ["30 min shooting", "60 min skill work", "Speed stop", "Delta offense", "Make it harder", "Balance time"];

export function AxisToolbar({ instruction, isLoading, onCreatePlan, onInstructionChange }: AxisToolbarProps) {
  function addChip(chip: string) {
    onInstructionChange(instruction.trim() ? `${instruction.trim()}, ${chip}` : chip);
  }

  return (
    <section className="axis-builder" aria-labelledby="axis-builder-title">
      <div className="axis-builder__copy">
        <p>Axis Routine</p>
        <h2 id="axis-builder-title">Tell Axis what you&apos;re building.</h2>
        <span>Axis will create a plan you can edit before starting.</span>
      </div>

      <label className="axis-builder__input">
        <span>Routine instruction</span>
        <textarea
          onChange={(event) => onInstructionChange(event.target.value)}
          placeholder="Example: Hailey, 30 minute speed stop workout, timed count"
          rows={4}
          value={instruction}
        />
      </label>

      <div className="axis-builder__chips" aria-label="Quick routine ideas">
        {quickChips.map((chip) => (
          <button key={chip} onClick={() => addChip(chip)} type="button">
            {chip}
          </button>
        ))}
      </div>

      <button className="axis-builder__primary" disabled={!instruction.trim() || isLoading} onClick={onCreatePlan} type="button">
        {isLoading ? "Creating..." : "Create Plan"}
      </button>

      <style jsx>{`
        .axis-builder {
          background: #141610;
          border: 1px solid rgba(20, 22, 16, 0.2);
          border-radius: 0.75rem;
          color: #f7f4eb;
          display: grid;
          gap: 0.8rem;
          padding: 0.9rem;
        }

        .axis-builder,
        .axis-builder * {
          box-sizing: border-box;
        }

        .axis-builder__copy,
        .axis-builder__input {
          display: grid;
          gap: 0.35rem;
        }

        .axis-builder p,
        .axis-builder h2 {
          margin: 0;
        }

        .axis-builder__copy p,
        .axis-builder label span {
          color: rgba(247, 244, 235, 0.62);
          font-size: 0.72rem;
          font-weight: 850;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .axis-builder h2 {
          font-size: clamp(1.8rem, 8vw, 3.2rem);
          letter-spacing: 0;
          line-height: 0.95;
        }

        .axis-builder__copy span {
          color: rgba(247, 244, 235, 0.72);
        }

        .axis-builder textarea {
          background: #fffdf7;
          border: 1px solid rgba(247, 244, 235, 0.2);
          border-radius: 0.55rem;
          color: #141610;
          font: inherit;
          min-height: 7.5rem;
          padding: 0.85rem;
          resize: vertical;
          width: 100%;
        }

        .axis-builder__chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
        }

        .axis-builder button {
          border-radius: 0.5rem;
          font: inherit;
          font-weight: 850;
          min-height: 2.9rem;
          padding: 0 0.85rem;
        }

        .axis-builder__chips button {
          background: rgba(247, 244, 235, 0.08);
          border: 1px solid rgba(247, 244, 235, 0.16);
          color: #f7f4eb;
        }

        .axis-builder__primary {
          background: #f7f4eb;
          border: 1px solid #f7f4eb;
          color: #141610;
          width: 100%;
        }

        .axis-builder__primary:disabled {
          background: rgba(247, 244, 235, 0.2);
          border-color: rgba(247, 244, 235, 0.12);
          color: rgba(247, 244, 235, 0.52);
        }
      `}</style>
    </section>
  );
}
