"use client";

import { useMemo, useState } from "react";
import type { RoutineBlockPlan, RoutineScoringMethod, RoutineTemplate } from "../../../lib/axis/routine/types";

type RoutineLengthOption = "30" | "45" | "60" | "custom";

type EditableBlock = RoutineBlockPlan & {
  id: string;
};

const routineLengthOptions: Array<{ label: string; value: RoutineLengthOption }> = [
  { label: "30 min", value: "30" },
  { label: "45 min", value: "45" },
  { label: "60 min", value: "60" },
  { label: "Custom", value: "custom" },
];

const scoringOptions: Array<{ label: string; value: RoutineScoringMethod }> = [
  { label: "Make / Miss", value: "make_miss" },
  { label: "Success / Fail", value: "success_fail" },
  { label: "Rep Count", value: "count_only" },
  { label: "Timed Count", value: "timed_count" },
];

const defaultBlocks: EditableBlock[] = [
  { id: "warmup", name: "Warmup", order: 1, plannedDurationSeconds: 5 * 60, type: "recovery" },
  { id: "starting-benchmark", name: "Starting Benchmark", order: 2, plannedDurationSeconds: 8 * 60, type: "benchmark" },
  { id: "work-block-1", name: "Work Block 1", order: 3, plannedDurationSeconds: 12 * 60, type: "skill" },
  { id: "work-block-2", name: "Work Block 2", order: 4, plannedDurationSeconds: 12 * 60, type: "skill" },
  { id: "work-block-3", name: "Work Block 3", order: 5, plannedDurationSeconds: 12 * 60, type: "skill" },
  { id: "final-benchmark", name: "Final Benchmark", order: 6, plannedDurationSeconds: 8 * 60, type: "benchmark" },
  { id: "report", name: "Report", order: 7, plannedDurationSeconds: 3 * 60, type: "custom" },
];

export default function AxisRoutinePage() {
  const [playerOrGroup, setPlayerOrGroup] = useState("");
  const [focus, setFocus] = useState("");
  const [routineLengthOption, setRoutineLengthOption] = useState<RoutineLengthOption>("60");
  const [customLengthMinutes, setCustomLengthMinutes] = useState(60);
  const [scoringMethod, setScoringMethod] = useState<RoutineScoringMethod | "">("");
  const [benchmarkName, setBenchmarkName] = useState("");
  const [blocks, setBlocks] = useState<EditableBlock[]>(defaultBlocks);
  const [configuredRoutine, setConfiguredRoutine] = useState<RoutineTemplate | null>(null);

  const selectedRoutineMinutes = routineLengthOption === "custom" ? customLengthMinutes : Number(routineLengthOption);
  const selectedRoutineSeconds = Math.max(1, selectedRoutineMinutes) * 60;
  const totalBlockSeconds = useMemo(
    () => blocks.reduce((total, block) => total + Math.max(0, block.plannedDurationSeconds), 0),
    [blocks],
  );
  const totalBlockMinutes = secondsToMinutes(totalBlockSeconds);
  const hasMismatch = totalBlockSeconds !== selectedRoutineSeconds;
  const canBuildRoutine =
    playerOrGroup.trim().length > 0 &&
    focus.trim().length > 0 &&
    scoringMethod !== "" &&
    benchmarkName.trim().length > 0 &&
    blocks.length > 0;

  function updateBlockName(blockId: string, name: string) {
    setBlocks((currentBlocks) => currentBlocks.map((block) => (block.id === blockId ? { ...block, name } : block)));
  }

  function updateBlockMinutes(blockId: string, minutes: number) {
    setBlocks((currentBlocks) =>
      currentBlocks.map((block) =>
        block.id === blockId ? { ...block, plannedDurationSeconds: Math.max(0, minutes) * 60 } : block,
      ),
    );
  }

  function buildRoutine() {
    if (scoringMethod === "" || !canBuildRoutine) return;
    const selectedScoringMethod = scoringMethod;
    const now = new Date().toISOString();
    setConfiguredRoutine({
      benchmarkName: benchmarkName.trim(),
      blockStructure: blocks.map((block) => ({
        name: block.name,
        order: block.order,
        plannedDurationSeconds: block.plannedDurationSeconds,
        type: block.type,
      })),
      constraints: [],
      createdAt: now,
      focus: focus.trim(),
      playerOrGroup: playerOrGroup.trim(),
      routineLengthSeconds: selectedRoutineSeconds,
      schemaVersion: "axis-routine-v0",
      scoringMethod: selectedScoringMethod,
      templateId: `routine-${Date.now()}`,
      updatedAt: now,
    });
  }

  if (configuredRoutine) {
    return (
      <main className="axis-routine">
        <section className="axis-routine__ready" aria-labelledby="axis-routine-ready-title">
          <header className="axis-routine__header">
            <p>Axis Routine</p>
            <h1 id="axis-routine-ready-title">Routine Ready</h1>
            <span>Build the benchmark. Run the reps. Get the report.</span>
          </header>

          <div className="axis-routine__ready-summary">
            <SummaryItem label="Player / Group" value={configuredRoutine.playerOrGroup} />
            <SummaryItem label="Focus" value={configuredRoutine.focus} />
            <SummaryItem label="Routine Length" value={`${secondsToMinutes(configuredRoutine.routineLengthSeconds)} min`} />
            <SummaryItem label="Scoring Method" value={formatScoringMethod(configuredRoutine.scoringMethod)} />
            <SummaryItem label="Benchmark Name" value={configuredRoutine.benchmarkName} />
          </div>

          <section className="axis-routine__blocks" aria-labelledby="axis-routine-ready-blocks">
            <h2 id="axis-routine-ready-blocks">Block List</h2>
            {configuredRoutine.blockStructure.map((block) => (
              <div className="axis-routine__ready-block" key={`${block.order}-${block.name}`}>
                <strong>{block.name}</strong>
                <span>{secondsToMinutes(block.plannedDurationSeconds)} min</span>
              </div>
            ))}
          </section>

          <button className="axis-routine__secondary" type="button" onClick={() => setConfiguredRoutine(null)}>
            Edit Setup
          </button>
        </section>
        <style jsx>{styles}</style>
      </main>
    );
  }

  return (
    <main className="axis-routine">
      <section className="axis-routine__shell" aria-labelledby="axis-routine-title">
        <header className="axis-routine__header">
          <p>Axis Routine</p>
          <h1 id="axis-routine-title">Axis Routine</h1>
          <span>Build the benchmark. Run the reps. Get the report.</span>
        </header>

        <section className="axis-routine__form" aria-label="Routine setup">
          <label>
            <span>Player / Group</span>
            <input
              autoComplete="off"
              onChange={(event) => setPlayerOrGroup(event.target.value)}
              placeholder="Player or group"
              type="text"
              value={playerOrGroup}
            />
          </label>

          <label>
            <span>Focus</span>
            <input
              autoComplete="off"
              onChange={(event) => setFocus(event.target.value)}
              placeholder="What are we improving?"
              type="text"
              value={focus}
            />
          </label>

          <div className="axis-routine__field">
            <span>Routine Length</span>
            <div className="axis-routine__segments" role="radiogroup" aria-label="Routine length">
              {routineLengthOptions.map((option) => (
                <button
                  aria-checked={routineLengthOption === option.value}
                  data-selected={routineLengthOption === option.value}
                  key={option.value}
                  onClick={() => setRoutineLengthOption(option.value)}
                  role="radio"
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {routineLengthOption === "custom" && (
            <label>
              <span>Custom Minutes</span>
              <input
                inputMode="numeric"
                min={1}
                onChange={(event) => setCustomLengthMinutes(Number(event.target.value))}
                type="number"
                value={customLengthMinutes}
              />
            </label>
          )}

          <label>
            <span>Scoring Method</span>
            <select onChange={(event) => setScoringMethod(event.target.value as RoutineScoringMethod | "")} value={scoringMethod}>
              <option value="">Choose method</option>
              {scoringOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Benchmark Name</span>
            <input
              autoComplete="off"
              onChange={(event) => setBenchmarkName(event.target.value)}
              placeholder="Benchmark name"
              type="text"
              value={benchmarkName}
            />
          </label>
        </section>

        <section className="axis-routine__preview" aria-labelledby="axis-routine-plan-preview">
          <div>
            <p id="axis-routine-plan-preview">Routine Plan Preview</p>
            <strong>{totalBlockMinutes} min planned</strong>
          </div>
          <span>{blocks.length} blocks for a {selectedRoutineMinutes} min routine</span>
          {hasMismatch && (
            <em role="status">
              Plan is {totalBlockMinutes} minutes. Selected routine is {selectedRoutineMinutes} minutes.
            </em>
          )}
        </section>

        <section className="axis-routine__blocks" aria-labelledby="axis-routine-blocks-title">
          <div className="axis-routine__section-title">
            <h2 id="axis-routine-blocks-title">Editable Blocks</h2>
            <span>Total: {totalBlockMinutes} min</span>
          </div>
          {blocks.length === 0 ? (
            <p className="axis-routine__empty">Add at least one block before building the routine.</p>
          ) : (
            blocks.map((block) => (
              <div className="axis-routine__block" key={block.id}>
                <label>
                  <span>Block {block.order}</span>
                  <input
                    onChange={(event) => updateBlockName(block.id, event.target.value)}
                    type="text"
                    value={block.name}
                  />
                </label>
                <label>
                  <span>Minutes</span>
                  <input
                    inputMode="numeric"
                    min={0}
                    onChange={(event) => updateBlockMinutes(block.id, Number(event.target.value))}
                    type="number"
                    value={secondsToMinutes(block.plannedDurationSeconds)}
                  />
                </label>
              </div>
            ))
          )}
        </section>

        <button className="axis-routine__primary" disabled={!canBuildRoutine} onClick={buildRoutine} type="button">
          Build Routine
        </button>
        {!canBuildRoutine && (
          <p className="axis-routine__validation">
            Add player/group, focus, scoring method, benchmark name, and at least one block.
          </p>
        )}
      </section>

      <style jsx>{styles}</style>
    </main>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatScoringMethod(scoringMethod: RoutineScoringMethod) {
  return scoringOptions.find((option) => option.value === scoringMethod)?.label ?? scoringMethod;
}

function secondsToMinutes(seconds: number) {
  return Math.round(seconds / 60);
}

const styles = `
  .axis-routine {
    background: #f7f4eb;
    color: #141610;
    min-height: 100dvh;
    overflow-x: hidden;
    padding: 1rem;
  }

  .axis-routine,
  .axis-routine * {
    box-sizing: border-box;
  }

  .axis-routine__shell,
  .axis-routine__ready {
    display: grid;
    gap: 1rem;
    margin: 0 auto;
    max-width: 46rem;
  }

  .axis-routine__header {
    display: grid;
    gap: 0.4rem;
    padding: 1rem 0 0.25rem;
  }

  .axis-routine__header p,
  .axis-routine label span,
  .axis-routine__field > span,
  .axis-routine__preview p,
  .axis-routine__ready-summary span,
  .axis-routine__section-title span {
    color: rgba(20, 22, 16, 0.58);
    font-size: 0.72rem;
    font-weight: 850;
    letter-spacing: 0.08em;
    margin: 0;
    text-transform: uppercase;
  }

  .axis-routine h1,
  .axis-routine h2,
  .axis-routine p {
    margin: 0;
  }

  .axis-routine h1 {
    color: #141610;
    font-size: clamp(2.05rem, 8.8vw, 5rem);
    font-weight: 950;
    letter-spacing: 0;
    line-height: 0.95;
    max-width: 100%;
    overflow-wrap: anywhere;
  }

  .axis-routine h2 {
    font-size: 1rem;
    letter-spacing: 0;
  }

  .axis-routine__header > span,
  .axis-routine__preview > span,
  .axis-routine__empty,
  .axis-routine__validation {
    color: rgba(20, 22, 16, 0.68);
  }

  .axis-routine__form,
  .axis-routine__blocks,
  .axis-routine__preview,
  .axis-routine__ready-summary {
    display: grid;
    gap: 0.75rem;
  }

  .axis-routine label,
  .axis-routine__field {
    display: grid;
    gap: 0.38rem;
  }

  .axis-routine input,
  .axis-routine select {
    background: #fffdf7;
    border: 1px solid rgba(20, 22, 16, 0.16);
    border-radius: 0.5rem;
    color: #141610;
    font: inherit;
    font-size: 1rem;
    line-height: 1.2;
    min-height: 3.25rem;
    padding: 0 0.85rem;
    width: 100%;
  }

  .axis-routine__segments {
    display: grid;
    gap: 0.45rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .axis-routine__segments button,
  .axis-routine__primary {
    border-radius: 0.5rem;
    font: inherit;
    font-weight: 850;
    line-height: 1.1;
    min-height: 3.25rem;
    padding: 0 0.8rem;
  }

  .axis-routine__segments button {
    background: #fffdf7;
    border: 1px solid rgba(20, 22, 16, 0.16);
    color: rgba(20, 22, 16, 0.78);
  }

  .axis-routine__segments button[data-selected="true"] {
    background: #141610;
    color: #f7f4eb;
  }

  .axis-routine__preview,
  .axis-routine__ready-summary {
    background: #fffdf7;
    border: 1px solid rgba(20, 22, 16, 0.12);
    border-radius: 0.5rem;
    padding: 0.85rem;
  }

  .axis-routine__preview div,
  .axis-routine__ready-block {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: space-between;
  }

  .axis-routine__section-title {
    align-items: start;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .axis-routine__preview div {
    align-items: start;
    flex-direction: column;
    gap: 0.25rem;
  }

  .axis-routine__preview strong {
    font-size: 1.35rem;
    overflow-wrap: anywhere;
  }

  .axis-routine__preview em {
    background: #fff0d9;
    border: 1px solid #f1c078;
    border-radius: 0.5rem;
    color: #5d3a00;
    font-style: normal;
    padding: 0.7rem;
  }

  .axis-routine__block {
    background: #fffdf7;
    border: 1px solid rgba(20, 22, 16, 0.12);
    border-radius: 0.5rem;
    display: grid;
    gap: 0.65rem;
    grid-template-columns: 1fr;
    padding: 0.75rem;
  }

  .axis-routine__block label,
  .axis-routine__block input {
    min-width: 0;
  }

  .axis-routine__ready-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .axis-routine__ready-summary div {
    display: grid;
    gap: 0.18rem;
    min-width: 0;
  }

  .axis-routine__ready-summary strong,
  .axis-routine__ready-block strong {
    overflow-wrap: anywhere;
  }

  .axis-routine__ready-block {
    border-bottom: 1px solid rgba(20, 22, 16, 0.1);
    padding: 0.7rem 0;
  }

  .axis-routine__ready-block:last-child {
    border-bottom: 0;
  }

  .axis-routine__primary,
  .axis-routine__secondary {
    background: #141610;
    border: 1px solid #141610;
    border-radius: 0.5rem;
    color: #f7f4eb;
    font: inherit;
    font-weight: 850;
    min-height: 3.25rem;
    width: 100%;
  }

  .axis-routine__secondary {
    background: transparent;
    color: #141610;
  }

  .axis-routine__primary:disabled {
    background: rgba(20, 22, 16, 0.18);
    border-color: rgba(20, 22, 16, 0.08);
    color: rgba(20, 22, 16, 0.48);
  }

  .axis-routine__validation {
    font-size: 0.88rem;
    margin: -0.35rem 0 0;
  }

  @media (min-width: 720px) {
    .axis-routine__form {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .axis-routine__field,
    .axis-routine__form label:last-child {
      grid-column: 1 / -1;
    }

    .axis-routine__segments {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .axis-routine__block {
      grid-template-columns: minmax(0, 1fr) 7.5rem;
    }

    .axis-routine__preview div,
    .axis-routine__section-title {
      align-items: center;
      flex-direction: row;
      gap: 0.75rem;
    }
  }

  @media (max-width: 430px) {
    .axis-routine {
      padding: 0.85rem;
    }

    .axis-routine__ready-summary {
      grid-template-columns: 1fr;
    }
  }
`;
