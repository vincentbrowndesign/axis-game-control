"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { axisFetchWithAccessToken, getAxisAccessToken } from "../../../lib/axis-client-auth";
import { type AxisChallenge, type AxisContext, VISION_CHALLENGES } from "../../../lib/axis-challenges";
import { type AxisEvidence, evaluateEvidence } from "../../../lib/axis-evidence";
import {
  createLocalMissionMemoryAdapter,
  createMissionAttempt,
  type MissionAttempt,
} from "../../../lib/axis-mission-memory";

type ShellPhase = "READY" | "CONTEXT" | "LOOP" | "DONE";
type LoopSubPhase = "SPEAKING" | "LISTENING";

const OBSERVATION_QUESTION = "What did you notice?";

const CONTEXT_LABELS: Record<AxisContext, string> = {
  GAME: "Game",
  PARTNER: "Partner",
  SOLO: "Alone",
  TEAM: "Practice",
};

export default function AxisShell() {
  const missionMemory = useMemo(() => createLocalMissionMemoryAdapter(), []);

  const [phase, setPhase] = useState<ShellPhase>("READY");
  const [activeContext, setActiveContext] = useState<AxisContext | null>(null);
  const [loopSubPhase, setLoopSubPhase] = useState<LoopSubPhase>("SPEAKING");
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [waitingForTap, setWaitingForTap] = useState(false);

  const videoBgRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(false);
  const pendingObservationRef = useRef<(() => void) | null>(null);
  const challengesRef = useRef<AxisChallenge[]>([]);
  const presentChallengeRef = useRef<(index: number) => void>(() => null);

  const isVoiceSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function startCamera() {
    console.log("[AXIS] START_CAMERA");
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" } })
      .then((stream) => {
        console.log("[AXIS] CAMERA_READY");
        streamRef.current = stream;
        const v = videoBgRef.current;
        if (v) {
          v.srcObject = stream;
          v.play().catch(() => null);
        }
      })
      .catch((err) => console.log("[AXIS] CAMERA_ERROR", err));
  }

  const speak = useCallback((text: string, onDone?: () => void) => {
    console.log("[AXIS] SPEAK_START", text);
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.88;
    u.pitch = 1.0;
    u.onend = () => { console.log("[AXIS] SPEAK_END", text); onDone?.(); };
    u.onerror = (e) => { console.log("[AXIS] SPEAK_ERROR", e); onDone?.(); };
    window.speechSynthesis.speak(u);
  }, []);

  const startListening = useCallback(
    (challenge: AxisChallenge, onComplete: (evidence: AxisEvidence) => void) => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechAPI) return;

      const rec: SpeechRecognition = new SpeechAPI();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      let latest = "";
      isListeningRef.current = true;

      rec.onresult = (e: SpeechRecognitionEvent) => {
        let acc = "";
        for (let i = 0; i < e.results.length; i++) {
          if (i > 0) acc += " ";
          acc += e.results[i][0].transcript;
        }
        latest = acc.trim();
      };

      const finish = () => {
        if (!isListeningRef.current) return;
        isListeningRef.current = false;
        onComplete({ kind: challenge.requiredEvidence, source: "VOICE", value: latest || null });
      };

      rec.onend = finish;
      rec.onerror = finish;

      recognitionRef.current = rec;
      rec.start();
      setLoopSubPhase("LISTENING");
    },
    [],
  );

  function handleAttempt(challenge: AxisChallenge, evidence: AxisEvidence) {
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

  function presentChallenge(index: number) {
    const challenges = challengesRef.current;
    const c = challenges[index];
    if (!c) return;

    recognitionRef.current?.abort();
    recognitionRef.current = null;
    isListeningRef.current = false;
    window.speechSynthesis.cancel();

    setChallengeIndex(index);
    setLoopSubPhase("SPEAKING");
    setWaitingForTap(false);
    pendingObservationRef.current = null;

    const isLast = index === challenges.length - 1;

    function complete(evidence: AxisEvidence) {
      handleAttempt(c, evidence);
      if (isLast) {
        setPhase("DONE");
        speak("Done.");
      } else {
        presentChallengeRef.current(index + 1);
      }
    }

    const qIdx = c.text.indexOf(OBSERVATION_QUESTION);
    if (c.requiredEvidence === "OBSERVATION" && qIdx > -1) {
      const task = c.text.slice(0, qIdx).trim();
      speak(task, () => {
        pendingObservationRef.current = () => {
          setWaitingForTap(false);
          pendingObservationRef.current = null;
          speak(OBSERVATION_QUESTION, () => {
            setTimeout(() => startListening(c, complete), 900);
          });
        };
        setWaitingForTap(true);
      });
    } else {
      speak(c.text, () => {
        setTimeout(() => startListening(c, complete), 900);
      });
    }
  }

  // Always keep ref current
  presentChallengeRef.current = presentChallenge;

  function handleGo() {
    console.log("[AXIS] GO");
    setPhase("CONTEXT");
    console.log("[AXIS] SET_CONTEXT");
    speak("Who's here?");
    startCamera();
  }

  function handleContextSelect(ctx: AxisContext) {
    const filtered = VISION_CHALLENGES.filter((c) => c.contexts.includes(ctx));
    challengesRef.current = filtered.length > 0 ? filtered : VISION_CHALLENGES;
    setActiveContext(ctx);
    setChallengeIndex(0);
    setPhase("LOOP");
    presentChallengeRef.current(0);
  }

  function handleTap() {
    if (waitingForTap && pendingObservationRef.current) {
      pendingObservationRef.current();
    } else if (loopSubPhase === "LISTENING") {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    }
  }

  function handleExit() {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    isListeningRef.current = false;
    window.speechSynthesis?.cancel();
    setPhase("READY");
    setActiveContext(null);
    setChallengeIndex(0);
    setWaitingForTap(false);
    pendingObservationRef.current = null;
  }

  function handleAgain() {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    isListeningRef.current = false;
    window.speechSynthesis.cancel();
    setActiveContext(null);
    setWaitingForTap(false);
    pendingObservationRef.current = null;
    setPhase("CONTEXT");
    speak("Who's here?");
  }

  // Display text for LOOP phase
  const challenges = challengesRef.current;
  const challenge = challenges[challengeIndex];

  function getDisplayText(): string {
    if (!challenge) return "";
    const qIdx = challenge.text.indexOf(OBSERVATION_QUESTION);
    const isObs = challenge.requiredEvidence === "OBSERVATION" && qIdx > -1;
    if (loopSubPhase === "LISTENING" && isObs) return OBSERVATION_QUESTION;
    if (isObs) return challenge.text.slice(0, qIdx).trim();
    return challenge.text;
  }

  const isStageTappable =
    phase === "LOOP" && (waitingForTap || loopSubPhase === "LISTENING");

  return (
    <main className="shell">
      <video ref={videoBgRef} muted playsInline aria-hidden className="camera-bg" />

      {phase !== "READY" && (
        <header>
          <button aria-label="Exit" className="back" onClick={handleExit} type="button">
            ←
          </button>
          <span className="context-label">
            {activeContext ? CONTEXT_LABELS[activeContext] : ""}
          </span>
          {phase === "LOOP" && challenge && (
            <span className="challenge-count">
              {challengeIndex + 1}&thinsp;/&thinsp;{challenges.length}
            </span>
          )}
        </header>
      )}

      <section
        className={`stage${isStageTappable ? " tappable" : ""}`}
        onClick={isStageTappable ? handleTap : undefined}
        role={isStageTappable ? "button" : undefined}
        aria-label={
          waitingForTap
            ? "Tap when ready"
            : loopSubPhase === "LISTENING"
              ? "Tap to finish"
              : undefined
        }
      >
        {phase === "READY" && (
          <>
            <p className="wordmark">Axis</p>
            <button
              className="go"
              disabled={!isVoiceSupported}
              onClick={handleGo}
              type="button"
            >
              Go
            </button>
          </>
        )}

        {phase === "CONTEXT" && (
          <>
            <p className="headline dim">Who's here?</p>
            <div className="context-options">
              {(["SOLO", "PARTNER", "TEAM", "GAME"] as AxisContext[]).map((ctx) => (
                <button
                  className="option"
                  key={ctx}
                  onClick={() => handleContextSelect(ctx)}
                  type="button"
                >
                  {CONTEXT_LABELS[ctx]}
                </button>
              ))}
            </div>
          </>
        )}

        {phase === "LOOP" && (
          <>
            {loopSubPhase === "SPEAKING" && !waitingForTap && <span className="dot" />}
            {waitingForTap && <span className="dot waiting" />}
            {loopSubPhase === "LISTENING" && <span className="dot listening" />}
            <p className="headline">{getDisplayText()}</p>
            {waitingForTap && <p className="tap-hint">tap when ready</p>}
          </>
        )}

        {phase === "DONE" && (
          <>
            <p className="headline dim">Done.</p>
            <button className="option" onClick={handleAgain} type="button">
              Again
            </button>
          </>
        )}
      </section>

      <style jsx>{`
        .shell {
          background: #0d0d0a;
          color: #f7f7f2;
          display: flex;
          flex-direction: column;
          min-height: 100dvh;
          overflow: hidden;
          position: relative;
        }

        .camera-bg {
          filter: blur(24px);
          height: 100%;
          left: 0;
          object-fit: cover;
          opacity: 0.18;
          pointer-events: none;
          position: absolute;
          top: 0;
          transform: scaleX(-1);
          width: 100%;
          z-index: 0;
        }

        header,
        .stage {
          position: relative;
          z-index: 1;
        }

        header {
          align-items: center;
          border-bottom: 1px solid rgba(247, 247, 242, 0.08);
          display: grid;
          gap: 12px;
          grid-template-columns: auto 1fr auto;
          padding: 14px clamp(18px, 5vw, 64px);
        }

        .back {
          background: transparent;
          border: 0;
          color: rgba(247, 247, 242, 0.3);
          cursor: pointer;
          font: inherit;
          font-size: 18px;
          line-height: 1;
          min-height: 44px;
          min-width: 44px;
          padding: 0;
        }

        .back:hover {
          color: rgba(247, 247, 242, 0.6);
        }

        .context-label {
          color: rgba(247, 247, 242, 0.4);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .challenge-count {
          color: rgba(247, 247, 242, 0.25);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .stage {
          align-content: center;
          display: grid;
          flex: 1;
          gap: 24px;
          padding: 48px clamp(18px, 5vw, 64px);
        }

        .stage.tappable {
          cursor: pointer;
        }

        .wordmark {
          color: rgba(247, 247, 242, 0.15);
          font-size: clamp(48px, 10vw, 96px);
          font-weight: 950;
          letter-spacing: -0.02em;
          line-height: 1;
          margin: 0;
        }

        .headline {
          font-size: clamp(32px, 6vw, 64px);
          font-weight: 900;
          line-height: 1;
          margin: 0;
          max-width: 18ch;
        }

        .headline.dim {
          color: rgba(247, 247, 242, 0.35);
        }

        .dot {
          background: rgba(247, 247, 242, 0.2);
          border-radius: 50%;
          display: block;
          height: 8px;
          width: 8px;
        }

        .dot.waiting {
          animation: breathe 2.4s ease-in-out infinite;
          background: rgba(247, 247, 242, 0.35);
        }

        .dot.listening {
          animation: pulse 1.1s ease-in-out infinite;
          background: #b8ff3d;
        }

        @keyframes breathe {
          0%,
          100% {
            opacity: 0.35;
          }
          50% {
            opacity: 0.8;
          }
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.2;
          }
        }

        .tap-hint {
          color: rgba(247, 247, 242, 0.25);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          margin: 0;
          text-transform: uppercase;
        }

        .context-options {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .go {
          background: #f7f7f2;
          border: 0;
          border-radius: 999px;
          color: #0d0d0a;
          cursor: pointer;
          font: inherit;
          font-size: 14px;
          font-weight: 850;
          min-height: 48px;
          padding: 0 28px;
          width: fit-content;
        }

        .go:disabled {
          cursor: not-allowed;
          opacity: 0.4;
        }

        .option {
          background: rgba(247, 247, 242, 0.08);
          border: 0;
          border-radius: 999px;
          color: #f7f7f2;
          cursor: pointer;
          font: inherit;
          font-size: 14px;
          font-weight: 850;
          min-height: 48px;
          padding: 0 22px;
        }

        .option:hover {
          background: rgba(247, 247, 242, 0.14);
        }
      `}</style>
    </main>
  );
}

async function saveRemoteMemory({ attempt }: { attempt: MissionAttempt }) {
  const token = await getAxisAccessToken();
  if (!token) return;
  await axisFetchWithAccessToken(token, "/api/axis/mission-memory", {
    body: JSON.stringify({ attempt }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }).catch(() => null);
}
