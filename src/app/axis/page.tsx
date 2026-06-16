"use client";

import { Camera, Mic, Paperclip } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";
import type { AxisCard, AxisUnderstanding, SidebarThread } from "../../lib/axis-server";

interface Conversation {
  id: string;
  userMessage: string;
  cards: AxisCard[];
  timestamp: string;
}

type AuthPhase = "loading" | "guest" | "signed_in";
type Phase = "idle" | "loading" | "results";

const STARTING_TIMELINES = [
  "Hailey",
  "Hudson",
  "Bridge",
  "My Jumpshot",
  "Axis",
  "VBZ",
  "Business",
  "Health",
];

function sentenceFromCard(card: AxisCard): string | null {
  const text = [card.content, card.secondary].filter(Boolean).join(" ");
  return text.trim() || null;
}

function AxisReply({ cards }: { cards: AxisCard[] }) {
  const sentences = cards.flatMap((card) => {
    const sentence = sentenceFromCard(card);
    return sentence ? [sentence] : [];
  });

  if (sentences.length === 0) return null;

  return (
    <div className="axis-reply">
      {sentences.map((sentence, index) => (
        <p key={`${sentence}-${index}`}>{sentence}</p>
      ))}
    </div>
  );
}

function TimelineRail({
  activeThreadId,
  threads,
  onSelectThread,
}: {
  activeThreadId: string | null;
  threads: SidebarThread[];
  onSelectThread: (id: string) => void;
}) {
  const names = threads.length
    ? threads.map((thread) => ({
        id: thread.id,
        name: thread.title || thread.focus || "Untitled",
        live: true,
      }))
    : STARTING_TIMELINES.map((name) => ({ id: name, name, live: false }));

  return (
    <nav className="timeline-rail" aria-label="Memory">
      {names.map((item) => {
        const active = item.live && item.id === activeThreadId;
        return (
          <button
            key={item.id}
            className={`timeline-name${active ? " timeline-name--active" : ""}`}
            disabled={!item.live}
            onClick={() => item.live && onSelectThread(item.id)}
            type="button"
          >
            {item.name}
          </button>
        );
      })}
    </nav>
  );
}

export default function AxisPage() {
  const [authPhase, setAuthPhase] = useState<AuthPhase>("loading");
  const [phase, setPhase] = useState<Phase>("idle");
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [, setCurrentUnderstanding] = useState<AxisUnderstanding | null>(null);
  const [sidebarThreads, setSidebarThreads] = useState<SidebarThread[]>([]);
  const [voicePhase, setVoicePhase] = useState<"OFF" | "LISTENING">("OFF");
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const threadRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const voiceRef = useRef<SpeechRecognition | null>(null);

  const isActive = conversations.length > 0 || phase !== "idle";
  const sortedTimelines = useMemo(
    () =>
      [...sidebarThreads].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      ),
    [sidebarThreads],
  );

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

      const savedId = localStorage.getItem("axis_thread_id");
      if (savedId) {
        try {
          const res = await fetch(`/api/axis/thread?id=${savedId}`);
          if (res.ok) {
            const data = (await res.json()) as {
              conversations: Conversation[];
              currentUnderstanding: AxisUnderstanding | null;
              sidebarThreads: SidebarThread[];
            };
            if (data.conversations?.length > 0 || data.currentUnderstanding?.belief) {
              setThreadId(savedId);
              setConversations(data.conversations ?? []);
              setCurrentUnderstanding(data.currentUnderstanding ?? null);
              setPhase("results");
              setSidebarThreads(data.sidebarThreads ?? []);
            } else {
              localStorage.removeItem("axis_thread_id");
            }
          } else {
            localStorage.removeItem("axis_thread_id");
          }
        } catch {
          localStorage.removeItem("axis_thread_id");
        }
      }

      setAuthPhase(user ? "signed_in" : "guest");
    }

    void init();
  }, []);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [conversations, phase]);

  function clearAttachment() {
    setPendingFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function run(message: string) {
    const msg = message.trim();
    const fileToUpload = pendingFile;
    const hasFile = fileToUpload !== null;
    if (!msg && !hasFile) return;
    if (phase === "loading") return;

    const originalFileName = fileToUpload?.name ?? null;
    setPhase("loading");
    setInput("");
    clearAttachment();

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
        }
      } catch (err) {
        console.error("[axis] upload error", (err as Error).message);
      }

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
        userMessage: msg || (displayFileName ? displayFileName : ""),
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

  function startNewTimeline() {
    setThreadId(null);
    setConversations([]);
    setCurrentUnderstanding(null);
    setPhase("idle");
    setInput("");
    clearAttachment();
    localStorage.removeItem("axis_thread_id");
  }

  async function loadThread(id: string) {
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
      // Keep the current conversation in place.
    }
  }

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

    const sr = new SpeechRecognition() as SpeechRecognition & {
      onstart: (() => void) | null;
      onresult: ((event: SpeechRecognitionEvent) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
    };
    sr.continuous = false;
    sr.interimResults = false;
    sr.lang = "en-US";

    sr.onstart = () => setVoicePhase("LISTENING");
    sr.onresult = (event: SpeechRecognitionEvent) => {
      const text = event.results[0]?.[0]?.transcript ?? "";
      setVoicePhase("OFF");
      if (text.trim()) void run(text.trim());
    };
    sr.onerror = () => setVoicePhase("OFF");
    sr.onend = () => setVoicePhase("OFF");

    voiceRef.current = sr;
    sr.start();
  }

  if (authPhase === "loading") {
    return <div className="blank" />;
  }

  return (
    <>
      <main className="axis-shell">
        <TimelineRail
          activeThreadId={threadId}
          threads={sortedTimelines}
          onSelectThread={loadThread}
        />

        <section className={`conversation${isActive ? " conversation--active" : ""}`}>
          {!isActive && (
            <div className="first-prompt">
              <h1>What are you working on?</h1>
            </div>
          )}

          {isActive && (
            <div className="conversation-scroll" ref={threadRef}>
              {conversations.map((conv) => (
                <article key={conv.id} className="turn">
                  {conv.userMessage && <p className="user-line">{conv.userMessage}</p>}
                  <AxisReply cards={conv.cards} />
                </article>
              ))}

              {phase === "loading" && (
                <div className="thinking" aria-label="Thinking">
                  <span />
                  <span />
                  <span />
                </div>
              )}
            </div>
          )}

          <div className="composer-wrap">
            {pendingFile && (
              <div className="moment-pill">
                <span>{pendingFile.name}</span>
                <button type="button" onClick={clearAttachment} aria-label="Remove upload">
                  x
                </button>
              </div>
            )}

            <form
              className="composer"
              onSubmit={(event) => {
                event.preventDefault();
                void run(input);
              }}
            >
              <textarea
                className="composer-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder=""
                rows={1}
                inputMode="text"
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void run(input);
                  }
                }}
              />
              <button
                className="icon-button"
                type="button"
                onClick={toggleVoice}
                aria-label="Voice"
              >
                {voicePhase === "LISTENING" ? <span className="voice-dot" /> : <Mic size={17} />}
              </button>
              <button
                className="icon-button"
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="Upload"
              >
                <Paperclip size={17} />
              </button>
              <button
                className="icon-button camera-button"
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="Camera"
              >
                <Camera size={17} />
              </button>
              <button
                className="send-button"
                type="submit"
                disabled={(!input.trim() && !pendingFile) || phase === "loading"}
                aria-label="Send"
              >
                &#8594;
              </button>
            </form>
          </div>

          {isActive && (
            <button className="quiet-new" type="button" onClick={startNewTimeline}>
              New page
            </button>
          )}
        </section>
      </main>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          setPendingFile(file);
        }}
      />

      <style jsx global>{`
        *,
        *::before,
        *::after {
          box-sizing: border-box;
        }

        html,
        body {
          background: #fbfaf7;
          color: rgba(25, 24, 21, 0.92);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
          margin: 0;
          min-height: 100%;
          overflow-x: hidden;
          width: 100%;
        }
      `}</style>

      <style jsx>{`
        .blank {
          background: #fbfaf7;
          min-height: 100svh;
        }

        .axis-shell {
          background:
            linear-gradient(90deg, rgba(25, 24, 21, 0.035), transparent 260px),
            #fbfaf7;
          display: grid;
          grid-template-columns: 220px minmax(0, 1fr);
          min-height: 100svh;
        }

        .timeline-rail {
          display: flex;
          flex-direction: column;
          gap: 17px;
          padding: 34px 26px;
        }

        .timeline-name {
          background: transparent;
          border: 0;
          color: rgba(25, 24, 21, 0.48);
          cursor: pointer;
          font: inherit;
          font-size: 15px;
          line-height: 1.2;
          padding: 0;
          text-align: left;
          transition: color 0.14s ease;
        }

        .timeline-name:hover,
        .timeline-name--active {
          color: rgba(25, 24, 21, 0.92);
        }

        .timeline-name:disabled {
          color: rgba(25, 24, 21, 0.28);
          cursor: default;
        }

        .conversation {
          display: flex;
          flex-direction: column;
          min-height: 100svh;
          padding: 40px clamp(22px, 5vw, 72px) 30px;
          position: relative;
        }

        .conversation--active {
          padding-top: 42px;
        }

        .first-prompt {
          align-items: center;
          display: flex;
          flex: 1;
          justify-content: center;
          padding-bottom: 84px;
        }

        .first-prompt h1 {
          color: rgba(25, 24, 21, 0.9);
          font-size: clamp(28px, 5vw, 48px);
          font-weight: 560;
          letter-spacing: 0;
          line-height: 1.08;
          margin: 0;
          text-align: center;
        }

        .conversation-scroll {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 42px;
          margin: 0 auto;
          max-width: 690px;
          overflow-y: auto;
          padding: 18px 0 144px;
          width: 100%;
        }

        .turn {
          display: flex;
          flex-direction: column;
          gap: 13px;
        }

        .user-line {
          align-self: flex-end;
          color: rgba(25, 24, 21, 0.46);
          font-size: 15px;
          line-height: 1.55;
          margin: 0;
          max-width: 82%;
          white-space: pre-wrap;
        }

        .axis-reply {
          color: rgba(25, 24, 21, 0.9);
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-width: 620px;
        }

        .axis-reply p {
          font-size: clamp(18px, 2.1vw, 24px);
          font-weight: 440;
          letter-spacing: 0;
          line-height: 1.42;
          margin: 0;
        }

        .thinking {
          align-items: center;
          display: flex;
          gap: 6px;
          margin: 0 auto;
          max-width: 690px;
          width: 100%;
        }

        .thinking span,
        .voice-dot {
          animation: pulse 1.1s ease-in-out infinite;
          background: rgba(25, 24, 21, 0.35);
          border-radius: 999px;
          display: block;
          height: 5px;
          width: 5px;
        }

        .thinking span:nth-child(2) {
          animation-delay: 0.16s;
        }

        .thinking span:nth-child(3) {
          animation-delay: 0.32s;
        }

        @keyframes pulse {
          0%,
          80%,
          100% {
            opacity: 0.3;
          }
          40% {
            opacity: 1;
          }
        }

        .composer-wrap {
          bottom: 24px;
          left: calc(220px + clamp(22px, 5vw, 72px));
          position: fixed;
          right: clamp(22px, 5vw, 72px);
          z-index: 2;
        }

        .composer {
          align-items: flex-end;
          background: rgba(251, 250, 247, 0.9);
          border: 1px solid rgba(25, 24, 21, 0.1);
          border-radius: 18px;
          display: flex;
          gap: 8px;
          margin: 0 auto;
          max-width: 760px;
          padding: 10px;
          backdrop-filter: blur(18px);
        }

        .composer-input {
          background: transparent;
          border: 0;
          color: rgba(25, 24, 21, 0.92);
          flex: 1;
          font: inherit;
          font-size: 17px;
          line-height: 1.45;
          min-height: 42px;
          min-width: 0;
          outline: 0;
          padding: 8px 8px 7px;
          resize: none;
        }

        .icon-button,
        .send-button {
          align-items: center;
          background: transparent;
          border: 0;
          border-radius: 12px;
          color: rgba(25, 24, 21, 0.44);
          cursor: pointer;
          display: flex;
          flex-shrink: 0;
          height: 42px;
          justify-content: center;
          padding: 0;
          width: 42px;
        }

        .icon-button:hover {
          color: rgba(25, 24, 21, 0.84);
        }

        .send-button {
          background: rgba(25, 24, 21, 0.9);
          color: #fbfaf7;
          font-size: 20px;
        }

        .send-button:disabled {
          cursor: default;
          opacity: 0.18;
        }

        .moment-pill {
          align-items: center;
          color: rgba(25, 24, 21, 0.54);
          display: flex;
          font-size: 13px;
          gap: 10px;
          justify-content: center;
          margin: 0 auto 8px;
          max-width: 760px;
        }

        .moment-pill button {
          background: transparent;
          border: 0;
          color: rgba(25, 24, 21, 0.38);
          cursor: pointer;
          font: inherit;
          padding: 0;
        }

        .quiet-new {
          background: transparent;
          border: 0;
          color: rgba(25, 24, 21, 0.28);
          cursor: pointer;
          font: inherit;
          font-size: 13px;
          position: fixed;
          right: 24px;
          top: 22px;
        }

        .quiet-new:hover {
          color: rgba(25, 24, 21, 0.62);
        }

        @media (max-width: 760px) {
          .axis-shell {
            background: #fbfaf7;
            display: block;
          }

          .timeline-rail {
            display: none;
          }

          .conversation,
          .conversation--active {
            min-height: 100svh;
            padding: 24px 18px 26px;
          }

          .first-prompt {
            align-items: flex-start;
            justify-content: flex-start;
            padding-bottom: 110px;
            padding-top: 22vh;
          }

          .first-prompt h1 {
            font-size: 32px;
            text-align: left;
          }

          .conversation-scroll {
            gap: 34px;
            padding: 12px 0 140px;
          }

          .user-line {
            max-width: 92%;
          }

          .axis-reply p {
            font-size: 20px;
          }

          .composer-wrap {
            bottom: max(14px, env(safe-area-inset-bottom));
            left: 12px;
            right: 12px;
          }

          .composer {
            border-radius: 16px;
            gap: 4px;
            padding: 8px;
          }

          .composer-input {
            font-size: 16px;
            min-height: 42px;
          }

          .icon-button,
          .send-button {
            height: 40px;
            width: 38px;
          }

          .quiet-new {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
