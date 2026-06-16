"use client";

import { Camera, Mic, Paperclip } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";
import type { AxisCard, AxisUnderstanding, SidebarThread } from "../../lib/axis-server";

interface Conversation {
  id: string;
  userMessage: string;
  cards: AxisCard[];
  timestamp: string;
}

interface NotebookLine {
  id: string;
  text: string;
  tone?: "memory" | "writing";
}

type AuthPhase = "loading" | "guest" | "signed_in";
type Phase = "idle" | "loading" | "results";

const INTERNAL_TEXT_PATTERNS = [
  /confidence/i,
  /current\s*pattern/i,
  /target\s*pattern/i,
  /optional\s*evidence/i,
  /next\s*experiment/i,
  /no information exists/i,
  /unable to determine/i,
  /unknown pattern/i,
  /diagnostic/i,
  /\bnow\s*\/\s*target\b/i,
];

function cleanVisibleSentence(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (INTERNAL_TEXT_PATTERNS.some((pattern) => pattern.test(text))) return null;
  return text;
}

function titleCase(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function summaryFromUnderstanding(understanding: AxisUnderstanding | null): string[] {
  if (!understanding) return [];

  const directBelief = cleanVisibleSentence(understanding.belief);
  const fallbackSubject =
    cleanVisibleSentence(understanding.focus) ?? cleanVisibleSentence(understanding.concept);
  const belief = directBelief ?? (fallbackSubject ? titleCase(fallbackSubject) : null);
  const nextStep = cleanVisibleSentence(understanding.experiment);
  const evidence = cleanVisibleSentence(understanding.evidenceRequest);

  return [belief, nextStep, evidence].filter(
    (line): line is string => Boolean(line),
  ).slice(0, 3);
}

function sentencesFromCards(cards: AxisCard[]): string[] {
  const selected = cards.flatMap((card) => {
    if (card.type === "belief") return cleanVisibleSentence(card.content) ?? [];
    if (card.type === "try_this" || card.type === "experiment" || card.type === "next_action") {
      return cleanVisibleSentence(card.content) ?? [];
    }
    if (card.type === "show_me" || card.type === "evidence_request") {
      return cleanVisibleSentence(card.content) ?? [];
    }
    if (card.type === "evidence_received") return cleanVisibleSentence(card.content) ?? [];
    return [];
  });

  return selected.slice(0, 3);
}

function rememberFrom(threads: SidebarThread[], conversations: Conversation[]): string {
  if (conversations.length > 0) return "";

  const remembered = threads
    .filter((thread) => thread.title || thread.focus)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];

  if (!remembered) return "";

  const subject = remembered.title || remembered.focus;
  if (!subject) return "";

  return `You were thinking about ${subject.toLowerCase()} last time.`;
}

function momentTitleFrom(input: string, file: File | null): string {
  if (!file) return "";
  const text = input.toLowerCase();
  if (text.includes("jumpshot") || text.includes("jump shot")) return "Jumpshot - front release";
  if (text.includes("hudson")) return "Hudson - today";
  if (text.includes("landing")) return "Landing after contact";
  if (text.includes("clip")) return "A clip from today";
  if (file.type.startsWith("video/")) return "A moment from today";
  if (file.type.startsWith("image/")) return "A still from today";
  return "A moment from today";
}

function memoryQueryFromCommand(value: string): string | null {
  const text = value.trim().toLowerCase();
  if (!text) return null;

  if (["/history", "/last", "/show", "/today"].includes(text)) return "";
  if (text === "/clip" || text.includes("find the clip")) return "clip";
  if (text === "/compare") return "compare";
  if (text.includes("show last") || text.includes("look back")) return "";
  if (text.includes("what changed") || text.includes("show evidence")) return "";

  const againMatch = text.match(/^(.+?)\s+again$/);
  if (againMatch?.[1]) return againMatch[1].trim();

  return null;
}

function buildNotebookLines({
  conversations,
  currentUnderstanding,
  memoryLines,
  memorySentence,
}: {
  conversations: Conversation[];
  currentUnderstanding: AxisUnderstanding | null;
  memoryLines: NotebookLine[];
  memorySentence: string;
}): NotebookLine[] {
  const lines: NotebookLine[] = [];

  if (memorySentence) {
    lines.push({ id: "memory", text: memorySentence, tone: "memory" });
  }

  summaryFromUnderstanding(currentUnderstanding).forEach((text, index) => {
    lines.push({ id: `current-${index}`, text });
  });

  for (const conv of conversations) {
    if (conv.userMessage) {
      lines.push({ id: `${conv.id}-user`, text: conv.userMessage, tone: "writing" });
    }

    sentencesFromCards(conv.cards).forEach((text, index) => {
      lines.push({ id: `${conv.id}-axis-${index}`, text });
    });
  }

  return [...memoryLines, ...lines];
}

export default function AxisPage() {
  const [authPhase, setAuthPhase] = useState<AuthPhase>("loading");
  const [phase, setPhase] = useState<Phase>("idle");
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentUnderstanding, setCurrentUnderstanding] = useState<AxisUnderstanding | null>(null);
  const [sidebarThreads, setSidebarThreads] = useState<SidebarThread[]>([]);
  const [voicePhase, setVoicePhase] = useState<"OFF" | "LISTENING">("OFF");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [composerFocused, setComposerFocused] = useState(false);
  const [eraseMode, setEraseMode] = useState(false);
  const [erasedLines, setErasedLines] = useState<Set<string>>(() => new Set());
  const [insertedLines, setInsertedLines] = useState<Record<string, NotebookLine[]>>({});
  const [memoryLines, setMemoryLines] = useState<NotebookLine[]>([]);
  const [momentPreview, setMomentPreview] = useState<string | null>(null);

  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const voiceRef = useRef<SpeechRecognition | null>(null);

  const isActive = conversations.length > 0 || phase !== "idle";
  const memorySentence = rememberFrom(sidebarThreads, conversations);
  const momentTitle = momentTitleFrom(input, pendingFile);
  const notebookLines = buildNotebookLines({
    conversations,
    currentUnderstanding,
    memoryLines,
    memorySentence,
  });

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

  useEffect(() => {
    if (!pendingFile) {
      setMomentPreview(null);
      return;
    }

    if (!pendingFile.type.startsWith("image/") && !pendingFile.type.startsWith("video/")) {
      setMomentPreview(null);
      return;
    }

    const nextUrl = URL.createObjectURL(pendingFile);
    setMomentPreview(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [pendingFile]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;

      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        setInput((current) => current || "/");
        inputRef.current?.focus();
      }
      if (key === "u") {
        event.preventDefault();
        fileRef.current?.click();
      }
      if (key === "m") {
        event.preventDefault();
        toggleVoice();
      }
      if (event.key === "Enter") {
        event.preventDefault();
        void run(input);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [input, pendingFile, phase]);

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

    const memoryQueryRequest = msg && !hasFile ? memoryQueryFromCommand(msg) : null;
    if (memoryQueryRequest !== null) {
      const matches = sidebarThreads
        .filter((thread) => {
          if (!memoryQueryRequest) return true;
          const haystack = [thread.title, thread.focus, thread.current_bottleneck]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(memoryQueryRequest.toLowerCase());
        })
        .slice(0, 5);

      setMemoryLines(
        matches.map((thread) => ({
          id: `memory-${thread.id}`,
          text: `You were thinking about ${(
            thread.title ||
            thread.focus ||
            "this"
          ).toLowerCase()}.`,
          tone: "memory",
        })),
      );
      setInput("");
      return;
    }

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

  async function askAboutLine(line: NotebookLine) {
    if (eraseMode) {
      setErasedLines((prev) => new Set(prev).add(line.id));
      return;
    }

    if (phase === "loading") return;
    setPhase("loading");

    try {
      const res = await fetch("/api/axis/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Tell me more about "${line.text}"`,
          threadId,
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

      const nextLines = sentencesFromCards(data.cards).map((text, index) => ({
        id: `${line.id}-note-${crypto.randomUUID()}-${index}`,
        text,
      }));

      setThreadId(data.threadId);
      localStorage.setItem("axis_thread_id", data.threadId);
      setCurrentUnderstanding(data.understanding ?? null);
      setSidebarThreads(data.sidebarThreads ?? []);
      setInsertedLines((prev) => ({
        ...prev,
        [line.id]: [...(prev[line.id] ?? []), ...nextLines],
      }));
      setPhase("results");
    } catch (err) {
      console.error("[axis] line note error", (err as Error).message);
      setPhase("results");
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

  function renderNotebookLine(line: NotebookLine) {
    const isErased = erasedLines.has(line.id);

    return (
      <div key={line.id} className={`notebook-line-wrap${isErased ? " is-erased" : ""}`}>
        <button
          className={`notebook-line${line.tone === "memory" ? " notebook-line--memory" : ""}${
            line.tone === "writing" ? " notebook-line--writing" : ""
          }${eraseMode ? " notebook-line--erase" : ""}`}
          onClick={() => void askAboutLine(line)}
          type="button"
        >
          {line.text}
        </button>
        {(insertedLines[line.id] ?? [])
          .filter((inserted) => !erasedLines.has(inserted.id))
          .map((inserted) => renderNotebookLine(inserted))}
      </div>
    );
  }

  return (
    <>
      <main className="axis-shell">
        <button
          className="axis-mark"
          type="button"
          onClick={() => {
            setEraseMode(false);
            inputRef.current?.focus();
          }}
          aria-label="Return to the page"
        >
          Axis
        </button>

        <section className={`page${isActive ? " page--written" : ""}`}>
          <div className="page-body" ref={threadRef}>
            {!isActive && (
              <button
                className="page-question"
                type="button"
                onClick={() => inputRef.current?.focus()}
              >
                What are you working on?
              </button>
            )}

            {isActive && notebookLines.map((line) => renderNotebookLine(line))}

            {phase === "loading" && (
              <div className="thinking" aria-label="Thinking">
                <span />
                <span />
                <span />
              </div>
            )}
            </div>

          <div className="composer-wrap">
            {pendingFile && (
              <div className="moment-pill">
                {momentPreview && (
                  pendingFile.type.startsWith("video/") ? (
                    <video src={momentPreview} muted playsInline />
                  ) : (
                    <img src={momentPreview} alt="" />
                  )
                )}
                <span>{momentTitle}</span>
                <button type="button" onClick={clearAttachment} aria-label="Remove upload">
                  x
                </button>
              </div>
            )}

            <form
              className={`composer${composerFocused ? " composer--awake" : ""}`}
              onSubmit={(event) => {
                event.preventDefault();
                void run(input);
              }}
            >
              <textarea
                ref={inputRef}
                className="composer-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onBlur={() => setComposerFocused(false)}
                onFocus={() => setComposerFocused(true)}
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
                className={`icon-button${eraseMode ? " icon-button--active" : ""}`}
                type="button"
                onClick={() => setEraseMode((current) => !current)}
                aria-label="Eraser"
              >
                eraser
              </button>
              <button
                className="send-button"
                type="submit"
                disabled={(!input.trim() && !pendingFile) || phase === "loading"}
                aria-label="Send"
              >
                enter
              </button>
            </form>
          </div>
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
          font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
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
            radial-gradient(circle at 24px 28px, rgba(25, 24, 21, 0.025) 0 1px, transparent 1.4px),
            #fbfaf7;
          background-size: 34px 34px, auto;
          display: block;
          min-height: 100svh;
        }

        .axis-mark {
          background: transparent;
          border: 0;
          color: rgba(25, 24, 21, 0.24);
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          left: 18px;
          letter-spacing: 0.02em;
          padding: 0;
          position: fixed;
          top: 16px;
          z-index: 4;
        }

        .axis-mark:hover {
          color: rgba(25, 24, 21, 0.56);
        }

        .page {
          display: flex;
          flex-direction: column;
          margin: 0 auto;
          max-width: 820px;
          min-height: 100svh;
          padding: 10vh clamp(22px, 6vw, 64px) 30px;
          position: relative;
        }

        .page--written {
          padding-top: 8vh;
        }

        .page-question {
          background: transparent;
          border: 0;
          color: rgba(25, 24, 21, 0.9);
          cursor: text;
          font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
          font-size: clamp(36px, 4.4vw, 52px);
          font-weight: 600;
          letter-spacing: 0;
          line-height: 1.18;
          margin: 0 0 22px;
          padding: 0;
          text-align: left;
        }

        .page-body {
          flex: 1;
          margin: 0 auto;
          max-width: 760px;
          overflow-y: auto;
          padding: 18px 0 150px;
          width: 100%;
        }

        .notebook-line-wrap {
          max-height: 280px;
          margin: 0 0 22px;
          opacity: 1;
          transform: translateY(0);
          transition: opacity 0.22s ease, margin 0.22s ease, max-height 0.22s ease, transform 0.22s ease;
        }

        .notebook-line-wrap .notebook-line-wrap {
          margin: 18px 0 0 clamp(16px, 4vw, 38px);
        }

        .notebook-line-wrap.is-erased {
          margin: 0;
          max-height: 0;
          opacity: 0;
          overflow: hidden;
          pointer-events: none;
          transform: translateY(-4px);
        }

        .notebook-line {
          background: transparent;
          border: 0;
          color: rgba(24, 23, 20, 0.92);
          cursor: text;
          font: inherit;
          font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
          font-size: clamp(19px, 2.35vw, 27px);
          font-style: italic;
          line-height: 1.56;
          margin: 0;
          padding: 0 0 4px;
          text-align: left;
          text-decoration-color: rgba(72, 70, 64, 0.46);
          text-decoration-line: underline;
          text-decoration-skip-ink: none;
          text-decoration-thickness: 1px;
          text-underline-offset: 5px;
        }

        .notebook-line--writing {
          color: rgba(24, 23, 20, 0.98);
          font-size: clamp(23px, 3vw, 34px);
          font-style: normal;
          text-decoration-color: rgba(72, 70, 64, 0.28);
        }

        .notebook-line--memory {
          color: rgba(24, 23, 20, 0.46);
        }

        .notebook-line:hover {
          color: rgba(24, 23, 20, 0.66);
        }

        .notebook-line--erase:hover {
          color: rgba(106, 31, 24, 0.58);
          text-decoration-color: rgba(106, 31, 24, 0.34);
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
          left: clamp(16px, 5vw, 52px);
          position: fixed;
          right: clamp(16px, 5vw, 52px);
          z-index: 2;
        }

        .composer {
          align-items: flex-end;
          background: rgba(251, 250, 247, 0.86);
          border: 0;
          border-radius: 0;
          display: flex;
          gap: 8px;
          margin: 0 auto;
          max-width: 760px;
          padding: 6px 0 0;
          backdrop-filter: blur(18px);
        }

        .composer:hover .icon-button,
        .composer--awake .icon-button {
          color: rgba(25, 24, 21, 0.5);
          opacity: 1;
        }

        .composer-input {
          background: transparent;
          background-image: linear-gradient(rgba(72, 70, 64, 0.32), rgba(72, 70, 64, 0.32));
          background-position: 0 calc(100% - 4px);
          background-repeat: no-repeat;
          background-size: 100% 1px;
          border: 0;
          color: rgba(25, 24, 21, 0.92);
          flex: 1;
          font: inherit;
          font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
          font-size: 21px;
          line-height: 1.45;
          min-height: 42px;
          min-width: 0;
          outline: 0;
          padding: 8px 8px 5px 0;
          resize: none;
        }

        .icon-button,
        .send-button {
          align-items: center;
          background: transparent;
          border: 0;
          border-radius: 0;
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

        .icon-button {
          opacity: 0.22;
          transition: color 0.14s ease, opacity 0.14s ease;
        }

        .icon-button--active {
          color: rgba(25, 24, 21, 0.82);
          opacity: 1;
        }

        [aria-label="Eraser"],
        .send-button {
          color: rgba(25, 24, 21, 0.62);
          font-size: 11px;
          letter-spacing: 0;
          width: auto;
        }

        [aria-label="Eraser"] {
          font-size: 0;
        }

        [aria-label="Eraser"]::before {
          content: "eraser";
          font-size: 11px;
        }

        .send-button {
          font-size: 0;
        }

        .send-button::before {
          content: "enter";
          font-size: 11px;
        }

        .send-button:disabled {
          cursor: default;
          opacity: 0.25;
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

        .moment-pill img,
        .moment-pill video {
          background: rgba(25, 24, 21, 0.06);
          border-radius: 0;
          height: 38px;
          object-fit: cover;
          width: 48px;
        }

        .moment-pill button {
          background: transparent;
          border: 0;
          color: rgba(25, 24, 21, 0.38);
          cursor: pointer;
          font: inherit;
          padding: 0;
        }

        @media (max-width: 760px) {
          .axis-shell {
            background: #fbfaf7;
            display: block;
          }

          .page,
          .page--written {
            min-height: 100svh;
            padding: 18vh 18px 26px;
          }

          .page-question {
            font-size: 36px;
            text-align: left;
          }

          .page-body {
            gap: 34px;
            padding: 0 0 140px;
          }

          .composer-wrap {
            bottom: max(14px, env(safe-area-inset-bottom));
            left: 12px;
            right: 12px;
          }

          .composer {
            border-radius: 0;
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
            min-width: 38px;
          }

        }
      `}</style>
    </>
  );
}
