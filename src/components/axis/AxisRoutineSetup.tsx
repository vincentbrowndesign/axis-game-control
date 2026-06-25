"use client";

import { useEffect, useMemo, useState } from "react";
import { AxisToolbar } from "./AxisToolbar";
import type { RoutineBlockPlan, RoutineScoringMethod, RoutineTemplate } from "../../lib/axis/routine/types";
import type { AxisRoutineToolbarSuggestion } from "../../lib/axis/routine/toolbar-types";

type RoutineLengthOption = "30" | "45" | "60" | "custom";
type RoutinePageState = "builder" | "review" | "running" | "complete";

type EditableBlock = RoutineBlockPlan & {
  id: string;
};

type RunningClock = {
  blockPausedMs: number;
  blockStartedAtMs: number;
  currentBlockIndex: number;
  isPaused: boolean;
  pausedAtMs: number | null;
  runStartedAtMs: number;
  totalPausedMs: number;
};

type CompleteSummary = {
  completedBlocksCount: number;
  totalElapsedSeconds: number;
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

export function AxisRoutineSetup() {
  const [pageState, setPageState] = useState<RoutinePageState>("builder");
  const [instruction, setInstruction] = useState("");
  const [builderStatus, setBuilderStatus] = useState("");
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [playerOrGroup, setPlayerOrGroup] = useState("Player");
  const [focus, setFocus] = useState("General skill work");
  const [routineLengthOption, setRoutineLengthOption] = useState<RoutineLengthOption>("60");
  const [customLengthMinutes, setCustomLengthMinutes] = useState(60);
  const [scoringMethod, setScoringMethod] = useState<RoutineScoringMethod>("make_miss");
  const [benchmarkName, setBenchmarkName] = useState("Training Benchmark");
  const [blocks, setBlocks] = useState<EditableBlock[]>(defaultBlocks);
  const [editingBlockId, setEditingBlockId] = useState(defaultBlocks[0]?.id ?? "");
  const [configuredRoutine, setConfiguredRoutine] = useState<RoutineTemplate | null>(null);
  const [runningClock, setRunningClock] = useState<RunningClock | null>(null);
  const [completeSummary, setCompleteSummary] = useState<CompleteSummary | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const selectedRoutineMinutes = routineLengthOption === "custom" ? customLengthMinutes : Number(routineLengthOption);
  const selectedRoutineSeconds = Math.max(1, selectedRoutineMinutes) * 60;
  const totalBlockSeconds = useMemo(
    () => blocks.reduce((total, block) => total + Math.max(0, block.plannedDurationSeconds), 0),
    [blocks],
  );
  const totalBlockMinutes = secondsToMinutes(totalBlockSeconds);
  const hasMismatch = totalBlockSeconds !== selectedRoutineSeconds;
  const editingBlock = blocks.find((block) => block.id === editingBlockId) ?? blocks[0];
  const canStartRoutine = blocks.length > 0 && selectedRoutineSeconds > 0;

  useEffect(() => {
    if (pageState !== "running" || runningClock?.isPaused) return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, [pageState, runningClock?.isPaused]);

  async function createPlan() {
    const trimmedInstruction = instruction.trim();
    if (!trimmedInstruction || isCreatingPlan) return;

    setIsCreatingPlan(true);
    setBuilderStatus("");

    try {
      const response = await fetch("/api/axis/toolbar", {
        body: JSON.stringify({
          currentBlockPlan: blocks,
          currentSetup: {
            benchmarkName,
            blocks,
            focus,
            playerOrGroup,
            routineLengthMinutes: selectedRoutineMinutes,
            scoringMethod,
          },
          instruction: trimmedInstruction,
          mode: "setup",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string; suggestion?: AxisRoutineToolbarSuggestion };
      if (!response.ok || !payload.suggestion) {
        setBuilderStatus(payload.error ?? "Axis could not create a plan. Try a simpler instruction.");
        return;
      }

      applySuggestionToPlan(payload.suggestion);
      setBuilderStatus("Axis suggested this plan. Edit anything before starting.");
      setPageState("review");
    } catch {
      setBuilderStatus("Axis could not create a plan. Try manual edits after creating a simpler plan.");
    } finally {
      setIsCreatingPlan(false);
    }
  }

  function applySuggestionToPlan(suggestion: AxisRoutineToolbarSuggestion) {
    const nextLength = suggestion.routineLengthMinutes;
    const nextLengthOption: RoutineLengthOption =
      nextLength === 30 || nextLength === 45 || nextLength === 60 ? (String(nextLength) as RoutineLengthOption) : "custom";
    const suggestedBlocks = suggestion.blocks.map((block, index) => ({
      id: block.id ?? createBlockId(block.name, index),
      name: block.name,
      order: block.order,
      plannedDurationSeconds: block.plannedDurationSeconds,
      type: block.type,
    }));

    setPlayerOrGroup(suggestion.playerOrGroup || "Player");
    setFocus(suggestion.focus || "General skill work");
    setRoutineLengthOption(nextLengthOption);
    setCustomLengthMinutes(nextLength);
    setScoringMethod(suggestion.scoringMethod);
    setBenchmarkName(suggestion.benchmarkName || "Training Benchmark");
    setBlocks(suggestedBlocks);
    setEditingBlockId(suggestedBlocks[0]?.id ?? "");
  }

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

  function updateRoutineLength(option: RoutineLengthOption) {
    setRoutineLengthOption(option);
    if (option !== "custom") setCustomLengthMinutes(Number(option));
  }

  function createRoutineTemplate() {
    const now = new Date().toISOString();
    return {
      benchmarkName: benchmarkName.trim() || "Training Benchmark",
      blockStructure: blocks.map((block) => ({
        name: block.name,
        order: block.order,
        plannedDurationSeconds: block.plannedDurationSeconds,
        type: block.type,
      })),
      constraints: [],
      createdAt: now,
      focus: focus.trim() || "General skill work",
      playerOrGroup: playerOrGroup.trim() || "Player",
      routineLengthSeconds: selectedRoutineSeconds,
      schemaVersion: "axis-routine-v0" as const,
      scoringMethod,
      templateId: `routine-${Date.now()}`,
      updatedAt: now,
    };
  }

  function startRoutine() {
    if (!canStartRoutine) return;
    const routine = createRoutineTemplate();
    const startedAtMs = Date.now();
    setConfiguredRoutine(routine);
    setNowMs(startedAtMs);
    setRunningClock({
      blockPausedMs: 0,
      blockStartedAtMs: startedAtMs,
      currentBlockIndex: 0,
      isPaused: false,
      pausedAtMs: null,
      runStartedAtMs: startedAtMs,
      totalPausedMs: 0,
    });
    setCompleteSummary(null);
    setPageState("running");
  }

  function pauseRoutine() {
    setRunningClock((clock) => (clock && !clock.isPaused ? { ...clock, isPaused: true, pausedAtMs: Date.now() } : clock));
  }

  function resumeRoutine() {
    setRunningClock((clock) => {
      if (!clock?.isPaused || clock.pausedAtMs === null) return clock;
      const resumedAtMs = Date.now();
      const pausedMs = resumedAtMs - clock.pausedAtMs;
      setNowMs(resumedAtMs);
      return {
        ...clock,
        blockPausedMs: clock.blockPausedMs + pausedMs,
        isPaused: false,
        pausedAtMs: null,
        totalPausedMs: clock.totalPausedMs + pausedMs,
      };
    });
  }

  function goToBlock(direction: -1 | 1) {
    if (!configuredRoutine) return;
    setRunningClock((clock) => {
      if (!clock) return clock;
      const nextIndex = clock.currentBlockIndex + direction;
      if (nextIndex < 0 || nextIndex >= configuredRoutine.blockStructure.length) return clock;
      const startedAtMs = Date.now();
      setNowMs(startedAtMs);
      return {
        ...clock,
        blockPausedMs: 0,
        blockStartedAtMs: startedAtMs,
        currentBlockIndex: nextIndex,
        isPaused: false,
        pausedAtMs: null,
      };
    });
  }

  function finishRoutine() {
    if (!configuredRoutine || !runningClock) return;
    const endedAtMs = runningClock.isPaused && runningClock.pausedAtMs !== null ? runningClock.pausedAtMs : Date.now();
    setCompleteSummary({
      completedBlocksCount: Math.min(runningClock.currentBlockIndex + 1, configuredRoutine.blockStructure.length),
      totalElapsedSeconds: getElapsedSeconds(endedAtMs, runningClock.runStartedAtMs, runningClock.totalPausedMs),
    });
    setRunningClock(null);
    setPageState("complete");
  }

  function resetRoutine() {
    setPageState("builder");
    setInstruction("");
    setBuilderStatus("");
    setPlayerOrGroup("Player");
    setFocus("General skill work");
    setRoutineLengthOption("60");
    setCustomLengthMinutes(60);
    setScoringMethod("make_miss");
    setBenchmarkName("Training Benchmark");
    setBlocks(defaultBlocks);
    setEditingBlockId(defaultBlocks[0]?.id ?? "");
    setConfiguredRoutine(null);
    setRunningClock(null);
    setCompleteSummary(null);
  }

  if (pageState === "running" && configuredRoutine && runningClock) {
    const displayNowMs = runningClock.isPaused && runningClock.pausedAtMs !== null ? runningClock.pausedAtMs : nowMs;
    const currentBlock = configuredRoutine.blockStructure[runningClock.currentBlockIndex];
    const totalElapsedSeconds = getElapsedSeconds(displayNowMs, runningClock.runStartedAtMs, runningClock.totalPausedMs);
    const blockElapsedSeconds = getElapsedSeconds(displayNowMs, runningClock.blockStartedAtMs, runningClock.blockPausedMs);
    const isOverPlanned = blockElapsedSeconds > currentBlock.plannedDurationSeconds;

    return (
      <main className="axis-routine">
        <section className="axis-routine__shell" aria-labelledby="axis-routine-running-title">
          <Header title="Running" subtitle={`${configuredRoutine.playerOrGroup} / ${configuredRoutine.focus}`} />

          <section className="axis-routine__current" aria-label="Current routine block">
            <span>Block {runningClock.currentBlockIndex + 1} of {configuredRoutine.blockStructure.length}</span>
            <h2 id="axis-routine-running-title">{currentBlock.name}</h2>
            <p>{getBlockInstruction(currentBlock)}</p>
            <strong>Planned: {formatDuration(currentBlock.plannedDurationSeconds)}</strong>
            {isOverPlanned && <em role="status">Over planned time</em>}
          </section>

          <section className="axis-routine__timers" aria-label="Routine timers">
            <div>
              <span>Total</span>
              <strong>{formatDuration(totalElapsedSeconds)}</strong>
            </div>
            <div>
              <span>Block</span>
              <strong>{formatDuration(blockElapsedSeconds)}</strong>
            </div>
          </section>

          <ProgressList blocks={configuredRoutine.blockStructure} currentBlockIndex={runningClock.currentBlockIndex} />

          <div className="axis-routine__actions">
            {runningClock.isPaused ? (
              <button className="axis-routine__primary" onClick={resumeRoutine} type="button">Resume</button>
            ) : (
              <button className="axis-routine__secondary" onClick={pauseRoutine} type="button">Pause</button>
            )}
            <button className="axis-routine__secondary" disabled={runningClock.currentBlockIndex === 0} onClick={() => goToBlock(-1)} type="button">
              Previous Block
            </button>
            <button
              className="axis-routine__primary"
              disabled={runningClock.currentBlockIndex >= configuredRoutine.blockStructure.length - 1}
              onClick={() => goToBlock(1)}
              type="button"
            >
              Next Block
            </button>
            <button className="axis-routine__finish" onClick={finishRoutine} type="button">Finish Routine</button>
          </div>
        </section>
        <style jsx>{styles}</style>
      </main>
    );
  }

  if (pageState === "complete" && configuredRoutine && completeSummary) {
    return (
      <main className="axis-routine">
        <section className="axis-routine__shell" aria-labelledby="axis-routine-complete-title">
          <Header id="axis-routine-complete-title" title="Routine Complete" subtitle="Session is finished." />

          <section className="axis-routine__summary-card" aria-labelledby="axis-routine-complete-title">
            <SummaryItem label="Player / Group" value={configuredRoutine.playerOrGroup} />
            <SummaryItem label="Focus" value={configuredRoutine.focus} />
            <SummaryItem label="Total Elapsed Time" value={formatDuration(completeSummary.totalElapsedSeconds)} />
            <SummaryItem label="Completed Blocks" value={`${completeSummary.completedBlocksCount} of ${configuredRoutine.blockStructure.length}`} />
          </section>

          <div className="axis-routine__actions">
            <button className="axis-routine__primary" onClick={resetRoutine} type="button">New Routine</button>
            <button className="axis-routine__secondary" onClick={() => setPageState("review")} type="button">Back to Plan</button>
          </div>
        </section>
        <style jsx>{styles}</style>
      </main>
    );
  }

  return (
    <main className="axis-routine">
      <section className="axis-routine__shell" aria-labelledby="axis-routine-title">
        <Header id="axis-routine-title" title="Axis Routine" subtitle="Build the benchmark. Run the reps. Get the report." />

        {pageState === "builder" ? (
          <>
            <AxisToolbar
              instruction={instruction}
              isLoading={isCreatingPlan}
              onCreatePlan={createPlan}
              onInstructionChange={setInstruction}
            />
            {builderStatus && <p className="axis-routine__validation">{builderStatus}</p>}
          </>
        ) : (
          <ReviewPlan
            benchmarkName={benchmarkName}
            blocks={blocks}
            builderStatus={builderStatus}
            canStartRoutine={canStartRoutine}
            customLengthMinutes={customLengthMinutes}
            editingBlock={editingBlock}
            focus={focus}
            hasMismatch={hasMismatch}
            onBenchmarkNameChange={setBenchmarkName}
            onBlockMinutesChange={updateBlockMinutes}
            onBlockNameChange={updateBlockName}
            onCustomLengthChange={setCustomLengthMinutes}
            onEditInstruction={() => setPageState("builder")}
            onFocusChange={setFocus}
            onPlayerOrGroupChange={setPlayerOrGroup}
            onReset={resetRoutine}
            onRoutineLengthChange={updateRoutineLength}
            onScoringMethodChange={setScoringMethod}
            onSelectBlock={setEditingBlockId}
            onStartRoutine={startRoutine}
            playerOrGroup={playerOrGroup}
            routineLengthOption={routineLengthOption}
            scoringMethod={scoringMethod}
            selectedRoutineMinutes={selectedRoutineMinutes}
            totalBlockMinutes={totalBlockMinutes}
          />
        )}
      </section>

      <style jsx>{styles}</style>
    </main>
  );
}

function Header({ id, subtitle, title }: { id?: string; subtitle: string; title: string }) {
  return (
    <header className="axis-routine__header">
      <p>Axis Routine</p>
      <h1 id={id}>{title}</h1>
      <span>{subtitle}</span>
    </header>
  );
}

function ReviewPlan(props: {
  benchmarkName: string;
  blocks: EditableBlock[];
  builderStatus: string;
  canStartRoutine: boolean;
  customLengthMinutes: number;
  editingBlock?: EditableBlock;
  focus: string;
  hasMismatch: boolean;
  onBenchmarkNameChange: (value: string) => void;
  onBlockMinutesChange: (blockId: string, minutes: number) => void;
  onBlockNameChange: (blockId: string, name: string) => void;
  onCustomLengthChange: (value: number) => void;
  onEditInstruction: () => void;
  onFocusChange: (value: string) => void;
  onPlayerOrGroupChange: (value: string) => void;
  onReset: () => void;
  onRoutineLengthChange: (value: RoutineLengthOption) => void;
  onScoringMethodChange: (value: RoutineScoringMethod) => void;
  onSelectBlock: (blockId: string) => void;
  onStartRoutine: () => void;
  playerOrGroup: string;
  routineLengthOption: RoutineLengthOption;
  scoringMethod: RoutineScoringMethod;
  selectedRoutineMinutes: number;
  totalBlockMinutes: number;
}) {
  return (
    <>
      <section className="axis-routine__review" aria-labelledby="axis-routine-review-title">
        <div className="axis-routine__section-title">
          <h2 id="axis-routine-review-title">Review Plan</h2>
          <span>{props.builderStatus || "Axis suggested this plan. Edit anything before starting."}</span>
        </div>

        <div className="axis-routine__edit-grid">
          <label>
            <span>Player / Group</span>
            <input onChange={(event) => props.onPlayerOrGroupChange(event.target.value)} type="text" value={props.playerOrGroup} />
          </label>
          <label>
            <span>Focus</span>
            <input onChange={(event) => props.onFocusChange(event.target.value)} type="text" value={props.focus} />
          </label>
          <div className="axis-routine__field">
            <span>Routine Length</span>
            <div className="axis-routine__segments" role="radiogroup" aria-label="Routine length">
              {routineLengthOptions.map((option) => (
                <button
                  aria-checked={props.routineLengthOption === option.value}
                  data-selected={props.routineLengthOption === option.value}
                  key={option.value}
                  onClick={() => props.onRoutineLengthChange(option.value)}
                  role="radio"
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {props.routineLengthOption === "custom" && (
            <label>
              <span>Custom Minutes</span>
              <input
                inputMode="numeric"
                min={1}
                onChange={(event) => props.onCustomLengthChange(Number(event.target.value))}
                type="number"
                value={props.customLengthMinutes}
              />
            </label>
          )}
          <label>
            <span>Scoring Method</span>
            <select onChange={(event) => props.onScoringMethodChange(event.target.value as RoutineScoringMethod)} value={props.scoringMethod}>
              {scoringOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Benchmark Name</span>
            <input onChange={(event) => props.onBenchmarkNameChange(event.target.value)} type="text" value={props.benchmarkName} />
          </label>
        </div>
      </section>

      <section className="axis-routine__preview" aria-labelledby="axis-routine-plan-preview">
        <div>
          <p id="axis-routine-plan-preview">Routine Plan</p>
          <strong>{props.totalBlockMinutes} min planned</strong>
        </div>
        <span>{props.blocks.length} blocks for a {props.selectedRoutineMinutes} min routine</span>
        {props.hasMismatch && (
          <em role="status">
            Plan is {props.totalBlockMinutes} minutes. Selected routine is {props.selectedRoutineMinutes} minutes.
          </em>
        )}
      </section>

      <section className="axis-routine__blocks" aria-labelledby="axis-routine-blocks-title">
        <div className="axis-routine__section-title">
          <h2 id="axis-routine-blocks-title">Block Plan</h2>
          <span>Tap a block to edit it.</span>
        </div>

        <PlanList blocks={props.blocks} editingBlockId={props.editingBlock?.id} onSelectBlock={props.onSelectBlock} />

        {props.editingBlock && (
          <div className="axis-routine__block-editor">
            <label>
              <span>Block {props.editingBlock.order} Name</span>
              <input
                onChange={(event) => props.onBlockNameChange(props.editingBlock!.id, event.target.value)}
                type="text"
                value={props.editingBlock.name}
              />
            </label>
            <label>
              <span>Minutes</span>
              <input
                inputMode="numeric"
                min={0}
                onChange={(event) => props.onBlockMinutesChange(props.editingBlock!.id, Number(event.target.value))}
                type="number"
                value={secondsToMinutes(props.editingBlock.plannedDurationSeconds)}
              />
            </label>
          </div>
        )}
      </section>

      <div className="axis-routine__actions">
        <button className="axis-routine__primary" disabled={!props.canStartRoutine} onClick={props.onStartRoutine} type="button">Start Routine</button>
        <button className="axis-routine__secondary" onClick={props.onEditInstruction} type="button">Edit Instruction</button>
        <button className="axis-routine__secondary" onClick={props.onReset} type="button">Reset</button>
      </div>
    </>
  );
}

function PlanList({
  blocks,
  editingBlockId,
  onSelectBlock,
}: {
  blocks: Array<Pick<EditableBlock, "id" | "name" | "order" | "plannedDurationSeconds">>;
  editingBlockId?: string;
  onSelectBlock: (blockId: string) => void;
}) {
  return (
    <div className="axis-routine__plan-list" aria-label="Routine blocks">
      {blocks.map((block) => (
        <button
          data-active={block.id === editingBlockId}
          key={block.id}
          onClick={() => onSelectBlock(block.id)}
          type="button"
        >
          <span>{block.order}</span>
          <strong>{block.name || `Block ${block.order}`}</strong>
          <em>{secondsToMinutes(block.plannedDurationSeconds)} min</em>
        </button>
      ))}
    </div>
  );
}

function ProgressList({ blocks, currentBlockIndex }: { blocks: RoutineBlockPlan[]; currentBlockIndex: number }) {
  return (
    <section className="axis-routine__blocks" aria-label="Block progress">
      <PlanList
        blocks={blocks.map((block) => ({
          id: `${block.order}-${block.name}`,
          name: block.name,
          order: block.order,
          plannedDurationSeconds: block.plannedDurationSeconds,
        }))}
        editingBlockId={`${blocks[currentBlockIndex]?.order}-${blocks[currentBlockIndex]?.name}`}
        onSelectBlock={() => undefined}
      />
    </section>
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

function secondsToMinutes(seconds: number) {
  return Math.round(seconds / 60);
}

function getElapsedSeconds(nowMs: number, startedAtMs: number, pausedMs: number) {
  return Math.max(0, Math.floor((nowMs - startedAtMs - pausedMs) / 1000));
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function createBlockId(name: string, index: number) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "block"}-${index + 1}`;
}

function getBlockInstruction(block: RoutineBlockPlan) {
  if (block.name.toLowerCase().includes("warmup")) return "Get loose and prepare for the benchmark.";
  if (block.name.toLowerCase().includes("starting benchmark")) return "Set the baseline. Do not chase perfection.";
  if (block.name.toLowerCase().includes("final benchmark")) return "Retest the same skill and beat the baseline.";
  if (block.name.toLowerCase().includes("report")) return "Wrap the session and prepare the report.";
  return "Train the focus. Keep the pace honest.";
}

const styles = `
  .axis-routine {
    background: #f7f4eb;
    color: #141610;
    min-height: 100dvh;
    overflow-x: hidden;
    padding: max(0.85rem, env(safe-area-inset-top)) 0.85rem max(6rem, env(safe-area-inset-bottom));
  }

  .axis-routine,
  .axis-routine * {
    box-sizing: border-box;
  }

  .axis-routine__shell {
    display: grid;
    gap: 0.85rem;
    margin: 0 auto;
    max-width: 46rem;
  }

  .axis-routine__header {
    display: grid;
    gap: 0.35rem;
    padding: 0.4rem 0 0.15rem;
  }

  .axis-routine__header p,
  .axis-routine label span,
  .axis-routine__field > span,
  .axis-routine__preview p,
  .axis-routine__summary-card span,
  .axis-routine__section-title span,
  .axis-routine__current > span,
  .axis-routine__timers span {
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
    font-size: clamp(2rem, 8.5vw, 4.8rem);
    font-weight: 950;
    letter-spacing: 0;
    line-height: 0.95;
    max-width: 100%;
    overflow-wrap: anywhere;
  }

  .axis-routine h2 {
    font-size: clamp(1.45rem, 6vw, 2.4rem);
    letter-spacing: 0;
    line-height: 1;
  }

  .axis-routine__header > span,
  .axis-routine__preview > span,
  .axis-routine__validation,
  .axis-routine__current p {
    color: rgba(20, 22, 16, 0.68);
  }

  .axis-routine__review,
  .axis-routine__blocks,
  .axis-routine__preview,
  .axis-routine__summary-card,
  .axis-routine__current,
  .axis-routine__timers > div {
    background: #fffdf7;
    border: 1px solid rgba(20, 22, 16, 0.12);
    border-radius: 0.5rem;
    padding: 0.8rem;
  }

  .axis-routine__review,
  .axis-routine__blocks,
  .axis-routine__summary-card,
  .axis-routine__current {
    display: grid;
    gap: 0.65rem;
  }

  .axis-routine__edit-grid,
  .axis-routine__timers,
  .axis-routine__actions {
    display: grid;
    gap: 0.65rem;
  }

  .axis-routine label,
  .axis-routine__field {
    display: grid;
    gap: 0.35rem;
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
    min-height: 3.1rem;
    padding: 0 0.85rem;
    width: 100%;
  }

  .axis-routine__segments {
    display: grid;
    gap: 0.45rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .axis-routine button,
  .axis-routine__primary,
  .axis-routine__secondary,
  .axis-routine__finish {
    border-radius: 0.5rem;
    font: inherit;
    font-weight: 850;
    line-height: 1.1;
    min-height: 3rem;
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

  .axis-routine__preview {
    display: grid;
    gap: 0.65rem;
  }

  .axis-routine__preview div,
  .axis-routine__section-title {
    align-items: start;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .axis-routine__preview strong {
    font-size: 1.3rem;
    overflow-wrap: anywhere;
  }

  .axis-routine__preview em,
  .axis-routine__current em {
    background: #fff0d9;
    border: 1px solid #f1c078;
    border-radius: 0.5rem;
    color: #5d3a00;
    font-style: normal;
    padding: 0.7rem;
  }

  .axis-routine__plan-list {
    display: grid;
    gap: 0.4rem;
  }

  .axis-routine__plan-list button {
    align-items: center;
    background: rgba(247, 244, 235, 0.8);
    border: 1px solid rgba(20, 22, 16, 0.1);
    border-radius: 0.45rem;
    color: #141610;
    display: grid;
    gap: 0.55rem;
    grid-template-columns: 1.8rem minmax(0, 1fr) auto;
    padding: 0.55rem 0.65rem;
    text-align: left;
    width: 100%;
  }

  .axis-routine__plan-list button[data-active="true"] {
    background: #141610;
    color: #f7f4eb;
  }

  .axis-routine__plan-list span {
    color: rgba(20, 22, 16, 0.58);
    font-size: 0.75rem;
    font-weight: 900;
  }

  .axis-routine__plan-list button[data-active="true"] span {
    color: rgba(247, 244, 235, 0.7);
  }

  .axis-routine__plan-list strong {
    font-size: 0.95rem;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .axis-routine__plan-list em {
    font-size: 0.82rem;
    font-style: normal;
    font-weight: 850;
    white-space: nowrap;
  }

  .axis-routine__block-editor {
    background: #f7f4eb;
    border: 1px solid rgba(20, 22, 16, 0.12);
    border-radius: 0.5rem;
    display: grid;
    gap: 0.65rem;
    grid-template-columns: minmax(0, 1fr);
    padding: 0.65rem;
  }

  .axis-routine__summary-card {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .axis-routine__summary-card div {
    display: grid;
    gap: 0.18rem;
    min-width: 0;
  }

  .axis-routine__summary-card strong {
    overflow-wrap: anywhere;
  }

  .axis-routine__current strong {
    color: rgba(20, 22, 16, 0.72);
  }

  .axis-routine__timers {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .axis-routine__timers > div {
    display: grid;
    gap: 0.2rem;
  }

  .axis-routine__timers strong {
    font-size: clamp(2rem, 12vw, 4rem);
    letter-spacing: 0;
    line-height: 1;
  }

  .axis-routine__primary,
  .axis-routine__secondary,
  .axis-routine__finish {
    background: #141610;
    border: 1px solid #141610;
    color: #f7f4eb;
    width: 100%;
  }

  .axis-routine__secondary {
    background: transparent;
    color: #141610;
  }

  .axis-routine__finish {
    background: #fffdf7;
    border-color: #8f2f24;
    color: #8f2f24;
  }

  .axis-routine button:disabled {
    opacity: 0.45;
  }

  .axis-routine__validation {
    font-size: 0.88rem;
    margin: -0.25rem 0 0;
  }

  @media (min-width: 720px) {
    .axis-routine {
      padding: 1.5rem 1.5rem max(6rem, env(safe-area-inset-bottom));
    }

    .axis-routine__edit-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .axis-routine__field {
      grid-column: 1 / -1;
    }

    .axis-routine__segments {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .axis-routine__preview div,
    .axis-routine__section-title {
      align-items: center;
      flex-direction: row;
      justify-content: space-between;
    }

    .axis-routine__block-editor {
      grid-template-columns: minmax(0, 1fr) 7.5rem;
    }

    .axis-routine__actions {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .axis-routine__actions .axis-routine__finish {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 430px) {
    .axis-routine__summary-card {
      grid-template-columns: 1fr;
    }
  }
`;
