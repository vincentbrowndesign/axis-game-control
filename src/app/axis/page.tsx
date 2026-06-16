"use client";

import { Mic, Paperclip } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DevSidebar } from "../../components/axis/dev-sidebar";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";
import { demonstrationFromUnderstanding, type AxisDemonstration } from "../../lib/axis-demonstration";
import type { AxisCard, AxisUnderstanding, SidebarThread } from "../../lib/axis-server";

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

// ---------------------------------------------------------------------------
// Demonstration — the visible representation of current understanding.
// Reads currentUnderstanding directly. No animation, no SVG, no history
// required: it must render correctly even with zero events.
// ---------------------------------------------------------------------------

function DemonstrationPanel({ demonstration }: { demonstration: AxisDemonstration }) {
  if (!demonstration.belief) return null;

  return (
    <div className="demo-panel">
      <p className="demo-belief">{demonstration.belief}</p>
      <div className="demo-rows">
        <div className="demo-row">
          <span className="demo-label">Confidence</span>
          <span className="demo-value">{Math.round(demonstration.confidence * 100)}%</span>
        </div>
        {demonstration.currentPattern && (
          <div className="demo-row">
            <span className="demo-label">Current Pattern</span>
            <span className="demo-value">{demonstration.currentPattern}</span>
          </div>
        )}
        {demonstration.targetPattern && (
          <div className="demo-row">
            <span className="demo-label">Target Pattern</span>
            <span className="demo-value demo-value--target">{demonstration.targetPattern}</span>
          </div>
        )}
        {demonstration.nextExperiment && (
          <div className="demo-row">
            <span className="demo-label">Next Experiment</span>
            <span className="demo-value">{demonstration.nextExperiment}</span>
          </div>
        )}
        {demonstration.optionalEvidence && (
          <div className="demo-row">
            <span className="demo-label">Optional Evidence</span>
            <span className="demo-value">{demonstration.optionalEvidence}</span>
          </div>
        )}
      </div>
      {demonstration.optionalEvidence && <p className="demo-note">Development continues regardless.</p>}

      <style jsx>{`
        .demo-panel {
          border-bottom: 1px solid rgba(26, 26, 24, 0.07);
          flex-shrink: 0;
          padding: 18px 20px 16px;
        }
        .demo-belief {
          color: rgba(26, 26, 24, 0.92);
          font-size: 19px;
          font-weight: 580;
          line-height: 1.4;
          margin: 0 0 12px;
        }
        .demo-rows {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .demo-row {
          align-items: baseline;
          display: flex;
          gap: 8px;
        }
        .demo-label {
          color: rgba(26, 26, 24, 0.34);
          flex-shrink: 0;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          width: 108px;
        }
        .demo-value {
          color: rgba(26, 26, 24, 0.78);
          font-size: 13px;
          line-height: 1.45;
        }
        .demo-value--target {
          color: rgba(120, 170, 60, 0.95);
        }
        .demo-note {
          color: rgba(26, 26, 24, 0.32);
          font-size: 11px;
          font-style: italic;
          margin: 10px 0 0;
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flow — understanding, then demonstration, then action. No cards. No labels.
// ---------------------------------------------------------------------------

function EntryFlow({ cards }: { cards: AxisCard[] }) {
  return (
    <div className="flow">
      {cards.map((card, i) => {
        const style = { animationDelay: `${i * 70}ms` };
        if (card.type === "see_it") {
          return null;
        }
        if (card.type === "try_this") {
          return (
            <div key={i} className="flow-item flow-action" style={style}>
              <p className="flow-action-text">{card.content}</p>
              {card.cue && <p className="flow-cue">{card.cue}</p>}
            </div>
          );
        }
        if (card.type === "show_me") {
          return (
            <p key={i} className="flow-item flow-show" style={style}>
              {card.content}
            </p>
          );
        }
        if (card.type === "breakthrough") {
          return (
            <p key={i} className="flow-item flow-breakthrough" style={style}>
              {card.content}
            </p>
          );
        }
        return (
          <p key={i} className="flow-item flow-belief" style={style}>
            {card.content}
          </p>
        );
      })}
      <style jsx>{`
        .flow {
          display: flex;
          flex-direction: column;
        }
        .flow-item {
          animation: flowIn 0.32s ease-out backwards;
        }
        @keyframes flowIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .flow-belief {
          color: rgba(26, 26, 24, 0.86);
          font-size: 17px;
          line-height: 1.5;
          margin: 0;
        }
        .flow-action {
          margin-top: 6px;
        }
        .flow-action-text {
          color: rgba(26, 26, 24, 0.88);
          font-size: 15px;
          font-weight: 560;
          line-height: 1.5;
          margin: 0;
        }
        .flow-cue {
          color: rgba(26, 26, 24, 0.42);
          font-size: 13px;
          font-style: italic;
          margin: 4px 0 0;
        }
        .flow-show {
          color: rgba(26, 26, 24, 0.45);
          font-size: 14px;
          line-height: 1.5;
          margin: 10px 0 0;
        }
        .flow-breakthrough {
          color: rgba(120, 170, 60, 0.85);
          font-size: 15px;
          font-weight: 600;
          line-height: 1.5;
          margin: 10px 0 0;
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
  const [currentUnderstanding, setCurrentUnderstanding] = useState<AxisUnderstanding | null>(null);
  const [sidebarThreads, setSidebarThreads] = useState<SidebarThread[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [voicePhase, setVoicePhase] = useState<"OFF" | "LISTENING" | "PROCESSING">("OFF");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pinnedThreadIds, setPinnedThreadIds] = useState<string[]>([]);

  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const voiceRef = useRef<SpeechRecognition | null>(null);

  const isActive = conversations.length > 0 || phase !== "idle";
  const demonstration = useMemo(
    () => (currentUnderstanding ? demonstrationFromUnderstanding(currentUnderstanding) : null),
    [currentUnderstanding],
  );
  const visibleSidebarThreads = useMemo(() => {
    const pinned = new Set(pinnedThreadIds);
    return [...sidebarThreads].sort((a, b) => {
      const pinDelta = Number(pinned.has(b.id)) - Number(pinned.has(a.id));
      if (pinDelta !== 0) return pinDelta;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [pinnedThreadIds, sidebarThreads]);

  // Mount/unmount trace — unexpected unmount during a session = remount bug
  useEffect(() => {
    console.log("[MOBILE_TRACE] AxisPage mounted");
    const storedPins = localStorage.getItem("axis_pinned_thread_ids");
    if (storedPins) {
      try {
        const ids = JSON.parse(storedPins);
        if (Array.isArray(ids)) setPinnedThreadIds(ids.filter((id) => typeof id === "string"));
      } catch {
        localStorage.removeItem("axis_pinned_thread_ids");
      }
    }
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
              currentUnderstanding: AxisUnderstanding | null;
              sidebarThreads: SidebarThread[];
            };
            if (data.conversations?.length > 0 || data.currentUnderstanding?.belief) {
              console.log("[MOBILE_TRACE] thread restore success,", data.conversations.length, "conversations");
              setThreadId(savedId);
              setConversations(data.conversations ?? []);
              setCurrentUnderstanding(data.currentUnderstanding ?? null);
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
  }, [conversations, phase]);

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
    let evidenceId: string | null = null;
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
            evidenceId?: string | null;
          };
          attachmentUrl = up.attachmentUrl;
          attachmentMime = up.mimeType;
          attachmentPath = up.attachmentPath;
          evidenceId = up.evidenceId ?? null;
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
          evidenceId,
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
        understanding: AxisUnderstanding;
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
      setCurrentUnderstanding(data.understanding ?? null);
      setSidebarThreads(data.sidebarThreads ?? []);
      setPhase("results");
    } catch (err) {
      console.error("[axis] run error", (err as Error).message);
      setPhase("results");
    }
  }

  function startNewThread() {
    setThreadId(null);
    setConversations([]);
    setCurrentUnderstanding(null);
    setPhase("idle");
    setInput("");
    clearAttachment();
    localStorage.removeItem("axis_thread_id");
  }

  function persistPinnedThreads(nextIds: string[]) {
    setPinnedThreadIds(nextIds);
    localStorage.setItem("axis_pinned_thread_ids", JSON.stringify(nextIds));
  }

  function togglePinThread(id: string) {
    const nextIds = pinnedThreadIds.includes(id)
      ? pinnedThreadIds.filter((threadId) => threadId !== id)
      : [id, ...pinnedThreadIds];
    persistPinnedThreads(nextIds);
  }

  async function renameThread(id: string, title: string) {
    const res = await fetch("/api/axis/thread", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { thread?: SidebarThread };
    if (!data.thread) return;
    setSidebarThreads((prev) =>
      prev.map((thread) => (thread.id === id ? { ...thread, ...data.thread } : thread)),
    );
  }

  async function deleteThread(id: string) {
    const res = await fetch(`/api/axis/thread?id=${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setSidebarThreads((prev) => prev.filter((thread) => thread.id !== id));
    persistPinnedThreads(pinnedThreadIds.filter((threadId) => threadId !== id));
    if (threadId === id) startNewThread();
  }

  async function loadThread(id: string) {
    setIsSidebarOpen(false);
    try {
      const res = await fetch(`/api/axis/thread?id=${id}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        conversations: Conversation[];
        currentUnderstanding: AxisUnderstanding | null;
        sidebarThreads: SidebarThread[];
      };
      setThreadId(id);
      setConversations(data.conversations ?? []);
      setCurrentUnderstanding(data.currentUnderstanding ?? null);
      setPhase(data.conversations?.length || data.currentUnderstanding?.belief ? "results" : "idle");
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
            background: #ffffff;
            display: flex;
            height: 100vh;
            justify-content: center;
          }
          .init-mark {
            color: rgba(26, 26, 24, 0.16);
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

  return (
    <>
      <DevSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeThreadId={threadId}
        threads={visibleSidebarThreads}
        pinnedThreadIds={pinnedThreadIds}
        authLabel={authLabel}
        authType={authType}
        isGuest={authPhase !== "signed_in"}
        onSelectThread={loadThread}
        onNewThread={startNewThread}
        onRenameThread={renameThread}
        onDeleteThread={deleteThread}
        onTogglePinThread={togglePinThread}
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
            {sidebarThreads.length > 0 && (
              <button
                className="sidebar-toggle"
                onClick={() => setIsSidebarOpen(true)}
                type="button"
                aria-label="Open threads"
              >
                ☰
              </button>
            )}
            <span className="wordmark">AXIS</span>
            <button
              className="new-thread-btn"
              onClick={startNewThread}
              type="button"
            >
              + New
            </button>
          </header>

          {demonstration && <DemonstrationPanel demonstration={demonstration} />}

          <div className="thread" ref={threadRef}>
            {conversations.map((conv) => (
              <div key={conv.id} className="entry">
                <p className="user-msg">{conv.userMessage}</p>
                <EntryFlow cards={conv.cards} />
              </div>
            ))}

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
          background: #ffffff;
          color: rgba(26, 26, 24, 0.9);
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
          color: rgba(26, 26, 24, 0.3);
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.28em;
          margin-bottom: 40px;
          text-transform: uppercase;
        }

        .home-q {
          color: rgba(26, 26, 24, 0.9);
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
          background: rgba(26, 26, 24, 0.025);
          border: 1px solid rgba(26, 26, 24, 0.12);
          border-radius: 12px;
          color: rgba(26, 26, 24, 0.9);
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
          color: rgba(26, 26, 24, 0.32);
        }

        .home-input:focus {
          border-color: rgba(120, 170, 60, 0.5);
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
          background: rgba(26, 26, 24, 0.92);
          border: none;
          border-radius: 8px;
          color: #ffffff;
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
          opacity: 0.28;
          cursor: default;
        }

        /* ── Controls ────────────────────────── */
        .ctrl-btn {
          align-items: center;
          background: rgba(26, 26, 24, 0.04);
          border: 1px solid rgba(26, 26, 24, 0.1);
          border-radius: 8px;
          color: rgba(26, 26, 24, 0.5);
          cursor: pointer;
          display: flex;
          height: 44px;
          justify-content: center;
          min-width: 44px;
          transition: background 0.1s, color 0.1s;
          width: 44px;
        }

        .ctrl-btn:hover {
          background: rgba(26, 26, 24, 0.07);
          color: rgba(26, 26, 24, 0.8);
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
          color: rgba(26, 26, 24, 0.4);
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
          color: rgba(26, 26, 24, 0.8);
        }

        /* ── Thread shell ────────────────────── */
        .thread-shell {
          display: flex;
          flex-direction: column;
          height: 100svh;
        }

        .hd {
          align-items: center;
          border-bottom: 1px solid rgba(26, 26, 24, 0.07);
          display: flex;
          flex-shrink: 0;
          gap: 12px;
          padding: 12px 16px;
        }

        .wordmark {
          color: rgba(26, 26, 24, 0.28);
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
          color: rgba(120, 170, 60, 0.85);
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.04em;
          padding: 0;
          transition: color 0.12s;
        }

        .new-thread-btn:hover {
          color: rgba(120, 170, 60, 1);
        }

        /* ── Thread body ─────────────────────── */
        .thread {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 36px;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding: 24px 20px calc(140px + env(safe-area-inset-bottom));
          scroll-behavior: smooth;
        }

        .entry {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-width: 640px;
          margin: 0 auto;
          width: 100%;
        }

        .user-msg {
          color: rgba(26, 26, 24, 0.42);
          font-size: 14px;
          letter-spacing: 0.01em;
          line-height: 1.5;
          padding: 0 2px;
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
          background: rgba(26, 26, 24, 0.28);
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
          background: rgba(255, 255, 255, 0.94);
          backdrop-filter: blur(8px);
          border-top: 1px solid rgba(26, 26, 24, 0.07);
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
          background: rgba(26, 26, 24, 0.03);
          border: 1px solid rgba(26, 26, 24, 0.1);
          border-radius: 10px;
          color: rgba(26, 26, 24, 0.9);
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
          color: rgba(26, 26, 24, 0.3);
        }

        .bottom-input:focus {
          border-color: rgba(120, 170, 60, 0.5);
        }

        .bottom-send {
          background: rgba(26, 26, 24, 0.92);
          border: none;
          border-radius: 8px;
          color: #ffffff;
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
          opacity: 0.25;
        }

        /* ── Attachment badge ────────────────── */
        .attachment-badge {
          align-items: center;
          background: rgba(120, 170, 60, 0.08);
          border: 1px solid rgba(120, 170, 60, 0.22);
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
          color: rgba(26, 26, 24, 0.7);
          font-size: 12px;
          letter-spacing: 0.02em;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .attachment-remove {
          background: none;
          border: none;
          color: rgba(26, 26, 24, 0.4);
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
