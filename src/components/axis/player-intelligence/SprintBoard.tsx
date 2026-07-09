"use client";

import Link from "next/link";
import { sprintTasks } from "./PlayerIntelligenceData";
import { IconMark } from "./PiKit";

export function SprintBoard({
  sprintDone,
  onToggle,
}: {
  sprintDone: Record<string, boolean>;
  onToggle: (task: string, done: boolean) => void;
}) {
  const done = sprintTasks.filter((task) => sprintDone[task]).length;

  return (
    <section className="pi-panel">
      <div className="pi-panel-head">
        <p>Build Sprint 001</p>
        <span>
          {done}/{sprintTasks.length} ready
        </span>
      </div>
      <p className="pi-copy">
        Finish the manual operating product for the first 10 Trophy Labs Player Intelligence Sessions: intake,
        permission, capture checklist, proof clips, Player Intelligence Report, next objective, follow-up offer, and
        debrief.
      </p>
      <div className="pi-checklist pi-checklist--sprint">
        {sprintTasks.map((task) => (
          <label className={sprintDone[task] ? "pi-check pi-check--on" : "pi-check"} key={task}>
            <input checked={Boolean(sprintDone[task])} onChange={(event) => onToggle(task, event.target.checked)} type="checkbox" />
            <IconMark label="OK" />
            <span>{task}</span>
          </label>
        ))}
      </div>
      <div className="pi-row-actions">
        <Link className="pi-button pi-button--primary" href="/axis/player-intelligence-session">
          Open session workflow
        </Link>
        <Link className="pi-button" href="/axis/control-center">
          Review First 10 tracker
        </Link>
      </div>
    </section>
  );
}
