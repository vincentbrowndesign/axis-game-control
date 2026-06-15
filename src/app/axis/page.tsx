"use client";

import { Mic } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DevSidebar } from "../../components/axis/dev-sidebar";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";
import type { AxisCard, SidebarThread } from "../../lib/axis-server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Conversation {
  id: string;
  userMessage: string;
  cards: AxisCard[];
  timestamp: string;
}

type AuthPhase = "loading" | "guest" | "signed_in";
type Phase = "idle" | "loading" | "results";

const CARD_LABELS: Record<string, string> = {
  insight: "INSIGHT",
  question: "TELL ME",
  experiment: "TRY THIS",
  evidence_request: "SHARE",
  breakthrough: "BREAKTHROUGH",
  next_action: "NEXT",
};

// ---------------------------------------------------------------------------
// Card component
// ---------------------------------------------------------------------------

function CardView({ card }: { card: AxisCard }) {
  return (
    <div className={`axis-card axis-card--${card.type}`}>
      <span className="card-label">{CARD_LABELS[card.type] ?? card.type.toUpperCase()}</span>
      <p className="card-body">{card.content}</p>
      {card.secondary && <p className="card-secondary">{card.secondary}</p>}
      {card.cue && <p className="card-cue">{card.cue}</p>}
      <style jsx>{`
        .axis-card {
          background: #fff;
          border-radius: 12px;
          padding: 20px 22px 22px;
          animation: cardReveal 0.22s ease-out;
        }
        @keyframes cardReveal {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .axis-card--question {
          background: rgba(250, 250, 249, 0.055);
          border: 1px solid rgba(250, 250, 249, 0.1);
        }
        .axis-card--breakthrough {
          background: rgba(140, 190, 40, 0.09);
          border: 1px solid rgba(140, 190, 40, 0.18);
        }
        .card-label {
          display: block;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.14em;
          color: rgba(26, 26, 24, 0.3);
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        .axis-card--question .card-label {
          color: rgba(250, 250, 249, 0.3);
        }
        .axis-card--breakthrough .card-label {
          color: rgba(140, 190, 40, 0.7);
        }
        .card-body {
          font-size: 16px;
          line-height: 1.55;
          color: rgba(26, 26, 24, 0.92);
          margin: 0;
          font-weight: 460;
        }
        .axis-card--question .card-body,
        .axis-card--breakthrough .card-body {
          color: rgba(250, 250, 249, 0.88);
        }
        .card-secondary {
          font-size: 13px;
          color: rgba(26, 26, 24, 0.48);
          line-height: 1.55;
          margin: 10px 0 0;
        }
        .card-cue {
          font-size: 13px;
          color: rgba(26, 26, 24, 0.72);
          line-height: 1.5;
          margin: 10px 0 0;
          padding-top: 10px;
          border-top: 1px solid rgba(26, 26, 24, 0.08);
          font-style: italic;
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AxisPage() {
  const [authPhase, setAuthPhase] = useState<AuthPhase>("loading");
  const [authLabel, setAuthLabel] = useState("Guest");
  const [authType, setAuthType] = useState("Guest");
  const [phase, setPhase] = useState<Phase>("idle");
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [revealIndex, setRevealIndex] = useState(0);
  const [sidebarThreads, setSidebarThreads] = useState<SidebarThread[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [voicePhase, setVoicePhase] = useState<"OFF" | "LISTENING" | "PROCESSING">("OFF");

  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const voiceRef = useRef<SpeechRecognition | null>(null);

  const isActive = conversations.length > 0 || phase === "loading";

  // Auth + thread restore on mount
  useEffect(() => {
    async function init() {
      const sb = getSupabaseBrowserClient();
      if (!sb) {
        setAuthPhase("guest");
        return;
      }

      const {
        data: { user },
      } = await sb.auth.getUser();

      if (user) {
        setAuthLabel(user.email ?? user.id.slice(0, 8));
        setAuthType("Google");
        setAuthPhase("signed_in");
      } else {
        setAuthPhase("guest");
      }

      // Restore last thread
      const savedId = localStorage.getItem("axis_thread_id");
      if (savedId) {
        try {
          const res = await fetch(`/api/axis/thread?id=${savedId}`);
          if (res.ok) {
            const data = (await res.json()) as {
              conversations: Conversation[];
              sidebarThreads: SidebarThread[];
            };
            if (data.conversations?.length > 0) {
              setThreadId(savedId);
              setConversations(data.conversations);
              setRevealIndex(9999);
              setPhase("results");
              setSidebarThreads(data.sidebarThreads ?? []);
            }
          }
        } catch {
          // restore failed — start fresh
        }
      }
    }
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll on new content
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [conversations, revealIndex, phase]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async function run(message: string) {
    const msg = message.trim();
    if (!msg || phase === "loading") return;

    setPhase("loading");
    setInput("");

    try {
      const res = await fetch("/api/axis/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, threadId }),
      });

      if (!res.ok) {
        console.error("[axis] run failed", res.status);
        setPhase("results");
        return;
      }

      const data = (await res.json()) as {
        threadId: string;
        cards: AxisCard[];
        sidebarThreads: SidebarThread[];
      };

      const conv: Conversation = {
        id: crypto.randomUUID(),
        userMessage: msg,
        cards: data.cards,
        timestamp: new Date().toISOString(),
      };

      setThreadId(data.threadId);
      localStorage.setItem("axis_thread_id", data.threadId);
      setConversations((prev) => [...prev, conv]);
      setRevealIndex(1);
      setSidebarThreads(data.sidebarThreads ?? []);
      setPhase("results");
    } catch (err) {
      console.error("[axis] run error", (err as Error).message);
      setPhase("results");
    }
  }

  function advance() {
    setRevealIndex((r) => r + 1);
  }

  function startNewThread() {
    setThreadId(null);
    setConversations([]);
    setPhase("idle");
    setInput("");
    setRevealIndex(0);
    localStorage.removeItem("axis_thread_id");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function loadThread(id: string) {
    setIsSidebarOpen(false);
    try {
      const res = await fetch(`/api/axis/thread?id=${id}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        conversations: Conversation[];
        sidebarThreads: SidebarThread[];
      };
      setThreadId(id);
      setConversations(data.conversations ?? []);
      setRevealIndex(9999);
      setPhase(data.conversations?.length ? "results" : "idle");
      setSidebarThreads(data.sidebarThreads ?? []);
      localStorage.setItem("axis_thread_id", id);
    } catch {
      // ignore
    }
  }

  async function handleSignIn() {
    const sb = getSupabaseBrowserClient();
    if (!sb) return;
    await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/axis` } });
  }

  async function handleSignOut() {
    const sb = getSupabaseBrowserClient();
    if (!sb) return;
    await sb.auth.signOut();
    setAuthLabel("Guest");
    setAuthType("Guest");
    setAuthPhase("guest");
  }

  // ---------------------------------------------------------------------------
  // Voice
  // ---------------------------------------------------------------------------

  function toggleVoice() {
    if (voicePhase === "LISTENING") {
      voiceRef.current?.stop();
      setVoicePhase("OFF");
      return;
    }

    type SR = typeof window.SpeechRecognition;
    const SpeechRecognition: SR | undefined =
      window.SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition: SR | undefined }).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sr = new SpeechRecognition() as any;
    sr.continuous = false;
    sr.interimResults = false;
    sr.lang = "en-US";

    sr.onstart = () => setVoicePhase("LISTENING");
    sr.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[0]?.[0]?.transcript ?? "";
      setVoicePhase("OFF");
      if (text.trim()) {
        void run(text.trim());
      }
    };
    sr.onerror = () => setVoicePhase("OFF");
    sr.onend = () => setVoicePhase("OFF");

    voiceRef.current = sr;
    sr.start();
  }

  // ---------------------------------------------------------------------------
  // Loading screen
  // ---------------------------------------------------------------------------

  if (authPhase === "loading") {
    return (
      <div className="init-screen">
        <span className="init-mark">AXIS</span>
        <style jsx>{`
          .init-screen {
            align-items: center;
            background: #0e0e0c;
            display: flex;
            height: 100vh;
            justify-content: center;
          }
          .init-mark {
            color: rgba(250, 250, 249, 0.14);
            font-size: 11px;
            font-weight: 750;
            letter-spacing: 0.26em;
            text-transform: uppercase;
          }
        `}</style>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const lastConvIdx = conversations.length - 1;

  return (
    <>
      <DevSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeThreadId={threadId}
        threads={sidebarThreads}
        authLabel={authLabel}
        authType={authType}
        isGuest={authPhase !== "signed_in"}
        onSelectThread={loadThread}
        onNewThread={startNewThread}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />

      {!isActive ? (
        // ── HOME SCREEN ──────────────────────────────────────────────────────
        <div className="home">
          {sidebarThreads.length > 0 && (
            <button
              className="sidebar-toggle sidebar-toggle--home"
              onClick={() => setIsSidebarOpen(true)}
              type="button"
              aria-label="Open threads"
            >
              ☰
            </button>
          )}
          <p className="home-mark">AXIS</p>
          <h1 className="home-q">What are you working on?</h1>
          <form
            className="home-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(input);
            }}
          >
            <textarea
              ref={inputRef}
              className="home-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe what you're trying to develop…"
              rows={3}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void run(input);
                }
              }}
            />
            <div className="home-controls">
              <button
                type="button"
                className="ctrl-btn"
                onClick={toggleVoice}
                aria-label="Voice input"
              >
                {voicePhase === "LISTENING" ? (
                  <span className="voice-dot" />
                ) : (
                  <Mic size={15} />
                )}
              </button>
              <button
                type="submit"
                className="send-btn"
                disabled={!input.trim()}
              >
                Go
              </button>
            </div>
          </form>
        </div>
      ) : (
        // ── THREAD SCREEN ─────────────────────────────────────────────────────
        <div className="thread-shell">
          <header className="hd">
            <button
              className="sidebar-toggle"
              onClick={() => setIsSidebarOpen(true)}
              type="button"
              aria-label="Open threads"
            >
              ☰
            </button>
            <span className="wordmark">AXIS</span>
            <button
              className="new-thread-btn"
              onClick={startNewThread}
              type="button"
            >
              + New
            </button>
          </header>

          <div className="thread" ref={threadRef}>
            {conversations.map((conv, convIdx) => {
              const isLast = convIdx === lastConvIdx;
              const visibleCount = isLast ? revealIndex : conv.cards.length;
              const visibleCards = conv.cards.slice(0, visibleCount);
              const hasMore = isLast && revealIndex < conv.cards.length && phase !== "loading";

              return (
                <div key={conv.id} className="entry">
                  <p className="user-msg">{conv.userMessage}</p>
                  {visibleCards.map((card, ci) => (
                    <CardView key={ci} card={card} />
                  ))}
                  {hasMore && (
                    <button className="advance-btn" onClick={advance} type="button">
                      →
                    </button>
                  )}
                </div>
              );
            })}

            {phase === "loading" && (
              <div className="entry">
                <div className="loading-row">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              </div>
            )}
          </div>

          <div className="bottom-bar">
            <form
              className="bottom-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(input);
              }}
            >
              <button
                type="button"
                className="ctrl-btn ctrl-btn--bottom"
                onClick={toggleVoice}
                aria-label="Voice input"
              >
                {voicePhase === "LISTENING" ? (
                  <span className="voice-dot" />
                ) : (
                  <Mic size={15} />
                )}
              </button>
              <textarea
                className="bottom-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Keep going…"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void run(input);
                  }
                }}
              />
              <button
                type="submit"
                className="bottom-send"
                disabled={!input.trim() || phase === "loading"}
                aria-label="Send"
              >
                →
              </button>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        *,
        *::before,
        *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        html,
        body {
          background: #0e0e0c;
          color: rgba(250, 250, 249, 0.88);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
      `}</style>
      <style jsx>{`
        /* ── Home ────────────────────────────── */
        .home {
          align-items: center;
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-height: 100svh;
          padding: 48px 24px 64px;
          position: relative;
        }

        .sidebar-toggle--home {
          left: 20px;
          position: absolute;
          top: 20px;
        }

        .home-mark {
          color: rgba(250, 250, 249, 0.22);
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.28em;
          margin-bottom: 40px;
          text-transform: uppercase;
        }

        .home-q {
          color: rgba(250, 250, 249, 0.88);
          font-size: 28px;
          font-weight: 640;
          line-height: 1.25;
          margin-bottom: 28px;
          max-width: 480px;
          text-align: center;
        }

        .home-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-width: 520px;
          width: 100%;
        }

        .home-input {
          background: rgba(250, 250, 249, 0.05);
          border: 1px solid rgba(250, 250, 249, 0.09);
          border-radius: 12px;
          color: rgba(250, 250, 249, 0.88);
          font: inherit;
          font-size: 16px;
          line-height: 1.5;
          min-height: 88px;
          outline: none;
          padding: 16px 18px;
          resize: none;
          transition: border-color 0.12s;
          width: 100%;
        }

        .home-input::placeholder {
          color: rgba(250, 250, 249, 0.24);
        }

        .home-input:focus {
          border-color: rgba(250, 250, 249, 0.18);
        }

        .home-controls {
          align-items: center;
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }

        .send-btn {
          background: rgba(250, 250, 249, 0.9);
          border: none;
          border-radius: 8px;
          color: #0e0e0c;
          cursor: pointer;
          font: inherit;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.04em;
          padding: 9px 22px;
          transition: opacity 0.1s;
        }

        .send-btn:disabled {
          opacity: 0.32;
          cursor: default;
        }

        /* ── Controls ────────────────────────── */
        .ctrl-btn {
          align-items: center;
          background: rgba(250, 250, 249, 0.06);
          border: 1px solid rgba(250, 250, 249, 0.08);
          border-radius: 8px;
          color: rgba(250, 250, 249, 0.44);
          cursor: pointer;
          display: flex;
          height: 36px;
          justify-content: center;
          transition: background 0.1s, color 0.1s;
          width: 36px;
        }

        .ctrl-btn:hover {
          background: rgba(250, 250, 249, 0.1);
          color: rgba(250, 250, 249, 0.72);
        }

        .ctrl-btn--bottom {
          flex-shrink: 0;
          height: 44px;
          width: 44px;
        }

        .voice-dot {
          background: #e34040;
          border-radius: 50%;
          display: block;
          height: 8px;
          width: 8px;
          animation: blink 1s infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        /* ── Sidebar toggle ──────────────────── */
        .sidebar-toggle {
          align-items: center;
          background: none;
          border: none;
          color: rgba(250, 250, 249, 0.38);
          cursor: pointer;
          display: flex;
          font-size: 16px;
          height: 36px;
          justify-content: center;
          padding: 0;
          width: 36px;
          transition: color 0.12s;
        }

        .sidebar-toggle:hover {
          color: rgba(250, 250, 249, 0.72);
        }

        /* ── Thread shell ────────────────────── */
        .thread-shell {
          display: flex;
          flex-direction: column;
          height: 100svh;
        }

        .hd {
          align-items: center;
          border-bottom: 1px solid rgba(250, 250, 249, 0.06);
          display: flex;
          flex-shrink: 0;
          gap: 12px;
          padding: 12px 16px;
        }

        .wordmark {
          color: rgba(250, 250, 249, 0.22);
          flex: 1;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.26em;
          text-align: center;
          text-transform: uppercase;
        }

        .new-thread-btn {
          background: none;
          border: none;
          color: rgba(140, 190, 40, 0.7);
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.04em;
          padding: 0;
          transition: color 0.12s;
        }

        .new-thread-btn:hover {
          color: rgba(140, 190, 40, 1);
        }

        /* ── Thread body ─────────────────────── */
        .thread {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 28px;
          overflow-y: auto;
          padding: 24px 20px 140px;
          scroll-behavior: smooth;
        }

        .entry {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .user-msg {
          color: rgba(250, 250, 249, 0.4);
          font-size: 14px;
          letter-spacing: 0.01em;
          line-height: 1.5;
          padding: 0 2px;
        }

        .advance-btn {
          align-self: flex-start;
          background: none;
          border: 1px solid rgba(250, 250, 249, 0.12);
          border-radius: 8px;
          color: rgba(250, 250, 249, 0.4);
          cursor: pointer;
          font: inherit;
          font-size: 16px;
          height: 36px;
          padding: 0 14px;
          transition: border-color 0.12s, color 0.12s;
        }

        .advance-btn:hover {
          border-color: rgba(250, 250, 249, 0.24);
          color: rgba(250, 250, 249, 0.72);
        }

        /* ── Loading ─────────────────────────── */
        .loading-row {
          align-items: center;
          display: flex;
          gap: 5px;
          padding: 4px 2px;
        }

        .dot {
          animation: pulse 1.1s ease-in-out infinite;
          background: rgba(250, 250, 249, 0.24);
          border-radius: 50%;
          height: 5px;
          width: 5px;
        }

        .dot:nth-child(2) {
          animation-delay: 0.18s;
        }

        .dot:nth-child(3) {
          animation-delay: 0.36s;
        }

        @keyframes pulse {
          0%, 80%, 100% {
            opacity: 0.28;
            transform: scale(0.8);
          }
          40% {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* ── Bottom bar ──────────────────────── */
        .bottom-bar {
          background: rgba(14, 14, 12, 0.94);
          backdrop-filter: blur(8px);
          border-top: 1px solid rgba(250, 250, 249, 0.06);
          bottom: 0;
          left: 0;
          padding: 10px 14px max(10px, env(safe-area-inset-bottom));
          position: fixed;
          right: 0;
        }

        .bottom-form {
          align-items: flex-end;
          display: flex;
          gap: 8px;
          margin: 0 auto;
          max-width: 720px;
        }

        .bottom-input {
          background: rgba(250, 250, 249, 0.06);
          border: 1px solid rgba(250, 250, 249, 0.09);
          border-radius: 10px;
          color: rgba(250, 250, 249, 0.88);
          flex: 1;
          font: inherit;
          font-size: 15px;
          line-height: 1.5;
          min-height: 44px;
          outline: none;
          padding: 10px 14px;
          resize: none;
          transition: border-color 0.12s;
        }

        .bottom-input::placeholder {
          color: rgba(250, 250, 249, 0.22);
        }

        .bottom-input:focus {
          border-color: rgba(250, 250, 249, 0.16);
        }

        .bottom-send {
          background: rgba(250, 250, 249, 0.9);
          border: none;
          border-radius: 8px;
          color: #0e0e0c;
          cursor: pointer;
          flex-shrink: 0;
          font: inherit;
          font-size: 18px;
          font-weight: 600;
          height: 44px;
          padding: 0 16px;
          transition: opacity 0.1s;
        }

        .bottom-send:disabled {
          cursor: default;
          opacity: 0.28;
        }
      `}</style>
    </>
  );
}
