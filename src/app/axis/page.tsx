"use client";

import { Mic, Paperclip } from "lucide-react";
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
  demonstration: "SEE IT",
  evidence_received: "RECEIVED",
  compare: "GAP",
  live_intervention: "SAY THIS",
  belief: "BELIEF",
  see_it: "SEE IT",
  try_this: "TRY THIS",
  show_me: "SHOW ME",
};

// ---------------------------------------------------------------------------
// Card component
// ---------------------------------------------------------------------------

function SeeItRenderer({ data }: { data: Record<string, unknown> }) {
  const current = data.currentPattern as { label?: string; objects?: string[]; relationships?: string[]; motion?: string[] } | undefined;
  const target = data.targetPattern as { label?: string; objects?: string[]; relationships?: string[]; motion?: string[] } | undefined;
  const primitives = data.primitives as string[] | undefined;
  return (
    <div className="see-it">
      {primitives && primitives.length > 0 && (
        <div className="see-it-primitives">
          {primitives.map((p) => (
            <span key={p} className="primitive-tag">{p}</span>
          ))}
        </div>
      )}
      <div className="see-it-patterns">
        {current && (
          <div className="pattern pattern--current">
            <span className="pattern-label">NOW</span>
            {current.label && <p className="pattern-name">{current.label}</p>}
            {(current.objects ?? []).length > 0 && (
              <p className="pattern-objects">{(current.objects ?? []).join(" · ")}</p>
            )}
            {(current.motion ?? []).length > 0 && (
              <p className="pattern-motion">{(current.motion ?? []).join(" → ")}</p>
            )}
          </div>
        )}
        {target && (
          <div className="pattern pattern--target">
            <span className="pattern-label">TARGET</span>
            {target.label && <p className="pattern-name">{target.label}</p>}
            {(target.objects ?? []).length > 0 && (
              <p className="pattern-objects">{(target.objects ?? []).join(" · ")}</p>
            )}
            {(target.motion ?? []).length > 0 && (
              <p className="pattern-motion">{(target.motion ?? []).join(" → ")}</p>
            )}
          </div>
        )}
      </div>
      <style jsx>{`
        .see-it { margin-top: 14px; }
        .see-it-primitives { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
        .primitive-tag {
          font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase;
          background: rgba(26,26,24,0.07); color: rgba(26,26,24,0.5);
          border-radius: 4px; padding: 3px 7px;
        }
        .see-it-patterns { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .pattern { border-radius: 8px; padding: 12px 14px; }
        .pattern--current { background: rgba(200,80,40,0.07); border: 1px solid rgba(200,80,40,0.14); }
        .pattern--target { background: rgba(60,140,60,0.07); border: 1px solid rgba(60,140,60,0.14); }
        .pattern-label {
          display: block; font-size: 9px; font-weight: 800; letter-spacing: 0.14em;
          text-transform: uppercase; color: rgba(26,26,24,0.35); margin-bottom: 6px;
        }
        .pattern-name { font-size: 13px; font-weight: 600; color: rgba(26,26,24,0.88); margin: 0 0 4px; }
        .pattern-objects { font-size: 11px; color: rgba(26,26,24,0.45); margin: 0 0 4px; }
        .pattern-motion { font-size: 11px; font-style: italic; color: rgba(26,26,24,0.55); margin: 0; }
      `}</style>
    </div>
  );
}

function CardView({ card }: { card: AxisCard }) {
  const isSeeIt = card.type === "see_it";
  return (
    <div className={`axis-card axis-card--${card.type}`}>
      <span className="card-label">{CARD_LABELS[card.type] ?? card.type.toUpperCase()}</span>
      <p className="card-body">{card.content}</p>
      {!isSeeIt && card.secondary && <p className="card-secondary">{card.secondary}</p>}
      {isSeeIt && card.data && <SeeItRenderer data={card.data} />}
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
        .axis-card--demonstration {
          background: rgba(60, 80, 140, 0.08);
          border: 1px solid rgba(60, 80, 140, 0.16);
        }
        .axis-card--evidence_received {
          background: rgba(250, 250, 249, 0.055);
          border: 1px solid rgba(250, 250, 249, 0.1);
        }
        .axis-card--compare {
          background: rgba(200, 80, 40, 0.07);
          border: 1px solid rgba(200, 80, 40, 0.14);
        }
        .axis-card--live_intervention {
          background: rgba(140, 190, 40, 0.13);
          border: 2px solid rgba(140, 190, 40, 0.3);
        }
        .axis-card--belief {
          background: #fff;
          border: 1px solid rgba(26, 26, 24, 0.1);
        }
        .axis-card--see_it {
          background: #fff;
          border: 1px solid rgba(26, 26, 24, 0.08);
        }
        .axis-card--try_this {
          background: rgba(26, 26, 24, 0.96);
          border: none;
        }
        .axis-card--show_me {
          background: rgba(250, 250, 249, 0.055);
          border: 1px solid rgba(250, 250, 249, 0.12);
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
        .axis-card--question .card-label,
        .axis-card--evidence_received .card-label,
        .axis-card--show_me .card-label {
          color: rgba(250, 250, 249, 0.3);
        }
        .axis-card--breakthrough .card-label,
        .axis-card--live_intervention .card-label {
          color: rgba(140, 190, 40, 0.7);
        }
        .axis-card--demonstration .card-label {
          color: rgba(60, 80, 140, 0.55);
        }
        .axis-card--compare .card-label {
          color: rgba(200, 80, 40, 0.6);
        }
        .axis-card--try_this .card-label {
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
        .axis-card--breakthrough .card-body,
        .axis-card--evidence_received .card-body,
        .axis-card--live_intervention .card-body,
        .axis-card--try_this .card-body,
        .axis-card--show_me .card-body {
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
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const voiceRef = useRef<SpeechRecognition | null>(null);

  const isActive = conversations.length > 0 || phase === "loading";

  // Mount/unmount trace — unexpected unmount during a session = remount bug
  useEffect(() => {
    console.log("[MOBILE_TRACE] AxisPage mounted");
    return () => { console.log("[MOBILE_TRACE] AxisPage unmounted"); };
  }, []);

  // Deep trace: intercept history, popstate, storage, resize
  // Catches: Supabase URL mutations, cross-tab auth changes, browser back/fwd, keyboard resize
  useEffect(() => {
    // Intercept history mutations (Supabase detectSessionInUrl can call replaceState)
    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    history.pushState = function (...args: [any, any, any]) {
      console.log("[MOBILE_TRACE] history.pushState →", args[2]);
      return origPush(...args);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    history.replaceState = function (...args: [any, any, any]) {
      console.log("[MOBILE_TRACE] history.replaceState →", args[2]);
      return origReplace(...args);
    };

    const onPop = () =>
      console.log("[MOBILE_TRACE] popstate, href:", window.location.href);
    const onStorage = (e: StorageEvent) =>
      console.log("[MOBILE_TRACE] storage event, key:", e.key, "new:", String(e.newValue).slice(0, 60));
    const onResize = () =>
      console.log("[MOBILE_TRACE] window resize, innerHeight:", window.innerHeight, "innerWidth:", window.innerWidth);
    const onVisibility = () =>
      console.log("[MOBILE_TRACE] visibilitychange →", document.visibilityState);

    window.addEventListener("popstate", onPop);
    window.addEventListener("storage", onStorage);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      history.pushState = origPush;
      history.replaceState = origReplace;
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // State transition trace — fires whenever isActive, authPhase, or phase change
  useEffect(() => {
    console.log(
      "[MOBILE_TRACE] state transition → authPhase:", authPhase,
      "| phase:", phase,
      "| isActive:", isActive,
      "| conversations:", conversations.length,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authPhase, phase, isActive, conversations.length]);

  // Auth + thread restore on mount
  useEffect(() => {
    async function init() {
      console.log("[MOBILE_TRACE] init start, href:", window.location.href);

      const sb = getSupabaseBrowserClient();
      if (!sb) {
        console.log("[MOBILE_TRACE] no supabase client → guest (no thread restore)");
        setAuthPhase("guest");
        return;
      }

      const {
        data: { user },
      } = await sb.auth.getUser();
      console.log("[MOBILE_TRACE] auth resolved, user:", user ? user.id.slice(0, 8) : "null");

      // Collect auth state but DO NOT set authPhase yet.
      // authPhase controls the loading screen — we keep it as "loading" until
      // thread restore also completes, so the home screen never flashes while
      // a thread fetch is in-flight (race condition that caused the iOS snap).
      const nextPhase: AuthPhase = user ? "signed_in" : "guest";
      const nextLabel = user ? (user.email ?? user.id.slice(0, 8)) : "Guest";
      const nextType = user ? "Google" : "Guest";

      // Thread restore — must finish before we exit the loading screen
      const savedId = localStorage.getItem("axis_thread_id");
      console.log("[MOBILE_TRACE] savedId:", savedId ?? "none");

      if (savedId) {
        try {
          console.log("[MOBILE_TRACE] thread restore fetch start");
          const res = await fetch(`/api/axis/thread?id=${savedId}`);
          console.log("[MOBILE_TRACE] thread restore response:", res.status);
          if (res.ok) {
            const data = (await res.json()) as {
              conversations: Conversation[];
              sidebarThreads: SidebarThread[];
            };
            if (data.conversations?.length > 0) {
              console.log("[MOBILE_TRACE] thread restore success,", data.conversations.length, "conversations");
              setThreadId(savedId);
              setConversations(data.conversations);
              setRevealIndex(9999);
              setPhase("results");
              setSidebarThreads(data.sidebarThreads ?? []);
            } else {
              console.log("[MOBILE_TRACE] thread restore: empty thread, clearing key");
              localStorage.removeItem("axis_thread_id");
            }
          } else {
            console.log("[MOBILE_TRACE] thread restore: non-ok response, clearing key");
            localStorage.removeItem("axis_thread_id");
          }
        } catch (err) {
          console.log("[MOBILE_TRACE] thread restore error:", (err as Error).message);
          localStorage.removeItem("axis_thread_id");
        }
      }

      // Set auth state last. This exits the loading screen.
      // All thread state is settled before this point.
      console.log("[MOBILE_TRACE] setting authPhase →", nextPhase);
      setAuthLabel(nextLabel);
      setAuthType(nextType);
      setAuthPhase(nextPhase);
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

  function clearAttachment() {
    setPendingFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function run(message: string) {
    const msg = message.trim();
    const fileToUpload = pendingFile; // capture before clearAttachment
    const hasFile = fileToUpload !== null;
    if (!msg && !hasFile) return;
    if (phase === "loading") return;

    const originalFileName = fileToUpload?.name ?? null;
    setPhase("loading");
    setInput("");
    clearAttachment();

    // Upload attachment first if present
    let attachmentUrl: string | null = null;
    let attachmentMime: string | null = null;
    let attachmentPath: string | null = null;
    let displayFileName = originalFileName;

    if (fileToUpload) {
      try {
        const fd = new FormData();
        fd.append("file", fileToUpload);
        if (threadId) fd.append("threadId", threadId);
        const upRes = await fetch("/api/axis/evidence/upload", { method: "POST", body: fd });
        if (upRes.ok) {
          const up = (await upRes.json()) as {
            attachmentUrl: string;
            attachmentPath: string;
            mimeType: string;
            fileName: string;
          };
          attachmentUrl = up.attachmentUrl;
          attachmentMime = up.mimeType;
          attachmentPath = up.attachmentPath;
          displayFileName = up.fileName;
        } else {
          console.error("[axis] upload failed", upRes.status);
        }
      } catch (err) {
        console.error("[axis] upload error", (err as Error).message);
      }

      // File-only message with failed upload — abort
      if (!attachmentUrl && !msg) {
        setPhase("results");
        return;
      }
    }

    try {
      const res = await fetch("/api/axis/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          threadId,
          attachmentUrl,
          attachmentType: attachmentMime,
          attachmentPath,
          fileName: displayFileName,
        }),
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
        userMessage: msg || (displayFileName ? `[${displayFileName}]` : ""),
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
    clearAttachment();
    localStorage.removeItem("axis_thread_id");
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
              inputMode="text"
              onFocus={() => console.log("[MOBILE_TRACE] home-input focus, phase:", phase, "authPhase:", authPhase, "isActive:", isActive)}
              onBlur={() => console.log("[MOBILE_TRACE] home-input blur")}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void run(input);
                }
              }}
            />
            {pendingFile && (
              <div className="attachment-badge">
                <span className="attachment-name">{pendingFile.name}</span>
                <button
                  type="button"
                  className="attachment-remove"
                  onClick={clearAttachment}
                  aria-label="Remove attachment"
                >
                  ×
                </button>
              </div>
            )}
            <div className="home-controls">
              <button
                type="button"
                className="ctrl-btn"
                onClick={() => fileRef.current?.click()}
                aria-label="Attach file"
              >
                <Paperclip size={15} />
              </button>
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
                disabled={!input.trim() && !pendingFile}
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
            {pendingFile && (
              <div className="attachment-badge attachment-badge--thread">
                <span className="attachment-name">{pendingFile.name}</span>
                <button
                  type="button"
                  className="attachment-remove"
                  onClick={clearAttachment}
                  aria-label="Remove attachment"
                >
                  ×
                </button>
              </div>
            )}
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
                onClick={() => fileRef.current?.click()}
                aria-label="Attach file"
              >
                <Paperclip size={15} />
              </button>
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
                inputMode="text"
                onFocus={() => console.log("[MOBILE_TRACE] bottom-input focus, phase:", phase)}
                onBlur={() => console.log("[MOBILE_TRACE] bottom-input blur")}
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
                disabled={(!input.trim() && !pendingFile) || phase === "loading"}
                aria-label="Send"
              >
                →
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Hidden file input — triggered by Paperclip buttons */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          setPendingFile(file);
        }}
      />

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
          max-width: 100%;
          overflow-x: hidden;
          width: 100%;
        }
      `}</style>
      <style jsx>{`
        /* ── Home ────────────────────────────── */
        .home {
          align-items: center;
          display: flex;
          flex-direction: column;
          justify-content: center;
          max-width: 100vw;
          min-height: 100svh;
          overflow-x: hidden;
          padding: 48px 20px 64px;
          position: relative;
          width: 100%;
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
          font-size: clamp(24px, 7vw, 34px);
          font-weight: 640;
          line-height: 1.15;
          margin-bottom: 28px;
          max-width: 100%;
          overflow-wrap: break-word;
          text-align: center;
          width: 100%;
        }

        .home-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-width: 520px;
          min-width: 0;
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
          max-width: 100%;
          min-height: 88px;
          min-width: 0;
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
          max-width: 100%;
          width: 100%;
        }

        .send-btn {
          background: rgba(250, 250, 249, 0.9);
          border: none;
          border-radius: 8px;
          color: #0e0e0c;
          cursor: pointer;
          flex-shrink: 0;
          font: inherit;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.04em;
          max-width: 96px;
          min-height: 44px;
          min-width: 64px;
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
          height: 44px;
          justify-content: center;
          min-width: 44px;
          transition: background 0.1s, color 0.1s;
          width: 44px;
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
          -webkit-overflow-scrolling: touch;
          padding: 24px 20px calc(140px + env(safe-area-inset-bottom));
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
          height: 44px;
          min-width: 44px;
          padding: 0 16px;
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
          max-width: 100vw;
          padding: 10px max(14px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left));
          position: fixed;
          right: 0;
          width: 100%;
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
          font-size: 16px;
          line-height: 1.5;
          min-height: 44px;
          min-width: 0;
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

        /* ── Attachment badge ────────────────── */
        .attachment-badge {
          align-items: center;
          background: rgba(140, 190, 40, 0.1);
          border: 1px solid rgba(140, 190, 40, 0.2);
          border-radius: 8px;
          display: flex;
          gap: 8px;
          justify-content: space-between;
          margin: 0 0 6px;
          padding: 8px 12px;
        }

        .attachment-badge--thread {
          margin: 0 14px 8px;
        }

        .attachment-name {
          color: rgba(250, 250, 249, 0.7);
          font-size: 12px;
          letter-spacing: 0.02em;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .attachment-remove {
          background: none;
          border: none;
          color: rgba(250, 250, 249, 0.4);
          cursor: pointer;
          flex-shrink: 0;
          font-size: 16px;
          height: 24px;
          line-height: 1;
          padding: 0;
          width: 24px;
        }
      `}</style>
    </>
  );
}
