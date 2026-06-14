"use client";

import { CameraIcon, Mic, Upload } from "lucide-react";
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

interface EvidenceCard {
  source: string;
  summary: string;
  relevance: string;
  url?: string;
}

interface ThreadEntry {
  id: string;
  intent: string;
  response: InsightResponse | null;
  mentalModelCard: MentalModelCard | null;
  demonstrationSpec: DemonstrationSpec | null;
  experimentSpec: ExperimentSpec | null;
  evidence: EvidenceCard[];
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
  const [voiceActive, setVoiceActive] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [isVoiceSupported, setIsVoiceSupported] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isEmpty = thread.length === 0 && phase === "IDLE";

  useEffect(() => {
    setIsVoiceSupported(
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window),
    );
    return () => {
      recognitionRef.current?.abort();
      abortRef.current?.abort();
      streamRef.current?.getTracks().forEach((t) => t.stop());
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
  // Camera
  // -------------------------------------------------------------------------

  function startCamera() {
    if (cameraOn) return;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" } })
      .then((stream) => {
        streamRef.current = stream;
        setCameraOn(true);
      })
      .catch(() => null);
  }

  // -------------------------------------------------------------------------
  // Voice
  // -------------------------------------------------------------------------

  function toggleVoice() {
    if (voiceActive) {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      setVoiceActive(false);
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
    setVoiceActive(true);
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const result = e.results[0];
      const text = result[0].transcript;
      if (inputRef.current) inputRef.current.value = text;
      if (result.isFinal && !handled) {
        handled = true;
        recognitionRef.current = null;
        setVoiceActive(false);
        void run(text);
      }
    };
    rec.onerror = () => { if (!handled) setVoiceActive(false); };
    rec.onend = () => { if (!handled) setVoiceActive(false); };
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
        }
      }

      const entry: ThreadEntry = {
        id: uid(),
        intent: val,
        response,
        mentalModelCard,
        demonstrationSpec,
        experimentSpec,
        evidence,
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
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
            <div className="main-controls">
              <button
                className={`ctrl-btn${cameraOn ? " on" : ""}`}
                onClick={startCamera}
                type="button"
                aria-label="Camera"
              >
                <CameraIcon size={15} strokeWidth={1.8} />
                <span>Camera</span>
              </button>
              <button
                className="ctrl-btn"
                onClick={() => { window.location.href = "/axis-ball"; }}
                type="button"
                aria-label="Upload"
              >
                <Upload size={15} strokeWidth={1.8} />
                <span>Upload</span>
              </button>
              <button
                className={`ctrl-btn${voiceActive ? " on" : ""}`}
                onClick={toggleVoice}
                type="button"
                aria-label="Voice"
                disabled={!isVoiceSupported}
              >
                <Mic size={15} strokeWidth={1.8} />
                <span>Voice</span>
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
          </header>

          <div className="thread" ref={threadRef}>

            {thread.map((entry) => (
              <div key={entry.id} className="entry">

                {/* Intent echo */}
                <p className="intent-echo">{entry.intent}</p>

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
                      {entry.response.nextRequiredCard === "Witness" && entry.response.witnessPrompt && (
                        <p className="next-card-body">{entry.response.witnessPrompt}</p>
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
                  </>
                )}

                {/* Evidence */}
                {entry.evidence.length > 0 && (
                  <section className="research-group" aria-label="Evidence">
                    <span className="section-label">Evidence</span>
                    {entry.evidence.map((card, i) => (
                      <article key={i} className="research-card">
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
                        <p className="research-body">{card.summary}</p>
                        <p className="research-why">{card.relevance}</p>
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
            <form className="bottom-form" onSubmit={handleSubmit}>
              <div className="bottom-ctls">
                <button
                  className={`ctrl-btn sm${cameraOn ? " on" : ""}`}
                  onClick={startCamera}
                  type="button"
                  aria-label="Camera"
                >
                  <CameraIcon size={13} strokeWidth={1.8} />
                </button>
                <button
                  className="ctrl-btn sm"
                  onClick={() => { window.location.href = "/axis-ball"; }}
                  type="button"
                  aria-label="Upload"
                >
                  <Upload size={13} strokeWidth={1.8} />
                </button>
                <button
                  className={`ctrl-btn sm${voiceActive ? " on" : ""}`}
                  onClick={toggleVoice}
                  type="button"
                  aria-label="Voice"
                  disabled={!isVoiceSupported}
                >
                  <Mic size={13} strokeWidth={1.8} />
                </button>
              </div>
              <input
                ref={inputRef}
                className="bottom-input"
                placeholder="What are you working on?"
                type="text"
                spellCheck={false}
                autoComplete="off"
              />
              <button className="bottom-send" type="submit" aria-label="Send">
                →
              </button>
            </form>
          </div>

        </div>
      )}

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

        .ctrl-btn:disabled {
          cursor: not-allowed;
          opacity: 0.38;
        }

        .ctrl-btn.sm {
          min-height: 30px;
          padding: 0 8px;
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

      `}</style>
    </main>
  );
}
