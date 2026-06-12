"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import VoiceLoop from "../../../components/VoiceLoop";
import { axisFetchWithAccessToken, getAxisAccessToken } from "../../../lib/axis-client-auth";
import { type AxisChallenge } from "../../../lib/axis-challenges";
import { type AxisEvidence, evaluateEvidence } from "../../../lib/axis-evidence";
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

type ComposerMode = "IDLE" | "MENU";

type ThreadMessage = {
  id: string;
  author: "Axis" | "You";
  text: string;
};

const missionTemplate = {
  constraint: "Weak Hand Only",
  objective: "50 Weak-Hand Finishes",
  reason: "Build touch, balance, and finishing confidence under a simple constraint.",
  target: 50,
};

export default function AxisMissionPage() {
  const missionMemory = useMemo(() => createLocalMissionMemoryAdapter(), []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const [composerMode, setComposerMode] = useState<ComposerMode>("IDLE");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [saveState, setSaveState] = useState<"IDLE" | "SAVED" | "SAVING">("IDLE");
  const [voiceLoopActive, setVoiceLoopActive] = useState(false);
  const [session, setSession] = useState<MissionSession | null>(null);
  const [thread, setThread] = useState<ThreadMessage[]>(() => [
    axisMessage("Last attempt was 43."),
    axisMessage("Target is 50."),
    axisMessage("Weak hand only."),
    axisMessage("Let's see it."),
  ]);

  const result = session?.result ?? 0;
  const active = session?.status === "ACTIVE";
  const paused = session?.status === "PAUSED";
  const complete = session?.status === "EVALUATED";

  useEffect(() => {
    if (!session || !active) return;

    const updateElapsed = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - Date.parse(session.startedAt)) / 1000)));
    };
    updateElapsed();
    const interval = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(interval);
  }, [active, session?.id, session?.startedAt]);

  function ensureSession() {
    if (session) return session;

    const nextSession = createMissionSession(missionTemplate);
    setSession(nextSession);
    setElapsedSeconds(0);
    appendAxis("Begin.");
    return nextSession;
  }

  function submitCommand() {
    const command = inputValue.trim();
    if (!command) return;

    setInputValue("");
    appendUser(command);
    handleCommand(command);
  }

  function handleCommand(command: string) {
    const normalized = command.toLowerCase();
    const countMatch = normalized.match(/(?:count\s*)?(\d+)/);

    if (normalized === "again") {
      resetMission();
      appendAxis("Again.");
      return;
    }

    if (normalized === "pause") {
      updateSessionStatus("PAUSED");
      appendAxis("Paused.");
      return;
    }

    if (normalized === "resume") {
      updateSessionStatus("ACTIVE");
      appendAxis("Continue.");
      return;
    }

    if (normalized === "failed") {
      finishSession("FAILED");
      appendAxis("Failed. Save the attempt.");
      return;
    }

    if (normalized === "done") {
      finishSession("COMPLETE");
      appendAxis(result >= missionTemplate.target ? "Complete." : `Need ${missionTemplate.target - result} more.`);
      return;
    }

    if (countMatch) {
      updateProgress(Number.parseInt(countMatch[1], 10));
      return;
    }

    appendAxis("Send a count, done, failed, pause, resume, or again.");
  }

  function updateProgress(nextResult: number) {
    const currentSession = ensureSession();
    const nextSession = appendMissionEvent(
      { ...currentSession, status: currentSession.status === "PAUSED" ? "ACTIVE" : currentSession.status },
      createMissionEvent({
        payload: { result: nextResult },
        type: "PROGRESS_UPDATE",
      }),
    );
    setSession(nextSession);
    appendAxis(nextResult >= missionTemplate.target ? `${nextResult}. Complete.` : `${nextResult}. Need ${missionTemplate.target - nextResult}. Continue.`);
  }

  function updateSessionStatus(status: "ACTIVE" | "PAUSED") {
    const currentSession = ensureSession();
    const nextSession = appendMissionEvent(
      { ...currentSession, status },
      createMissionEvent({
        payload: { state: status === "PAUSED" ? "pause" : "resume" },
        type: "BREAK",
      }),
    );
    setSession(nextSession);
  }

  function finishSession(status: "COMPLETE" | "FAILED") {
    const currentSession = ensureSession();
    const endedSession = {
      ...endMissionSession(currentSession),
      status: "ENDED" as const,
    };
    setSession(endedSession);
    void saveDebrief(endedSession, status);
  }

  async function saveDebrief(finalSessionInput: MissionSession, finalStatus: "COMPLETE" | "FAILED") {
    if (saveState === "SAVING") return;

    setSaveState("SAVING");
    const finalSession = appendMissionEvent(
      { ...finalSessionInput, status: "EVALUATED" as const },
      createMissionEvent({
        payload: { result: finalSessionInput.result, status: finalStatus },
        type: "FINISHED",
      }),
    );
    const previousBest = missionMemory.getPersonalBest(finalSession.objective, finalSession.constraint);
    const context = createMissionContextSnapshot({
      audioContext: null,
      cameraContext: null,
      constraint: finalSession.constraint,
      notes: null,
      objective: finalSession.objective,
      result: finalSession.result,
      timestamp: finalSession.endedAt ?? new Date().toISOString(),
    });
    const attempt = createMissionAttempt({
      audioContext: context.audioContext,
      cameraContext: context.cameraContext,
      constraint: finalSession.constraint,
      moment: createMoment({ previousBest, result: finalSession.result, target: finalSession.target }),
      notes: null,
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
    appendAxis(finalStatus === "COMPLETE" ? "Saved. New session when ready." : "Saved. Again when ready.");
  }

  function resetMission() {
    setElapsedSeconds(0);
    setSaveState("IDLE");
    setSession(null);
  }

  function handleVoiceAttempt(challenge: AxisChallenge, evidence: AxisEvidence) {
    const evaluation = evaluateEvidence(challenge.requiredEvidence, evidence);
    const attempt = createMissionAttempt({
      constraint: challenge.constraint,
      evidence,
      moment: evaluation === "SATISFIED" ? "COMPLETE" : "FAILED",
      objective: challenge.objective,
      result: 1,
      target: 1,
    });
    missionMemory.saveAttempt(attempt);
    void saveRemoteMemory({ attempt });
  }

  function quickCapture() {
    appendUser("Camera");
    appendAxis("Camera context is ready later. Continue the mission.");
  }

  function handleUtility(label: string, inputRef?: React.RefObject<HTMLInputElement | null>) {
    setComposerMode("IDLE");
    appendUser(label);
    if (inputRef?.current) {
      inputRef.current.click();
      return;
    }
    appendAxis("Attached to this session.");
  }

  function appendAxis(text: string) {
    setThread((current) => [...current, axisMessage(text)]);
  }

  function appendUser(text: string) {
    setThread((current) => [...current, { author: "You", id: crypto.randomUUID(), text }]);
  }

  if (voiceLoopActive) {
    return (
      <VoiceLoop
        onAttempt={handleVoiceAttempt}
        onEnd={() => setVoiceLoopActive(false)}
      />
    );
  }

  return (
    <main className="axis-chat">
      <section className="context" aria-label="Current Context">
        <p>CONTROL</p>
        <h1>{missionTemplate.target}</h1>
        <strong>{missionTemplate.constraint}</strong>
        <span>
          {complete
            ? `Saved ${result}`
            : paused
              ? "Paused"
              : active
                ? `${formatElapsedTime(elapsedSeconds)} active`
                : missionTemplate.objective}
        </span>
      </section>

      <section className="thread" aria-label="Axis Conversation">
        {thread.map((message) => (
          <article className={message.author === "Axis" ? "message axis" : "message user"} key={message.id}>
            <span>{message.author}</span>
            <p>{message.text}</p>
          </article>
        ))}
      </section>

      <section className="composer" aria-label="Mission input">
        {composerMode === "MENU" ? (
          <div className="utility-menu">
            <button onClick={() => handleUtility("Upload File", fileInputRef)} type="button">
              Upload File
            </button>
            <button onClick={() => handleUtility("Take Picture", photoInputRef)} type="button">
              Take Picture
            </button>
            <button onClick={() => handleUtility("Choose Photo", photoInputRef)} type="button">
              Choose Photo
            </button>
            <button onClick={() => handleUtility("Import Video", videoInputRef)} type="button">
              Import Video
            </button>
            <button onClick={() => handleUtility("Import Audio")} type="button">
              Import Audio
            </button>
          </div>
        ) : null}

        <div className="bar">
          <button aria-label="Open attachment menu" onClick={() => setComposerMode(composerMode === "MENU" ? "IDLE" : "MENU")} type="button">
            +
          </button>
          <button aria-label="Quick capture" onClick={quickCapture} type="button">
            Camera
          </button>
          <button
            aria-label="Voice loop"
            onClick={() => setVoiceLoopActive(true)}
            type="button"
          >
            Voice
          </button>
          <input
            aria-label="Message Axis"
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitCommand();
            }}
            placeholder="count 43, done, failed, again"
            value={inputValue}
          />
          <button aria-label="Send" className="send" onClick={submitCommand} type="button">
            Send
          </button>
        </div>

        <input hidden ref={fileInputRef} type="file" />
        <input accept="image/*" capture="environment" hidden ref={photoInputRef} type="file" />
        <input accept="video/*" hidden ref={videoInputRef} type="file" />
      </section>

      <style jsx>{`
        .axis-chat {
          background: #f7f7f2;
          color: #12120f;
          display: grid;
          grid-template-rows: auto 1fr auto;
          min-height: 100dvh;
        }

        .context {
          border-bottom: 1px solid rgba(18, 18, 15, 0.1);
          display: grid;
          gap: 2px;
          padding: 28px clamp(18px, 5vw, 64px) 22px;
        }

        .context p,
        .context span,
        .message span {
          color: rgba(18, 18, 15, 0.52);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0;
          margin: 0;
          text-transform: uppercase;
        }

        .context h1 {
          font-size: clamp(70px, 18vw, 180px);
          font-weight: 950;
          line-height: 0.82;
          margin: 0;
        }

        .context strong {
          color: #12120f;
          font-size: clamp(24px, 5vw, 56px);
          font-weight: 900;
          line-height: 0.96;
          text-transform: uppercase;
        }

        .thread {
          align-content: start;
          display: grid;
          gap: 18px;
          margin: 0 auto;
          max-width: 840px;
          overflow-y: auto;
          padding: 34px clamp(18px, 5vw, 64px) 150px;
          width: 100%;
        }

        .message {
          display: grid;
          gap: 6px;
          max-width: 680px;
        }

        .message.user {
          justify-self: end;
          text-align: right;
        }

        .message p {
          background: #ffffff;
          border: 1px solid rgba(18, 18, 15, 0.08);
          border-radius: 18px;
          box-shadow: 0 10px 30px rgba(18, 18, 15, 0.04);
          font-size: clamp(18px, 2.2vw, 24px);
          line-height: 1.25;
          margin: 0;
          padding: 14px 16px;
        }

        .message.axis p {
          background: transparent;
          border-color: transparent;
          box-shadow: none;
          padding-left: 0;
        }

        .message.user p {
          background: #12120f;
          color: #f7f7f2;
        }

        .composer {
          background: linear-gradient(180deg, rgba(247, 247, 242, 0), #f7f7f2 22%);
          bottom: 0;
          left: 0;
          padding: 18px clamp(14px, 4vw, 36px) 22px;
          position: fixed;
          right: 0;
        }

        .bar,
        .utility-menu {
          background: #ffffff;
          border: 1px solid rgba(18, 18, 15, 0.1);
          box-shadow: 0 18px 50px rgba(18, 18, 15, 0.1);
          margin: 0 auto;
          max-width: 900px;
        }

        .bar {
          align-items: center;
          border-radius: 28px;
          display: grid;
          gap: 8px;
          grid-template-columns: auto auto auto 1fr auto;
          min-height: 62px;
          padding: 8px;
        }

        .utility-menu {
          border-radius: 22px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 10px;
          padding: 10px;
        }

        button {
          background: rgba(18, 18, 15, 0.06);
          border: 0;
          border-radius: 999px;
          color: #12120f;
          cursor: pointer;
          font: inherit;
          font-size: 13px;
          font-weight: 850;
          min-height: 44px;
          padding: 0 14px;
        }

        button.listening {
          background: #b8ff3d;
        }

        button.send {
          background: #12120f;
          color: #f7f7f2;
        }

        input {
          background: transparent;
          border: 0;
          color: #12120f;
          font: inherit;
          font-size: 16px;
          min-width: 0;
          outline: none;
          width: 100%;
        }

        @media (max-width: 720px) {
          .context {
            padding-top: 22px;
          }

          .thread {
            padding-bottom: 190px;
          }

          .bar {
            grid-template-columns: auto auto auto;
          }

          .bar input,
          .bar .send {
            grid-column: 1 / -1;
          }

          .bar input {
            min-height: 42px;
            padding: 0 8px;
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
  session?: MissionSession;
}) {
  const token = await getAxisAccessToken();
  if (!token) return;

  if (session) {
    await axisFetchWithAccessToken(token, "/api/axis/mission-memory", {
      body: JSON.stringify({ session }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch(() => null);
  }

  await axisFetchWithAccessToken(token, "/api/axis/mission-memory", {
    body: JSON.stringify({ attempt }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }).catch(() => null);
}

function axisMessage(text: string): ThreadMessage {
  return {
    author: "Axis",
    id: crypto.randomUUID(),
    text,
  };
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
