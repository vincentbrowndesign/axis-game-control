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

function matchContextKeyword(transcript: string): AxisContext | null {
  const t = transcript.toLowerCase();
  if (
    t.includes("solo") ||
    t.includes("alone") ||
    t.includes("myself") ||
    t.includes("just me") ||
    t.includes("by myself")
  )
    return "SOLO";
  if (
    t.includes("partner") ||
    t.includes("one on one") ||
    t.includes("1v1") ||
    t.includes("with someone") ||
    t.includes("with a friend")
  )
    return "PARTNER";
  if (
    t.includes("team") ||
    t.includes("practice") ||
    t.includes("group") ||
    t.includes("squad") ||
    t.includes("drill")
  )
    return "TEAM";
  if (
    t.includes("game") ||
    t.includes("match") ||
    t.includes("playing") ||
    t.includes("competition") ||
    t.includes("scrimmage")
  )
    return "GAME";
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSpeechAPI(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
}

export default function AxisShell() {
  const missionMemory = useMemo(() => createLocalMissionMemoryAdapter(), []);

  const [phase, setPhase] = useState<ShellPhase>("READY");
  const [activeContext, setActiveContext] = useState<AxisContext | null>(null);
  const [loopSubPhase, setLoopSubPhase] = useState<LoopSubPhase>("SPEAKING");
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [waitingForTap, setWaitingForTap] = useState(false);
  const [fallbackVisible, setFallbackVisible] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);

  const videoBgRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(false);
  const pendingObservationRef = useRef<(() => void) | null>(null);
  const challengesRef = useRef<AxisChallenge[]>([]);
  const presentChallengeRef = useRef<(index: number) => void>(() => null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Optimistic true — corrected client-side after hydration
  const [isVoiceSupported, setIsVoiceSupported] = useState(true);

  useEffect(() => {
    setIsVoiceSupported("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(fallbackTimerRef.current ?? undefined);
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function startCamera() {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" } })
      .then((stream) => {
        streamRef.current = stream;
        const v = videoBgRef.current;
        if (v) {
          v.srcObject = stream;
          v.play().catch(() => null);
        }
      })
      .catch(() => null);
  }

  const speak = useCallback((text: string, onDone?: () => void) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.88;
    u.pitch = 1.0;
    u.onend = () => onDone?.();
    u.onerror = () => onDone?.();
    window.speechSynthesis.speak(u);
  }, []);

  // Opens mic after "Who's here?" — listens for context keyword
  // Falls back to visible buttons after 5s if no voice match
  function listenForContextVoice() {
    clearTimeout(fallbackTimerRef.current ?? undefined);
    recognitionRef.current?.abort();
    recognitionRef.current = null;

    const SpeechAPI = getSpeechAPI();
    if (!SpeechAPI) {
      setFallbackVisible(true);
      return;
    }

    const rec: SpeechRecognition = new SpeechAPI();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    let matched = false;

    setVoiceActive(true);

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(
        { length: e.results.length },
        (_, i) => e.results[i][0].transcript,
      ).join(" ");
      const ctx = matchContextKeyword(transcript);
      if (!matched && ctx) {
        matched = true;
        clearTimeout(fallbackTimerRef.current ?? undefined);
        recognitionRef.current?.abort();
        recognitionRef.current = null;
        setVoiceActive(false);
        handleContextSelect(ctx);
      }
    };

    rec.onerror = () => {
      if (!matched) {
        setVoiceActive(false);
        setFallbackVisible(true);
      }
    };

    recognitionRef.current = rec;
    rec.start();

    fallbackTimerRef.current = setTimeout(() => {
      if (!matched) {
        setVoiceActive(false);
        setFallbackVisible(true);
      }
    }, 5000);
  }

  // Opens mic after "Done." — listens for "again"/"yes"/"more" etc.
  // Falls back to visible button after 6s if no voice match
  function listenForAgainVoice() {
    clearTimeout(fallbackTimerRef.current ?? undefined);
    recognitionRef.current?.abort();
    recognitionRef.current = null;

    const SpeechAPI = getSpeechAPI();
    if (!SpeechAPI) {
      setFallbackVisible(true);
      return;
    }

    const AGAIN = ["again", "yes", "yeah", "sure", "go", "ready", "more", "another", "next"];
    const rec: SpeechRecognition = new SpeechAPI();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    let matched = false;

    setVoiceActive(true);

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(
        { length: e.results.length },
        (_, i) => e.results[i][0].transcript,
      )
        .join(" ")
        .toLowerCase();
      if (!matched && AGAIN.some((k) => transcript.includes(k))) {
        matched = true;
        clearTimeout(fallbackTimerRef.current ?? undefined);
        recognitionRef.current?.abort();
        recognitionRef.current = null;
        setVoiceActive(false);
        handleAgain();
      }
    };

    rec.onerror = () => {
      if (!matched) {
        setVoiceActive(false);
        setFallbackVisible(true);
      }
    };

    recognitionRef.current = rec;
    rec.start();

    fallbackTimerRef.current = setTimeout(() => {
      if (!matched) {
        setVoiceActive(false);
        setFallbackVisible(true);
      }
    }, 6000);
  }

  // Opens mic during OBSERVATION "waiting for ready" state
  // Listens for "ready"/"yes"/"go" — tap always works too
  function listenForReadyVoice(onReady: () => void) {
    recognitionRef.current?.abort();
    recognitionRef.current = null;

    const SpeechAPI = getSpeechAPI();
    if (!SpeechAPI) return;

    const READY = ["ready", "yes", "yeah", "go", "done", "ok", "okay"];
    const rec: SpeechRecognition = new SpeechAPI();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    let matched = false;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(
        { length: e.results.length },
        (_, i) => e.results[i][0].transcript,
      )
        .join(" ")
        .toLowerCase();
      if (!matched && READY.some((k) => transcript.includes(k))) {
        matched = true;
        recognitionRef.current?.abort();
        recognitionRef.current = null;
        onReady();
      }
    };

    rec.onerror = () => null;
    recognitionRef.current = rec;
    rec.start();
  }

  const startListening = useCallback(
    (challenge: AxisChallenge, onComplete: (evidence: AxisEvidence) => void) => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;

      const SpeechAPI = getSpeechAPI();
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
        setFallbackVisible(false);
        setVoiceActive(false);
        speak("Done.", () => listenForAgainVoice());
      } else {
        presentChallengeRef.current(index + 1);
      }
    }

    const qIdx = c.text.indexOf(OBSERVATION_QUESTION);
    if (c.requiredEvidence === "OBSERVATION" && qIdx > -1) {
      const task = c.text.slice(0, qIdx).trim();
      speak(task, () => {
        const advance = () => {
          setWaitingForTap(false);
          pendingObservationRef.current = null;
          speak(OBSERVATION_QUESTION, () => {
            setTimeout(() => startListening(c, complete), 900);
          });
        };
        pendingObservationRef.current = advance;
        setWaitingForTap(true);
        listenForReadyVoice(advance);
      });
    } else {
      speak(c.text, () => {
        setTimeout(() => startListening(c, complete), 900);
      });
    }
  }

  presentChallengeRef.current = presentChallenge;

  function handleGo() {
    setFallbackVisible(false);
    setVoiceActive(false);
    setPhase("CONTEXT");
    speak("Who's here?", () => listenForContextVoice());
    startCamera();
  }

  function handleContextSelect(ctx: AxisContext) {
    clearTimeout(fallbackTimerRef.current ?? undefined);
    const filtered = VISION_CHALLENGES.filter((c) => c.contexts.includes(ctx));
    challengesRef.current = filtered.length > 0 ? filtered : VISION_CHALLENGES;
    setActiveContext(ctx);
    setChallengeIndex(0);
    setFallbackVisible(false);
    setVoiceActive(false);
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
    clearTimeout(fallbackTimerRef.current ?? undefined);
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    isListeningRef.current = false;
    window.speechSynthesis?.cancel();
    setPhase("READY");
    setActiveContext(null);
    setChallengeIndex(0);
    setWaitingForTap(false);
    setFallbackVisible(false);
    setVoiceActive(false);
    pendingObservationRef.current = null;
  }

  function handleAgain() {
    clearTimeout(fallbackTimerRef.current ?? undefined);
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    isListeningRef.current = false;
    window.speechSynthesis.cancel();
    setActiveContext(null);
    setWaitingForTap(false);
    setFallbackVisible(false);
    setVoiceActive(false);
    pendingObservationRef.current = null;
    setPhase("CONTEXT");
    speak("Who's here?", () => listenForContextVoice());
  }

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
        {/* READY — threshold only */}
        {phase === "READY" && (
          <button
            className="go"
            disabled={!isVoiceSupported}
            onClick={handleGo}
            type="button"
          >
            Go
          </button>
        )}

        {/* CONTEXT — Axis speaks first, player speaks back, buttons are fallback */}
        {phase === "CONTEXT" && (
          <>
            <p className="headline dim">Who's here?</p>
            {voiceActive && <span className="dot listening" />}
            {fallbackVisible && (
              <div className="context-options">
                {(["SOLO", "PARTNER", "TEAM", "GAME"] as AxisContext[]).map((ctx) => (
                  <button
                    className="context-choice"
                    key={ctx}
                    onClick={() => handleContextSelect(ctx)}
                    type="button"
                  >
                    {CONTEXT_LABELS[ctx]}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* LOOP */}
        {phase === "LOOP" && (
          <>
            {loopSubPhase === "SPEAKING" && !waitingForTap && <span className="dot" />}
            {waitingForTap && <span className="dot waiting" />}
            {loopSubPhase === "LISTENING" && <span className="dot listening" />}
            <p className="headline">{getDisplayText()}</p>
            {waitingForTap && <p className="tap-hint">say ready — or tap</p>}
          </>
        )}

        {/* DONE — voice primary, button is fallback */}
        {phase === "DONE" && (
          <>
            <p className="headline dim">Done.</p>
            {voiceActive && <span className="dot listening" />}
            {fallbackVisible && (
              <button className="again" onClick={handleAgain} type="button">
                again
              </button>
            )}
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
          border-bottom: 1px solid rgba(247, 247, 242, 0.06);
          display: grid;
          gap: 12px;
          grid-template-columns: auto 1fr auto;
          padding: 14px clamp(18px, 5vw, 64px);
        }

        .back {
          background: transparent;
          border: 0;
          color: rgba(247, 247, 242, 0.25);
          cursor: pointer;
          font: inherit;
          font-size: 18px;
          line-height: 1;
          min-height: 44px;
          min-width: 44px;
          padding: 0;
        }

        .back:hover {
          color: rgba(247, 247, 242, 0.5);
        }

        .context-label {
          color: rgba(247, 247, 242, 0.35);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .challenge-count {
          color: rgba(247, 247, 242, 0.2);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .stage {
          align-content: center;
          display: grid;
          flex: 1;
          gap: 32px;
          padding: 56px clamp(18px, 5vw, 64px) 48px;
        }

        .stage.tappable {
          cursor: pointer;
        }

        .headline {
          font-size: clamp(40px, 7vw, 80px);
          font-weight: 900;
          line-height: 1;
          margin: 0;
          max-width: 16ch;
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
          color: rgba(247, 247, 242, 0.22);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          margin: 0;
          text-transform: uppercase;
        }

        .context-options {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .context-choice {
          background: transparent;
          border: 0;
          color: rgba(247, 247, 242, 0.55);
          cursor: pointer;
          font: inherit;
          font-size: clamp(28px, 5vw, 52px);
          font-weight: 900;
          line-height: 1.1;
          min-height: 52px;
          padding: 0;
          text-align: left;
          transition: color 0.1s;
        }

        .context-choice:hover {
          color: #f7f7f2;
        }

        .go {
          background: #f7f7f2;
          border: 0;
          border-radius: 999px;
          color: #0d0d0a;
          cursor: pointer;
          font: inherit;
          font-size: 15px;
          font-weight: 850;
          min-height: 52px;
          padding: 0 32px;
          width: fit-content;
        }

        .go:disabled {
          cursor: not-allowed;
          opacity: 0.4;
        }

        .again {
          background: transparent;
          border: 0;
          color: rgba(247, 247, 242, 0.22);
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.1em;
          min-height: 44px;
          padding: 0;
          text-align: left;
          text-transform: uppercase;
          transition: color 0.1s;
        }

        .again:hover {
          color: rgba(247, 247, 242, 0.5);
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
