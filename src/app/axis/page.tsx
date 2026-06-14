"use client";

import { Mic, Paperclip } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase = "IDLE" | "LOADING" | "RESULTS";

type CardType = "Mental Model" | "Demonstration" | "Experiment" | "Witness";

interface InsightResponse {
  insight: string;
  confidence: number;
  reasoning: string;
  nextRequiredCard: CardType;
  mentalModel?: string;
  experimentCandidate?: string;
  witnessPrompt?: string;
  clarificationQuestion?: string;
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AxisPage() {
  const [phase, setPhase] = useState<Phase>("IDLE");
  const [thread, setThread] = useState<ThreadEntry[]>([]);
  const [activeIntent, setActiveIntent] = useState("");
  const [voicePhase, setVoicePhase] = useState<"OFF" | "LISTENING" | "PROCESSING">("OFF");
  const [pendingAttachment, setPendingAttachment] = useState<Attachment | null>(null);
  const [isVoiceSupported, setIsVoiceSupported] = useState(false);
  const [witnessInputs, setWitnessInputs] = useState<Record<string, string>>({});
  const [reviewLoadingId, setReviewLoadingId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  const isEmpty = thread.length === 0 && phase === "IDLE";

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
  }, [thread, phase]);

  // Focus input when thread exists
  useEffect(() => {
    if (!isEmpty) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [isEmpty]);

  // -------------------------------------------------------------------------
  // Camera + Upload — native file inputs, no navigation
  // -------------------------------------------------------------------------

  function handleFileSelected(file: File) {
    if (pendingAttachment) URL.revokeObjectURL(pendingAttachment.url);
    const url = URL.createObjectURL(file);
    objectUrlsRef.current.push(url);
    setPendingAttachment({ name: file.name, url, type: file.type });
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
    const val = intentText.trim();
    if (!val || phase === "LOADING") return;
    if (inputRef.current) inputRef.current.value = "";

    const attachment = pendingAttachment;
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
          body: JSON.stringify({ intent: val }),
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

      // Secondary engines — called only when the Insight Engine selects that card type
      let mentalModelCard: MentalModelCard | null = null;
      let demonstrationSpec: DemonstrationSpec | null = null;
      let experimentSpec: ExperimentSpec | null = null;
      let witnessPlan: WitnessPlan | null = null;

      // Deep Model — fired concurrently with secondary engine, non-fatal
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

      if (response?.insight) {
        if (response.nextRequiredCard === "Mental Model") {
          try {
            const mmRes = await fetch("/api/axis/mental-model", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ insight: response.insight, reasoning: response.reasoning }),
              signal: ctrl.signal,
            });
            if (mmRes.ok) mentalModelCard = await mmRes.json() as MentalModelCard;
          } catch { /* non-fatal */ }
        } else if (response.nextRequiredCard === "Demonstration") {
          try {
            const demoRes = await fetch("/api/axis/demonstration", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                insight: response.insight,
                mentalModel: response.mentalModel,
                reasoning: response.reasoning,
              }),
              signal: ctrl.signal,
            });
            if (demoRes.ok) demonstrationSpec = await demoRes.json() as DemonstrationSpec;
          } catch { /* non-fatal */ }
        } else if (response.nextRequiredCard === "Experiment") {
          try {
            const expRes = await fetch("/api/axis/experiment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                insight: response.insight,
                reasoning: response.reasoning,
                experimentCandidate: response.experimentCandidate,
              }),
              signal: ctrl.signal,
            });
            if (expRes.ok) experimentSpec = await expRes.json() as ExperimentSpec;
          } catch { /* non-fatal */ }
        } else if (response.nextRequiredCard === "Witness") {
          try {
            const witnessRes = await fetch("/api/axis/witness", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                insight: response.insight,
                reasoning: response.reasoning,
                witnessPrompt: response.witnessPrompt,
              }),
              signal: ctrl.signal,
            });
            if (witnessRes.ok) witnessPlan = await witnessRes.json() as WitnessPlan;
          } catch { /* non-fatal */ }
        }
      }

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

      setThread((prev) => [...prev, entry]);
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

  return (
    <main className="root">

      {/* ── EMPTY STATE ─────────────────────────────────────────────────── */}
      {isEmpty && (
        <div className="empty">
          <p className="main-q">What are you working on?</p>
          <form className="main-form" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              className="main-input"
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
            <div className="main-controls">
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
      {!isEmpty && (
        <div className="thread-shell">

          <header className="hd">
            <span className="wordmark">Axis</span>
            {thread.length > 1 && (
              <span className="thread-count">{thread.length} sessions</span>
            )}
          </header>

          <div className="thread" ref={threadRef}>

            {thread.map((entry, i) => (
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

                {entry.response && (
                  <>
                    {/* Clarification — shown above insight when confidence is low */}
                    {entry.response.clarificationQuestion && (
                      <p className="clarification">{entry.response.clarificationQuestion}</p>
                    )}

                    {/* Insight block */}
                    <article className="insight-card">
                      <span className="badge badge-insight">Insight</span>
                      <p className="ins-body">{entry.response.insight}</p>
                      <div className="ins-sub">
                        <p className="ins-sub-body">{entry.response.reasoning}</p>
                      </div>
                    </article>

                    {/* Next Required Card */}
                    <section className="next-card" aria-label={entry.response.nextRequiredCard}>
                      <span className="next-card-label">{entry.response.nextRequiredCard}</span>

                      {entry.response.nextRequiredCard === "Mental Model" && entry.mentalModelCard ? (
                        <div className="mm-card">
                          <p className="mm-framework">{entry.mentalModelCard.mentalModel}</p>
                          <dl className="mm-rows">
                            <div className="mm-row">
                              <dt className="mm-term">Rule</dt>
                              <dd className="mm-def mm-def--rule">{entry.mentalModelCard.rule}</dd>
                            </div>
                            <div className="mm-row">
                              <dt className="mm-term">Failure Pattern</dt>
                              <dd className="mm-def">{entry.mentalModelCard.failurePattern}</dd>
                            </div>
                            <div className="mm-row">
                              <dt className="mm-term">Recognition Cue</dt>
                              <dd className="mm-def">{entry.mentalModelCard.recognitionCue}</dd>
                            </div>
                          </dl>
                        </div>
                      ) : entry.response.nextRequiredCard === "Mental Model" && entry.response.mentalModel ? (
                        <p className="next-card-body">{entry.response.mentalModel}</p>
                      ) : null}

                      {entry.response.nextRequiredCard === "Experiment" && entry.experimentSpec ? (
                        <div className="exp-spec">
                          <dl className="exp-rows">
                            <div className="exp-row">
                              <dt className="exp-term">Hypothesis</dt>
                              <dd className="exp-def exp-def--hyp">{entry.experimentSpec.hypothesis}</dd>
                            </div>
                            <div className="exp-row">
                              <dt className="exp-term">Constraint</dt>
                              <dd className="exp-def">{entry.experimentSpec.constraint}</dd>
                            </div>
                            <div className="exp-row">
                              <dt className="exp-term">Repetitions</dt>
                              <dd className="exp-def">{entry.experimentSpec.repetitions}</dd>
                            </div>
                            <div className="exp-criteria">
                              <div className="exp-row">
                                <dt className="exp-term">Success Criteria</dt>
                                <dd className="exp-def exp-def--success">{entry.experimentSpec.successCriteria}</dd>
                              </div>
                              <div className="exp-row">
                                <dt className="exp-term">Failure Criteria</dt>
                                <dd className="exp-def exp-def--failure">{entry.experimentSpec.failureCriteria}</dd>
                              </div>
                            </div>
                            <div className="exp-row">
                              <dt className="exp-term">Evidence Required</dt>
                              <dd className="exp-def">{entry.experimentSpec.evidenceRequired}</dd>
                            </div>
                            <div className="exp-row">
                              <dt className="exp-term">Expected Learning</dt>
                              <dd className="exp-def exp-def--learn">{entry.experimentSpec.expectedLearning}</dd>
                            </div>
                          </dl>
                        </div>
                      ) : entry.response.nextRequiredCard === "Experiment" && entry.response.experimentCandidate ? (
                        <p className="next-card-body">{entry.response.experimentCandidate}</p>
                      ) : null}
                      {entry.response.nextRequiredCard === "Witness" && entry.witnessPlan?.witnesses.length ? (
                        <div className="witness-plan">
                          {entry.witnessPlan.witnesses.map((w, i) => (
                            <div key={i} className="witness-row">
                              <div className="witness-header">
                                <span className="witness-name">{w.witness}</span>
                                <span className={`witness-importance wi-${w.confidenceImportance.toLowerCase()}`}>
                                  {w.confidenceImportance}
                                </span>
                              </div>
                              <dl className="witness-fields">
                                <div className="witness-field">
                                  <dt className="witness-term">Purpose</dt>
                                  <dd className="witness-def">{w.purpose}</dd>
                                </div>
                                <div className="witness-field">
                                  <dt className="witness-term">Expected Claim</dt>
                                  <dd className="witness-def">{w.expectedClaim}</dd>
                                </div>
                                <div className="witness-field">
                                  <dt className="witness-term">Required Evidence</dt>
                                  <dd className="witness-def witness-def--evidence">{w.requiredEvidence}</dd>
                                </div>
                              </dl>
                            </div>
                          ))}
                        </div>
                      ) : entry.response.nextRequiredCard === "Witness" && entry.response.witnessPrompt ? (
                        <p className="next-card-body">{entry.response.witnessPrompt}</p>
                      ) : null}

                      {/* Witness observation input — shown after witness plan, hidden once reviewed */}
                      {entry.response.nextRequiredCard === "Witness" && entry.witnessPlan?.witnesses.length && !entry.witnessReview && (
                        <div className="witness-observe">
                          <label className="witness-observe-label" htmlFor={`obs-${entry.id}`}>
                            What did you observe?
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
                            {reviewLoadingId === entry.id ? "Reviewing…" : "Review Evidence"}
                          </button>
                        </div>
                      )}
                      {entry.response.nextRequiredCard === "Demonstration" && entry.demonstrationSpec && (
                        <div className="demo-spec">
                          <div className="demo-badges">
                            <span className="demo-badge">{entry.demonstrationSpec.complexity}</span>
                            {entry.demonstrationSpec.comparisonRequired && (
                              <span className="demo-badge">Comparison Required</span>
                            )}
                          </div>
                          <dl className="demo-rows">
                            <div className="demo-row">
                              <dt className="demo-term">Current State</dt>
                              <dd className="demo-def">{entry.demonstrationSpec.currentState}</dd>
                            </div>
                            <div className="demo-row">
                              <dt className="demo-term">Target State</dt>
                              <dd className="demo-def">{entry.demonstrationSpec.targetState}</dd>
                            </div>
                            <div className="demo-row">
                              <dt className="demo-term">Key Difference</dt>
                              <dd className="demo-def demo-def--key">{entry.demonstrationSpec.keyDifference}</dd>
                            </div>
                            <div className="demo-row">
                              <dt className="demo-term">Execution Cue</dt>
                              <dd className="demo-def">{entry.demonstrationSpec.executionCue}</dd>
                            </div>
                            <div className="demo-row">
                              <dt className="demo-term">Common Failure</dt>
                              <dd className="demo-def">{entry.demonstrationSpec.commonFailure}</dd>
                            </div>
                            <div className="demo-row">
                              <dt className="demo-term">Recommended Viewpoints</dt>
                              <dd className="demo-def">
                                <ul className="demo-viewpoints">
                                  {entry.demonstrationSpec.recommendedViewpoints.map((vp, i) => (
                                    <li key={i}>{vp}</li>
                                  ))}
                                </ul>
                              </dd>
                            </div>
                            <div className="demo-row">
                              <dt className="demo-term">Animation Notes</dt>
                              <dd className="demo-def demo-def--dim">{entry.demonstrationSpec.animationNotes}</dd>
                            </div>
                          </dl>
                        </div>
                      )}
                      {entry.response.nextRequiredCard === "Demonstration" && !entry.demonstrationSpec && (
                        <p className="next-card-body next-card-body--dim">
                          Film your next session and look for where this shows up.
                        </p>
                      )}
                    </section>

                    {/* Witness Review */}
                    {entry.witnessReview && (
                      <section className={`review-card review-${entry.witnessReview.verdict.toLowerCase()}`}>
                        <div className="review-header">
                          <span className={`review-verdict rv-${entry.witnessReview.verdict.toLowerCase()}`}>
                            {entry.witnessReview.verdict}
                          </span>
                          <span className="review-conf">
                            {Math.round(entry.witnessReview.confidence * 100)}%
                          </span>
                        </div>
                        <p className="review-claim">{entry.witnessReview.claim}</p>
                        {entry.witnessReview.supportingEvidence.length > 0 && (
                          <div className="review-ev-group">
                            <span className="review-ev-label">Supporting</span>
                            <ul className="review-ev-list">
                              {entry.witnessReview.supportingEvidence.map((ev, i) => (
                                <li key={i} className="review-ev-item review-ev-item--support">{ev}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {entry.witnessReview.contradictingEvidence.length > 0 && (
                          <div className="review-ev-group">
                            <span className="review-ev-label">Contradicting</span>
                            <ul className="review-ev-list">
                              {entry.witnessReview.contradictingEvidence.map((ev, i) => (
                                <li key={i} className="review-ev-item review-ev-item--contra">{ev}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="review-next">
                          <span className="review-next-label">Recommended Next Card</span>
                          <span className="review-next-card">{entry.witnessReview.recommendedNextCard}</span>
                        </div>
                      </section>
                    )}

                    {/* Adjustment */}
                    {entry.adjustment && (
                      <section className={`adj-card${entry.adjustment.nextCard === null ? " adj-card--complete" : ""}`}>
                        <div className="adj-header">
                          <span className="adj-decision">{entry.adjustment.decision}</span>
                          {entry.adjustment.nextCard && (
                            <span className="adj-next-pill">{entry.adjustment.nextCard}</span>
                          )}
                        </div>
                        <p className="adj-reason">{entry.adjustment.reason}</p>
                        <p className="adj-benefit">{entry.adjustment.expectedBenefit}</p>
                      </section>
                    )}

                    {/* Orchestration */}
                    {entry.orchestration && (
                      <section className={`orch-card${entry.orchestration.nextCard === null ? " orch-card--done" : ""}`}>
                        <div className="orch-header">
                          <span className="orch-label">Thread</span>
                          {entry.orchestration.nextCard ? (
                            <span className="orch-next">{entry.orchestration.nextCard}</span>
                          ) : (
                            <span className="orch-done">Complete</span>
                          )}
                        </div>
                        <p className="orch-reason">{entry.orchestration.reason}</p>
                        {entry.orchestration.requiredInputs.length > 0 && (
                          <div className="orch-inputs">
                            <span className="orch-inputs-label">Required</span>
                            <ul className="orch-inputs-list">
                              {entry.orchestration.requiredInputs.map((inp, i) => (
                                <li key={i}>{inp}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <p className="orch-outcome">{entry.orchestration.expectedOutcome}</p>
                      </section>
                    )}
                  </>
                )}

                {/* Deep Model */}
                {entry.deepModel && (
                  <section className="deep-model-card" aria-label="Deep Model">
                    <span className="section-label">Deep Model</span>
                    <p className="dm-model">{entry.deepModel.deepModel}</p>
                    <div className="dm-field">
                      <span className="dm-label">Leverage Point</span>
                      <p className="dm-value">{entry.deepModel.leveragePoint}</p>
                    </div>
                    {entry.deepModel.caution && (
                      <div className="dm-field">
                        <span className="dm-label">Caution</span>
                        <p className="dm-value dm-caution">{entry.deepModel.caution}</p>
                      </div>
                    )}
                  </section>
                )}

                {/* Discovery */}
                {entry.evidence.length > 0 && (
                  <section className="research-group" aria-label="Discovery">
                    <span className="section-label">Discovery</span>
                    {entry.evidence.map((card, i) => (
                      <article key={i} className="research-card">
                        <span className="discovery-index">Discovery {i + 1}</span>
                        <p className="research-body">{card.summary}</p>
                        <p className="research-why">{card.relevance}</p>
                        {card.url ? (
                          <a
                            className="badge badge-source badge-link"
                            href={card.url}
                            rel="noreferrer noopener"
                            target="_blank"
                          >
                            {card.source}
                          </a>
                        ) : (
                          <span className="badge badge-source">{card.source}</span>
                        )}
                      </article>
                    ))}
                  </section>
                )}

              </div>
            ))}

            {/* Thinking */}
            {phase === "LOADING" && (
              <div className="entry">
                <p className="intent-echo intent-echo--loading">{activeIntent}</p>
                <div className="thinking" aria-label="Thinking">
                  <span /><span /><span />
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
                placeholder="What are you working on?"
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
          overflow: hidden;
        }

        /* ── Header ──────────────────────────────────────────────────────── */

        .hd {
          align-items: center;
          border-bottom: 1px solid rgba(26, 26, 24, 0.07);
          display: flex;
          flex-shrink: 0;
          padding: 14px clamp(20px, 5vw, 48px);
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

        /* ── Empty state ─────────────────────────────────────────────────── */

        .empty {
          align-items: flex-start;
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 28px;
          justify-content: center;
          margin: 0 auto;
          max-width: 640px;
          padding: 0 clamp(20px, 5vw, 48px) 80px;
          width: 100%;
        }

        .main-q {
          color: #1a1a18;
          font-size: clamp(28px, 5vw, 44px);
          font-weight: 700;
          line-height: 1.1;
          margin: 0;
        }

        .main-form {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
        }

        .main-input {
          background: #fff;
          border: 1.5px solid rgba(26, 26, 24, 0.12);
          border-radius: 12px;
          color: #1a1a18;
          font: inherit;
          font-size: 17px;
          line-height: 1.5;
          outline: none;
          padding: 14px 18px;
          transition: border-color 0.15s;
          width: 100%;
          box-sizing: border-box;
        }

        .main-input:focus {
          border-color: rgba(26, 26, 24, 0.28);
        }

        .main-input::placeholder {
          color: rgba(26, 26, 24, 0.28);
        }

        .main-controls {
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
          display: flex;
          flex: 1;
          flex-direction: column;
          min-height: 0;
        }

        .thread {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 52px;
          margin: 0 auto;
          max-width: 680px;
          min-height: 0;
          overflow-y: auto;
          padding: 36px clamp(20px, 5vw, 48px) 24px;
          width: 100%;
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

        /* ── Thinking ────────────────────────────────────────────────────── */

        .thinking {
          align-items: center;
          display: flex;
          gap: 5px;
        }

        .thinking span {
          animation: dotrise 1.4s ease-in-out infinite;
          background: rgba(26, 26, 24, 0.2);
          border-radius: 50%;
          display: block;
          height: 6px;
          width: 6px;
        }

        .thinking span:nth-child(2) { animation-delay: 0.18s; }
        .thinking span:nth-child(3) { animation-delay: 0.36s; }

        @keyframes dotrise {
          0%, 60%, 100% { opacity: 0.2; transform: translateY(0); }
          30% { opacity: 0.6; transform: translateY(-4px); }
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
          margin: 0 0 14px;
        }

        .ins-sub {
          border-top: 1px solid rgba(26, 26, 24, 0.06);
          padding-top: 12px;
        }

        .ins-sub-body {
          color: rgba(26, 26, 24, 0.52);
          font-size: 14px;
          line-height: 1.55;
          margin: 0;
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

        /* ── Mental Model card ───────────────────────────────────────────── */

        .mm-card {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .mm-framework {
          color: #1a1a18;
          font-size: 15px;
          font-weight: 450;
          line-height: 1.6;
          margin: 0;
        }

        .mm-rows {
          border-top: 1px solid rgba(62, 140, 38, 0.12);
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin: 0;
          padding-top: 14px;
        }

        .mm-row {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .mm-term {
          color: rgba(26, 26, 24, 0.32);
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .mm-def {
          color: rgba(26, 26, 24, 0.62);
          font-size: 13px;
          line-height: 1.5;
          margin: 0;
        }

        .mm-def--rule {
          color: #1a1a18;
          font-size: 14px;
          font-weight: 550;
        }

        /* ── Demonstration spec ──────────────────────────────────────────── */

        .demo-spec {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .demo-badges {
          display: flex;
          gap: 6px;
        }

        .demo-badge {
          background: rgba(26, 26, 24, 0.05);
          border: 1px solid rgba(26, 26, 24, 0.08);
          border-radius: 4px;
          color: rgba(26, 26, 24, 0.42);
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.08em;
          padding: 3px 7px;
          text-transform: uppercase;
        }

        .demo-rows {
          border-top: 1px solid rgba(62, 140, 38, 0.12);
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin: 0;
          padding-top: 14px;
        }

        .demo-row {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .demo-term {
          color: rgba(26, 26, 24, 0.32);
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .demo-def {
          color: rgba(26, 26, 24, 0.68);
          font-size: 13px;
          line-height: 1.55;
          margin: 0;
        }

        .demo-def--key {
          color: #1a1a18;
          font-size: 14px;
          font-weight: 500;
        }

        .demo-def--dim {
          color: rgba(26, 26, 24, 0.42);
          font-style: italic;
        }

        .demo-viewpoints {
          display: flex;
          flex-direction: column;
          gap: 4px;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .demo-viewpoints li::before {
          color: rgba(62, 140, 38, 0.6);
          content: "→ ";
        }

        /* ── Experiment spec ─────────────────────────────────────────────── */

        .exp-spec {
          display: flex;
          flex-direction: column;
        }

        .exp-rows {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin: 0;
        }

        .exp-row {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .exp-criteria {
          background: rgba(26, 26, 24, 0.02);
          border: 1px solid rgba(26, 26, 24, 0.06);
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 12px 14px;
        }

        .exp-term {
          color: rgba(26, 26, 24, 0.32);
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .exp-def {
          color: rgba(26, 26, 24, 0.68);
          font-size: 13px;
          line-height: 1.55;
          margin: 0;
        }

        .exp-def--hyp {
          color: #1a1a18;
          font-size: 14px;
          font-weight: 500;
          line-height: 1.45;
        }

        .exp-def--success {
          color: #3d7a28;
        }

        .exp-def--failure {
          color: rgba(26, 26, 24, 0.52);
        }

        .exp-def--learn {
          color: rgba(26, 26, 24, 0.55);
          font-style: italic;
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
