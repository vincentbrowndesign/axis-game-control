"use client";

import type { User } from "@supabase/supabase-js";
import { Mic, Paperclip } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DevSidebar } from "../../components/axis/dev-sidebar";
import {
  createDevThread,
  EMPTY_THREAD_MEMORY,
  listBreakthroughs,
  listDevThreads,
  loadDevEntries,
  loadThreadMemory,
  saveBreakthrough,
  saveDevEntry,
  saveThreadMemory,
  touchDevThread,
  type Breakthrough,
  type DevThread,
  type ThreadEvidenceItem,
  type ThreadExperiment,
  type ThreadHypothesis,
  type ThreadMemory,
} from "../../lib/axis-dev-persistence";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase = "IDLE" | "LOADING" | "RESULTS";

type CardType = "Mental Model" | "Demonstration" | "Experiment" | "Witness";

interface StateUpdate {
  focus?: string;
  currentBottleneck?: string;
  newHypotheses?: Array<{ id: string; statement: string; confidence: number }>;
  confirmedHypothesisIds?: string[];
  rejectedHypothesisIds?: string[];
  newEvidence?: string[];
  newBreakthroughs?: string[];
  resolvedQuestions?: string[];
}

interface InsightResponse {
  insight: string;
  confidence: number;
  reasoning: string;
  nextRequiredCard: CardType;
  mentalModel?: string;
  demonstration?: {
    currentState: string;
    targetState: string;
    keyDifference: string;
    executionCue: string;
  };
  experimentCandidate?: string;
  witnessPrompt?: string;
  clarificationQuestion?: string;
  stateUpdate?: StateUpdate;
}

interface MentalModelCard {
  mentalModel: string;
  rule: string;
  failurePattern: string;
  recognitionCue: string;
}

interface DemonstrationSpec {
  currentState: string;
  targetState: string;
  keyDifference: string;
  executionCue: string;
  commonFailure: string;
  recommendedViewpoints: string[];
  animationNotes: string;
  comparisonRequired: boolean;
  complexity: "Beginner" | "Intermediate" | "Advanced";
}

interface ExperimentSpec {
  hypothesis: string;
  constraint: string;
  repetitions: string;
  successCriteria: string;
  failureCriteria: string;
  evidenceRequired: string;
  expectedLearning: string;
}

type WitnessType = "Camera" | "Computer Vision" | "Coach" | "User" | "Research" | "Audio" | "Sensor";
type ConfidenceImportance = "Critical" | "High" | "Medium" | "Low";

interface WitnessRequirement {
  witness: WitnessType;
  purpose: string;
  expectedClaim: string;
  confidenceImportance: ConfidenceImportance;
  requiredEvidence: string;
}

interface WitnessPlan {
  witnesses: WitnessRequirement[];
}

interface WitnessReviewResult {
  claim: string;
  confidence: number;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  verdict: "PASS" | "FAIL" | "INCONCLUSIVE";
  recommendedNextCard: CardType;
}

interface AdjustmentResult {
  decision: string;
  reason: string;
  expectedBenefit: string;
  nextCard: CardType | null;
}

interface OrchestratorDecision {
  nextCard: CardType | null;
  reason: string;
  requiredInputs: string[];
  expectedOutcome: string;
}

interface EvidenceCard {
  source: string;
  summary: string;
  relevance: string;
  url?: string;
}

interface Attachment {
  name: string;
  url: string;
  type: string;
}

interface DeepModelResult {
  deepModel: string;
  leveragePoint: string;
  caution?: string;
}

interface ThreadEntry {
  id: string;
  intent: string;
  response: InsightResponse | null;
  mentalModelCard: MentalModelCard | null;
  demonstrationSpec: DemonstrationSpec | null;
  experimentSpec: ExperimentSpec | null;
  witnessPlan: WitnessPlan | null;
  witnessReview: WitnessReviewResult | null;
  adjustment: AdjustmentResult | null;
  orchestration: OrchestratorDecision | null;
  evidence: EvidenceCard[];
  deepModel: DeepModelResult | null;
  attachment: Attachment | null;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

let _ctr = 0;
const uid = () => (++_ctr).toString(36);

type AxisAuthState =
  | { status: "LOADING" }
  | { status: "SIGNED_OUT" }
  | { status: "SIGNED_IN"; userId: string; label: string; authType: string; isGuest: boolean };

function authReturnPath() {
  return "/axis";
}

function authUrl() {
  return `/auth?next=${encodeURIComponent(authReturnPath())}`;
}

function isGuestUser(user: User) {
  return Boolean((user as User & { is_anonymous?: boolean }).is_anonymous);
}

function userLabel(user: User) {
  if (isGuestUser(user)) return "Guest session";
  const metadata = user.user_metadata as Record<string, unknown>;
  const name = metadata.full_name ?? metadata.name;
  return typeof name === "string" && name.trim()
    ? name.trim()
    : user.email ?? "Axis account";
}

function userAuthType(user: User) {
  if (isGuestUser(user)) return "Guest";
  const provider = user.app_metadata?.provider;
  if (typeof provider === "string" && provider.trim()) {
    return provider === "email" ? "Email" : provider.charAt(0).toUpperCase() + provider.slice(1);
  }
  return "Account";
}

function authStateFromUser(user: User): AxisAuthState {
  return {
    status: "SIGNED_IN",
    userId: user.id,
    label: userLabel(user),
    authType: userAuthType(user),
    isGuest: isGuestUser(user),
  };
}

// ---------------------------------------------------------------------------
// Thread memory helpers
// ---------------------------------------------------------------------------

function applyStateUpdate(prev: ThreadMemory, update: StateUpdate): ThreadMemory {
  const next: ThreadMemory = { ...prev };

  if (update.focus && !next.focus) next.focus = update.focus;
  if (update.currentBottleneck) next.currentBottleneck = update.currentBottleneck;

  if (update.newHypotheses?.length) {
    const existingIds = new Set(next.hypotheses.map((h) => h.id));
    const toAdd: ThreadHypothesis[] = update.newHypotheses
      .filter((h) => !existingIds.has(h.id))
      .map((h) => ({
        id: h.id,
        statement: h.statement,
        status: "active" as const,
        confidence: h.confidence,
        evidence: [],
        createdAt: new Date().toISOString(),
      }));
    next.hypotheses = [...next.hypotheses, ...toAdd];
  }

  if (update.confirmedHypothesisIds?.length) {
    const confirmed = new Set(update.confirmedHypothesisIds);
    next.hypotheses = next.hypotheses.map((h) =>
      confirmed.has(h.id) ? { ...h, status: "confirmed" as const } : h,
    );
  }

  if (update.rejectedHypothesisIds?.length) {
    const rejected = new Set(update.rejectedHypothesisIds);
    next.hypotheses = next.hypotheses.map((h) =>
      rejected.has(h.id) ? { ...h, status: "rejected" as const } : h,
    );
  }

  if (update.newEvidence?.length) {
    const existingObs = new Set(next.evidence.map((e) => e.observation));
    const toAdd: ThreadEvidenceItem[] = update.newEvidence
      .filter((obs) => !existingObs.has(obs))
      .map((obs) => ({
        id: uid(),
        observation: obs,
        source: "user_report" as const,
        confidence: 0.8,
        createdAt: new Date().toISOString(),
      }));
    next.evidence = [...next.evidence, ...toAdd];
  }

  if (update.newBreakthroughs?.length) {
    const existingBts = new Set(next.breakthroughs);
    const toAdd = update.newBreakthroughs.filter((b) => !existingBts.has(b));
    next.breakthroughs = [...next.breakthroughs, ...toAdd];
  }

  if (update.resolvedQuestions?.length) {
    const resolved = new Set(update.resolvedQuestions);
    next.openQuestions = next.openQuestions.filter((q) => !resolved.has(q));
  }

  return next;
}

function updateMemoryFromEntry(prev: ThreadMemory, entry: ThreadEntry): ThreadMemory {
  const next: ThreadMemory = { ...prev };

  // Surface clarification questions as open questions
  if (entry.response?.clarificationQuestion) {
    const q = entry.response.clarificationQuestion;
    if (!next.openQuestions.includes(q)) {
      next.openQuestions = [...next.openQuestions, q];
    }
  }

  // Track experiment candidates so witness review can close them
  if (entry.experimentSpec?.hypothesis) {
    const alreadyTracked = next.experiments.some(
      (e) => e.hypothesis === entry.experimentSpec!.hypothesis,
    );
    if (!alreadyTracked) {
      const exp: ThreadExperiment = {
        id: entry.id,
        hypothesis: entry.experimentSpec.hypothesis,
        status: "open",
        createdAt: new Date().toISOString(),
      };
      next.experiments = [...next.experiments, exp];
    }
  }

  return next;
}

function updateMemoryFromWitnessReview(
  prev: ThreadMemory,
  entry: ThreadEntry,
  review: { verdict: "PASS" | "FAIL" | "INCONCLUSIVE"; claim: string },
): ThreadMemory {
  const next: ThreadMemory = { ...prev };

  // Resolve the open experiment this review corresponds to
  next.experiments = next.experiments.map((e) =>
    e.id === entry.id
      ? {
          ...e,
          status: review.verdict === "PASS"
            ? "completed"
            : review.verdict === "FAIL"
              ? "failed"
              : "inconclusive",
          verdict: review.verdict,
          result: review.claim,
        }
      : e,
  );

  // PASS witness reviews become confirmed breakthroughs
  if (review.verdict === "PASS" && entry.response?.insight) {
    const b = entry.response.insight;
    if (!next.breakthroughs.includes(b)) {
      next.breakthroughs = [...next.breakthroughs, b];
    }
  }

  // Close open questions that the witness review resolved
  if (review.verdict !== "INCONCLUSIVE") {
    next.openQuestions = next.openQuestions.filter(
      (q) => !entry.response?.clarificationQuestion || q !== entry.response.clarificationQuestion,
    );
  }

  return next;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const LOADING_LABELS = [
  "Finding the main idea…",
  "Getting the example ready…",
  "Building something to try…",
  "Getting your work ready…",
] as const;

const REVIEW_LABELS = [
  "Looking at results…",
  "Updating the next step…",
  "Choosing the next step…",
] as const;

const authGateStyles = `
  .auth-root {
    align-items: center;
    background: #fafaf9;
    color: #1a1a18;
    display: flex;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    justify-content: center;
    min-height: 100dvh;
  }

  .auth-gate {
    align-items: flex-start;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 24px;
  }

  .auth-wordmark {
    color: rgba(26, 26, 24, 0.28);
    font-size: 12px;
    font-weight: 750;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .auth-gate p,
  .auth-gate strong {
    color: rgba(26, 26, 24, 0.58);
    font-size: 15px;
    font-weight: 500;
    margin: 0;
  }

  .auth-gate button {
    background: #1a1a18;
    border: 0;
    border-radius: 10px;
    color: #fafaf9;
    cursor: pointer;
    font: inherit;
    font-size: 14px;
    height: 38px;
    padding: 0 18px;
  }
`;

export default function AxisPage() {
  const [phase, setPhase] = useState<Phase>("IDLE");
  const [thread, setThread] = useState<ThreadEntry[]>([]);
  const [activeIntent, setActiveIntent] = useState("");
  const [voicePhase, setVoicePhase] = useState<"OFF" | "LISTENING" | "PROCESSING">("OFF");
  const [pendingAttachment, setPendingAttachment] = useState<Attachment | null>(null);
  const [isVoiceSupported, setIsVoiceSupported] = useState(false);
  const [witnessInputs, setWitnessInputs] = useState<Record<string, string>>({});
  const [reviewLoadingId, setReviewLoadingId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState<string>(LOADING_LABELS[0]);
  const [reviewLabel, setReviewLabel] = useState<string>(REVIEW_LABELS[0]);
  const [revealMap, setRevealMap] = useState<Record<string, number>>({});

  // ── Persistence + auth ──────────────────────────────────────────────────
  const [authState, setAuthState] = useState<AxisAuthState>({ status: "LOADING" });
  const [userId, setUserId] = useState<string | null>(null);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [threadList, setThreadList] = useState<DevThread[]>([]);
  const [breakthroughList, setBreakthroughList] = useState<Breakthrough[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [threadMemory, setThreadMemory] = useState<ThreadMemory>({ ...EMPTY_THREAD_MEMORY });
  // Supabase entry IDs keyed by local ThreadEntry.id (so we can reference them for breakthroughs)
  const entryIdMapRef = useRef<Record<string, string>>({});

  const inputRef = useRef<HTMLInputElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const loadingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reviewTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevThreadLenRef = useRef(0);

  useEffect(() => {
    setIsVoiceSupported(
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window),
    );
    return () => {
      recognitionRef.current?.abort();
      abortRef.current?.abort();
      objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [thread, phase, revealMap]);

  // Cycle loading labels while a query is in flight
  useEffect(() => {
    if (phase !== "LOADING") {
      if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
      return;
    }
    setLoadingLabel(LOADING_LABELS[0]);
    let idx = 0;
    loadingTimerRef.current = setInterval(() => {
      idx = Math.min(idx + 1, LOADING_LABELS.length - 1);
      setLoadingLabel(LOADING_LABELS[idx]);
    }, 1100);
    return () => { if (loadingTimerRef.current) clearInterval(loadingTimerRef.current); };
  }, [phase]);

  // Cycle review labels while witness review is in flight
  useEffect(() => {
    if (!reviewLoadingId) {
      if (reviewTimerRef.current) clearInterval(reviewTimerRef.current);
      return;
    }
    setReviewLabel(REVIEW_LABELS[0]);
    let idx = 0;
    reviewTimerRef.current = setInterval(() => {
      idx = Math.min(idx + 1, REVIEW_LABELS.length - 1);
      setReviewLabel(REVIEW_LABELS[idx]);
    }, 1800);
    return () => { if (reviewTimerRef.current) clearInterval(reviewTimerRef.current); };
  }, [reviewLoadingId]);

  // Auth gate + load sidebar data on mount
  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthState({ status: "SIGNED_OUT" });
      window.location.replace(authUrl());
      return;
    }

    supabase.auth.getUser().then(async ({ data, error }) => {
      if (cancelled) return;
      if (error || !data.user) {
        setAuthState({ status: "SIGNED_OUT" });
        window.location.replace(authUrl());
        return;
      }
      setAuthState(authStateFromUser(data.user));
      setUserId(data.user.id);
      const [threads, bts] = await Promise.all([
        listDevThreads(),
        listBreakthroughs(),
      ]);
      if (cancelled) return;
      setThreadList(threads);
      setBreakthroughList(bts);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reveal insight immediately when an entry arrives; further cards advance on user action
  useEffect(() => {
    if (thread.length <= prevThreadLenRef.current) return;
    prevThreadLenRef.current = thread.length;
    const id = thread[thread.length - 1]?.id;
    if (!id) return;
    setRevealMap(prev => ({ ...prev, [id]: 1 }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.length]);

  function advance(id: string) {
    setRevealMap(prev => ({ ...prev, [id]: (prev[id] ?? 1) + 1 }));
  }

  // -------------------------------------------------------------------------
  // Camera + Upload — native file inputs, no navigation
  // -------------------------------------------------------------------------

  function handleFileSelected(file: File) {
    if (pendingAttachment) URL.revokeObjectURL(pendingAttachment.url);
    const url = URL.createObjectURL(file);
    objectUrlsRef.current.push(url);
    setPendingAttachment({ name: file.name, url, type: file.type });
  }

  // ── Persistence helpers ─────────────────────────────────────────────────

  async function persistEntry(localId: string, entry: ThreadEntry, threadId: string, position: number) {
    const dbId = await saveDevEntry({
      threadId,
      intent: entry.intent,
      insight: entry.response?.insight,
      reasoning: entry.response?.reasoning,
      mentalModel: entry.mentalModelCard?.mentalModel,
      demonstration: entry.demonstrationSpec
        ? {
            currentState: entry.demonstrationSpec.currentState,
            targetState: entry.demonstrationSpec.targetState,
            keyDifference: entry.demonstrationSpec.keyDifference,
            executionCue: entry.demonstrationSpec.executionCue,
          }
        : undefined,
      experiment: entry.experimentSpec?.hypothesis,
      confidence: entry.response?.confidence,
      position,
    });
    if (dbId) entryIdMapRef.current[localId] = dbId;
    await touchDevThread(threadId);
    setThreadList(await listDevThreads());
  }

  async function loadThread(threadId: string) {
    const entries = await loadDevEntries(threadId);
    if (!entries.length) return;
    const reconstructed: ThreadEntry[] = entries.map((e) => ({
      id: e.id,
      intent: e.intent,
      response: e.insight
        ? {
            insight: e.insight,
            reasoning: e.reasoning ?? "",
            confidence: e.confidence ?? 0.8,
            nextRequiredCard: "Experiment" as CardType,
            mentalModel: e.mental_model ?? undefined,
            demonstration: e.demonstration as InsightResponse["demonstration"] ?? undefined,
            experimentCandidate: e.experiment ?? undefined,
          }
        : null,
      mentalModelCard: e.mental_model
        ? { mentalModel: e.mental_model, rule: "", failurePattern: "", recognitionCue: "" }
        : null,
      demonstrationSpec: e.demonstration
        ? { ...(e.demonstration as { currentState: string; targetState: string; keyDifference: string; executionCue: string }), commonFailure: "", recommendedViewpoints: [], animationNotes: "", comparisonRequired: false, complexity: "Intermediate" as const }
        : null,
      experimentSpec: e.experiment
        ? { hypothesis: e.experiment, constraint: "", repetitions: "", successCriteria: "", failureCriteria: "", evidenceRequired: "", expectedLearning: "" }
        : null,
      witnessPlan: null,
      witnessReview: null,
      adjustment: null,
      orchestration: null,
      evidence: [],
      deepModel: null,
      attachment: null,
    }));
    // Mark all loaded entries as fully revealed
    const newReveal: Record<string, number> = {};
    reconstructed.forEach((e) => { newReveal[e.id] = 4; });
    setRevealMap(newReveal);
    setThread(reconstructed);
    setCurrentThreadId(threadId);
    setIsActive(true);
    prevThreadLenRef.current = reconstructed.length;
    const memory = await loadThreadMemory(threadId);
    setThreadMemory(memory);
  }

  async function markBreakthrough(localEntryId: string, text: string) {
    const dbEntryId = entryIdMapRef.current[localEntryId];
    const id = await saveBreakthrough(text, currentThreadId ?? undefined, dbEntryId);
    if (id) {
      setBreakthroughList(await listBreakthroughs());
    }
  }

  function openAttach() {
    attachInputRef.current?.click();
  }

  function removePendingAttachment() {
    if (pendingAttachment) URL.revokeObjectURL(pendingAttachment.url);
    setPendingAttachment(null);
  }

  // -------------------------------------------------------------------------
  // Voice
  // -------------------------------------------------------------------------

  function toggleVoice() {
    if (voicePhase !== "OFF") {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      setVoicePhase("OFF");
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechAPI) return;
    const rec: SpeechRecognition = new SpeechAPI();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    let handled = false;
    setVoicePhase("LISTENING");
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const result = e.results[0];
      const text = result[0].transcript;
      if (inputRef.current) inputRef.current.value = text;
      if (result.isFinal && !handled) {
        handled = true;
        recognitionRef.current = null;
        setVoicePhase("PROCESSING");
        void run(text);
        setTimeout(() => setVoicePhase("OFF"), 900);
      }
    };
    rec.onerror = () => { if (!handled) setVoicePhase("OFF"); };
    rec.onend = () => { if (!handled) setVoicePhase("OFF"); };
    recognitionRef.current = rec;
    rec.start();
  }

  // -------------------------------------------------------------------------
  // Core: intent → OpenAI + Tavily in parallel → insight cards
  // -------------------------------------------------------------------------

  async function run(intentText: string) {
    const text = intentText.trim();
    const attachment = pendingAttachment;
    const hasText = text.length > 0;
    const hasAttachment = attachment != null;
    if ((!hasText && !hasAttachment) || phase === "LOADING") return;
    const val = hasText ? text : "Uploaded evidence";
    if (inputRef.current) inputRef.current.value = "";

    if (!isActive) setIsActive(true);

    setPendingAttachment(null);

    setActiveIntent(val);
    setPhase("LOADING");

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const [understandRes, researchRes] = await Promise.all([
        fetch("/api/axis/understand", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intent: val,
            threadMemory: {
              focus: threadMemory.focus,
              currentBottleneck: threadMemory.currentBottleneck,
              hypotheses: threadMemory.hypotheses,
              experiments: threadMemory.experiments,
              evidence: threadMemory.evidence,
              breakthroughs: threadMemory.breakthroughs,
              openQuestions: threadMemory.openQuestions,
            },
          }),
          signal: ctrl.signal,
        }),
        fetch("/api/axis/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: val }),
          signal: ctrl.signal,
        }),
      ]);

      const response: InsightResponse | null = understandRes.ok
        ? await understandRes.json() as InsightResponse
        : null;
      const researchData = researchRes.ok ? await researchRes.json() : { evidence: [] };

      const evidence: EvidenceCard[] = Array.isArray(researchData.evidence)
        ? researchData.evidence
        : [];

      // Apply state update from model NOW — before building the entry.
      // This is the key architectural fix: state changes driven by user messages
      // propagate immediately so the next message inherits the updated hypotheses.
      let nextMemory = threadMemory;
      if (response?.stateUpdate) {
        nextMemory = applyStateUpdate(threadMemory, response.stateUpdate);
        setThreadMemory(nextMemory);
      }

      // Build all four cards directly from the unified understand response
      let mentalModelCard: MentalModelCard | null = null;
      let demonstrationSpec: DemonstrationSpec | null = null;
      let experimentSpec: ExperimentSpec | null = null;
      let witnessPlan: WitnessPlan | null = null;

      if (response?.insight) {
        if (response.mentalModel) {
          mentalModelCard = {
            mentalModel: response.mentalModel,
            rule: "",
            failurePattern: "",
            recognitionCue: "",
          };
        }
        if (response.demonstration) {
          demonstrationSpec = {
            ...response.demonstration,
            commonFailure: "",
            recommendedViewpoints: [],
            animationNotes: "",
            comparisonRequired: false,
            complexity: "Intermediate",
          };
        }
        if (response.experimentCandidate) {
          experimentSpec = {
            hypothesis: response.experimentCandidate,
            constraint: "",
            repetitions: "",
            successCriteria: "",
            failureCriteria: "",
            evidenceRequired: "",
            expectedLearning: "",
          };
        }
      }

      // Deep Model — fired concurrently, non-fatal
      const deepModelPromise: Promise<DeepModelResult | null> = response?.insight
        ? fetch("/api/axis/deep-model", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              intent: val,
              insight: response.insight,
              discoveries: evidence.map((e) => ({
                statement: e.summary,
                relevance: e.relevance,
                source: e.source,
              })),
            }),
            signal: ctrl.signal,
          })
            .then((r) => (r.ok ? (r.json() as Promise<DeepModelResult>) : null))
            .catch(() => null)
        : Promise.resolve(null);

      const deepModel = await deepModelPromise;

      const entry: ThreadEntry = {
        id: uid(),
        intent: val,
        response,
        mentalModelCard,
        demonstrationSpec,
        experimentSpec,
        witnessPlan,
        witnessReview: null,
        adjustment: null,
        orchestration: null,
        evidence,
        deepModel,
        attachment,
      };

      setThread((prev) => {
        const next = [...prev, entry];

        // Persist to Supabase (fire-and-forget; non-fatal)
        if (userId) {
          void (async () => {
            let threadId = currentThreadId;
            if (!threadId) {
              threadId = await createDevThread(val.slice(0, 120));
              if (threadId) setCurrentThreadId(threadId);
            }
            if (threadId) {
              await persistEntry(entry.id, entry, threadId, next.length - 1);
              // Layer open-question + experiment tracking on top of the
              // stateUpdate already applied synchronously above.
              const withEntryMeta = updateMemoryFromEntry(nextMemory, entry);
              setThreadMemory(withEntryMeta);
              await saveThreadMemory(threadId, withEntryMeta);
            }
          })();
        }

        return next;
      });
      setPhase("RESULTS");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setPhase(thread.length > 0 ? "RESULTS" : "IDLE");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = inputRef.current?.value ?? "";
    void run(val);
  }

  function startNewThread() {
    abortRef.current?.abort();
    setThread([]);
    setCurrentThreadId(null);
    setThreadMemory({ ...EMPTY_THREAD_MEMORY });
    setRevealMap({});
    setPhase("IDLE");
    setIsActive(false);
    prevThreadLenRef.current = 0;
    entryIdMapRef.current = {};
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleSignIn() {
    window.location.replace(authUrl());
  }

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    abortRef.current?.abort();
    recognitionRef.current?.abort();
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
    entryIdMapRef.current = {};
    prevThreadLenRef.current = 0;
    setThread([]);
    setCurrentThreadId(null);
    setThreadList([]);
    setBreakthroughList([]);
    setRevealMap({});
    setPendingAttachment(null);
    setIsActive(false);
    setPhase("IDLE");
    setUserId(null);
    setAuthState({ status: "SIGNED_OUT" });
    if (inputRef.current) inputRef.current.value = "";
    try {
      await supabase?.auth.signOut();
    } finally {
      window.location.replace(authUrl());
    }
  }

  async function reviewWitness(entry: ThreadEntry) {
    const text = (witnessInputs[entry.id] ?? "").trim();
    if (!text || !entry.response?.insight || reviewLoadingId) return;

    const observations = text.split("\n").map((l) => l.trim()).filter(Boolean);
    setReviewLoadingId(entry.id);
    try {
      const res = await fetch("/api/axis/witness-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insight: entry.response.insight,
          reasoning: entry.response.reasoning,
          observations,
        }),
      });
      if (!res.ok) { setReviewLoadingId(null); return; }

      const review = await res.json() as WitnessReviewResult;
      setThread((prev) =>
        prev.map((e) => e.id === entry.id ? { ...e, witnessReview: review } : e),
      );

      // Update thread memory from witness result (fire-and-forget; non-fatal)
      if (currentThreadId) {
        void (async () => {
          const updated = updateMemoryFromWitnessReview(threadMemory, entry, review);
          setThreadMemory(updated);
          await saveThreadMemory(currentThreadId, updated);
        })();
      }

      // Auto-chain adjustment engine
      let adjustment: AdjustmentResult | null = null;
      try {
        const adjRes = await fetch("/api/axis/adjustment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            insight: entry.response.insight,
            reasoning: entry.response.reasoning,
            review,
          }),
        });
        if (adjRes.ok) {
          adjustment = await adjRes.json() as AdjustmentResult;
          setThread((prev) =>
            prev.map((e) => e.id === entry.id ? { ...e, adjustment } : e),
          );
        }
      } catch { /* non-fatal */ }

      // Auto-chain orchestrator with full thread history
      if (adjustment) {
        try {
          const history = [
            { card: "Insight", outcome: `nextRequiredCard: ${entry.response.nextRequiredCard}, confidence: ${entry.response.confidence}` },
            entry.mentalModelCard ? { card: "Mental Model", outcome: `rule: ${entry.mentalModelCard.rule}` } : null,
            entry.demonstrationSpec ? { card: "Demonstration", outcome: `complexity: ${entry.demonstrationSpec.complexity}` } : null,
            entry.experimentSpec ? { card: "Experiment", outcome: `hypothesis: ${entry.experimentSpec.hypothesis}` } : null,
            entry.witnessPlan ? { card: "Witness", outcome: `plan: ${entry.witnessPlan.witnesses.map((w) => w.witness).join(", ")}` } : null,
            { card: "Witness Review", outcome: `${review.verdict}, confidence: ${review.confidence}` },
            { card: "Adjustment", outcome: `decision: ${adjustment.decision}` },
          ].filter((h): h is { card: string; outcome: string } => h !== null);

          const orchRes = await fetch("/api/axis/orchestrator", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              insight: entry.response.insight,
              reasoning: entry.response.reasoning,
              history,
            }),
          });
          if (orchRes.ok) {
            const orchestration = await orchRes.json() as OrchestratorDecision;
            setThread((prev) =>
              prev.map((e) => e.id === entry.id ? { ...e, orchestration } : e),
            );
          }
        } catch { /* non-fatal */ }
      }
    } catch { /* non-fatal */ }
    setReviewLoadingId(null);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const lastEntry = thread[thread.length - 1];
  const lastReveal = lastEntry ? (revealMap[lastEntry.id] ?? 0) : 0;
  const bottomPlaceholder = phase === "RESULTS" && lastReveal >= 4 && lastEntry?.experimentSpec
    ? "What happened?"
    : "What are you working on?";

  if (authState.status === "LOADING") {
    return (
      <main className="auth-root">
        <div className="auth-gate">
          <span className="auth-wordmark">Axis</span>
          <p>Checking session.</p>
        </div>
        <style jsx>{authGateStyles}</style>
      </main>
    );
  }

  if (authState.status === "SIGNED_OUT") {
    return (
      <main className="auth-root">
        <div className="auth-gate">
          <span className="auth-wordmark">Axis</span>
          <strong>Not signed in</strong>
          <button type="button" onClick={handleSignIn}>Sign In</button>
        </div>
        <style jsx>{authGateStyles}</style>
      </main>
    );
  }

  return (
    <main className="root">

      <DevSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeThreadId={currentThreadId}
        threads={threadList}
        breakthroughs={breakthroughList}
        authLabel={authState.isGuest ? "Guest session" : authState.label}
        authType={authState.authType}
        isGuest={authState.isGuest}
        onSelectThread={(id) => void loadThread(id)}
        onNewThread={startNewThread}
        onSignIn={handleSignIn}
        onSignOut={() => void handleSignOut()}
      />

      {/* ── HOME ────────────────────────────────────────────────────────── */}
      {!isActive && (
        <div className="home">
          <div className="home-hero">
            <span className="home-mark">Axis</span>
            <p className="home-q">What are you working on?</p>
          </div>
          <form className="home-form" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              className="home-input"
              placeholder="Describe what you're trying to improve…"
              type="text"
              spellCheck={false}
              autoComplete="off"
              enterKeyHint="send"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void run(inputRef.current?.value ?? "");
                }
              }}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
            {pendingAttachment && (
              <div className="attachment-pending">
                {pendingAttachment.type.startsWith("image/") ? (
                  <img className="attachment-thumb" src={pendingAttachment.url} alt={pendingAttachment.name} />
                ) : (
                  <span className="attachment-name">{pendingAttachment.name}</span>
                )}
                <button type="button" className="attachment-remove" onClick={removePendingAttachment} aria-label="Remove">×</button>
              </div>
            )}
            <div className="home-controls">
              <button
                className={`ctrl-btn${pendingAttachment ? " on" : ""}`}
                onClick={openAttach}
                type="button"
                aria-label="Attach"
              >
                <Paperclip size={15} strokeWidth={1.8} />
                <span>Attach</span>
              </button>
              <button
                className={`ctrl-btn${voicePhase === "LISTENING" ? " voice-listening" : voicePhase === "PROCESSING" ? " voice-processing" : ""}`}
                onClick={toggleVoice}
                type="button"
                aria-label={voicePhase === "LISTENING" ? "Listening" : voicePhase === "PROCESSING" ? "Processing" : "Voice"}
                disabled={!isVoiceSupported}
              >
                {voicePhase === "LISTENING" ? (
                  <><span className="voice-dot" /><span>Listening</span></>
                ) : voicePhase === "PROCESSING" ? (
                  <span>Processing…</span>
                ) : (
                  <><Mic size={15} strokeWidth={1.8} /><span>Voice</span></>
                )}
              </button>
              <button className="send-btn" type="submit" aria-label="Send">
                →
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── THREAD ──────────────────────────────────────────────────────── */}
      {isActive && (
        <div className="thread-shell">

          <header className="hd">
            <button
              className="sidebar-toggle"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open history"
              type="button"
            >
              ☰
            </button>
            <span className="wordmark">Axis</span>
            <div className="hd-right">
              <div className={`auth-chip${authState.isGuest ? " auth-chip--guest" : ""}`}>
                {authState.isGuest ? "Guest session" : `Signed in as ${authState.label}`}
              </div>
              {thread.length > 0 && thread[thread.length - 1]?.response?.insight && (
                <button
                  className="breakthrough-btn"
                  type="button"
                  onClick={() => {
                    const last = thread[thread.length - 1];
                    if (last?.response?.insight) {
                      void markBreakthrough(last.id, last.response.insight);
                    }
                  }}
                  title="Mark current insight as a breakthrough"
                >
                  ★
                </button>
              )}
            </div>
          </header>

          <div className="thread" ref={threadRef}>

            {thread.map((entry, i) => {
              const isCurrentEntry = i === thread.length - 1;
              const reveal = isCurrentEntry ? (revealMap[entry.id] ?? 0) : 4;
              const hasQuestion = Boolean(entry.response?.clarificationQuestion);
              const needsReview = entry.response?.nextRequiredCard === "Witness";
              return (
                <div key={entry.id} className="entry">

                  {i > 0 && <hr className="entry-divider" />}

                  {/* Intent echo */}
                  <p className="intent-echo">{entry.intent}</p>

                  {/* Attachment */}
                  {entry.attachment && (
                    <div className="entry-attachment">
                      {entry.attachment.type.startsWith("image/") ? (
                        <img className="entry-thumb" src={entry.attachment.url} alt={entry.attachment.name} />
                      ) : (
                        <span className="entry-file">{entry.attachment.name}</span>
                      )}
                    </div>
                  )}

                  {/* ── Level 1: Insight ───────────────────────────────────── */}
                  {reveal === 1 && entry.response && (
                    <>
                      {hasQuestion ? (
                        <article className="insight-card card-reveal">
                          <span className="teaching-label">Question</span>
                          <p className="ins-body">{entry.response.clarificationQuestion}</p>
                        </article>
                      ) : (
                        <article className="insight-card card-reveal">
                          <span className="teaching-label">Insight</span>
                          <p className="ins-body">{entry.response.insight}</p>
                        </article>
                      )}
                    </>
                  )}

                  {/* Advance: Insight → Mental Model */}
                  {reveal === 1 && !hasQuestion && entry.mentalModelCard && (
                    <button className="advance-btn" onClick={() => advance(entry.id)}>
                      Got it <span className="advance-arrow">→</span>
                    </button>
                  )}

                  {/* ── Level 2: Mental Model ──────────────────────────────── */}
                  {reveal === 2 && entry.mentalModelCard && (
                    <section className="next-card card-reveal" aria-label="The principle">
                      <span className="next-card-label">Principle</span>
                      <p className="mm-framework">{entry.mentalModelCard.mentalModel}</p>
                    </section>
                  )}

                  {/* Advance: Mental Model → Demonstration */}
                  {reveal === 2 && entry.demonstrationSpec && (
                    <button className="advance-btn" onClick={() => advance(entry.id)}>
                      Show me <span className="advance-arrow">→</span>
                    </button>
                  )}

                  {/* ── Level 3: Demonstration ─────────────────────────────── */}
                  {reveal === 3 && entry.demonstrationSpec && (
                    <section className="next-card card-reveal" aria-label="What it looks like">
                      <span className="next-card-label">Demonstration</span>
                      <div className="demo-body">
                        <p className="demo-state demo-state--now">{entry.demonstrationSpec.currentState}</p>
                        <span className="demo-arrow" aria-hidden>→</span>
                        <p className="demo-state demo-state--target">{entry.demonstrationSpec.targetState}</p>
                        {entry.demonstrationSpec.keyDifference && (
                          <p className="demo-diff">{entry.demonstrationSpec.keyDifference}</p>
                        )}
                        {entry.demonstrationSpec.executionCue && (
                          <p className="demo-cue">{entry.demonstrationSpec.executionCue}</p>
                        )}
                      </div>
                    </section>
                  )}

                  {/* Advance: Demonstration → Experiment ("Try it" — the pivot moment) */}
                  {reveal === 3 && entry.experimentSpec && (
                    <button className="advance-btn advance-btn--try" onClick={() => advance(entry.id)}>
                      Try it
                    </button>
                  )}

                  {/* ── Level 4: Experiment ────────────────────────────────── */}
                  {reveal === 4 && entry.experimentSpec && (
                    <section className="next-card card-reveal" aria-label="Try this">
                      <span className="next-card-label">Experiment</span>
                      <p className="exp-instruction">{entry.experimentSpec.hypothesis}</p>
                      {entry.experimentSpec.repetitions && (
                        <p className="exp-reps">{entry.experimentSpec.repetitions}</p>
                      )}
                    </section>
                  )}

                  {reveal === 4 && entry.experimentSpec && needsReview && (
                    <button className="advance-btn" onClick={() => advance(entry.id)}>
                      I tried it <span className="advance-arrow">→</span>
                    </button>
                  )}

                  {/* ── Level 4: Witness (model-requested, after experiment) ─ */}
                  {reveal === 5 && needsReview && (
                    <section className="next-card card-reveal" aria-label="Review">
                      <span className="next-card-label">Review</span>
                      {entry.response?.witnessPrompt ? (
                        <p className="next-card-body">{entry.response.witnessPrompt}</p>
                      ) : null}
                      {entry.witnessPlan?.witnesses.length && !entry.witnessReview ? (
                        <div className="witness-observe">
                          <label className="witness-observe-label" htmlFor={`obs-${entry.id}`}>
                            What happened?
                          </label>
                          <textarea
                            id={`obs-${entry.id}`}
                            className="witness-observe-input"
                            placeholder={"One observation per line.\nBe specific — what you saw, not what you felt."}
                            rows={4}
                            value={witnessInputs[entry.id] ?? ""}
                            onChange={(e) => setWitnessInputs((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                          />
                          <button
                            className="witness-review-btn"
                            type="button"
                            onClick={() => void reviewWitness(entry)}
                            disabled={!witnessInputs[entry.id]?.trim() || reviewLoadingId === entry.id}
                          >
                            Check Results
                          </button>
                        </div>
                      ) : null}
                      {reviewLoadingId === entry.id && (
                        <div className="progress-block progress-block--inline">
                          <span className="progress-dot" />
                          <span key={reviewLabel} className="progress-label">{reviewLabel}</span>
                        </div>
                      )}
                    </section>
                  )}

                  {/* ── User-action results: ungated, appear as data arrives ─ */}
                  {entry.witnessReview && (reveal >= 5 || !isCurrentEntry) && (
                    <section className={`review-card card-reveal review-${entry.witnessReview.verdict.toLowerCase()}`}>
                      <span className="next-card-label">Review</span>
                      <div className="review-header">
                        <span className={`review-verdict rv-${entry.witnessReview.verdict.toLowerCase()}`}>
                          {entry.witnessReview.verdict}
                        </span>
                        <span className="review-conf">
                          {Math.round(entry.witnessReview.confidence * 100)}%
                        </span>
                      </div>
                      <p className="review-claim">{entry.witnessReview.claim}</p>
                    </section>
                  )}

                </div>
              );
            })}

            {/* Session status — shown only after full reveal completes */}
            {phase === "RESULTS" && thread.length > 0 && (() => {
              const last = thread[thread.length - 1];
              if (!last) return null;
              const reveal = revealMap[last.id] ?? 0;
              const hasQuestion = Boolean(last.response?.clarificationQuestion);
              const needsReview = last.response?.nextRequiredCard === "Witness";
              const doneAt = hasQuestion ? 1 : needsReview ? 5 : 4;
              if (reveal < doneAt) return null;
              const label = last.response?.clarificationQuestion
                ? "Answer below."
                : last.witnessReview
                ? "Done."
                : last.experimentSpec
                ? "Go. Come back with what you noticed."
                : "Keep going.";
              return (
                <div className="session-status">
                  <span className="session-status-dot" />
                  <span className="session-status-text">{label}</span>
                </div>
              );
            })()}

            {/* Loading — cycling progression labels */}
            {phase === "LOADING" && (
              <div className="entry">
                <p className="intent-echo intent-echo--loading">{activeIntent}</p>
                <div className="progress-block" aria-label="Working">
                  <span className="progress-dot" />
                  <span key={loadingLabel} className="progress-label">{loadingLabel}</span>
                </div>
              </div>
            )}

          </div>

          {/* Pinned bottom input */}
          <div className="bottom-bar">
            {pendingAttachment && (
              <div className="attachment-pending attachment-pending--bottom">
                {pendingAttachment.type.startsWith("image/") ? (
                  <img className="attachment-thumb" src={pendingAttachment.url} alt={pendingAttachment.name} />
                ) : (
                  <span className="attachment-name">{pendingAttachment.name}</span>
                )}
                <button type="button" className="attachment-remove" onClick={removePendingAttachment} aria-label="Remove">×</button>
              </div>
            )}
            <form className="bottom-form" onSubmit={handleSubmit}>
              <div className="bottom-ctls">
                <button
                  className={`ctrl-btn sm${pendingAttachment ? " on" : ""}`}
                  onClick={openAttach}
                  type="button"
                  aria-label="Attach"
                >
                  <Paperclip size={13} strokeWidth={1.8} />
                </button>
                <button
                  className={`ctrl-btn sm${voicePhase === "LISTENING" ? " voice-listening" : voicePhase === "PROCESSING" ? " voice-processing" : ""}`}
                  onClick={toggleVoice}
                  type="button"
                  aria-label={voicePhase === "LISTENING" ? "Listening" : voicePhase === "PROCESSING" ? "Processing" : "Voice"}
                  disabled={!isVoiceSupported}
                >
                  {voicePhase === "LISTENING" ? (
                    <span className="voice-dot" />
                  ) : voicePhase === "PROCESSING" ? (
                    <span className="voice-processing-dots">···</span>
                  ) : (
                    <Mic size={13} strokeWidth={1.8} />
                  )}
                </button>
              </div>
              <input
                ref={inputRef}
                className="bottom-input"
                placeholder={bottomPlaceholder}
                type="text"
                spellCheck={false}
                autoComplete="off"
                enterKeyHint="send"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void run(inputRef.current?.value ?? "");
                  }
                }}
              />
              <button className="bottom-send" type="submit" aria-label="Send">
                →
              </button>
            </form>
          </div>

        </div>
      )}

      {/* Hidden native file input — Photo Library, Take Photo/Video, Browse */}
      <input
        ref={attachInputRef}
        type="file"
        accept="image/*,video/*,application/pdf,.doc,.docx,.txt"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelected(file);
          e.target.value = "";
        }}
      />

      <style jsx>{`

        /* ── Root ────────────────────────────────────────────────────────── */

        .root {
          background: #fafaf9;
          color: #1a1a18;
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
          min-height: 100dvh;
          overflow-x: hidden;
        }

        /* ── Header ──────────────────────────────────────────────────────── */

        .hd {
          align-items: center;
          border-bottom: 1px solid rgba(26, 26, 24, 0.07);
          display: flex;
          flex-shrink: 0;
          gap: 10px;
          padding: 12px clamp(16px, 4vw, 40px);
        }

        .sidebar-toggle {
          background: none;
          border: none;
          color: rgba(26, 26, 24, 0.3);
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          padding: 4px;
          transition: color 0.12s;
        }

        .sidebar-toggle:hover {
          color: rgba(26, 26, 24, 0.62);
        }

        .hd-right {
          align-items: center;
          display: flex;
          gap: 8px;
          margin-left: auto;
        }

        .auth-chip {
          border: 1px solid rgba(26, 26, 24, 0.08);
          border-radius: 999px;
          color: rgba(26, 26, 24, 0.46);
          font-size: 11px;
          font-weight: 550;
          line-height: 1;
          max-width: min(42vw, 280px);
          overflow: hidden;
          padding: 7px 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .auth-chip--guest {
          border-color: rgba(140, 190, 40, 0.18);
          color: rgba(62, 120, 38, 0.72);
        }

        .breakthrough-btn {
          background: none;
          border: none;
          color: rgba(26, 26, 24, 0.22);
          cursor: pointer;
          font-size: 15px;
          line-height: 1;
          padding: 4px;
          transition: color 0.15s;
        }

        .breakthrough-btn:hover {
          color: rgba(200, 160, 0, 0.8);
        }

        .wordmark {
          color: rgba(26, 26, 24, 0.28);
          font-size: 12px;
          font-weight: 750;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .thread-count {
          color: rgba(26, 26, 24, 0.22);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.04em;
          margin-left: auto;
        }

        /* ── Home state ──────────────────────────────────────────────────── */

        .home {
          align-items: flex-start;
          animation: homeEnter 0.35s ease both;
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 40px;
          justify-content: flex-start;
          margin: 0 auto;
          max-width: 640px;
          padding: clamp(52px, 13vh, 88px) clamp(20px, 5vw, 48px) 80px;
          width: 100%;
        }

        @keyframes homeEnter {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .home-hero {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .home-mark {
          color: rgba(26, 26, 24, 0.22);
          font-size: 11px;
          font-weight: 750;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .home-q {
          color: #1a1a18;
          font-size: clamp(36px, 6.5vw, 54px);
          font-weight: 720;
          letter-spacing: -0.01em;
          line-height: 1.04;
          margin: 0;
        }

        .home-form {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
        }

        .home-input {
          background: #fff;
          border: 1.5px solid rgba(26, 26, 24, 0.12);
          border-radius: 12px;
          box-sizing: border-box;
          color: #1a1a18;
          font: inherit;
          font-size: 17px;
          line-height: 1.5;
          outline: none;
          padding: 14px 18px;
          transition: border-color 0.15s;
          width: 100%;
        }

        .home-input:focus {
          border-color: rgba(26, 26, 24, 0.28);
        }

        .home-input::placeholder {
          color: rgba(26, 26, 24, 0.28);
        }

        .home-controls {
          align-items: center;
          display: flex;
          gap: 6px;
        }

        /* ── Controls ─────────────────────────────────────────────────────── */

        .ctrl-btn {
          align-items: center;
          background: rgba(26, 26, 24, 0.04);
          border: 1px solid rgba(26, 26, 24, 0.08);
          border-radius: 8px;
          color: rgba(26, 26, 24, 0.42);
          cursor: pointer;
          display: flex;
          font: inherit;
          font-size: 12px;
          font-weight: 500;
          gap: 5px;
          min-height: 36px;
          padding: 0 11px;
          transition: background 0.12s, color 0.12s, border-color 0.12s;
        }

        .ctrl-btn:hover {
          background: rgba(26, 26, 24, 0.07);
          color: rgba(26, 26, 24, 0.7);
        }

        .ctrl-btn.on {
          background: rgba(62, 140, 38, 0.07);
          border-color: rgba(62, 140, 38, 0.2);
          color: #3d7a28;
        }

        .ctrl-btn.voice-listening {
          background: rgba(62, 140, 38, 0.08);
          border-color: rgba(62, 140, 38, 0.24);
          color: #3d7a28;
        }

        .ctrl-btn.voice-processing {
          background: rgba(180, 90, 15, 0.07);
          border-color: rgba(180, 90, 15, 0.2);
          color: rgb(160, 80, 12);
        }

        .voice-dot {
          animation: voice-pulse 1s ease-in-out infinite;
          background: currentColor;
          border-radius: 50%;
          display: inline-block;
          flex-shrink: 0;
          height: 7px;
          width: 7px;
        }

        @keyframes voice-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }

        .voice-processing-dots {
          font-size: 16px;
          letter-spacing: 0.05em;
          line-height: 1;
        }

        .ctrl-btn:disabled {
          cursor: not-allowed;
          opacity: 0.38;
        }

        .ctrl-btn.sm {
          min-height: 30px;
          padding: 0 8px;
        }

        /* ── Attachment ──────────────────────────────────────────────────── */

        .attachment-pending {
          align-items: center;
          background: rgba(26, 26, 24, 0.03);
          border: 1px solid rgba(26, 26, 24, 0.08);
          border-radius: 8px;
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
          padding: 6px 8px;
        }

        .attachment-pending--bottom {
          margin: 0 16px 8px;
        }

        .attachment-thumb {
          border-radius: 4px;
          height: 36px;
          object-fit: cover;
          width: 36px;
        }

        .attachment-name {
          color: rgba(26, 26, 24, 0.6);
          flex: 1;
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .attachment-remove {
          background: none;
          border: none;
          color: rgba(26, 26, 24, 0.36);
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          padding: 0 2px;
        }

        .attachment-remove:hover {
          color: rgba(26, 26, 24, 0.6);
        }

        .entry-attachment {
          margin: 4px 0 8px;
        }

        .entry-thumb {
          border-radius: 8px;
          display: block;
          max-height: 200px;
          max-width: 100%;
          object-fit: cover;
        }

        .entry-file {
          color: rgba(26, 26, 24, 0.44);
          font-size: 12px;
        }

        .send-btn {
          align-items: center;
          background: #1a1a18;
          border: 0;
          border-radius: 8px;
          color: #fafaf9;
          cursor: pointer;
          display: flex;
          font: inherit;
          font-size: 16px;
          height: 36px;
          justify-content: center;
          margin-left: auto;
          padding: 0 18px;
          transition: opacity 0.15s;
        }

        .send-btn:hover { opacity: 0.78; }

        /* ── Thread shell ─────────────────────────────────────────────────── */

        .thread-shell {
          animation: sessionEnter 0.28s ease both;
          display: flex;
          flex: 1;
          flex-direction: column;
          min-height: 0;
        }

        @keyframes sessionEnter {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .thread {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 52px;
          margin: 0 auto;
          max-width: 680px;
          min-height: 0;
          overflow-wrap: break-word;
          overflow-x: hidden;
          overflow-y: auto;
          padding: 36px clamp(20px, 5vw, 48px) 88px;
          width: 100%;
          word-break: break-word;
        }

        /* ── Entry ───────────────────────────────────────────────────────── */

        .entry {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .entry-divider {
          border: none;
          border-top: 1px solid rgba(26, 26, 24, 0.06);
          margin: 0 0 12px;
        }

        .intent-echo {
          color: rgba(26, 26, 24, 0.32);
          font-size: 12px;
          font-weight: 650;
          letter-spacing: 0.05em;
          margin: 0;
          text-transform: uppercase;
        }

        .intent-echo--loading {
          opacity: 0.55;
        }

        .clarification {
          color: #1a1a18;
          font-size: 18px;
          line-height: 1.45;
          margin: 0;
        }

        /* ── Progress block ──────────────────────────────────────────────── */

        .progress-block {
          align-items: center;
          display: flex;
          gap: 10px;
          padding: 16px 0 4px;
        }

        .progress-block--inline {
          padding: 14px 0 0;
        }

        .progress-dot {
          animation: pulseDot 1.2s ease-in-out infinite;
          background: rgba(140, 190, 40, 0.85);
          border-radius: 50%;
          flex-shrink: 0;
          height: 6px;
          width: 6px;
        }

        @keyframes pulseDot {
          0%, 100% { opacity: 0.35; transform: scale(0.85); }
          50%       { opacity: 1;    transform: scale(1.15); }
        }

        .progress-label {
          animation: progressIn 0.25s ease both;
          color: rgba(26, 26, 24, 0.36);
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.01em;
        }

        @keyframes progressIn {
          from { opacity: 0; transform: translateX(-5px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        /* ── Session status ──────────────────────────────────────────────── */

        .session-status {
          align-items: center;
          display: flex;
          gap: 10px;
          padding: 20px 0 4px;
        }

        .session-status-dot {
          animation: pulseDot 2.2s ease-in-out infinite;
          background: rgba(140, 190, 40, 0.55);
          border-radius: 50%;
          flex-shrink: 0;
          height: 5px;
          width: 5px;
        }

        .session-status-text {
          color: rgba(26, 26, 24, 0.26);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        /* ── Badges ──────────────────────────────────────────────────────── */

        .badge {
          border-radius: 4px;
          display: inline-block;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.1em;
          margin-bottom: 10px;
          padding: 3px 7px;
          text-transform: uppercase;
        }

        .badge-insight {
          background: rgba(62, 140, 38, 0.08);
          color: #3d7a28;
        }

        .badge-source {
          background: rgba(26, 26, 24, 0.05);
          color: rgba(26, 26, 24, 0.4);
        }

        .section-label {
          color: rgba(26, 26, 24, 0.28);
          display: block;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.1em;
          margin-bottom: 10px;
          text-transform: uppercase;
        }

        /* ── Insight card ────────────────────────────────────────────────── */

        .card-context {
          border-bottom: 1px solid rgba(26, 26, 24, 0.07);
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin: 0 0 15px;
          padding: 0 0 13px;
        }

        .card-context div {
          min-width: 0;
        }

        .card-context span {
          color: rgba(26, 26, 24, 0.26);
          display: block;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.12em;
          margin-bottom: 5px;
          text-transform: uppercase;
        }

        .card-context p {
          color: rgba(26, 26, 24, 0.54);
          font-size: 12px;
          line-height: 1.35;
          margin: 0;
        }

        @media (max-width: 640px) {
          .card-context {
            gap: 9px;
            grid-template-columns: 1fr;
          }
        }

        .insight-card {
          background: #fff;
          border: 1px solid rgba(26, 26, 24, 0.08);
          border-radius: 12px;
          padding: 18px 20px 20px;
        }

        .ins-body {
          color: #1a1a18;
          font-size: clamp(17px, 2.6vw, 22px);
          font-weight: 500;
          line-height: 1.45;
          margin: 0;
        }

        .ins-reasoning {
          color: rgba(26, 26, 24, 0.38);
          font-size: 13px;
          line-height: 1.6;
          margin: 14px 0 0;
        }

        /* ── Advance controls ────────────────────────────────────────────── */

        .advance-btn {
          align-items: center;
          animation: cardReveal 0.3s ease both;
          background: none;
          border: none;
          border-top: 1px solid rgba(26, 26, 24, 0.07);
          color: rgba(26, 26, 24, 0.32);
          cursor: pointer;
          display: flex;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          gap: 7px;
          justify-content: center;
          letter-spacing: 0.08em;
          margin-top: 20px;
          padding: 18px 0 4px;
          text-transform: uppercase;
          transition: color 0.15s;
          width: 100%;
        }

        .advance-btn:hover {
          color: rgba(26, 26, 24, 0.7);
        }

        .advance-arrow {
          font-size: 14px;
          font-weight: 400;
          letter-spacing: 0;
          text-transform: none;
          transition: transform 0.15s;
        }

        .advance-btn:hover .advance-arrow {
          transform: translateX(3px);
        }

        /* "Try it" — the pivot from understanding to doing */
        .advance-btn--try {
          border-top-color: rgba(62, 140, 38, 0.18);
          color: rgba(62, 140, 38, 0.65);
          font-size: 13px;
          letter-spacing: 0.1em;
          padding-top: 20px;
        }

        .advance-btn--try:hover {
          color: rgba(62, 140, 38, 0.9);
        }

        /* ── Card reveal animation ───────────────────────────────────────── */

        .card-reveal {
          animation: cardReveal 0.4s ease both;
        }

        @keyframes cardReveal {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Next Required Card ──────────────────────────────────────────── */

        .next-card {
          background: rgba(62, 140, 38, 0.04);
          border: 1px solid rgba(62, 140, 38, 0.14);
          border-radius: 10px;
          padding: 16px 18px;
        }

        .next-card-label {
          color: #3d7a28;
          display: block;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.1em;
          margin-bottom: 10px;
          text-transform: uppercase;
        }

        .next-card-body {
          color: #1a1a18;
          font-size: 16px;
          font-weight: 450;
          line-height: 1.5;
          margin: 0;
        }

        .next-card-body--dim {
          color: rgba(26, 26, 24, 0.42);
          font-style: italic;
        }

        /* ── Mental Model ────────────────────────────────────────────────── */

        .mm-framework {
          color: #1a1a18;
          font-size: 15px;
          font-weight: 450;
          line-height: 1.65;
          margin: 0;
        }

        /* ── Demonstration ───────────────────────────────────────────────── */

        .demo-body {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .demo-state {
          font-size: 14px;
          line-height: 1.55;
          margin: 0;
        }

        .demo-state--now {
          color: rgba(26, 26, 24, 0.52);
        }

        .demo-state--target {
          color: #1a1a18;
          font-weight: 500;
        }

        .demo-arrow {
          color: rgba(62, 140, 38, 0.5);
          font-size: 16px;
          line-height: 1;
        }

        .demo-diff {
          border-left: 2px solid rgba(62, 140, 38, 0.35);
          color: #1a1a18;
          font-size: 14px;
          font-weight: 500;
          line-height: 1.5;
          margin: 4px 0 0;
          padding-left: 12px;
        }

        .demo-cue {
          color: rgba(26, 26, 24, 0.44);
          font-size: 13px;
          font-style: italic;
          line-height: 1.55;
          margin: 0;
        }

        /* ── Experiment ──────────────────────────────────────────────────── */

        .exp-instruction {
          color: #1a1a18;
          font-size: clamp(15px, 2.2vw, 18px);
          font-weight: 500;
          line-height: 1.5;
          margin: 0;
        }

        .exp-reps {
          color: rgba(26, 26, 24, 0.38);
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.04em;
          margin: 10px 0 0;
          text-transform: uppercase;
        }

        /* ── Witness plan ────────────────────────────────────────────────── */

        .witness-plan {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .witness-row {
          border: 1px solid rgba(26, 26, 24, 0.07);
          border-radius: 8px;
          padding: 12px 14px;
        }

        .witness-header {
          align-items: center;
          display: flex;
          gap: 8px;
          margin-bottom: 10px;
        }

        .witness-name {
          color: #1a1a18;
          font-size: 13px;
          font-weight: 650;
          letter-spacing: 0.02em;
        }

        .witness-importance {
          border-radius: 4px;
          font-size: 9px;
          font-weight: 750;
          letter-spacing: 0.1em;
          padding: 2px 6px;
          text-transform: uppercase;
        }

        .wi-critical {
          background: rgba(62, 140, 38, 0.1);
          color: #3d7a28;
        }

        .wi-high {
          background: rgba(26, 26, 24, 0.06);
          color: rgba(26, 26, 24, 0.52);
        }

        .wi-medium {
          background: rgba(26, 26, 24, 0.04);
          color: rgba(26, 26, 24, 0.36);
        }

        .wi-low {
          background: transparent;
          color: rgba(26, 26, 24, 0.26);
        }

        .witness-fields {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin: 0;
        }

        .witness-field {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .witness-term {
          color: rgba(26, 26, 24, 0.28);
          font-size: 9px;
          font-weight: 750;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .witness-def {
          color: rgba(26, 26, 24, 0.62);
          font-size: 13px;
          line-height: 1.5;
          margin: 0;
        }

        .witness-def--evidence {
          color: rgba(26, 26, 24, 0.44);
          font-style: italic;
        }

        /* ── Deep Model ─────────────────────────────────────────────────── */

        .deep-model-card {
          background: rgba(26, 26, 24, 0.03);
          border: 1px solid rgba(26, 26, 24, 0.08);
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
        }

        .dm-model {
          color: #1a1a18;
          font-size: 15px;
          font-weight: 500;
          line-height: 1.55;
          margin: 0;
        }

        .dm-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .dm-label {
          color: rgba(26, 26, 24, 0.36);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .dm-value {
          color: rgba(26, 26, 24, 0.72);
          font-size: 13px;
          line-height: 1.5;
          margin: 0;
        }

        .dm-caution {
          color: rgba(26, 26, 24, 0.44);
          font-style: italic;
        }

        /* ── Research cards ──────────────────────────────────────────────── */

        .research-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .research-card {
          background: rgba(26, 26, 24, 0.02);
          border: 1px solid rgba(26, 26, 24, 0.06);
          border-radius: 10px;
          padding: 14px 16px;
        }

        .discovery-index {
          color: rgba(26, 26, 24, 0.28);
          display: block;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.06em;
          margin-bottom: 8px;
          text-transform: uppercase;
        }

        .badge-link {
          cursor: pointer;
          text-decoration: none;
          transition: opacity 0.12s;
        }

        .badge-link:hover { opacity: 0.7; }

        .research-body {
          color: rgba(26, 26, 24, 0.72);
          font-size: 14px;
          line-height: 1.55;
          margin: 0 0 6px;
        }

        .research-why {
          color: rgba(26, 26, 24, 0.38);
          font-size: 13px;
          line-height: 1.45;
          margin: 0;
        }


        /* ── Bottom bar ──────────────────────────────────────────────────── */

        .bottom-bar {
          border-top: 1px solid rgba(26, 26, 24, 0.07);
          flex-shrink: 0;
          margin: 0 auto;
          max-width: 680px;
          padding: 12px clamp(20px, 5vw, 48px) 28px;
          width: 100%;
        }

        .bottom-form {
          align-items: center;
          background: #fff;
          border: 1.5px solid rgba(26, 26, 24, 0.1);
          border-radius: 12px;
          display: flex;
          gap: 6px;
          padding: 7px 9px;
          transition: border-color 0.15s;
        }

        .bottom-form:focus-within {
          border-color: rgba(26, 26, 24, 0.22);
        }

        .bottom-ctls {
          align-items: center;
          display: flex;
          flex-shrink: 0;
          gap: 2px;
        }

        .bottom-input {
          background: transparent;
          border: 0;
          color: #1a1a18;
          flex: 1;
          font: inherit;
          font-size: 15px;
          min-width: 0;
          outline: none;
          padding: 4px 6px;
        }

        .bottom-input::placeholder {
          color: rgba(26, 26, 24, 0.26);
        }

        .bottom-send {
          align-items: center;
          background: #1a1a18;
          border: 0;
          border-radius: 8px;
          color: #fafaf9;
          cursor: pointer;
          display: flex;
          flex-shrink: 0;
          font: inherit;
          font-size: 14px;
          height: 30px;
          justify-content: center;
          padding: 0 12px;
          transition: opacity 0.15s;
        }

        .bottom-send:hover { opacity: 0.78; }

        /* ── Witness observation input ───────────────────────────────────── */

        .witness-observe {
          border-top: 1px solid rgba(62, 140, 38, 0.1);
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 14px;
          padding-top: 14px;
        }

        .witness-observe-label {
          color: rgba(26, 26, 24, 0.42);
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .witness-observe-input {
          background: rgba(26, 26, 24, 0.02);
          border: 1px solid rgba(26, 26, 24, 0.1);
          border-radius: 8px;
          color: #1a1a18;
          font: inherit;
          font-size: 13px;
          line-height: 1.55;
          outline: none;
          padding: 10px 12px;
          resize: vertical;
          transition: border-color 0.12s;
          width: 100%;
          box-sizing: border-box;
        }

        .witness-observe-input::placeholder {
          color: rgba(26, 26, 24, 0.28);
        }

        .witness-observe-input:focus {
          border-color: rgba(26, 26, 24, 0.22);
        }

        .witness-review-btn {
          align-self: flex-start;
          background: rgba(26, 26, 24, 0.06);
          border: 1px solid rgba(26, 26, 24, 0.1);
          border-radius: 7px;
          color: rgba(26, 26, 24, 0.62);
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.02em;
          padding: 6px 14px;
          transition: background 0.12s, color 0.12s;
        }

        .witness-review-btn:hover:not(:disabled) {
          background: rgba(26, 26, 24, 0.1);
          color: #1a1a18;
        }

        .witness-review-btn:disabled {
          cursor: not-allowed;
          opacity: 0.4;
        }

        /* ── Review card ─────────────────────────────────────────────────── */

        .review-card {
          border-radius: 10px;
          border: 1px solid rgba(26, 26, 24, 0.08);
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 16px 18px;
        }

        .review-pass {
          background: rgba(62, 140, 38, 0.04);
          border-color: rgba(62, 140, 38, 0.16);
        }

        .review-fail {
          background: rgba(26, 26, 24, 0.03);
          border-color: rgba(26, 26, 24, 0.1);
        }

        .review-inconclusive {
          background: rgba(26, 26, 24, 0.02);
          border-color: rgba(26, 26, 24, 0.07);
        }

        .review-header {
          align-items: center;
          display: flex;
          gap: 10px;
        }

        .review-verdict {
          border-radius: 4px;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.1em;
          padding: 3px 8px;
          text-transform: uppercase;
        }

        .rv-pass {
          background: rgba(62, 140, 38, 0.1);
          color: #3d7a28;
        }

        .rv-fail {
          background: rgba(26, 26, 24, 0.08);
          color: rgba(26, 26, 24, 0.58);
        }

        .rv-inconclusive {
          background: rgba(26, 26, 24, 0.05);
          color: rgba(26, 26, 24, 0.38);
        }

        .review-conf {
          color: rgba(26, 26, 24, 0.36);
          font-size: 12px;
          font-variant-numeric: tabular-nums;
          font-weight: 600;
        }

        .review-claim {
          color: #1a1a18;
          font-size: 15px;
          font-weight: 450;
          line-height: 1.5;
          margin: 0;
        }

        .review-ev-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .review-ev-label {
          color: rgba(26, 26, 24, 0.28);
          font-size: 9px;
          font-weight: 750;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .review-ev-list {
          display: flex;
          flex-direction: column;
          gap: 5px;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .review-ev-item {
          font-size: 13px;
          line-height: 1.5;
          padding-left: 14px;
          position: relative;
        }

        .review-ev-item::before {
          left: 0;
          position: absolute;
        }

        .review-ev-item--support {
          color: rgba(26, 26, 24, 0.68);
        }

        .review-ev-item--support::before {
          color: #3d7a28;
          content: "✓";
          font-size: 10px;
          top: 2px;
        }

        .review-ev-item--contra {
          color: rgba(26, 26, 24, 0.52);
        }

        .review-ev-item--contra::before {
          color: rgba(26, 26, 24, 0.36);
          content: "×";
          font-size: 11px;
          top: 1px;
        }

        .review-next {
          align-items: center;
          border-top: 1px solid rgba(26, 26, 24, 0.06);
          display: flex;
          gap: 8px;
          padding-top: 12px;
        }

        .review-next-label {
          color: rgba(26, 26, 24, 0.28);
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .review-next-card {
          color: rgba(26, 26, 24, 0.58);
          font-size: 12px;
          font-weight: 600;
        }

        /* ── Adjustment card ─────────────────────────────────────────────── */

        .adj-card {
          background: rgba(26, 26, 24, 0.025);
          border: 1px solid rgba(26, 26, 24, 0.08);
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 14px 16px;
        }

        .adj-card--complete {
          background: rgba(62, 140, 38, 0.03);
          border-color: rgba(62, 140, 38, 0.12);
        }

        .adj-header {
          align-items: center;
          display: flex;
          gap: 10px;
        }

        .adj-decision {
          color: #1a1a18;
          font-size: 13px;
          font-weight: 650;
          letter-spacing: 0.01em;
        }

        .adj-next-pill {
          background: rgba(26, 26, 24, 0.05);
          border: 1px solid rgba(26, 26, 24, 0.08);
          border-radius: 4px;
          color: rgba(26, 26, 24, 0.42);
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.08em;
          padding: 2px 7px;
          text-transform: uppercase;
        }

        .adj-reason {
          color: rgba(26, 26, 24, 0.62);
          font-size: 13px;
          line-height: 1.55;
          margin: 0;
        }

        .adj-benefit {
          color: rgba(26, 26, 24, 0.38);
          font-size: 12px;
          font-style: italic;
          line-height: 1.5;
          margin: 0;
        }

        /* ── Orchestration card ──────────────────────────────────────────── */

        .orch-card {
          background: #fff;
          border: 1.5px solid rgba(26, 26, 24, 0.1);
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 14px 16px;
        }

        .orch-card--done {
          background: rgba(62, 140, 38, 0.03);
          border-color: rgba(62, 140, 38, 0.18);
        }

        .orch-header {
          align-items: center;
          display: flex;
          gap: 10px;
        }

        .orch-label {
          color: rgba(26, 26, 24, 0.28);
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .orch-next {
          color: #1a1a18;
          font-size: 13px;
          font-weight: 650;
        }

        .orch-done {
          color: #3d7a28;
          font-size: 13px;
          font-weight: 650;
        }

        .orch-reason {
          color: rgba(26, 26, 24, 0.62);
          font-size: 13px;
          line-height: 1.55;
          margin: 0;
        }

        .orch-inputs {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .orch-inputs-label {
          color: rgba(26, 26, 24, 0.28);
          font-size: 9px;
          font-weight: 750;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .orch-inputs-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .orch-inputs-list li {
          color: rgba(26, 26, 24, 0.48);
          font-size: 12px;
          padding-left: 10px;
          position: relative;
        }

        .orch-inputs-list li::before {
          color: rgba(26, 26, 24, 0.24);
          content: "—";
          left: 0;
          position: absolute;
        }

        .orch-outcome {
          color: rgba(26, 26, 24, 0.36);
          font-size: 12px;
          font-style: italic;
          line-height: 1.5;
          margin: 0;
        }

      `}</style>
    </main>
  );
}
