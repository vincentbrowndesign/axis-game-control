"use client";

import { CameraIcon, Eye, Mic, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { axisFetchWithAccessToken, getAxisAccessToken } from "../../../lib/axis-client-auth";
import { type AxisEvidence, type EvidenceKind, evaluateEvidence } from "../../../lib/axis-evidence";
import { startCameraWitness, type CameraWitnessHandle } from "../../../lib/camera-witness";
import { record } from "../../../lib/learning-engine";
import {
  createLocalMissionMemoryAdapter,
  createMissionAttempt,
  type MissionAttempt,
} from "../../../lib/axis-mission-memory";
import { type ContextSummary } from "../../../lib/context-model";
import ContextSidebar from "../../../components/axis/context-sidebar";
import {
  createContext as createDevContext,
  findMatchingContext,
  listSummaries,
  recordExperiment as recordCtxExperiment,
  recordInsights as recordCtxInsights,
  recordIntent as recordCtxIntent,
  recordObservation as recordCtxObservation,
  recordOutcome as recordCtxOutcome,
} from "../../../lib/context-store";
import {
  COACH_TAPS,
  type CoachTap,
  coachNoteEvent,
  coachTapEvent,
} from "../../../lib/coach-witness";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GENERIC_CLARIFICATION = "What part are you trying to improve?";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ShellPhase = "CONTEXT" | "THINKING" | "EXPAND" | "INSIGHTS" | "CHALLENGE" | "DONE";
type CameraStatus = "OFF" | "STARTING" | "ON" | "BLOCKED";
type WitnessStatus = "QUIET" | "READY" | "WATCHING" | "SAVING" | "RECORDED";

// Thread message — accumulates over the session
interface Message {
  id: string;
  role: "user" | "axis";
  // type controls visual treatment
  type: "intent" | "question" | "challenge" | "observation" | "witness" | "done";
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

interface InsightObject {
  id: string;
  title: string;
  insight: string;
  mentalModel?: string;
  experimentCandidate?: string;
}

interface UnderstandingOutput {
  confidence: number;
  leveragePoint?: string;
  mentalModel?: string;
  commonMistake?: string;
  experimentCandidate?: string;
  clarificationQuestion?: string;
  insights: InsightObject[];
}

interface GeneratedConstraint {
  constraint: string;
}

interface RuntimeChallenge {
  id: string;
  constraint: string;
  objective: string;
  requiredEvidence: EvidenceKind;
  text: string;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

// "I noticed:" — witness speaks as a presence, not a telemetry readout
function formatMachineWitness(value: string): string {
  const map: Record<string, string> = {
    "Head Down": "I noticed: you were looking down.",
    "Head Up": "I noticed: you kept your head up.",
  };
  return map[value] ?? `I noticed: ${value.toLowerCase()}.`;
}

function candidateToConstraint(candidate: string): GeneratedConstraint {
  return { constraint: candidate.trim() };
}

function titleFromInsight(text: string): string {
  return text
    .replace(/[.?!]+$/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 4)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function insightFromApi(data: Partial<UnderstandingOutput>): InsightObject[] {
  if (Array.isArray(data.insights) && data.insights.length > 0) {
    return data.insights
      .map((insight, index) => ({
        id: typeof insight.id === "string" && insight.id.trim() ? insight.id.trim() : `api-insight-${index}`,
        title: typeof insight.title === "string" && insight.title.trim()
          ? insight.title.trim()
          : titleFromInsight(insight.insight ?? data.leveragePoint ?? "Insight"),
        insight: typeof insight.insight === "string" && insight.insight.trim()
          ? insight.insight.trim()
          : data.leveragePoint?.trim() ?? "",
        mentalModel: typeof insight.mentalModel === "string" && insight.mentalModel.trim()
          ? insight.mentalModel.trim()
          : data.mentalModel?.trim(),
        experimentCandidate: typeof insight.experimentCandidate === "string" && insight.experimentCandidate.trim()
          ? insight.experimentCandidate.trim()
          : data.experimentCandidate?.trim(),
      }))
      .filter((insight) => insight.insight);
  }

  if (typeof data.leveragePoint === "string" && data.leveragePoint.trim()) {
    return [{
      id: `api-insight-${Date.now().toString(36)}`,
      title: titleFromInsight(data.leveragePoint),
      insight: data.leveragePoint.trim(),
      mentalModel: data.mentalModel?.trim(),
      experimentCandidate: data.experimentCandidate?.trim(),
    }];
  }

  return [];
}

async function requestUnderstanding(
  input: { intent: string; threadHistory?: string[] },
  signal?: AbortSignal,
): Promise<UnderstandingOutput> {
  const res = await fetch("/api/axis/understand", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });

  if (!res.ok) throw new Error("understand api error");

  const data = await res.json() as Partial<UnderstandingOutput>;
  const insights = insightFromApi(data);
  const hasClarification = typeof data.clarificationQuestion === "string" && data.clarificationQuestion.trim();
  const hasExperiment = typeof data.experimentCandidate === "string" && data.experimentCandidate.trim();
  if (!hasClarification && insights.length === 0 && !hasExperiment) {
    throw new Error("unusable understand response");
  }

  return {
    confidence: typeof data.confidence === "number" ? data.confidence : 0,
    leveragePoint: data.leveragePoint?.trim(),
    mentalModel: data.mentalModel?.trim(),
    commonMistake: data.commonMistake?.trim(),
    experimentCandidate: data.experimentCandidate?.trim(),
    clarificationQuestion: data.clarificationQuestion?.trim(),
    insights,
  };
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
  const [insights, setInsights] = useState<InsightObject[]>([]);
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("OFF");
  const [voiceActive, setVoiceActive] = useState(false);
  const [witnessText, setWitnessText] = useState<string | null>(null);
  const [witnessStatus, setWitnessStatus] = useState<WitnessStatus>("QUIET");
  const [isVoiceSupported, setIsVoiceSupported] = useState(true);

  const videoBgRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraStartedRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const challengesRef = useRef<RuntimeChallenge[]>([]);
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
  const cameraWitnessRef = useRef<CameraWitnessHandle | null>(null);
  const activeContextIdRef = useRef<string | null>(null);
  const coachNoteRef = useRef<HTMLInputElement | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contexts, setContexts] = useState<ContextSummary[]>([]);

  useEffect(() => {
    setContexts(listSummaries());
  }, []);

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

  // Focus response input when a challenge, expansion question, or insight appears
  useEffect(() => {
    if (phase !== "CHALLENGE" && phase !== "EXPAND" && phase !== "INSIGHTS") return;
    const t = setTimeout(() => observationInputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [phase, challengeIndex]);

  // -------------------------------------------------------------------------
  // Thread
  // -------------------------------------------------------------------------

  function appendMessage(m: Omit<Message, "id">) {
    setMessages((prev) => [...prev, { ...m, id: uid() }]);
  }

  function applyUnderstanding(output: UnderstandingOutput) {
    setInsights(output.insights);
    if (activeContextIdRef.current) {
      recordCtxInsights(activeContextIdRef.current, output.insights);
      setContexts(listSummaries());
    }
    if (output.clarificationQuestion) {
      appendMessage({ role: "axis", type: "question", text: output.clarificationQuestion });
      setPhase("EXPAND");
      return;
    }
    if (output.insights.length > 0) {
      setPhase("INSIGHTS");
      return;
    }
    appendMessage({ role: "axis", type: "question", text: GENERIC_CLARIFICATION });
    setPhase("EXPAND");
  }

  // -------------------------------------------------------------------------
  // Camera Witness
  // -------------------------------------------------------------------------

  function startWitness(experimentId: string, constraint: string) {
    setWitnessStatus("WATCHING");
    const video = videoBgRef.current;
    if (!video) {
      setWitnessStatus("READY");
      return;
    }
    cameraWitnessRef.current = startCameraWitness({
      intent_id: sessionIdRef.current,
      experiment_id: experimentId,
      constraint,
      video,
    });
  }

  function stopWitness() {
    const handle = cameraWitnessRef.current;
    cameraWitnessRef.current = null;
    if (!handle) {
      setWitnessStatus("READY");
      return;
    }
    setWitnessStatus("SAVING");
    const capturedSid = sessionIdRef.current;
    handle.stop().then((event) => {
      if (!event || sessionIdRef.current !== capturedSid) {
        setWitnessStatus("READY");
        return;
      }
      record(event);
      setWitnessStatus("RECORDED");
      appendMessage({ role: "axis", type: "witness", text: `I noticed: ${event.claim.summary}` });
    }).catch(() => setWitnessStatus("READY"));
  }

  // -------------------------------------------------------------------------
  // Camera
  // -------------------------------------------------------------------------

  function startCamera() {
    if (cameraStartedRef.current) return;
    cameraStartedRef.current = true;
    setCameraStatus("STARTING");
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" } })
      .then((stream) => {
        streamRef.current = stream;
        const v = videoBgRef.current;
        if (v) { v.srcObject = stream; v.play().catch(() => null); }
        setCameraStatus("ON");
        setWitnessStatus((current) => current === "QUIET" ? "READY" : current);
      })
      .catch(() => {
        cameraStartedRef.current = false;
        setCameraStatus("BLOCKED");
      });
  }

  function openUpload() {
    window.location.href = "/axis-ball";
  }

  function toggleVisibleVoice() {
    if (!isVoiceSupported) return;
    if (voiceActive) { stopVoice(); return; }
    if (phase === "CONTEXT") {
      startCamera();
      startVoiceCapture(intentInputRef, submitIntent);
      return;
    }
    if (phase === "EXPAND") {
      startVoiceCapture(observationInputRef, handleExpandAnswer);
      return;
    }
    if (phase === "INSIGHTS") {
      startVoiceCapture(observationInputRef, handleInsightsInput);
      return;
    }
    if (phase === "CHALLENGE") {
      startVoiceCapture(observationInputRef, completeChallenge);
      return;
    }
    if (phase === "DONE") {
      startVoiceCapture(intentInputRef, submitDone);
    }
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

  function handleAttempt(challenge: RuntimeChallenge, evidence: AxisEvidence) {
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

  function renderExperimentChallenge(challenge: RuntimeChallenge) {
    appendMessage({ role: "axis", type: "challenge", text: challenge.text });
  }

  // -------------------------------------------------------------------------
  // Understanding Engine — Intent → Understand → Experiment
  // -------------------------------------------------------------------------

  // Primary path: locate a leverage point before any challenge can start.
  // No failed/unknown intent may fall through to the static vision list.
  async function runExpansion(intent: string) {
    const sid = sessionIdRef.current; // capture — if user exits mid-call, sid changes
    try {
      expandAbortRef.current?.abort();
      const ctrl = new AbortController();
      expandAbortRef.current = ctrl;

      const output = await requestUnderstanding({
        intent,
        threadHistory: messages.map((m) => `${m.role}: ${m.text}`),
      }, ctrl.signal);
      expandAbortRef.current = null;

      if (sessionIdRef.current !== sid) return; // user exited while in flight
      applyUnderstanding(output);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (sessionIdRef.current !== sid) return;
      runExpansionStatic();
    }
  }

  // Fallback: static clarification only. Never routes to a local challenge list.
  function runExpansionStatic() {
    appendMessage({
      role: "axis",
      type: "question",
      text: GENERIC_CLARIFICATION,
    });
    setPhase("EXPAND");
  }

  // Build a one-experiment session from API-returned content.
  function startApiExperiment(generated: GeneratedConstraint) {
    const experimentId = `dynamic-${Date.now()}`;
    const synthetic: RuntimeChallenge = {
      id: experimentId,
      constraint: generated.constraint,
      objective: generated.constraint,
      requiredEvidence: "OBSERVATION",
      text: generated.constraint,
    };
    expansionConstraintRef.current = generated;
    challengesRef.current = [synthetic];
    setChallengeIndex(0);
    setWitnessText(null);
    setPhase("CHALLENGE");
    renderExperimentChallenge(synthetic);
    startWitness(experimentId, generated.constraint);
    if (activeContextIdRef.current) {
      recordCtxExperiment(activeContextIdRef.current, generated.constraint);
      setContexts(listSummaries());
    }
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
        const output = await requestUnderstanding({
          intent: `${intentRef.current} ${capturedVal}`,
          threadHistory: messages.map((m) => `${m.role}: ${m.text}`).concat(`user: ${capturedVal}`),
        }, ctrl.signal);
        expandAbortRef.current = null;
        if (sessionIdRef.current !== sid) return;
        applyUnderstanding({ ...output, clarificationQuestion: undefined });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if (sessionIdRef.current !== sid) return;
        appendMessage({ role: "axis", type: "question", text: GENERIC_CLARIFICATION });
        setPhase("EXPAND");
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

  // -------------------------------------------------------------------------
  // INSIGHTS — user reads insight, then decides: refine or run
  // -------------------------------------------------------------------------

  function handleTryExperiment() {
    const candidate = insights[0]?.experimentCandidate;
    if (!candidate) return;
    startApiExperiment(candidateToConstraint(candidate));
  }

  function handleInsightsInput(val: string) {
    stopVoice();
    const trimmed = val.trim();
    if (observationInputRef.current) observationInputRef.current.value = "";
    if (!trimmed) return;
    appendMessage({ role: "user", type: "observation", text: trimmed });
    const sid = sessionIdRef.current;
    showThinking(async () => {
      try {
        expandAbortRef.current?.abort();
        const ctrl = new AbortController();
        expandAbortRef.current = ctrl;
        const output = await requestUnderstanding({
          intent: `${intentRef.current} ${trimmed}`,
          threadHistory: messages.map((m) => `${m.role}: ${m.text}`).concat(`user: ${trimmed}`),
        }, ctrl.signal);
        expandAbortRef.current = null;
        if (sessionIdRef.current !== sid) return;
        applyUnderstanding({ ...output, clarificationQuestion: undefined });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if (sessionIdRef.current !== sid) return;
        appendMessage({ role: "axis", type: "question", text: GENERIC_CLARIFICATION });
        setPhase("EXPAND");
      }
    });
  }

  function handleInsightsSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleInsightsInput(observationInputRef.current?.value ?? "");
  }

  function handleInsightsMicToggle() {
    if (voiceActive) { stopVoice(); return; }
    startVoiceCapture(observationInputRef, handleInsightsInput);
  }

  function completeChallenge(observation: string) {
    clearTimeout(witnessTimerRef.current ?? undefined);
    stopVoice();

    const challenges = challengesRef.current;
    const c = challenges[challengeIndex];
    if (!c) return;

    if (observation.trim()) {
      appendMessage({ role: "user", type: "observation", text: observation.trim() });
      if (activeContextIdRef.current) {
        recordCtxObservation(activeContextIdRef.current, observation.trim());
        setContexts(listSummaries());
      }
    }

    // Stop camera witness — fires async, records to learning engine when done
    stopWitness();

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
        if (activeContextIdRef.current) {
          recordCtxOutcome(activeContextIdRef.current, "Done");
          setContexts(listSummaries());
        }
        appendMessage({ role: "axis", type: "done", text: "Done." });
      });
    } else {
      showThinking(() => {
        setChallengeIndex(nextIndex);
        setPhase("CHALLENGE");
        renderExperimentChallenge(challenges[nextIndex]);
        startWitness(challenges[nextIndex].id, challenges[nextIndex].constraint);
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
    setInsights([]);
    startCamera();
    appendMessage({ role: "user", type: "intent", text: val.trim() });
    if (intentInputRef.current) intentInputRef.current.value = "";
    const match = findMatchingContext(val.trim());
    if (match) {
      activeContextIdRef.current = match.context.id;
      recordCtxIntent(match.context.id, val.trim());
    } else {
      const ctx = createDevContext({ intent: val.trim() });
      activeContextIdRef.current = ctx.id;
    }
    setContexts(listSummaries());
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
  // Coach Witness — synchronous, high-trust, no API
  // -------------------------------------------------------------------------

  function fireCoachWitness(event: ReturnType<typeof coachTapEvent>) {
    record(event);
    setWitnessStatus("RECORDED");
    appendMessage({ role: "axis", type: "witness", text: `Coach: ${event.claim.summary}` });
  }

  function handleCoachTap(tap: CoachTap) {
    const c = challengesRef.current[challengeIndex];
    if (!c) return;
    fireCoachWitness(coachTapEvent(sessionIdRef.current, c.id, tap));
  }

  function handleCoachNote() {
    const note = coachNoteRef.current?.value?.trim();
    if (!note) return;
    const c = challengesRef.current[challengeIndex];
    if (!c) return;
    fireCoachWitness(coachNoteEvent(sessionIdRef.current, c.id, note));
    if (coachNoteRef.current) coachNoteRef.current.value = "";
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
        showThinking(() => startApiExperiment(expansionConstraintRef.current!));
      } else {
        showThinking(() => runExpansion(intentRef.current || val.trim()));
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
    cameraWitnessRef.current = null; // discard in-flight witness — session is ending
    clearTimeout(thinkingTimerRef.current ?? undefined);
    clearTimeout(witnessTimerRef.current ?? undefined);
    stopVoice();
    setInsights([]);
    setWitnessText(null);
    setWitnessStatus(cameraStatus === "ON" ? "READY" : "QUIET");
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
  // Show thread view once any message exists, or while thinking.
  const inThread = messages.length > 0 || phase === "THINKING";
  const witnessStatusText = witnessText ?? `Witness: ${witnessStatus.toLowerCase()}`;

  return (
    <main className="shell">
      <ContextSidebar
        contexts={contexts}
        activeId={activeContextIdRef.current ?? undefined}
        isOpen={sidebarOpen}
        onSelect={(ctx) => { activeContextIdRef.current = ctx.id; setSidebarOpen(false); }}
        onClose={() => setSidebarOpen(false)}
      />
      <video ref={videoBgRef} muted playsInline aria-hidden className="cam-bg" />
      <div className="capability-rail" aria-label="Axis capabilities">
        <button
          className={`cap-btn${cameraStatus === "ON" ? " active" : ""}`}
          onClick={startCamera}
          type="button"
        >
          <CameraIcon aria-hidden className="cap-icon" size={15} strokeWidth={1.8} />
          <span>Camera</span>
          <strong>{cameraStatus}</strong>
        </button>
        <button className="cap-btn" onClick={openUpload} type="button">
          <Upload aria-hidden className="cap-icon" size={15} strokeWidth={1.8} />
          <span>Upload</span>
          <strong>READY</strong>
        </button>
        <button
          className={`cap-btn${voiceActive ? " active" : ""}`}
          disabled={!isVoiceSupported}
          onClick={toggleVisibleVoice}
          type="button"
        >
          <Mic aria-hidden className="cap-icon" size={15} strokeWidth={1.8} />
          <span>Voice</span>
          <strong>{voiceActive ? "LIVE" : isVoiceSupported ? "READY" : "OFF"}</strong>
        </button>
        <div className={`cap-status ${witnessStatus.toLowerCase()}`}>
          <Eye aria-hidden className="cap-icon" size={15} strokeWidth={1.8} />
          <span>Witness</span>
          <strong>{witnessStatusText}</strong>
        </div>
      </div>

      {/* ── OPENING STATE ──────────────────────────────────────────────── */}
      {!inThread && (
        <div className="opening">
          <button
            aria-label="Open context history"
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(true)}
            type="button"
          >
            ☰
          </button>
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
      {/* Context in progress. One thread, one input at bottom. */}
      {inThread && (
        <div className="thread-view">

          {/* Minimal header — only exit */}
          <div className="thread-hd">
            <div className="hd-nav">
              <button
                aria-label="Open context history"
                className="sidebar-toggle"
                onClick={() => setSidebarOpen(true)}
                type="button"
              >
                ☰
              </button>
              <button
                aria-label="New session"
                className="exit-btn"
                onClick={handleExit}
                type="button"
              >
                ←
              </button>
            </div>
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

            {insights.length > 0 && (
              <div className="insight-stack" aria-label="Insights">
                {insights.map((insight) => (
                  <article className="insight-object" key={insight.id}>
                    <span className="insight-label">Insight</span>
                    <h2>{insight.title}</h2>
                    <p className="insight-text">{insight.insight}</p>
                    {insight.mentalModel ? (
                      <div className="insight-block">
                        <span>Mental Model</span>
                        <p>{insight.mentalModel}</p>
                      </div>
                    ) : null}
                    {insight.experimentCandidate ? (
                      <div className="insight-block">
                        <span>Experiment</span>
                        <p>{insight.experimentCandidate}</p>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}

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
            {phase === "INSIGHTS" && (
              <>
                {insights[0]?.experimentCandidate && (
                  <button className="try-it-btn" onClick={handleTryExperiment} type="button">
                    Try it →
                  </button>
                )}
                <InputBox
                  key="insights"
                  inputRef={observationInputRef}
                  onSubmit={handleInsightsSubmit}
                  onMicToggle={handleInsightsMicToggle}
                  voiceActive={voiceActive}
                  isVoiceSupported={isVoiceSupported}
                  placeholder="dig deeper…"
                />
              </>
            )}
            {phase === "CHALLENGE" && (
              <>
                <InputBox
                  key="obs"
                  inputRef={observationInputRef}
                  onSubmit={handleObsSubmit}
                  onMicToggle={handleObsMicToggle}
                  voiceActive={voiceActive}
                  isVoiceSupported={isVoiceSupported}
                  placeholder="what happened…"
                />
                <div className="coach-strip">
                  <span className="coach-lbl">Coach</span>
                  <div className="coach-taps">
                    {COACH_TAPS.map((tap) => (
                      <button
                        key={tap}
                        className="coach-tap"
                        onClick={() => handleCoachTap(tap)}
                        type="button"
                      >
                        {tap}
                      </button>
                    ))}
                  </div>
                  <div className="coach-note-row">
                    <input
                      ref={coachNoteRef}
                      className="coach-note"
                      placeholder="note…"
                      type="text"
                      onKeyDown={(e) => { if (e.key === "Enter") handleCoachNote(); }}
                    />
                    <button className="coach-send" onClick={handleCoachNote} type="button">
                      ↑
                    </button>
                  </div>
                </div>
              </>
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

        @media (min-width: 768px) {
          .shell {
            margin-left: 256px;
          }
        }

        .sidebar-toggle {
          align-items: center;
          background: transparent;
          border: 0;
          color: rgba(247, 247, 242, 0.2);
          cursor: pointer;
          display: flex;
          font-size: 17px;
          height: 36px;
          justify-content: center;
          line-height: 1;
          padding: 0;
          transition: color 0.12s;
          width: 36px;
        }

        .sidebar-toggle:hover {
          color: rgba(247, 247, 242, 0.5);
        }

        /* Hide toggle on desktop — sidebar is always visible */
        @media (min-width: 768px) {
          .sidebar-toggle {
            display: none;
          }
        }

        .hd-nav {
          align-items: center;
          display: flex;
          gap: 2px;
        }

        .capability-rail {
          align-items: stretch;
          border-bottom: 1px solid rgba(247, 247, 242, 0.05);
          display: grid;
          gap: 1px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          position: relative;
          z-index: 2;
        }

        .cap-btn,
        .cap-status {
          background: rgba(247, 247, 242, 0.025);
          border: 0;
          border-right: 1px solid rgba(247, 247, 242, 0.05);
          color: rgba(247, 247, 242, 0.42);
          display: flex;
          flex-direction: column;
          font: inherit;
          gap: 3px;
          justify-content: center;
          min-height: 52px;
          min-width: 0;
          padding: 9px 12px;
          text-align: left;
        }

        .cap-btn {
          cursor: pointer;
        }

        .cap-btn:hover {
          background: rgba(247, 247, 242, 0.045);
          color: rgba(247, 247, 242, 0.62);
        }

        .cap-btn:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .cap-icon {
          color: rgba(247, 247, 242, 0.24);
          margin-bottom: 1px;
        }

        .cap-btn.active .cap-icon,
        .cap-status.watching .cap-icon,
        .cap-status.saving .cap-icon,
        .cap-status.recorded .cap-icon {
          color: rgba(189, 255, 91, 0.72);
        }

        .cap-btn span,
        .cap-status span {
          color: rgba(247, 247, 242, 0.22);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .cap-btn strong,
        .cap-status strong {
          color: rgba(247, 247, 242, 0.58);
          display: block;
          font-size: 12px;
          font-weight: 650;
          line-height: 1.2;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .cap-btn.active strong,
        .cap-status.watching strong,
        .cap-status.saving strong,
        .cap-status.recorded strong {
          color: rgba(189, 255, 91, 0.78);
        }

        .cap-status {
          border-right: 0;
          grid-column: 1 / -1;
        }

        @media (min-width: 860px) {
          .capability-rail {
            grid-template-columns: repeat(3, 112px) minmax(180px, 1fr);
          }

          .cap-status {
            grid-column: auto;
          }
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
        /* Opening state                                                       */
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
        /* Insight Objects                                                     */
        /* ------------------------------------------------------------------ */

        .insight-stack {
          align-self: stretch;
          display: grid;
          gap: 10px;
          margin: 14px 0 8px;
        }

        .insight-object {
          background: rgba(247, 247, 242, 0.035);
          border: 1px solid rgba(247, 247, 242, 0.08);
          border-radius: 8px;
          padding: 15px 16px 16px;
        }

        .insight-label {
          color: rgba(189, 255, 91, 0.68);
          display: block;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.12em;
          line-height: 1;
          margin-bottom: 10px;
          text-transform: uppercase;
        }

        .insight-object h2 {
          color: #f7f7f2;
          font-size: clamp(22px, 4vw, 34px);
          font-weight: 650;
          line-height: 1.08;
          margin: 0;
        }

        .insight-text {
          color: rgba(247, 247, 242, 0.72);
          font-size: 16px;
          line-height: 1.45;
          margin: 12px 0 0;
        }

        .insight-block {
          border-top: 1px solid rgba(247, 247, 242, 0.07);
          margin-top: 14px;
          padding-top: 12px;
        }

        .insight-block span {
          color: rgba(247, 247, 242, 0.28);
          display: block;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.12em;
          margin-bottom: 6px;
          text-transform: uppercase;
        }

        .insight-block p {
          color: rgba(247, 247, 242, 0.64);
          font-size: 15px;
          line-height: 1.45;
          margin: 0;
        }

        /* Try it — explicit action from INSIGHTS phase */
        .try-it-btn {
          background: rgba(189, 255, 91, 0.08);
          border: 1px solid rgba(189, 255, 91, 0.22);
          border-radius: 8px;
          color: rgba(189, 255, 91, 0.72);
          cursor: pointer;
          font: inherit;
          font-size: 14px;
          font-weight: 650;
          letter-spacing: 0.03em;
          margin-bottom: 10px;
          min-height: 44px;
          padding: 0 18px;
          text-align: left;
          transition: background 0.15s, border-color 0.15s, color 0.15s;
          width: 100%;
        }

        .try-it-btn:hover {
          background: rgba(189, 255, 91, 0.13);
          border-color: rgba(189, 255, 91, 0.38);
          color: rgba(189, 255, 91, 0.92);
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

        /* ------------------------------------------------------------------ */
        /* Coach Witness strip                                                 */
        /* Tiny, secondary. Below the athlete input. Not the focus.           */
        /* ------------------------------------------------------------------ */

        .coach-strip {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid rgba(247, 247, 242, 0.04);
        }

        .coach-lbl {
          color: rgba(247, 247, 242, 0.18);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          flex-shrink: 0;
        }

        .coach-taps {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          flex: 1;
        }

        .coach-tap {
          background: rgba(247, 247, 242, 0.04);
          border: 1px solid rgba(247, 247, 242, 0.08);
          border-radius: 20px;
          color: rgba(247, 247, 242, 0.3);
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          font-weight: 500;
          line-height: 1;
          padding: 4px 10px;
          transition: background 0.1s, color 0.1s, border-color 0.1s;
          white-space: nowrap;
        }

        .coach-tap:hover {
          background: rgba(247, 247, 242, 0.08);
          border-color: rgba(247, 247, 242, 0.18);
          color: rgba(247, 247, 242, 0.65);
        }

        .coach-note-row {
          align-items: center;
          background: rgba(247, 247, 242, 0.03);
          border: 1px solid rgba(247, 247, 242, 0.06);
          border-radius: 8px;
          display: flex;
          gap: 2px;
          padding: 3px 4px 3px 8px;
          width: 100%;
        }

        .coach-note {
          background: transparent;
          border: 0;
          color: rgba(247, 247, 242, 0.4);
          flex: 1;
          font: inherit;
          font-size: 12px;
          min-width: 0;
          outline: none;
          padding: 2px 0;
        }

        .coach-note::placeholder {
          color: rgba(247, 247, 242, 0.14);
        }

        .coach-send {
          align-items: center;
          background: transparent;
          border: 0;
          border-radius: 5px;
          color: rgba(247, 247, 242, 0.2);
          cursor: pointer;
          display: flex;
          font: inherit;
          font-size: 12px;
          height: 22px;
          justify-content: center;
          padding: 0;
          transition: color 0.1s;
          width: 22px;
        }

        .coach-send:hover {
          color: rgba(247, 247, 242, 0.5);
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
