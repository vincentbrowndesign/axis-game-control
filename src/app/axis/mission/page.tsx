"use client";

import { useEffect, useMemo, useState } from "react";
import { axisFetchWithAccessToken, getAxisAccessToken } from "../../../lib/axis-client-auth";
import {
  appendMissionEvent,
  createLocalMissionMemoryAdapter,
  createMissionAttempt,
  createMissionEvent,
  createMissionSession,
  createMoment,
  endMissionSession,
  type MissionAttempt,
  type MissionSession,
} from "../../../lib/axis-mission-memory";
import { createMissionContextSnapshot } from "../../../lib/axis-context-engine";

type ScreenState = "ACTIVE" | "BRIEF" | "DEBRIEF";

const missionTemplate = {
  constraint: "Weak Hand Only",
  objective: "50 Weak-Hand Finishes",
  reason: "Build touch, balance, and finishing confidence under a simple constraint.",
  target: 50,
};

export default function AxisMissionPage() {
  const missionMemory = useMemo(() => createLocalMissionMemoryAdapter(), []);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [note, setNote] = useState("");
  const [progressInput, setProgressInput] = useState("0");
  const [saveState, setSaveState] = useState<"IDLE" | "SAVED" | "SAVING">("IDLE");
  const [screenState, setScreenState] = useState<ScreenState>("BRIEF");
  const [session, setSession] = useState<MissionSession | null>(null);

  const result = session?.result ?? 0;
  const passed = result >= missionTemplate.target;

  useEffect(() => {
    if (!session || screenState !== "ACTIVE") {
      setElapsedSeconds(0);
      return;
    }

    const updateElapsed = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - Date.parse(session.startedAt)) / 1000)));
    };
    updateElapsed();
    const interval = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(interval);
  }, [screenState, session?.id, session?.startedAt]);

  function startSession() {
    const nextSession = createMissionSession(missionTemplate);
    setElapsedSeconds(0);
    setNote("");
    setProgressInput("0");
    setSaveState("IDLE");
    setSession(nextSession);
    setScreenState("ACTIVE");
  }

  function addProgress() {
    if (!session || screenState !== "ACTIVE") return;

    const nextResult = Math.max(0, Number.parseInt(progressInput, 10) || 0);
    const nextSession = appendMissionEvent(
      session,
      createMissionEvent({
        payload: { result: nextResult },
        type: "PROGRESS_UPDATE",
      }),
    );
    setSession(nextSession);
  }

  function pauseSession() {
    if (!session || screenState !== "ACTIVE") return;

    const nextSession = appendMissionEvent(
      { ...session, status: session.status === "PAUSED" ? "ACTIVE" : "PAUSED" },
      createMissionEvent({
        payload: { state: session.status === "PAUSED" ? "resume" : "pause" },
        type: "BREAK",
      }),
    );
    setSession(nextSession);
  }

  function finishSession() {
    if (!session || screenState !== "ACTIVE") return;

    const endedSession = endMissionSession(session);
    setSession(endedSession);
    setScreenState("DEBRIEF");
  }

  async function saveDebrief() {
    if (!session || screenState !== "DEBRIEF" || saveState === "SAVING") return;

    setSaveState("SAVING");
    const baseSession = { ...session, status: "EVALUATED" as const };
    const finalSession = note.trim()
      ? appendMissionEvent(
          baseSession,
          createMissionEvent({
            payload: { note: note.trim(), passed, result: session.result },
            type: "COACH_NOTE",
          }),
        )
      : baseSession;
    const previousBest = missionMemory.getPersonalBest(finalSession.objective, finalSession.constraint);
    const context = createMissionContextSnapshot({
      audioContext: null,
      cameraContext: null,
      constraint: finalSession.constraint,
      notes: note.trim() || null,
      objective: finalSession.objective,
      result: finalSession.result,
      timestamp: finalSession.endedAt ?? new Date().toISOString(),
    });
    const attempt = createMissionAttempt({
      audioContext: context.audioContext,
      cameraContext: context.cameraContext,
      constraint: finalSession.constraint,
      moment: createMoment({ previousBest, result: finalSession.result, target: finalSession.target }),
      notes: context.notes,
      objective: finalSession.objective,
      result: finalSession.result,
      sessionId: finalSession.id,
      target: finalSession.target,
    });

    missionMemory.saveSession(finalSession);
    missionMemory.saveAttempt(attempt);
    setSession(finalSession);
    await saveRemoteMemory({ attempt, session: finalSession });
    setSaveState("SAVED");
  }

  function resetLoop() {
    setElapsedSeconds(0);
    setNote("");
    setProgressInput("0");
    setSaveState("IDLE");
    setScreenState("BRIEF");
    setSession(null);
  }

  return (
    <main className="mission-v0">
      <section className="mission-shell" aria-label="Axis Mission Control">
        <header>
          <span>AXIS</span>
          <strong>THE GUY IN THE CHAIR</strong>
        </header>

        {screenState === "BRIEF" ? (
          <section className="mission-panel" aria-label="Mission brief">
            <span>Mission Brief</span>
            <h1>{missionTemplate.objective}</h1>
            <dl>
              <div>
                <dt>Constraint</dt>
                <dd>{missionTemplate.constraint}</dd>
              </div>
              <div>
                <dt>Reason</dt>
                <dd>{missionTemplate.reason}</dd>
              </div>
            </dl>
            <button onClick={startSession} type="button">
              Start
            </button>
          </section>
        ) : null}

        {screenState === "ACTIVE" ? (
          <section className="mission-panel active" aria-label="Session active">
            <span>Session Active</span>
            <h1>{missionTemplate.objective}</h1>
            <div className="active-grid">
              <div>
                <small>Constraint</small>
                <strong>{missionTemplate.constraint}</strong>
              </div>
              <div>
                <small>Elapsed Time</small>
                <strong>{formatElapsedTime(elapsedSeconds)}</strong>
              </div>
            </div>
            <label>
              Add Progress
              <input
                inputMode="numeric"
                min="0"
                onChange={(event) => setProgressInput(event.target.value)}
                type="number"
                value={progressInput}
              />
            </label>
            <div className="actions">
              <button className="quiet" onClick={addProgress} type="button">
                Add Progress
              </button>
              <button className="quiet" onClick={pauseSession} type="button">
                {session?.status === "PAUSED" ? "Resume" : "Pause"}
              </button>
              <button onClick={finishSession} type="button">
                End
              </button>
            </div>
          </section>
        ) : null}

        {screenState === "DEBRIEF" ? (
          <section className="mission-panel" aria-label="Debrief">
            <span>Debrief</span>
            <h1>{result}</h1>
            <dl>
              <div>
                <dt>Result</dt>
                <dd>
                  {result} / {missionTemplate.target}
                </dd>
              </div>
              <div>
                <dt>Pass / Fail</dt>
                <dd>{passed ? "Pass" : "Fail"}</dd>
              </div>
              <div>
                <dt>Next Recommendation</dt>
                <dd>Placeholder</dd>
              </div>
            </dl>
            <label>
              Note
              <textarea onChange={(event) => setNote(event.target.value)} value={note} />
            </label>
            <div className="actions">
              <button onClick={() => void saveDebrief()} type="button">
                {saveState === "SAVING" ? "Saving" : saveState === "SAVED" ? "Saved" : "Save"}
              </button>
              <button className="quiet" onClick={resetLoop} type="button">
                New Brief
              </button>
            </div>
          </section>
        ) : null}
      </section>

      <style jsx>{`
        .mission-v0 {
          background:
            linear-gradient(rgba(184, 255, 61, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(184, 255, 61, 0.04) 1px, transparent 1px),
            #030403;
          background-size: 44px 44px;
          color: #f4f4ef;
          display: grid;
          min-height: 100dvh;
          padding: 18px;
        }

        .mission-shell {
          border: 1px solid rgba(244, 244, 239, 0.14);
          display: grid;
          gap: 24px;
          grid-template-rows: auto 1fr;
          padding: clamp(18px, 4vw, 42px);
        }

        header {
          align-items: center;
          display: flex;
          justify-content: space-between;
          text-transform: uppercase;
        }

        header span {
          color: #b8ff3d;
          font-size: 14px;
          font-weight: 950;
        }

        header strong,
        .mission-panel > span,
        dt,
        label,
        small {
          color: rgba(244, 244, 239, 0.58);
          font-size: 11px;
          font-weight: 850;
          text-transform: uppercase;
        }

        .mission-panel {
          align-content: center;
          display: grid;
          gap: 18px;
          min-height: 70dvh;
          max-width: 1100px;
        }

        h1 {
          font-size: clamp(48px, 12vw, 138px);
          font-weight: 950;
          line-height: 0.86;
          margin: 0;
          text-transform: uppercase;
        }

        dl {
          display: grid;
          gap: 10px;
          margin: 0;
          max-width: 720px;
        }

        dl div,
        .active-grid div {
          border: 1px solid rgba(244, 244, 239, 0.12);
          display: grid;
          gap: 8px;
          padding: 14px;
        }

        dd {
          font-size: clamp(18px, 3vw, 30px);
          font-weight: 850;
          margin: 0;
          text-transform: uppercase;
        }

        .active-grid {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          max-width: 900px;
        }

        .active-grid strong {
          font-size: clamp(28px, 7vw, 76px);
          font-weight: 950;
          line-height: 0.9;
          text-transform: uppercase;
        }

        label {
          display: grid;
          gap: 8px;
          max-width: 460px;
        }

        input,
        textarea {
          background: rgba(244, 244, 239, 0.08);
          border: 1px solid rgba(244, 244, 239, 0.14);
          color: #f4f4ef;
          font: inherit;
          font-size: 22px;
          font-weight: 850;
          min-height: 54px;
          padding: 10px 12px;
        }

        textarea {
          min-height: 110px;
          resize: vertical;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        button {
          background: #b8ff3d;
          border: 0;
          color: #030403;
          cursor: pointer;
          font: inherit;
          font-size: 13px;
          font-weight: 950;
          min-height: 58px;
          min-width: 160px;
          padding: 0 18px;
          text-transform: uppercase;
        }

        button.quiet {
          background: rgba(244, 244, 239, 0.09);
          color: #f4f4ef;
        }

        @media (max-width: 720px) {
          .mission-v0 {
            padding: 0;
          }

          .mission-shell {
            border-left: 0;
            border-right: 0;
            min-height: 100dvh;
          }

          header {
            align-items: flex-start;
            display: grid;
            gap: 6px;
          }

          .active-grid {
            grid-template-columns: 1fr;
          }

          button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}

async function saveRemoteMemory({
  attempt,
  session,
}: {
  attempt: MissionAttempt;
  session: MissionSession;
}) {
  const token = await getAxisAccessToken();
  if (!token) return;

  await axisFetchWithAccessToken(token, "/api/axis/mission-memory", {
    body: JSON.stringify({ session }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }).catch(() => null);

  await axisFetchWithAccessToken(token, "/api/axis/mission-memory", {
    body: JSON.stringify({ attempt }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }).catch(() => null);
}

function formatElapsedTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}
