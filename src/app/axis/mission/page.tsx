"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { axisFetchWithAccessToken, getAxisAccessToken } from "../../../lib/axis-client-auth";
import {
  appendMissionEvent,
  createLocalMissionMemoryAdapter,
  createMissionEvent,
  createMissionAttempt,
  createMissionSession,
  createMoment,
  endMissionSession,
  type MissionAttempt,
  type MissionSession,
  type MissionStatus,
} from "../../../lib/axis-mission-memory";
import { createMissionContextSnapshot } from "../../../lib/axis-context-engine";
import {
  createEmptyCameraFoundationState,
  createReferenceFrame,
  loadCameraFoundationState,
  saveCameraFoundationState,
  type AxisCameraFoundationState,
} from "../../../lib/axis-camera-foundation";

type Mission = {
  constraint: string;
  objective: string;
  progress: number;
  status: MissionStatus;
  target: number;
  timestamp: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal?: boolean }> }) => void) | null;
  start: () => void;
  stop: () => void;
};

const defaultObjective = "50 Weak-Hand Finishes";
const defaultConstraint = "Weak Hand Only";
const defaultTarget = 50;

export default function AxisMissionPage() {
  const missionMemory = useMemo(() => createLocalMissionMemoryAdapter(), []);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldListenRef = useRef(false);
  const [attempts, setAttempts] = useState<MissionAttempt[]>([]);
  const [activeSession, setActiveSession] = useState<MissionSession | null>(null);
  const [cameraFoundation, setCameraFoundation] = useState<AxisCameraFoundationState>(() => createEmptyCameraFoundationState());
  const [heard, setHeard] = useState("");
  const [mission, setMission] = useState<Mission>(() => createMission());
  const [memoryState, setMemoryState] = useState<"LOCAL" | "REMOTE" | "SYNCING">("LOCAL");
  const [voiceState, setVoiceState] = useState<"LISTENING" | "OFF" | "PAUSED" | "UNAVAILABLE">("OFF");

  const recentAttempts = useMemo(
    () => missionMemory.listRecentAttempts(mission.objective, mission.constraint, 5),
    [attempts, mission.constraint, mission.objective, missionMemory],
  );
  const lastAttempt = missionMemory.getLastAttempt(mission.objective, mission.constraint);
  const personalBest = missionMemory.getPersonalBest(mission.objective, mission.constraint);
  const streak = missionMemory.getStreak(mission.objective, mission.constraint);
  const axisPrompt = useMemo(() => createAxisPrompt({ lastAttempt, target: mission.target }), [lastAttempt, mission.target]);
  const recentEvents = activeSession?.events.slice(-5).reverse() ?? [];

  useEffect(() => {
    setAttempts(missionMemory.listAttempts());
    const storedCamera = loadCameraFoundationState();
    setCameraFoundation(storedCamera.powerState === "ON" ? { ...storedCamera, powerState: "OFF" } : storedCamera);
    void loadRemoteMissionMemory();
  }, [missionMemory]);

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      recognitionRef.current?.stop();
      stopCameraStream();
    };
  }, []);

  function beginMission() {
    const session = createMissionSession({
      constraint: defaultConstraint,
      objective: defaultObjective,
      target: defaultTarget,
    });
    const nextMission = {
      ...createMission(),
      progress: session.result,
      status: "ACTIVE" as const,
      timestamp: session.startedAt,
    };
    setActiveSession(session);
    setMission(nextMission);
    missionMemory.saveSession(session);
    void saveRemoteMissionSession(session);
    speak(axisPrompt);
    startListening();
  }

  function resetMission() {
    setHeard("");
    setActiveSession(null);
    setMission(createMission());
    speak("Ready.");
  }

  function pauseMission() {
    shouldListenRef.current = false;
    recognitionRef.current?.stop();
    if (activeSession) {
      const nextSession = appendMissionEvent(
        { ...activeSession, status: "PAUSED" },
        createMissionEvent({ payload: { progress: mission.progress }, type: "MISSION_PAUSED" }),
      );
      setActiveSession(nextSession);
      missionMemory.saveSession(nextSession);
      void saveRemoteMissionSession(nextSession);
    }
    setMission((current) => ({ ...current, status: "PAUSED", timestamp: new Date().toISOString() }));
    setVoiceState("PAUSED");
    speak("Paused.");
  }

  function resumeMission() {
    if (activeSession) {
      const nextSession = appendMissionEvent(
        { ...activeSession, status: "ACTIVE" },
        createMissionEvent({ payload: { progress: mission.progress }, type: "MISSION_RESUMED" }),
      );
      setActiveSession(nextSession);
      missionMemory.saveSession(nextSession);
      void saveRemoteMissionSession(nextSession);
    }
    setMission((current) => ({ ...current, status: "ACTIVE", timestamp: new Date().toISOString() }));
    speak("Resume.");
    startListening();
  }

  function recordSessionResult(result: number, type: "COUNT_RECORDED" | "RESULT_RECORDED" = "RESULT_RECORDED") {
    if (!activeSession || activeSession.status === "ENDED" || activeSession.status === "EVALUATED") {
      speak("Begin first.");
      return;
    }

    const boundedResult = Math.max(0, result);
    const nextSession = appendMissionEvent(
      activeSession,
      createMissionEvent({
        payload: { result: boundedResult },
        type,
      }),
    );
    setActiveSession(nextSession);
    missionMemory.saveSession(nextSession);
    void saveRemoteMissionSession(nextSession);
    setMission({
      ...mission,
      progress: Math.max(0, Math.min(mission.target, boundedResult)),
      status: activeSession.status === "PAUSED" ? "PAUSED" : "ACTIVE",
      timestamp: new Date().toISOString(),
    });
    speak(`${boundedResult}. Logged.`);
  }

  function endSession() {
    if (!activeSession) {
      speak("No active session.");
      return;
    }

    const endedSession = endMissionSession(activeSession);
    const result = endedSession.result;
    const previousBest = missionMemory.getPersonalBest(endedSession.objective, endedSession.constraint);
    const moment = createMoment({
      previousBest,
      result,
      target: endedSession.target,
    });
    const evaluatedSession = appendMissionEvent(
      { ...endedSession, status: "EVALUATED" },
      createMissionEvent({
        payload: { moment, previousBest, result },
        type: "SESSION_EVALUATED",
      }),
    );
    const evaluatedMission: Mission = {
      ...mission,
      progress: Math.max(0, Math.min(mission.target, result)),
      status: "EVALUATED",
      timestamp: evaluatedSession.endedAt ?? new Date().toISOString(),
    };
    const context = createMissionContextSnapshot({
      audioContext: null,
      cameraContext: {
        calibrationState: cameraFoundation.calibrationState,
        referenceFrameId: cameraFoundation.referenceFrame?.id,
        source: cameraFoundation.powerState === "ON" ? "camera" : "none",
        timestamp: cameraFoundation.referenceFrame?.createdAt ?? evaluatedMission.timestamp,
      },
      constraint: evaluatedMission.constraint,
      notes: null,
      objective: evaluatedMission.objective,
      result,
      timestamp: evaluatedMission.timestamp,
    });
    const attempt = createMissionAttempt({
      audioContext: context.audioContext,
      cameraContext: context.cameraContext,
      constraint: evaluatedMission.constraint,
      moment,
      notes: context.notes,
      objective: evaluatedMission.objective,
      result,
      sessionId: evaluatedSession.id,
      target: evaluatedMission.target,
    });

    setActiveSession(evaluatedSession);
    setMission(evaluatedMission);
    missionMemory.saveSession(evaluatedSession);
    void saveRemoteMissionSession(evaluatedSession);
    const nextAttempts = missionMemory.saveAttempt(attempt);
    setAttempts(nextAttempts);
    void saveRemoteMissionAttempt(attempt);
    speak(createEvaluationPrompt({ moment, previousBest, result, target: mission.target }));
  }

  async function loadRemoteMissionMemory() {
    setMemoryState("SYNCING");
    const token = await getAxisAccessToken();
    if (!token) {
      setMemoryState("LOCAL");
      return;
    }

    const response = await axisFetchWithAccessToken(token, "/api/axis/mission-memory");
    const result = (await response.json().catch(() => null)) as { attempts?: MissionAttempt[]; sessions?: MissionSession[]; error?: string } | null;
    if (!response.ok || !Array.isArray(result?.attempts)) {
      console.warn("AXIS_MISSION_MEMORY_REMOTE_LOAD_FAILED", {
        error: result?.error ?? null,
        status: response.status,
      });
      setMemoryState("LOCAL");
      return;
    }

    for (const attempt of [...result.attempts].reverse()) missionMemory.saveAttempt(attempt);
    for (const session of [...(result.sessions ?? [])].reverse()) missionMemory.saveSession(session);
    setAttempts(missionMemory.listAttempts());
    setMemoryState("REMOTE");
  }

  async function saveRemoteMissionAttempt(attempt: MissionAttempt) {
    const token = await getAxisAccessToken();
    if (!token) {
      setMemoryState("LOCAL");
      return;
    }

    const response = await axisFetchWithAccessToken(token, "/api/axis/mission-memory", {
      body: JSON.stringify({ attempt }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const result = (await response.json().catch(() => null)) as { attempts?: MissionAttempt[]; error?: string } | null;
    if (!response.ok || !Array.isArray(result?.attempts)) {
      console.warn("AXIS_MISSION_MEMORY_REMOTE_SAVE_FAILED", {
        error: result?.error ?? null,
        status: response.status,
      });
      setMemoryState("LOCAL");
      return;
    }

    for (const remoteAttempt of [...result.attempts].reverse()) missionMemory.saveAttempt(remoteAttempt);
    setAttempts(missionMemory.listAttempts());
    setMemoryState("REMOTE");
  }

  async function saveRemoteMissionSession(session: MissionSession) {
    const token = await getAxisAccessToken();
    if (!token) {
      setMemoryState("LOCAL");
      return;
    }

    const response = await axisFetchWithAccessToken(token, "/api/axis/mission-memory", {
      body: JSON.stringify({ session }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const result = (await response.json().catch(() => null)) as { sessions?: MissionSession[]; error?: string } | null;
    if (!response.ok || !Array.isArray(result?.sessions)) {
      console.warn("AXIS_MISSION_SESSION_REMOTE_SAVE_FAILED", {
        error: result?.error ?? null,
        status: response.status,
      });
      setMemoryState("LOCAL");
      return;
    }

    for (const remoteSession of [...result.sessions].reverse()) missionMemory.saveSession(remoteSession);
    setMemoryState("REMOTE");
  }

  function handleVoiceCommand(command: string) {
    const normalized = command.toLowerCase().trim();
    setHeard(command);

    const count = normalized.match(/\bcount\s+(\d+)\b/)?.[1];
    if (count) {
      recordSessionResult(Number(count), "COUNT_RECORDED");
      return;
    }

    if (/\bpause\b/.test(normalized)) {
      pauseMission();
      return;
    }

    if (/\bresume\b/.test(normalized)) {
      resumeMission();
      return;
    }

    const number = normalized.match(/\b\d+\b/)?.[0];
    if (number) {
      recordSessionResult(Number(number), "COUNT_RECORDED");
      return;
    }

    if (/\b(done|complete|completed|finished)\b/.test(normalized)) {
      recordSessionResult(mission.target, "RESULT_RECORDED");
      return;
    }

    if (/\b(failed|fail|missed|stop)\b/.test(normalized)) {
      recordSessionResult(mission.progress, "RESULT_RECORDED");
      return;
    }

    if (/\b(end|close|evaluate|checkout|check out)\b/.test(normalized)) {
      endSession();
      return;
    }

    if (/\b(again|reset|restart)\b/.test(normalized)) {
      resetMission();
      return;
    }
  }

  function startListening() {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setVoiceState("UNAVAILABLE");
      return;
    }

    shouldListenRef.current = true;
    const recognition = new Recognition() as SpeechRecognitionLike;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const transcript = result?.[0]?.transcript?.trim();
      if (transcript) handleVoiceCommand(transcript);
    };
    recognition.onerror = (event) => {
      console.warn("AXIS_MISSION_VOICE_ERROR", { error: event.error ?? "unknown" });
    };
    recognition.onend = () => {
      if (!shouldListenRef.current) return;
      window.setTimeout(() => {
        try {
          recognition.start();
          setVoiceState("LISTENING");
        } catch {
          setVoiceState("OFF");
        }
      }, 350);
    };

    recognitionRef.current?.stop();
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setVoiceState("LISTENING");
    } catch {
      setVoiceState("OFF");
    }
  }

  function stopCameraStream() {
    if (cameraStreamRef.current) stopStream(cameraStreamRef.current);
    cameraStreamRef.current = null;
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
  }

  async function turnCameraOn() {
    if (!navigator.mediaDevices?.getUserMedia) {
      const nextState = saveCameraFoundationState({
        ...cameraFoundation,
        powerState: "UNAVAILABLE",
      });
      setCameraFoundation(nextState);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "environment" },
      });
      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) cameraVideoRef.current.srcObject = stream;
      const nextState = saveCameraFoundationState({
        ...cameraFoundation,
        powerState: "ON",
      });
      setCameraFoundation(nextState);
    } catch {
      const nextState = saveCameraFoundationState({
        ...cameraFoundation,
        powerState: "UNAVAILABLE",
      });
      setCameraFoundation(nextState);
    }
  }

  function turnCameraOff() {
    stopCameraStream();
    const nextState = saveCameraFoundationState({
      ...cameraFoundation,
      powerState: "OFF",
    });
    setCameraFoundation(nextState);
  }

  function saveReferenceFrame() {
    const video = cameraVideoRef.current;
    const width = video?.videoWidth ?? 0;
    const height = video?.videoHeight ?? 0;
    if (!video || width <= 0 || height <= 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, width, height);
    const referenceFrame = createReferenceFrame({
      dataUrl: canvas.toDataURL("image/jpeg", 0.7),
      height,
      width,
    });
    const nextState = saveCameraFoundationState({
      ...cameraFoundation,
      calibrationState: "REFERENCE_SAVED",
      referenceFrame,
    });
    setCameraFoundation(nextState);
  }

  return (
    <main className="mission-control">
      <section className="mission-shell" aria-label="Axis Mission Control">
        <header>
          <span>AXIS</span>
          <strong>MISSION CONTROL</strong>
        </header>

        <div className="prompt">
          <span>Axis Prompt</span>
          <p>{axisPrompt}</p>
        </div>

        <div className="mission-grid">
          <div className="mission-block wide">
            <span>Mission</span>
            <strong>{mission.objective}</strong>
          </div>
          <div className="mission-block wide">
            <span>Constraint</span>
            <strong>{mission.constraint}</strong>
          </div>
          <div className="mission-block progress">
            <span>Progress</span>
            <strong>
              {mission.progress} / {mission.target}
            </strong>
          </div>
          <div className="mission-block">
            <span>Status</span>
            <strong>{mission.status}</strong>
          </div>
          <div className="mission-block">
            <span>Personal Best</span>
            <strong>{personalBest || "--"}</strong>
          </div>
          <div className="mission-block">
            <span>Last Attempt</span>
            <strong>{lastAttempt ? lastAttempt.result : "--"}</strong>
          </div>
        </div>

        <div className="mission-actions">
          <button onClick={beginMission} type="button">
            {mission.status === "ACTIVE" ? "LISTENING" : "BEGIN"}
          </button>
          <button className="quiet" onClick={() => recordSessionResult(mission.target, "RESULT_RECORDED")} type="button">
            DONE
          </button>
          <button className="quiet" onClick={() => recordSessionResult(mission.progress, "RESULT_RECORDED")} type="button">
            FAILED
          </button>
          <button className="quiet" onClick={endSession} type="button">
            END SESSION
          </button>
          <button className="quiet" onClick={resetMission} type="button">
            AGAIN
          </button>
          <button className="quiet" onClick={mission.status === "ACTIVE" && voiceState !== "PAUSED" ? pauseMission : resumeMission} type="button">
            {mission.status === "ACTIVE" && voiceState !== "PAUSED" ? "PAUSE" : "RESUME"}
          </button>
        </div>

        <footer>
          <span>Voice {voiceState}</span>
          <span>Streak {streak}</span>
          <span>Events {activeSession?.events.length ?? 0}</span>
          <span>Memory {memoryState}</span>
          <span>{heard ? `Heard: ${heard}` : "Awaiting result"}</span>
        </footer>

        <section className="session-events" aria-label="Session events">
          <span>Session Events</span>
          {recentEvents.length ? (
            <ol>
              {recentEvents.map((event) => (
                <li key={event.id}>
                  <strong>{event.type.replaceAll("_", " ")}</strong>
                  <time>{formatAttemptTime(event.timestamp)}</time>
                </li>
              ))}
            </ol>
          ) : (
            <p>No session events yet.</p>
          )}
        </section>

        <section className="camera-foundation" aria-label="Camera foundation">
          <div>
            <span>Camera</span>
            <strong>{cameraFoundation.powerState}</strong>
          </div>
          <div>
            <span>Calibration</span>
            <strong>{cameraFoundation.calibrationState}</strong>
          </div>
          <video muted playsInline ref={cameraVideoRef} />
          <div className="camera-actions">
            <button className="quiet" onClick={() => void turnCameraOn()} type="button">
              CAMERA ON
            </button>
            <button className="quiet" onClick={turnCameraOff} type="button">
              CAMERA OFF
            </button>
            <button className="quiet" disabled={cameraFoundation.powerState !== "ON"} onClick={saveReferenceFrame} type="button">
              SAVE REFERENCE FRAME
            </button>
          </div>
        </section>

        <section className="recent-attempts" aria-label="Recent attempts">
          <span>Recent Attempts</span>
          {recentAttempts.length ? (
            <ol>
              {recentAttempts.map((attempt) => (
                <li key={attempt.id}>
                  <strong>{attempt.result}</strong>
                  <em>{attempt.moment ?? attempt.status}</em>
                  <time>{formatAttemptTime(attempt.timestamp)}</time>
                </li>
              ))}
            </ol>
          ) : (
            <p>No attempts recorded.</p>
          )}
        </section>
      </section>

      <style jsx>{`
        .mission-control {
          align-items: stretch;
          background:
            linear-gradient(rgba(184, 255, 61, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(184, 255, 61, 0.05) 1px, transparent 1px),
            #030403;
          background-size:
            42px 42px,
            42px 42px,
            auto;
          color: #f4f4ef;
          display: grid;
          min-height: 100dvh;
          padding: 18px;
        }

        .mission-shell {
          border: 1px solid rgba(244, 244, 239, 0.14);
          display: grid;
          gap: 18px;
          grid-template-rows: auto auto 1fr auto auto auto;
          padding: clamp(18px, 4vw, 42px);
        }

        header,
        footer {
          align-items: center;
          display: flex;
          justify-content: space-between;
          text-transform: uppercase;
        }

        header span {
          color: #b8ff3d;
          font-size: 14px;
          font-weight: 900;
        }

        header strong,
        footer span,
        .prompt span,
        .mission-block span {
          color: rgba(244, 244, 239, 0.56);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0;
          text-transform: uppercase;
        }

        .prompt {
          border-bottom: 1px solid rgba(244, 244, 239, 0.12);
          border-top: 1px solid rgba(244, 244, 239, 0.12);
          display: grid;
          gap: 8px;
          padding: 16px 0;
        }

        .prompt p {
          font-size: clamp(22px, 5vw, 46px);
          font-weight: 900;
          line-height: 0.98;
          margin: 0;
          max-width: 980px;
        }

        .mission-grid {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .mission-block {
          align-content: space-between;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(244, 244, 239, 0.12);
          display: grid;
          min-height: 112px;
          padding: 14px;
        }

        .mission-block.wide {
          grid-column: 1 / -1;
        }

        .mission-block strong {
          font-size: clamp(22px, 7vw, 68px);
          font-weight: 950;
          line-height: 0.9;
          text-transform: uppercase;
        }

        .mission-block.progress strong {
          color: #b8ff3d;
        }

        .mission-actions {
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr repeat(5, minmax(72px, 0.24fr));
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
          text-transform: uppercase;
        }

        button.quiet {
          background: rgba(244, 244, 239, 0.09);
          color: #f4f4ef;
        }

        footer {
          gap: 12px;
        }

        footer span:last-child {
          margin-left: auto;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .recent-attempts,
        .session-events {
          border-top: 1px solid rgba(244, 244, 239, 0.12);
          display: grid;
          gap: 10px;
          padding-top: 14px;
        }

        .camera-foundation {
          border-top: 1px solid rgba(244, 244, 239, 0.12);
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          padding-top: 14px;
        }

        .camera-foundation div {
          display: grid;
          gap: 4px;
        }

        .camera-foundation span {
          color: rgba(244, 244, 239, 0.56);
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .camera-foundation strong {
          font-size: 16px;
          text-transform: uppercase;
        }

        .camera-foundation video {
          background: rgba(244, 244, 239, 0.05);
          border: 1px solid rgba(244, 244, 239, 0.1);
          grid-column: 1 / -1;
          max-height: 180px;
          object-fit: contain;
          width: 100%;
        }

        .camera-actions {
          display: grid;
          gap: 10px;
          grid-column: 1 / -1;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .recent-attempts > span,
        .session-events > span {
          color: rgba(244, 244, 239, 0.56);
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .recent-attempts ol,
        .session-events ol {
          display: grid;
          gap: 6px;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .recent-attempts li,
        .session-events li {
          align-items: center;
          border: 1px solid rgba(244, 244, 239, 0.1);
          display: grid;
          gap: 10px;
          grid-template-columns: 64px 1fr auto;
          min-height: 42px;
          padding: 8px 10px;
          text-transform: uppercase;
        }

        .recent-attempts strong {
          color: #b8ff3d;
          font-size: 24px;
          line-height: 1;
        }

        .session-events strong {
          color: #f4f4ef;
          font-size: 12px;
          line-height: 1;
        }

        .recent-attempts em,
        .recent-attempts time,
        .recent-attempts p,
        .session-events time,
        .session-events p {
          color: rgba(244, 244, 239, 0.58);
          font-size: 11px;
          font-style: normal;
          font-weight: 800;
          margin: 0;
        }

        @media (max-width: 720px) {
          .mission-control {
            padding: 0;
          }

          .mission-shell {
            border-left: 0;
            border-right: 0;
            min-height: 100dvh;
          }

          .mission-actions {
            grid-template-columns: 1fr;
          }

          footer {
            align-items: flex-start;
            display: grid;
          }

          footer span:last-child {
            margin-left: 0;
            white-space: normal;
          }
        }
      `}</style>
    </main>
  );
}

function createMission(): Mission {
  return {
    constraint: defaultConstraint,
    objective: defaultObjective,
    progress: 0,
    status: "READY",
    target: defaultTarget,
    timestamp: new Date().toISOString(),
  };
}

function createAxisPrompt({
  lastAttempt,
  target,
}: {
  lastAttempt: MissionAttempt | null;
  target: number;
}) {
  if (lastAttempt) {
    return `Last attempt ${lastAttempt.result}. Target ${target}. Begin.`;
  }
  return "50 weak-hand finishes. Begin.";
}

function createEvaluationPrompt({
  moment,
  result,
  target,
  previousBest,
}: {
  moment: MissionAttempt["moment"];
  previousBest: number;
  result: number;
  target: number;
}) {
  if (result >= target && result > previousBest) return `${result}. Complete. New record.`;
  if (result >= target) return `${result}. Complete.`;
  if (moment === "ALMOST") return "Almost. Again.";
  return `${result}. Need ${Math.max(0, target - result)}. Again.`;
}

function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 0.78;
  window.speechSynthesis.speak(utterance);
}

function stopStream(stream: MediaStream) {
  for (const track of stream.getTracks()) track.stop();
}

function getSpeechRecognitionConstructor() {
  const browserWindow = window as typeof window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null;
}

function formatAttemptTime(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
