"use client";

import Link from "next/link";
import { useRef, type ChangeEvent } from "react";
import type { PlayerIntelligenceStore } from "../../../lib/axis/player-intelligence";
import { serializePlayerIntelligenceStore } from "../../../lib/axis/player-intelligence";
import { currentPriorities, operatingSections } from "./PlayerIntelligenceData";
import { FirstTenTracker } from "./FirstTenTracker";
import { IconMark } from "./PiKit";

export function ControlCenter({
  store,
  onImport,
  onLessonChange,
}: {
  store: PlayerIntelligenceStore;
  onImport: (raw: string) => void;
  onLessonChange: (sessionId: string, lesson: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <section className="pi-grid pi-grid--map" aria-label="Axis operating map">
        {operatingSections.map((section) => (
          <article className="pi-card" key={section.title}>
            <p>{section.title}</p>
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="pi-panel">
        <div className="pi-panel-head">
          <p>Current Priority</p>
          <Link href="/axis/build-sprint-001">Open sprint</Link>
        </div>
        <ol className="pi-priority">
          {currentPriorities.map((priority) => (
            <li key={priority}>{priority}</li>
          ))}
        </ol>
      </section>

      <section className="pi-actions" aria-label="Operator shortcuts">
        <Link href="/axis/player-intelligence-session">
          <IconMark label="Run" />
          Run one session workflow
        </Link>
        <Link href="/axis/build-sprint-001">
          <IconMark label="001" />
          Work Build Sprint 001
        </Link>
        <button className="pi-button" type="button" onClick={exportBackup}>
          <IconMark label="JSON" />
          Export backup
        </button>
        <label className="pi-file-button">
          <IconMark label="In" />
          Import backup
          <input ref={fileRef} type="file" accept="application/json" onChange={importBackup} />
        </label>
      </section>

      <FirstTenTracker sessions={store.sessions} onLessonChange={onLessonChange} />
    </>
  );

  function exportBackup() {
    const blob = new Blob([serializePlayerIntelligenceStore(store)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `axis-player-intelligence-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    onImport(await file.text());
    if (fileRef.current) fileRef.current.value = "";
  }
}
