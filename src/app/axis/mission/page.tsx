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

// Default false — enable only when camera observations are reliable on court
const OBSERVATION_EXCHANGE_ENABLED = false;

// READY removed — clerk is the entry. THINKING is a brief transition beat.
type ShellPhase = "CONTEXT" | "THINKING" | "LOOP" | "EXCHANGE" | "DONE";
type LoopSubPhase = "SPEAKING" | "LISTENING";

const OBSERVATION_QUESTION = "What did you notice?";

// Hidden classification — player never sees these labels
function classifyIntent(transcript: string): AxisContext {
  const t = transcript.toLowerCase();
  if (
    t.includes("game") ||
    t.includes("match") ||
    t.includes("playing") ||
    t.includes("competition") ||
    t.includes("scrimmage") ||
    t.includes("against")
  )
    return "GAME";
  if (
    t.includes("team") ||
    t.includes("practice") ||
    t.includes("group") ||
    t.includes("squad") ||
    t.includes("we're") ||
    t.includes("we are")
  )
    return "TEAM";
  if (
    t.includes("partner") ||
    t.includes("one on one") ||
    t.includes("1v1") ||
    t.includes("with someone") ||
    t.includes("with a friend") ||
    t.includes("with my")
  )
    return "PARTNER";
  return "SOLO";
}

const DONE_KEYWORDS = ["again", "yes", "yeah", "sure", "more", "another", "next", "yep", "go"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSpeechAPI(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
}

export default function AxisShell() {
  const missionMemory = useMemo(() => createLocalMissionMemoryAdapter(), []);

  // Start in CONTEXT — clerk is already here
  const [phase, setPhase] = useState<ShellPhase>("CONTEXT");
  const [activeContext, setActiveContext] = useState<AxisContext | null>(null);
  const [loopSubPhase, setLoopSubPhase] = useState<LoopSubPhase>("SPEAKING");
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [waitingForTap, setWaitingForTap] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [exchangeData, setExchangeData] = useState<{
    human: string | null;
    machine: string | null;
  } | null>(null);

  const videoBgRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraStartedRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(false);
  const pendingObservationRef = useRef<(() => void) | null>(null);
  const challengesRef = useRef<AxisChallenge[]>([]);
  const presentChallengeRef = useRef<(index: number) => void>(() => null);
  const thinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thinkingNextRef = useRef<(() => void) | null>(null);
  const exchangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exchangeAdvanceRef = useRef<(() => void) | null>(null);
  const intentInputRef = useRef<HTMLInputElement | null>(null);

  const [isVoiceSupported, setIsVoiceSupported] = useState(true);

  useEffect(() => {
    setIsVoiceSupported("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(thinkingTimerRef.current ?? undefined);
      clearTimeout(exchangeTimerRef.current ?? undefined);
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Camera starts on first user interaction — no Go button required
  function startCamera() {
    if (cameraStartedRef.current) return;
    cameraStartedRef.current = true;
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
      .catch(() => {
        cameraStartedRef.current = false;
      });
  }

  // Brief thinking beat between major transitions — clerk is processing
  function showThinking(then: () => void) {
    clearTimeout(thinkingTimerRef.current ?? undefined);
    thinkingNextRef.current = then;
    setPhase("THINKING");
    thinkingTimerRef.current = setTimeout(() => {
      const next = thinkingNextRef.current;
      thinkingNextRef.current = null;
      thinkingTimerRef.current = null;
      next?.();
    }, 800);
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

  // Conversation Mode listening — non-continuous, writes to input field in real time.
  // Voice and text are peers through the same field.
  function listenForIntentVoice() {
    recognitionRef.current?.abort();
    recognitionRef.current = null;

    const SpeechAPI = getSpeechAPI();
    if (!SpeechAPI) return;

    const rec: SpeechRecognition = new SpeechAPI();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    let handled = false;

    setVoiceActive(true);

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const result = e.results[0];
      const transcript = result[0].transcript;
      if (intentInputRef.current) intentInputRef.current.value = transcript;
      if (result.isFinal && !handled) {
        handled = true;
        recognitionRef.current = null;
        setVoiceActive(false);
        startCamera();
        showThinking(() => handleContextSelect(classifyIntent(transcript)));
      }
    };

    rec.onerror = () => {
      if (!handled) setVoiceActive(false);
    };

    rec.onend = () => {
      if (!handled) setVoiceActive(false);
    };

    recognitionRef.current = rec;
    rec.start();
  }

  // DONE mode listening — same field, handles both "again" and new intent
  function listenForDoneVoice() {
    recognitionRef.current?.abort();
    recognitionRef.current = null;

    const SpeechAPI = getSpeechAPI();
    if (!SpeechAPI) return;

    const rec: SpeechRecognition = new SpeechAPI();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    let handled = false;

    setVoiceActive(true);

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const result = e.results[0];
      const transcript = result[0].transcript;
      if (intentInputRef.current) intentInputRef.current.value = transcript;
      if (result.isFinal && !handled) {
        handled = true;
        recognitionRef.current = null;
        setVoiceActive(false);
        if (DONE_KEYWORDS.some((k) => transcript.toLowerCase().includes(k))) {
          handleAgain();
        } else {
          const ctx = classifyIntent(transcript);
          resetSession();
          showThinking(() => handleContextSelect(ctx));
        }
      }
    };

    rec.onerror = () => {
      if (!handled) setVoiceActive(false);
    };

    rec.onend = () => {
      if (!handled) setVoiceActive(false);
    };

    recognitionRef.current = rec;
    rec.start();
  }

  // Opens mic during OBSERVATION "waiting for ready" — tap also works
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
    clearTimeout(exchangeTimerRef.current ?? undefined);

    setChallengeIndex(index);
    setLoopSubPhase("SPEAKING");
    setWaitingForTap(false);
    setExchangeData(null);
    exchangeAdvanceRef.current = null;
    pendingObservationRef.current = null;

    const isLast = index === challenges.length - 1;

    function advance() {
      setExchangeData(null);
      exchangeAdvanceRef.current = null;
      if (isLast) {
        showThinking(() => {
          setPhase("DONE");
          speak("Done.", () => listenForDoneVoice());
        });
      } else {
        presentChallengeRef.current(index + 1);
      }
    }

    async function complete(evidence: AxisEvidence) {
      handleAttempt(c, evidence);

      const video = videoBgRef.current;
      const shouldExchange =
        OBSERVATION_EXCHANGE_ENABLED &&
        c.requiredEvidence === "OBSERVATION" &&
        video !== null &&
        video.readyState >= 2;

      if (shouldExchange && video) {
        const { createHeadPositionEvidence } = await import(
          "../../../lib/axis-vision-evidence"
        );
        const cameraEvidence = await createHeadPositionEvidence(video);
        if (cameraEvidence.value !== null) {
          handleAttempt(c, cameraEvidence);
          setExchangeData({
            human: typeof evidence.value === "string" ? evidence.value : null,
            machine: typeof cameraEvidence.value === "string" ? cameraEvidence.value : null,
          });
          setPhase("EXCHANGE");
          exchangeAdvanceRef.current = advance;
          exchangeTimerRef.current = setTimeout(advance, 3200);
          return;
        }
      }

      advance();
    }

    const qIdx = c.text.indexOf(OBSERVATION_QUESTION);
    if (c.requiredEvidence === "OBSERVATION" && qIdx > -1) {
      const task = c.text.slice(0, qIdx).trim();
      speak(task, () => {
        const advanceToQuestion = () => {
          setWaitingForTap(false);
          pendingObservationRef.current = null;
          speak(OBSERVATION_QUESTION, () => {
            setTimeout(() => startListening(c, complete), 900);
          });
        };
        pendingObservationRef.current = advanceToQuestion;
        setWaitingForTap(true);
        listenForReadyVoice(advanceToQuestion);
      });
    } else {
      speak(c.text, () => {
        setTimeout(() => startListening(c, complete), 900);
      });
    }
  }

  presentChallengeRef.current = presentChallenge;

  function handleContextSelect(ctx: AxisContext) {
    const filtered = VISION_CHALLENGES.filter((c) => c.contexts.includes(ctx));
    challengesRef.current = filtered.length > 0 ? filtered : VISION_CHALLENGES;
    setActiveContext(ctx);
    setChallengeIndex(0);
    setVoiceActive(false);
    setPhase("LOOP");
    presentChallengeRef.current(0);
  }

  function handleIntentSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = intentInputRef.current?.value.trim();
    if (!val) return;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setVoiceActive(false);
    startCamera();
    showThinking(() => handleContextSelect(classifyIntent(val)));
  }

  function handleDoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = intentInputRef.current?.value.trim();
    if (!val) return;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setVoiceActive(false);
    if (DONE_KEYWORDS.some((k) => val.toLowerCase().includes(k))) {
      handleAgain();
    } else {
      const ctx = classifyIntent(val);
      resetSession();
      showThinking(() => handleContextSelect(ctx));
    }
  }

  function handleMicToggle() {
    if (voiceActive) {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      setVoiceActive(false);
    } else {
      if (phase === "CONTEXT") {
        startCamera();
        listenForIntentVoice();
      } else if (phase === "DONE") {
        listenForDoneVoice();
      }
    }
  }

  function handleTap() {
    if (phase === "EXCHANGE") {
      clearTimeout(exchangeTimerRef.current ?? undefined);
      exchangeAdvanceRef.current?.();
      return;
    }
    if (waitingForTap && pendingObservationRef.current) {
      pendingObservationRef.current();
    } else if (loopSubPhase === "LISTENING") {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    }
  }

  function resetSession() {
    clearTimeout(thinkingTimerRef.current ?? undefined);
    clearTimeout(exchangeTimerRef.current ?? undefined);
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    isListeningRef.current = false;
    window.speechSynthesis?.cancel();
    setActiveContext(null);
    setChallengeIndex(0);
    setWaitingForTap(false);
    setVoiceActive(false);
    setExchangeData(null);
    exchangeAdvanceRef.current = null;
    pendingObservationRef.current = null;
    thinkingNextRef.current = null;
  }

  function handleExit() {
    resetSession();
    setPhase("CONTEXT");
  }

  function handleAgain() {
    resetSession();
    showThinking(() => setPhase("CONTEXT"));
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
    phase === "EXCHANGE" ||
    (phase === "LOOP" && (waitingForTap || loopSubPhase === "LISTENING"));

  return (
    <main className="shell">
      <video ref={videoBgRef} muted playsInline aria-hidden className="camera-bg" />

      {/* Header — Session Mode only */}
      {(phase === "LOOP" || phase === "EXCHANGE") && (
        <header>
          <button aria-label="Exit" className="back" onClick={handleExit} type="button">
            ←
          </button>
          <span />
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
          phase === "EXCHANGE"
            ? "Tap to continue"
            : waitingForTap
              ? "Tap when ready"
              : loopSubPhase === "LISTENING"
                ? "Tap to finish"
                : undefined
        }
      >
        {/* CONTEXT — Conversation Mode */}
        {phase === "CONTEXT" && (
          <>
            <p className="headline dim">What are you working on?</p>
            <div className="peer-input">
              <form className="peer-form" onSubmit={handleIntentSubmit}>
                <input
                  ref={intentInputRef}
                  autoComplete="off"
                  autoFocus
                  className="peer-text"
                  placeholder="handles, game day, team…"
                  spellCheck={false}
                  type="text"
                />
              </form>
              {isVoiceSupported && (
                <button
                  aria-label={voiceActive ? "Stop listening" : "Start listening"}
                  className={`mic${voiceActive ? " active" : ""}`}
                  onClick={handleMicToggle}
                  type="button"
                >
                  <span className={`mic-dot${voiceActive ? " listening" : ""}`} />
                </button>
              )}
            </div>
          </>
        )}

        {/* THINKING — brief beat between major transitions */}
        {phase === "THINKING" && <span className="dot thinking" />}

        {/* LOOP — Session Mode */}
        {phase === "LOOP" && (
          <>
            {loopSubPhase === "SPEAKING" && !waitingForTap && <span className="dot" />}
            {waitingForTap && <span className="dot waiting" />}
            {loopSubPhase === "LISTENING" && <span className="dot listening" />}
            <p className="headline">{getDisplayText()}</p>
            {waitingForTap && <p className="tap-hint">say ready — or tap</p>}
          </>
        )}

        {/* EXCHANGE — two witnesses, same moment */}
        {phase === "EXCHANGE" && exchangeData && (
          <>
            <div className="witness">
              <p className="witness-label">You noticed</p>
              <p className="witness-value human">&ldquo;{exchangeData.human}&rdquo;</p>
            </div>
            <div className="witness">
              <p className="witness-label">Camera noticed</p>
              <p className="witness-value machine">{exchangeData.machine}</p>
            </div>
          </>
        )}

        {/* DONE — Conversation Mode returns */}
        {phase === "DONE" && (
          <>
            <p className="headline dim">Done.</p>
            <div className="peer-input">
              <form className="peer-form" onSubmit={handleDoneSubmit}>
                <input
                  ref={intentInputRef}
                  autoComplete="off"
                  autoFocus
                  className="peer-text"
                  placeholder="again, or try something new…"
                  spellCheck={false}
                  type="text"
                />
              </form>
              {isVoiceSupported && (
                <button
                  aria-label={voiceActive ? "Stop listening" : "Start listening"}
                  className={`mic${voiceActive ? " active" : ""}`}
                  onClick={handleMicToggle}
                  type="button"
                >
                  <span className={`mic-dot${voiceActive ? " listening" : ""}`} />
                </button>
              )}
            </div>
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
          gap: 28px;
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

        /* Peer input — voice and text, always both present */
        .peer-input {
          align-items: center;
          display: flex;
          gap: 12px;
          max-width: 560px;
        }

        .peer-form {
          flex: 1;
        }

        .peer-text {
          background: transparent;
          border: 0;
          border-bottom: 1px solid rgba(247, 247, 242, 0.12);
          color: #f7f7f2;
          font: inherit;
          font-size: clamp(22px, 3.5vw, 40px);
          font-weight: 800;
          outline: none;
          padding: 6px 0 8px;
          width: 100%;
        }

        .peer-text::placeholder {
          color: rgba(247, 247, 242, 0.16);
          font-weight: 700;
        }

        /* Mic button — peer to text, always visible */
        .mic {
          align-items: center;
          background: transparent;
          border: 1px solid rgba(247, 247, 242, 0.1);
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          flex-shrink: 0;
          height: 44px;
          justify-content: center;
          padding: 0;
          transition: border-color 0.15s;
          width: 44px;
        }

        .mic:hover {
          border-color: rgba(247, 247, 242, 0.3);
        }

        .mic.active {
          border-color: rgba(184, 255, 61, 0.5);
        }

        .mic-dot {
          background: rgba(247, 247, 242, 0.3);
          border-radius: 50%;
          display: block;
          height: 8px;
          transition: background 0.15s;
          width: 8px;
        }

        .mic-dot.listening {
          animation: pulse 1.1s ease-in-out infinite;
          background: #b8ff3d;
        }

        /* Status dots — Session Mode */
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

        .dot.thinking {
          animation: breathe 0.6s ease-in-out infinite;
          background: rgba(247, 247, 242, 0.3);
          height: 10px;
          width: 10px;
        }

        @keyframes breathe {
          0%,
          100% {
            opacity: 0.35;
          }
          50% {
            opacity: 0.9;
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

        /* Observation Exchange */
        .witness {
          display: grid;
          gap: 8px;
        }

        .witness-label {
          color: rgba(247, 247, 242, 0.25);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          margin: 0;
          text-transform: uppercase;
        }

        .witness-value {
          font-size: clamp(24px, 4vw, 44px);
          font-weight: 900;
          line-height: 1.1;
          margin: 0;
          max-width: 20ch;
        }

        .witness-value.human {
          color: #f7f7f2;
        }

        .witness-value.machine {
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
