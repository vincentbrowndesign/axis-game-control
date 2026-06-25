"use client";

import { useState } from "react";
import type {
  AxisRoutineToolbarSetup,
  AxisRoutineToolbarSuggestion,
} from "../../lib/axis/routine/toolbar-types";

type AxisToolbarProps = {
  currentSetup: AxisRoutineToolbarSetup;
  onApply: (suggestion: AxisRoutineToolbarSuggestion) => void;
};

const quickChips = ["30 min shooting", "60 min skill work", "Speed stop", "Make it harder", "Balance time"];

export function AxisToolbar({ currentSetup, onApply }: AxisToolbarProps) {
  const [instruction, setInstruction] = useState("");
  const [suggestion, setSuggestion] = useState<AxisRoutineToolbarSuggestion | null>(null);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function buildWithAxis() {
    const trimmedInstruction = instruction.trim();
    if (!trimmedInstruction || isLoading) return;

    setIsLoading(true);
    setStatus("");

    try {
      const response = await fetch("/api/axis/toolbar", {
        body: JSON.stringify({
          currentBlockPlan: currentSetup.blocks,
          currentSetup,
          instruction: trimmedInstruction,
          mode: "setup",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const payload = (await response.json()) as { error?: string; suggestion?: AxisRoutineToolbarSuggestion };
      if (!response.ok || !payload.suggestion) {
        setStatus(payload.error ?? "Axis could not build a suggestion.");
        return;
      }

      setSuggestion(payload.suggestion);
      setStatus("Review the suggestion before applying.");
    } catch {
      setStatus("Axis could not build a suggestion. Manual setup still works.");
    } finally {
      setIsLoading(false);
    }
  }

  function addChip(chip: string) {
    setInstruction((currentInstruction) => {
      if (!currentInstruction.trim()) return chip;
      return `${currentInstruction.trim()}, ${chip}`;
    });
  }

  function applySuggestion() {
    if (!suggestion) return;
    onApply(suggestion);
    setSuggestion(null);
    setStatus("Applied. Manual setup is still available.");
  }

  function editManually() {
    setStatus("Use manual setup below to adjust before building.");
  }

  function ignoreSuggestion() {
    setSuggestion(null);
    setStatus("Ignored. Nothing changed.");
  }

  return (
    <section className="axis-toolbar" aria-labelledby="axis-toolbar-title">
      <div className="axis-toolbar__copy">
        <p>Axis Toolbar</p>
        <h2 id="axis-toolbar-title">Tell Axis what you&apos;re building.</h2>
        <span>Axis will suggest the setup. You approve before anything changes.</span>
      </div>

      <label className="axis-toolbar__input">
        <span>Routine instruction</span>
        <textarea
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="Example: Hailey, 30 minute speed stop workout, timed count"
          rows={3}
          value={instruction}
        />
      </label>

      <div className="axis-toolbar__chips" aria-label="Quick routine ideas">
        {quickChips.map((chip) => (
          <button key={chip} onClick={() => addChip(chip)} type="button">
            {chip}
          </button>
        ))}
      </div>

      <button className="axis-toolbar__primary" disabled={!instruction.trim() || isLoading} onClick={buildWithAxis} type="button">
        {isLoading ? "Building..." : "Build with Axis"}
      </button>

      {status && <p className="axis-toolbar__status">{status}</p>}

      {suggestion && (
        <section className="axis-toolbar__proposal" aria-labelledby="axis-toolbar-proposal-title">
          <div>
            <p>Proposed setup</p>
            <h3 id="axis-toolbar-proposal-title">{suggestion.benchmarkName}</h3>
            <span>{suggestion.explanation}</span>
          </div>

          <dl className="axis-toolbar__details">
            <div>
              <dt>Player / Group</dt>
              <dd>{suggestion.playerOrGroup}</dd>
            </div>
            <div>
              <dt>Focus</dt>
              <dd>{suggestion.focus}</dd>
            </div>
            <div>
              <dt>Routine Length</dt>
              <dd>{suggestion.routineLengthMinutes} min</dd>
            </div>
            <div>
              <dt>Scoring Method</dt>
              <dd>{formatScoringMethod(suggestion.scoringMethod)}</dd>
            </div>
          </dl>

          <div className="axis-toolbar__plan" aria-label="Proposed block plan">
            {suggestion.blocks.map((block) => (
              <div key={`${block.order}-${block.name}`}>
                <span>{block.order}</span>
                <strong>{block.name}</strong>
                <em>{Math.round(block.plannedDurationSeconds / 60)} min</em>
              </div>
            ))}
          </div>

          <div className="axis-toolbar__review-actions">
            <button className="axis-toolbar__primary" onClick={applySuggestion} type="button">
              Apply
            </button>
            <button onClick={editManually} type="button">
              Edit
            </button>
            <button onClick={ignoreSuggestion} type="button">
              Ignore
            </button>
          </div>
        </section>
      )}

      <p className="axis-toolbar__manual">Manual setup is always available.</p>

      <style jsx>{`
        .axis-toolbar {
          background: #141610;
          border: 1px solid rgba(20, 22, 16, 0.2);
          border-radius: 0.75rem;
          color: #f7f4eb;
          display: grid;
          gap: 0.75rem;
          padding: 0.85rem;
        }

        .axis-toolbar,
        .axis-toolbar * {
          box-sizing: border-box;
        }

        .axis-toolbar__copy,
        .axis-toolbar__proposal,
        .axis-toolbar__proposal > div:first-child {
          display: grid;
          gap: 0.35rem;
        }

        .axis-toolbar p,
        .axis-toolbar h2,
        .axis-toolbar h3,
        .axis-toolbar dl,
        .axis-toolbar dd {
          margin: 0;
        }

        .axis-toolbar__copy p,
        .axis-toolbar label span,
        .axis-toolbar__proposal p,
        .axis-toolbar dt {
          color: rgba(247, 244, 235, 0.62);
          font-size: 0.72rem;
          font-weight: 850;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .axis-toolbar h2 {
          font-size: clamp(1.55rem, 7vw, 2.6rem);
          letter-spacing: 0;
          line-height: 0.98;
        }

        .axis-toolbar h3 {
          font-size: 1.25rem;
          letter-spacing: 0;
          line-height: 1.05;
        }

        .axis-toolbar__copy span,
        .axis-toolbar__proposal span,
        .axis-toolbar__status,
        .axis-toolbar__manual {
          color: rgba(247, 244, 235, 0.72);
        }

        .axis-toolbar__input {
          display: grid;
          gap: 0.35rem;
        }

        .axis-toolbar textarea {
          background: #fffdf7;
          border: 1px solid rgba(247, 244, 235, 0.2);
          border-radius: 0.55rem;
          color: #141610;
          font: inherit;
          min-height: 6.2rem;
          padding: 0.8rem;
          resize: vertical;
          width: 100%;
        }

        .axis-toolbar__chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
        }

        .axis-toolbar button {
          border-radius: 0.5rem;
          font: inherit;
          font-weight: 850;
          min-height: 2.75rem;
          padding: 0 0.85rem;
        }

        .axis-toolbar__chips button,
        .axis-toolbar__review-actions button {
          background: rgba(247, 244, 235, 0.08);
          border: 1px solid rgba(247, 244, 235, 0.16);
          color: #f7f4eb;
        }

        .axis-toolbar__primary {
          background: #f7f4eb;
          border: 1px solid #f7f4eb;
          color: #141610;
          width: 100%;
        }

        .axis-toolbar__primary:disabled {
          background: rgba(247, 244, 235, 0.2);
          border-color: rgba(247, 244, 235, 0.12);
          color: rgba(247, 244, 235, 0.52);
        }

        .axis-toolbar__proposal {
          background: rgba(247, 244, 235, 0.08);
          border: 1px solid rgba(247, 244, 235, 0.14);
          border-radius: 0.65rem;
          padding: 0.75rem;
        }

        .axis-toolbar__details {
          display: grid;
          gap: 0.55rem;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .axis-toolbar__details div {
          display: grid;
          gap: 0.12rem;
          min-width: 0;
        }

        .axis-toolbar dd {
          font-weight: 850;
          overflow-wrap: anywhere;
        }

        .axis-toolbar__plan {
          display: grid;
          gap: 0.4rem;
        }

        .axis-toolbar__plan div {
          align-items: center;
          background: rgba(247, 244, 235, 0.08);
          border: 1px solid rgba(247, 244, 235, 0.12);
          border-radius: 0.45rem;
          display: grid;
          gap: 0.45rem;
          grid-template-columns: 1.5rem minmax(0, 1fr) auto;
          padding: 0.55rem 0.6rem;
        }

        .axis-toolbar__plan span {
          color: rgba(247, 244, 235, 0.62);
          font-size: 0.75rem;
          font-weight: 900;
        }

        .axis-toolbar__plan strong {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .axis-toolbar__plan em {
          font-size: 0.82rem;
          font-style: normal;
          font-weight: 850;
          white-space: nowrap;
        }

        .axis-toolbar__review-actions {
          display: grid;
          gap: 0.5rem;
          grid-template-columns: 1fr;
        }

        @media (min-width: 720px) {
          .axis-toolbar {
            padding: 1rem;
          }

          .axis-toolbar__review-actions {
            grid-template-columns: 1.3fr 1fr 1fr;
          }
        }

        @media (max-width: 430px) {
          .axis-toolbar__details {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}

function formatScoringMethod(scoringMethod: AxisRoutineToolbarSuggestion["scoringMethod"]) {
  const labels: Record<AxisRoutineToolbarSuggestion["scoringMethod"], string> = {
    count_only: "Rep Count",
    make_miss: "Make / Miss",
    success_fail: "Success / Fail",
    timed_count: "Timed Count",
  };

  return labels[scoringMethod];
}
