"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AxisSuiteShell } from "../AxisSuiteShell";
import { ControlCenter } from "./ControlCenter";
import { PlayerIntelligenceStyles, IconMark } from "./PiKit";
import { SessionWorkflow } from "./SessionWorkflow";
import { SprintBoard } from "./SprintBoard";
import {
  createEmptyStore,
  createPlayerIntelligenceSession,
  getNextFirstTenSessionNumber,
  importPlayerIntelligenceStore,
  loadPlayerIntelligenceStore,
  savePlayerIntelligenceStore,
  type PlayerIntelligenceSession,
  type PlayerIntelligenceStore,
} from "../../../lib/axis/player-intelligence";

type Mode = "control" | "sprint" | "session";

export function PlayerIntelligenceOperatingSystem({ mode }: { mode: Mode }) {
  const [store, setStore] = useState<PlayerIntelligenceStore>(() => createEmptyStore());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const nextStore = loadPlayerIntelligenceStore(window.localStorage);
    const querySessionId = new URLSearchParams(window.location.search).get("session");
    if (querySessionId && nextStore.sessions.some((session) => session.id === querySessionId)) {
      nextStore.activeSessionId = querySessionId;
    }
    setStore(nextStore);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    savePlayerIntelligenceStore(window.localStorage, store);
  }, [loaded, store]);

  const activeSession = useMemo(
    () => store.sessions.find((session) => session.id === store.activeSessionId) ?? store.sessions[0] ?? null,
    [store.activeSessionId, store.sessions],
  );

  return (
    <AxisSuiteShell backHref="/axis" backLabel="Axis" title={pageTitle(mode)}>
      <div className="pi-os">
        <section className="pi-hero">
          <div>
            <p>Trophy Labs operator tool</p>
            <h1>{mode === "control" ? "Player Intelligence v0" : pageTitle(mode)}</h1>
            <span>Proof + Plan + Next Objective</span>
          </div>
          <nav aria-label="Player Intelligence routes">
            <Link className={mode === "control" ? "pi-nav pi-nav--on" : "pi-nav"} href="/axis/control-center">
              <IconMark label="OS" />
              Control
            </Link>
            <Link className={mode === "sprint" ? "pi-nav pi-nav--on" : "pi-nav"} href="/axis/build-sprint-001">
              <IconMark label="001" />
              Sprint
            </Link>
            <Link className={mode === "session" ? "pi-nav pi-nav--on" : "pi-nav"} href="/axis/player-intelligence-session">
              <IconMark label="PI" />
              Session
            </Link>
          </nav>
        </section>

        {mode === "control" ? (
          <ControlCenter store={store} onImport={handleImport} onLessonChange={setLesson} />
        ) : mode === "sprint" ? (
          <SprintBoard sprintDone={store.sprintDone} onToggle={setSprintDone} />
        ) : (
          <SessionWorkflow
            sessions={store.sessions}
            activeSession={activeSession}
            onCreateSession={createSession}
            onSelectSession={(sessionId) => setStore((current) => ({ ...current, activeSessionId: sessionId }))}
            onUpdateSession={updateSession}
          />
        )}
      </div>
      <PlayerIntelligenceStyles />
    </AxisSuiteShell>
  );

  function setSprintDone(task: string, done: boolean) {
    setStore((current) => ({ ...current, sprintDone: { ...current.sprintDone, [task]: done } }));
  }

  function createSession() {
    setStore((current) => {
      const session = createPlayerIntelligenceSession(getNextFirstTenSessionNumber(current.sessions));
      return {
        ...current,
        activeSessionId: session.id,
        sessions: [...current.sessions, session],
      };
    });
  }

  function updateSession(sessionId: string, updater: (session: PlayerIntelligenceSession) => PlayerIntelligenceSession) {
    setStore((current) => ({
      ...current,
      sessions: current.sessions.map((session) => (session.id === sessionId ? updater(session) : session)),
    }));
  }

  function setLesson(sessionId: string, lesson: string) {
    updateSession(sessionId, (session) => ({
      ...session,
      updatedAt: new Date().toISOString(),
      debrief: { ...session.debrief, lesson },
    }));
  }

  function handleImport(raw: string) {
    try {
      setStore(importPlayerIntelligenceStore(raw));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not import Player Intelligence backup.");
    }
  }
}

function pageTitle(mode: Mode) {
  if (mode === "sprint") return "Build Sprint 001";
  if (mode === "session") return "Player Intelligence Session";
  return "Axis Control Center";
}
