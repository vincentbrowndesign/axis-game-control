"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { axisFetchWithAccessToken, getAxisAccessToken } from "../../../lib/axis-client-auth";
import { type AxisChallenge, type AxisContext, VISION_CHALLENGES } from "../../../lib/axis-challenges";
import { analyzeIntent, generateConstraint, type GeneratedConstraint } from "../../../lib/axis-expansion";
import { type AxisEvidence, evaluateEvidence } from "../../../lib/axis-evidence";
import {
  createLocalMissionMemoryAdapter,
  createMissionAttempt,
  type MissionAttempt,
} from "../../../lib/axis-mission-memory";

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

const OBSERVATION_EXCHANGE_ENABLED = false;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ShellPhase = "CONTEXT" | "THINKING" | "EXPAND" | "CHALLENGE" | "DONE";

// Thread message — accumulates over the session
interface Message {
  id: string;
  role: "user" | "axis";
  // type controls visual treatment
  type: "intent" | "question" | "challenge" | "obs-prompt" | "observation" | "witness" | "done";
  text: string;
}

interface LearningToken {
  intent: string;
  challengeText: string;
  machineWitness: string | null;
  humanObservation: string | null;
  outcome: "COMPLETE" | "FAILED";
  timestamp: number;
  sessionId: string;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function classifyIntent(t: string): AxisContext {
  const s = t.toLowerCase();
  if (["game", "match", "playing", "competition", "scrimmage", "against"].some((k) => s.includes(k)))
    return "GAME";
  if (["team", "practice", "group", "squad", "we're", "we are"].some((k) => s.includes(k)))
    return "TEAM";
  if (["partner", "one on one", "1v1", "with someone", "with my"].some((k) => s.includes(k)))
    return "PARTNER";
  return "SOLO";
}

// "I noticed:" — witness speaks as a presence, not a telemetry readout
function formatMachineWitness(value: string): string {
  const map: Record<string, string> = {
    "Head Down": "I noticed: you were looking down.",
    "Head Up": "I noticed: you kept your head up.",
  };
  return map[value] ?? `I noticed: ${value.toLowerCase()}.`;
}

function getChallengeText(c: AxisChallenge): string {
  const i = c.text.indexOf("What did you notice?");
  return i > -1 ? c.text.slice(0, i).trim() : c.text;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSpeechAPI(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
}

function storeLearningToken(token: LearningToken) {
  try {
    const prev: LearningToken[] = JSON.parse(
      localStorage.getItem("axis_learning_tokens") ?? "[]",
    );
    localStorage.setItem("axis_learning_tokens", JSON.stringify([...prev, token]));
  } catch {}
}

let _id = 0;
const uid = () => (++_id).toString(36);

const AGAIN_WORDS = ["again", "yes", "yeah", "sure", "more", "another", "next", "yep"];

// ---------------------------------------------------------------------------
// InputBox — mic (left) · field (center) · send (right)
// Industry pattern: everything in one box.
// ---------------------------------------------------------------------------

type InputBoxProps = {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: (e: React.FormEvent) => void;
  onMicToggle: () => void;
  voiceActive: boolean;
  isVoiceSupported: boolean;
  placeholder: string;
  autoFocus?: boolean;
};

function InputBox({
  inputRef,
  onSubmit,
  onMicToggle,
  voiceActive,
  isVoiceSupported,
  placeholder,
  autoFocus,
}: InputBoxProps) {
  return (
    <form className="ibox" onSubmit={onSubmit}>
      {isVoiceSupported && (
        <button
          aria-label={voiceActive ? "Stop listening" : "Speak"}
          className={`ibox-mic${voiceActive ? " active" : ""}`}
          onClick={onMicToggle}
          type="button"
        >
          <span className={`mic-dot${voiceActive ? " active" : ""}`} />
        </button>
      )}
      <input
        ref={inputRef}
        autoComplete="off"
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        className="ibox-field"
        placeholder={placeholder}
        spellCheck={false}
        type="text"
      />
      <button aria-label="Send" className="ibox-send" type="submit">
        ↑
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export default function AxisShell() {
  const missionMemory = useMemo(() => createLocalMissionMemoryAdapter(), []);

  const [phase, setPhase] = useState<ShellPhase>("CONTEXT");
  const [messages, setMessages] = useState<Message[]>([]);
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [voiceActive, setVoiceActive] = useState(false);
  const [witnessText, setWitnessText] = useState<string | null>(null);
  const [isVoiceSupported, setIsVoiceSupported] = useState(true);

  const videoBgRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraStartedRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const challengesRef = useRef<AxisChallenge[]>([]);
  const intentInputRef = useRef<HTMLInputElement | null>(null);
  const observationInputRef = useRef<HTMLInputElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const thinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thinkingNextRef = useRef<(() => void) | null>(null);
  const witnessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentRef = useRef("");
  const sessionIdRef = useRef(Date.now().toString(36));
  const expansionConstraintRef = useRef<GeneratedConstraint | null>(null);
  const expandAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setIsVoiceSupported("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(thinkingTimerRef.current ?? undefined);
      clearTimeout(witnessTimerRef.current ?? undefined);
      recognitionRef.current?.abort();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Scroll to latest message whenever thread or thinking state changes
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, phase]);

  // Camera witness — captured 3s into drill when exchange is enabled
  useEffect(() => {
    if (phase !== "CHALLENGE" || !OBSERVATION_EXCHANGE_ENABLED) return;
    witnessTimerRef.current = setTimeout(async () => {
      const video = videoBgRef.current;
      if (!video || video.readyState < 2) return;
      const { createHeadPositionEvidence } = await import(
        "../../../lib/axis-vision-evidence"
      );
      const evidence = await createHeadPositionEvidence(video);
      if (evidence.value) {
        const text = formatMachineWitness(evidence.value as string);
        setWitnessText(text);
        appendMessage({ role: "axis", type: "witness", text });
      }
    }, 3000);
    return () => clearTimeout(witnessTimerRef.current ?? undefined);
  }, [phase, challengeIndex]);

  // Focus response input when a challenge or expansion question appears
  useEffect(() => {
    if (phase !== "CHALLENGE" && phase !== "EXPAND") return;
    const t = setTimeout(() => observationInputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [phase, challengeIndex]);

  // -------------------------------------------------------------------------
  // Thread
  // -------------------------------------------------------------------------

  function appendMessage(m: Omit<Message, "id">) {
    setMessages((prev) => [...prev, { ...m, id: uid() }]);
  }

  // -------------------------------------------------------------------------
  // Camera
  // -------------------------------------------------------------------------

  function startCamera() {
    if (cameraStartedRef.current) return;
    cameraStartedRef.current = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" } })
      .then((stream) => {
        streamRef.current = stream;
        const v = videoBgRef.current;
        if (v) { v.srcObject = stream; v.play().catch(() => null); }
      })
      .catch(() => { cameraStartedRef.current = false; });
  }

  // -------------------------------------------------------------------------
  // Thinking — quiet beat, shows as dot at bottom of thread
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Voice — one function, writes into whichever input is active
  // -------------------------------------------------------------------------

  function startVoiceCapture(
    inputRef: React.RefObject<HTMLInputElement | null>,
    onFinal: (text: string) => void,
  ) {
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
      const text = result[0].transcript;
      if (inputRef.current) inputRef.current.value = text;
      if (result.isFinal && !handled) {
        handled = true;
        recognitionRef.current = null;
        setVoiceActive(false);
        onFinal(text);
      }
    };
    rec.onerror = () => { if (!handled) setVoiceActive(false); };
    rec.onend = () => { if (!handled) setVoiceActive(false); };
    recognitionRef.current = rec;
    rec.start();
  }

  function stopVoice() {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setVoiceActive(false);
  }

  // -------------------------------------------------------------------------
  // Core loop — architecture unchanged
  // -------------------------------------------------------------------------

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

  // Builds challenge thread messages for the given index.
  // "What did you notice?" is a reflection gate — shown only at the end of a set
  // so action can accumulate before the player is asked to interpret it.
  function pushChallenge(index: number) {
    const c = challengesRef.current[index];
    if (!c) return;
    appendMessage({ role: "axis", type: "challenge", text: getChallengeText(c) });
    const isReflection = index === challengesRef.current.length - 1;
    if (isReflection) {
      appendMessage({ role: "axis", type: "obs-prompt", text: "What did you notice?" });
    }
  }

  // -------------------------------------------------------------------------
  // Expansion Engine — Intent → Expand → Constrain
  // -------------------------------------------------------------------------

  // Primary path: LLM generates the most useful clarifying question or a direct constraint.
  // Falls back to static rules if the API is unavailable.
  async function runExpansion(intent: string) {
    const sid = sessionIdRef.current; // capture — if user exits mid-call, sid changes
    try {
      expandAbortRef.current?.abort();
      const ctrl = new AbortController();
      expandAbortRef.current = ctrl;

      const res = await fetch("/api/axis/expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent }),
        signal: ctrl.signal,
      });
      expandAbortRef.current = null;

      if (sessionIdRef.current !== sid) return; // user exited while in flight
      if (!res.ok) throw new Error("expand api error");

      const data = await res.json() as { confidence: number; clarification_question?: string; constraint?: string };
      if (sessionIdRef.current !== sid) return;

      if (data.clarification_question) {
        appendMessage({ role: "axis", type: "question", text: data.clarification_question });
        setPhase("EXPAND");
      } else if (data.constraint) {
        startSessionWithConstraint({ constraint: data.constraint, duration: "90 seconds" });
      } else {
        throw new Error("unexpected response shape");
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (sessionIdRef.current !== sid) return;
      runExpansionStatic(intent);
    }
  }

  // Fallback: static knowledge base (no network required)
  function runExpansionStatic(intent: string) {
    const analysis = analyzeIntent(intent);
    if (!analysis.needsExpansion && analysis.directConstraint) {
      startSessionWithConstraint(analysis.directConstraint);
    } else if (analysis.needsExpansion && analysis.question) {
      appendMessage({ role: "axis", type: "question", text: analysis.question.text });
      setPhase("EXPAND");
    } else {
      startSession(classifyIntent(intent));
    }
  }

  // Build a one-constraint session from a dynamically generated constraint
  function startSessionWithConstraint(generated: GeneratedConstraint) {
    const synthetic: AxisChallenge = {
      id: `dynamic-${Date.now()}`,
      constraint: generated.constraint,
      objective: generated.constraint,
      requiredEvidence: "OBSERVATION",
      contexts: ["SOLO", "PARTNER", "TEAM", "GAME"],
      text: `${generated.constraint}. ${generated.duration}.`,
    };
    expansionConstraintRef.current = generated;
    challengesRef.current = [synthetic];
    setChallengeIndex(0);
    setWitnessText(null);
    setPhase("CHALLENGE");
    pushChallenge(0);
  }

  // Called when player answers the expansion question (text or voice).
  // Calls the LLM with intent + answer to generate an earned constraint.
  function handleExpandAnswer(val: string) {
    stopVoice();
    if (!val.trim()) return;
    if (observationInputRef.current) observationInputRef.current.value = "";
    appendMessage({ role: "user", type: "observation", text: val.trim() });
    const capturedVal = val.trim();
    const sid = sessionIdRef.current;
    showThinking(async () => {
      try {
        expandAbortRef.current?.abort();
        const ctrl = new AbortController();
        expandAbortRef.current = ctrl;
        const res = await fetch("/api/axis/expand", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intent: intentRef.current, answer: capturedVal }),
          signal: ctrl.signal,
        });
        expandAbortRef.current = null;
        if (sessionIdRef.current !== sid) return;
        if (!res.ok) throw new Error("expand api error");
        const data = await res.json() as { confidence: number; constraint?: string };
        if (sessionIdRef.current !== sid) return;
        if (data.constraint) {
          startSessionWithConstraint({ constraint: data.constraint, duration: "90 seconds" });
        } else {
          throw new Error("no constraint");
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if (sessionIdRef.current !== sid) return;
        // Fallback to static constraint generation
        const generated = generateConstraint(intentRef.current, capturedVal);
        startSessionWithConstraint(generated);
      }
    });
  }

  function handleExpandSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleExpandAnswer(observationInputRef.current?.value ?? "");
  }

  function handleExpandMicToggle() {
    if (voiceActive) { stopVoice(); return; }
    startVoiceCapture(observationInputRef, handleExpandAnswer);
  }

  function startSession(ctx: AxisContext) {
    const filtered = VISION_CHALLENGES.filter((c) => c.contexts.includes(ctx));
    challengesRef.current = filtered.length > 0 ? filtered : VISION_CHALLENGES;
    setChallengeIndex(0);
    setWitnessText(null);
    setPhase("CHALLENGE");
    pushChallenge(0);
  }

  function completeChallenge(observation: string) {
    clearTimeout(witnessTimerRef.current ?? undefined);
    stopVoice();

    const challenges = challengesRef.current;
    const c = challenges[challengeIndex];
    if (!c) return;

    if (observation.trim()) {
      appendMessage({ role: "user", type: "observation", text: observation.trim() });
    }

    handleAttempt(c, { kind: c.requiredEvidence, source: "VOICE", value: observation || null });
    storeLearningToken({
      intent: intentRef.current,
      challengeText: c.text,
      machineWitness: witnessText,
      humanObservation: observation || null,
      outcome: "COMPLETE",
      timestamp: Date.now(),
      sessionId: sessionIdRef.current,
    });

    const nextIndex = challengeIndex + 1;
    setWitnessText(null);
    if (observationInputRef.current) observationInputRef.current.value = "";

    if (nextIndex >= challenges.length) {
      showThinking(() => {
        setPhase("DONE");
        appendMessage({ role: "axis", type: "done", text: "Done." });
      });
    } else {
      showThinking(() => {
        setChallengeIndex(nextIndex);
        setPhase("CHALLENGE");
        pushChallenge(nextIndex);
      });
    }
  }

  // -------------------------------------------------------------------------
  // Opening / CONTEXT
  // -------------------------------------------------------------------------

  function submitIntent(val: string) {
    stopVoice();
    if (!val.trim()) return;
    intentRef.current = val.trim();
    sessionIdRef.current = Date.now().toString(36);
    startCamera();
    appendMessage({ role: "user", type: "intent", text: val.trim() });
    if (intentInputRef.current) intentInputRef.current.value = "";
    showThinking(() => runExpansion(val.trim()));
  }

  function handleIntentSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitIntent(intentInputRef.current?.value ?? "");
  }

  function handleIntentMicToggle() {
    if (voiceActive) { stopVoice(); return; }
    startCamera();
    startVoiceCapture(intentInputRef, submitIntent);
  }

  // -------------------------------------------------------------------------
  // CHALLENGE
  // -------------------------------------------------------------------------

  function handleObsSubmit(e: React.FormEvent) {
    e.preventDefault();
    completeChallenge(observationInputRef.current?.value ?? "");
  }

  function handleObsMicToggle() {
    if (voiceActive) { stopVoice(); return; }
    startVoiceCapture(observationInputRef, completeChallenge);
  }

  // -------------------------------------------------------------------------
  // DONE — "again" restarts session in same thread; new intent starts fresh
  // -------------------------------------------------------------------------

  function submitDone(val: string) {
    stopVoice();
    if (!val.trim()) return;
    if (intentInputRef.current) intentInputRef.current.value = "";
    appendMessage({ role: "user", type: "intent", text: val.trim() });
    if (AGAIN_WORDS.some((k) => val.toLowerCase().includes(k))) {
      reset();
      // Reuse the last generated constraint if available; otherwise re-route
      if (expansionConstraintRef.current) {
        showThinking(() => startSessionWithConstraint(expansionConstraintRef.current!));
      } else {
        showThinking(() => startSession(classifyIntent(intentRef.current)));
      }
    } else {
      intentRef.current = val.trim();
      sessionIdRef.current = Date.now().toString(36);
      showThinking(() => runExpansion(val.trim()));
    }
  }

  function handleDoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitDone(intentInputRef.current?.value ?? "");
  }

  function handleDoneMicToggle() {
    if (voiceActive) { stopVoice(); return; }
    startVoiceCapture(intentInputRef, submitDone);
  }

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  function reset() {
    expandAbortRef.current?.abort();
    expandAbortRef.current = null;
    clearTimeout(thinkingTimerRef.current ?? undefined);
    clearTimeout(witnessTimerRef.current ?? undefined);
    stopVoice();
    setWitnessText(null);
    thinkingNextRef.current = null;
  }

  // Clears thread, returns to opening state.
  // Bumps sessionIdRef so any in-flight async expansion calls discard their results.
  function handleExit() {
    reset();
    sessionIdRef.current = Date.now().toString(36);
    setMessages([]);
    setPhase("CONTEXT");
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const challenges = challengesRef.current;
  const challenge = challenges[challengeIndex];
  const isLastChallenge = challenges.length > 0 && challengeIndex === challenges.length - 1;
  // Show thread view once any message exists, or while thinking (dot must appear somewhere)
  const inThread = messages.length > 0 || phase === "THINKING";

  return (
    <main className="shell">
      <video ref={videoBgRef} muted playsInline aria-hidden className="cam-bg" />

      {/* ── OPENING STATE ──────────────────────────────────────────────── */}
      {/* No messages yet. Mirrors ChatGPT's empty-state: centered, one box. */}
      {!inThread && (
        <div className="opening">
          <p className="opening-q">What are you working on?</p>
          <InputBox
            inputRef={intentInputRef}
            onSubmit={handleIntentSubmit}
            onMicToggle={handleIntentMicToggle}
            voiceActive={voiceActive}
            isVoiceSupported={isVoiceSupported}
            placeholder="I keep looking at the ball…"
            autoFocus
          />
        </div>
      )}

      {/* ── THREAD VIEW ────────────────────────────────────────────────── */}
      {/* Conversation in progress. One thread, one input at bottom. */}
      {inThread && (
        <div className="thread-view">

          {/* Minimal header — only exit */}
          <div className="thread-hd">
            <button
              aria-label="New session"
              className="exit-btn"
              onClick={handleExit}
              type="button"
            >
              ←
            </button>
            <span />
            {phase === "CHALLENGE" && challenge && (
              <span className="progress">
                {challengeIndex + 1}&thinsp;/&thinsp;{challenges.length}
              </span>
            )}
          </div>

          {/* Scrollable thread */}
          <div className="thread" ref={threadRef}>
            {messages.map((m) => (
              <div key={m.id} className={`msg r-${m.role} t-${m.type}`}>
                {m.text}
              </div>
            ))}

            {/* Thinking indicator — three dots, industry pattern */}
            {phase === "THINKING" && (
              <div className="msg r-axis t-thinking">
                <span className="dot-wave">
                  <span /><span /><span />
                </span>
              </div>
            )}
          </div>

          {/* Pinned input — routes by phase */}
          <div className="thread-footer">
            {phase === "EXPAND" && (
              <InputBox
                key="expand"
                inputRef={observationInputRef}
                onSubmit={handleExpandSubmit}
                onMicToggle={handleExpandMicToggle}
                voiceActive={voiceActive}
                isVoiceSupported={isVoiceSupported}
                placeholder="tell me more…"
              />
            )}
            {phase === "CHALLENGE" && (
              <InputBox
                key="obs"
                inputRef={observationInputRef}
                onSubmit={handleObsSubmit}
                onMicToggle={handleObsMicToggle}
                voiceActive={voiceActive}
                isVoiceSupported={isVoiceSupported}
                placeholder={isLastChallenge ? "what did you see…" : "done, or what you noticed…"}
              />
            )}
            {phase === "DONE" && (
              <InputBox
                key="done"
                inputRef={intentInputRef}
                onSubmit={handleDoneSubmit}
                onMicToggle={handleDoneMicToggle}
                voiceActive={voiceActive}
                isVoiceSupported={isVoiceSupported}
                placeholder="again, or try something new…"
                autoFocus
              />
            )}
          </div>

        </div>
      )}

      <style jsx>{`
        /* ------------------------------------------------------------------ */
        /* Shell                                                               */
        /* ------------------------------------------------------------------ */

        .shell {
          background: #0d0d0a;
          color: #f7f7f2;
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
          min-height: 100dvh;
          overflow: hidden;
          position: relative;
        }

        /* Ambient camera — atmosphere, never a homepage */
        .cam-bg {
          filter: blur(32px);
          height: 100%;
          left: 0;
          object-fit: cover;
          opacity: 0.1;
          pointer-events: none;
          position: absolute;
          top: 0;
          transform: scaleX(-1);
          width: 100%;
          z-index: 0;
        }

        /* ------------------------------------------------------------------ */
        /* Opening state — ChatGPT empty state pattern                        */
        /* ------------------------------------------------------------------ */

        .opening {
          align-items: flex-start;
          display: flex;
          flex-direction: column;
          flex: 1;
          gap: 20px;
          justify-content: center;
          margin: 0 auto;
          max-width: 640px;
          padding: 0 clamp(20px, 5vw, 48px);
          position: relative;
          width: 100%;
          z-index: 1;
        }

        .opening-q {
          color: rgba(247, 247, 242, 0.55);
          font-size: clamp(22px, 3.5vw, 34px);
          font-weight: 700;
          line-height: 1.1;
          margin: 0;
        }

        /* ------------------------------------------------------------------ */
        /* Thread view                                                         */
        /* ------------------------------------------------------------------ */

        .thread-view {
          display: flex;
          flex: 1;
          flex-direction: column;
          min-height: 0;
          position: relative;
          z-index: 1;
        }

        .thread-hd {
          align-items: center;
          border-bottom: 1px solid rgba(247, 247, 242, 0.05);
          display: grid;
          flex-shrink: 0;
          gap: 12px;
          grid-template-columns: auto 1fr auto;
          padding: 12px clamp(20px, 5vw, 48px);
        }

        .exit-btn {
          background: transparent;
          border: 0;
          color: rgba(247, 247, 242, 0.2);
          cursor: pointer;
          font: inherit;
          font-size: 17px;
          line-height: 1;
          min-height: 44px;
          min-width: 44px;
          padding: 0;
          transition: color 0.12s;
        }

        .exit-btn:hover {
          color: rgba(247, 247, 242, 0.5);
        }

        .progress {
          color: rgba(247, 247, 242, 0.18);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.09em;
          text-align: right;
          text-transform: uppercase;
        }

        /* Scrollable thread */
        .thread {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 4px;
          margin: 0 auto;
          max-width: 640px;
          min-height: 0;
          overflow-y: auto;
          padding: 28px clamp(20px, 5vw, 48px) 20px;
          scroll-behavior: smooth;
          width: 100%;
        }

        /* Pinned input */
        .thread-footer {
          border-top: 1px solid rgba(247, 247, 242, 0.05);
          flex-shrink: 0;
          margin: 0 auto;
          max-width: 640px;
          padding: 14px clamp(20px, 5vw, 48px) 24px;
          width: 100%;
        }

        /* ------------------------------------------------------------------ */
        /* Messages                                                            */
        /* ------------------------------------------------------------------ */

        .msg {
          line-height: 1.45;
          margin: 0;
        }

        /* User — right, dim */
        .r-user {
          align-self: flex-end;
          color: rgba(247, 247, 242, 0.42);
          font-size: 15px;
          font-weight: 500;
          max-width: 75%;
          padding: 2px 0;
          text-align: right;
        }

        /* Axis — left */
        .r-axis {
          align-self: flex-start;
        }

        /* Challenge — the constraint. Dominant. Readable at a distance. */
        .t-challenge {
          color: #f7f7f2;
          font-size: clamp(26px, 4.5vw, 44px);
          font-weight: 600;
          line-height: 1.15;
          margin-top: 12px;
          max-width: 20ch;
        }

        /* Expansion question — one question that earns the constraint */
        .t-question {
          color: rgba(247, 247, 242, 0.88);
          font-size: clamp(20px, 3.2vw, 28px);
          font-weight: 500;
          line-height: 1.3;
          margin-top: 12px;
        }

        /* Observation prompt — protected, always visible */
        .t-obs-prompt {
          color: rgba(247, 247, 242, 0.35);
          font-size: 15px;
          font-weight: 500;
          margin-top: 4px;
          padding: 0;
        }

        /* Machine Witness — one sentence, earns the question */
        .t-witness {
          color: rgba(247, 247, 242, 0.38);
          font-size: 14px;
          font-weight: 400;
          margin-top: 6px;
        }

        /* Done */
        .t-done {
          color: rgba(247, 247, 242, 0.28);
          font-size: clamp(20px, 3vw, 28px);
          font-weight: 600;
          margin-top: 12px;
        }

        /* Thinking indicator — sits naturally in thread flow */
        .t-thinking {
          margin-top: 8px;
          padding: 6px 0;
        }

        .dot-wave {
          align-items: center;
          display: flex;
          gap: 5px;
        }

        .dot-wave span {
          animation: dotrise 1.4s ease-in-out infinite;
          background: rgba(247, 247, 242, 0.28);
          border-radius: 50%;
          display: block;
          height: 6px;
          width: 6px;
        }

        .dot-wave span:nth-child(2) { animation-delay: 0.18s; }
        .dot-wave span:nth-child(3) { animation-delay: 0.36s; }

        @keyframes dotrise {
          0%, 60%, 100% { opacity: 0.28; transform: translateY(0); }
          30% { opacity: 0.75; transform: translateY(-4px); }
        }

        /* ------------------------------------------------------------------ */
        /* InputBox                                                            */
        /* ------------------------------------------------------------------ */

        :global(.ibox) {
          align-items: center;
          background: rgba(247, 247, 242, 0.05);
          border: 1px solid rgba(247, 247, 242, 0.1);
          border-radius: 14px;
          display: flex;
          gap: 4px;
          padding: 10px 10px 10px 14px;
          transition: border-color 0.18s;
        }

        :global(.ibox:focus-within) {
          border-color: rgba(247, 247, 242, 0.22);
        }

        :global(.ibox-field) {
          background: transparent;
          border: 0;
          color: #f7f7f2;
          flex: 1;
          font: inherit;
          font-size: 17px;
          font-weight: 400;
          line-height: 1.5;
          min-width: 0;
          outline: none;
          padding: 2px 4px;
        }

        :global(.ibox-field::placeholder) {
          color: rgba(247, 247, 242, 0.2);
        }

        :global(.ibox-mic) {
          align-items: center;
          background: transparent;
          border: 0;
          color: rgba(247, 247, 242, 0.28);
          cursor: pointer;
          display: flex;
          flex-shrink: 0;
          height: 30px;
          justify-content: center;
          padding: 0;
          transition: color 0.15s;
          width: 30px;
        }

        :global(.ibox-mic:hover) {
          color: rgba(247, 247, 242, 0.55);
        }

        :global(.ibox-mic.active) {
          color: #b8ff3d;
        }

        :global(.mic-dot) {
          background: currentColor;
          border-radius: 50%;
          display: block;
          height: 7px;
          width: 7px;
        }

        :global(.mic-dot.active) {
          animation: pulse 1.1s ease-in-out infinite;
        }

        :global(.ibox-send) {
          align-items: center;
          background: rgba(247, 247, 242, 0.09);
          border: 0;
          border-radius: 9px;
          color: rgba(247, 247, 242, 0.55);
          cursor: pointer;
          display: flex;
          flex-shrink: 0;
          font: inherit;
          font-size: 14px;
          height: 34px;
          justify-content: center;
          padding: 0;
          transition: background 0.15s, color 0.15s;
          width: 34px;
        }

        :global(.ibox-send:hover) {
          background: rgba(247, 247, 242, 0.16);
          color: #f7f7f2;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.15; }
        }
      `}</style>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Remote persistence — unchanged
// ---------------------------------------------------------------------------

async function saveRemoteMemory({ attempt }: { attempt: MissionAttempt }) {
  const token = await getAxisAccessToken();
  if (!token) return;
  await axisFetchWithAccessToken(token, "/api/axis/mission-memory", {
    body: JSON.stringify({ attempt }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }).catch(() => null);
}
