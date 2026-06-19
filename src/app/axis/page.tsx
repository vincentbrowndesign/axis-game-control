"use client";

import { useEffect, useRef, useState } from "react";
import { axisAuthenticatedFetch } from "../../lib/axis-client-auth";
import { AXIS_ROOM_COLORS } from "../../lib/axis-visual-language";
import AxisAuthControl, { useAxisAuth } from "./axis-auth-control";
import ThreadBoard, { type ThreadBoardData } from "./thread-board";
import ThreadPicker, { type AxisThreadListItem } from "./thread-picker";

interface Message {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  threadBoard?: ThreadBoardData | null;
}

export type AxisThreadSaveStatus =
  | "not_saved"
  | "saving"
  | "saved"
  | "unsaved_changes"
  | "error";

type PersistedThread = {
  createdAt: string;
  id: string;
  lastOpenedAt: string | null;
  messages: Array<{
    createdAt: string;
    content: string;
    role: "user" | "assistant";
    threadBoard: ThreadBoardData | null;
  }>;
  title: string;
  updatedAt: string;
};

type ActiveThreadMeta = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  lastSavedAt: string;
};

function createInitialMessage(): Message {
  return {
    role: "assistant",
    content: "What are we working on?",
    createdAt: new Date().toISOString(),
  };
}

export default function AxisPage() {
  const auth = useAxisAuth();
  const [messages, setMessages] = useState<Message[]>(() => [createInitialMessage()]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeThread, setActiveThread] = useState<ActiveThreadMeta | null>(null);
  const [saveState, setSaveState] = useState<AxisThreadSaveStatus>("not_saved");
  const [saveAuthRequired, setSaveAuthRequired] = useState(false);
  const [threads, setThreads] = useState<AxisThreadListItem[]>([]);
  const [localRevision, setLocalRevision] = useState(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>(messages);
  const activeThreadRef = useRef<ActiveThreadMeta | null>(activeThread);
  const localRevisionRef = useRef(localRevision);
  const ownerIdRef = useRef<string | null | undefined>(undefined);

  const isInitial = messages.length === 1 && !loading;
  const latestAssistantIndex = messages.reduce(
    (latest, message, index) => (message.role === "assistant" ? index : latest),
    -1,
  );
  const latestAssistant = messages[latestAssistantIndex];
  const threadStartedAt =
    activeThread?.createdAt ??
    messages.find((message) => message.role === "user")?.createdAt ??
    messages[0]?.createdAt;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    activeThreadRef.current = activeThread;
  }, [activeThread]);

  useEffect(() => {
    localRevisionRef.current = localRevision;
  }, [localRevision]);

  useEffect(() => {
    if (auth.status === "loading") return;

    const nextOwnerId = auth.status === "signed_in" ? auth.userId : null;
    if (ownerIdRef.current === nextOwnerId) return;

    ownerIdRef.current = nextOwnerId;
    resetOwnerScopedThreadState(nextOwnerId === null);
    if (nextOwnerId) void loadThreads();
  }, [auth.status, auth.userId]);

  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  }, [input]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    const pendingMessages = [...messages, userMsg];
    const apiHistory = [...messages.slice(1), userMsg].map(
      ({ role, content }) => ({ role, content }),
    );

    commitMessages(pendingMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/axis/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: apiHistory }),
      });

      if (!res.ok) {
        commitMessages(messages);
        setError("Something went wrong. Try again.");
        setLoading(false);
        return;
      }

      const data = (await res.json()) as {
        reply: string;
        threadBoard: ThreadBoardData | null;
      };

      const assistantMsg: Message = {
        role: "assistant",
        content: data.reply,
        createdAt: new Date().toISOString(),
        threadBoard: data.threadBoard,
      };
      const nextMessages = [...messages, userMsg, assistantMsg];
      const nextRevision = commitMessages(nextMessages);
      void saveCurrentThread(nextMessages, nextRevision);
    } catch {
      commitMessages(messages);
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function commitMessages(nextMessages: Message[]) {
    messagesRef.current = nextMessages;
    setMessages(nextMessages);

    const nextRevision = localRevisionRef.current + 1;
    localRevisionRef.current = nextRevision;
    setLocalRevision(nextRevision);
    setSaveAuthRequired(auth.status !== "signed_in");
    setSaveState(activeThreadRef.current ? "unsaved_changes" : "not_saved");
    return nextRevision;
  }

  async function loadThreads() {
    if (auth.status !== "signed_in") {
      setThreads([]);
      return;
    }

    try {
      const res = await axisAuthenticatedFetch("/api/axis/threads");
      if (res.status === 401) {
        setThreads([]);
        setSaveAuthRequired(true);
        void auth.reload();
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { threads?: AxisThreadListItem[] };
      setThreads(Array.isArray(data.threads) ? data.threads : []);
    } catch {
      // Thread access is additive; conversation remains usable without it.
    }
  }

  async function saveCurrentThread(
    snapshot = messagesRef.current,
    revision = localRevisionRef.current,
  ) {
    if (saveState === "saving") return;
    const persistedMessages = snapshot.slice(1);
    if (persistedMessages.length === 0) {
      setSaveState("not_saved");
      return;
    }
    if (auth.status !== "signed_in") {
      setSaveAuthRequired(true);
      setSaveState(activeThreadRef.current ? "unsaved_changes" : "not_saved");
      return;
    }

    const messagesToSave = persistedMessages.map((message, index) => ({
      content: message.content,
      createdAt: message.createdAt,
      ordinal: index + 1,
      role: message.role,
      threadBoard: message.threadBoard ?? null,
    }));

    const active = activeThreadRef.current;
    setSaveState("saving");
    setSaveAuthRequired(false);

    try {
      const res = active
        ? await axisAuthenticatedFetch(`/api/axis/threads/${active.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: messagesToSave }),
          })
        : await axisAuthenticatedFetch("/api/axis/threads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: messagesToSave }),
          });

      if (!res.ok) {
        if (res.status === 401) {
          setSaveAuthRequired(true);
          void auth.reload();
        }
        setSaveState("error");
        return;
      }

      const data = (await res.json()) as {
        saved?: boolean;
        thread?: PersistedThread;
        updatedAt?: string;
      };
      const savedAt = data.thread?.updatedAt ?? data.updatedAt ?? new Date().toISOString();
      const nextActiveThread = data.thread
        ? {
            id: data.thread.id,
            title: data.thread.title,
            createdAt: data.thread.createdAt,
            updatedAt: data.thread.updatedAt,
            lastOpenedAt: data.thread.lastOpenedAt,
            lastSavedAt: savedAt,
          }
        : active
          ? {
              ...active,
              updatedAt: savedAt,
              lastSavedAt: savedAt,
            }
          : null;

      if (!nextActiveThread) {
        setSaveState("error");
        return;
      }

      activeThreadRef.current = nextActiveThread;
      setActiveThread(nextActiveThread);

      if (revision === localRevisionRef.current) {
        setSaveState("saved");
      } else {
        setSaveState("unsaved_changes");
      }
      void loadThreads();
    } catch {
      setSaveState("error");
    }
  }

  async function openThread(threadId: string) {
    if (auth.status !== "signed_in") {
      setSaveAuthRequired(true);
      setThreads([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await axisAuthenticatedFetch(`/api/axis/threads/${threadId}`);
      if (!res.ok) {
        if (res.status === 401) {
          setSaveAuthRequired(true);
          setThreads([]);
          void auth.reload();
        }
        setError("Saved thread could not be opened.");
        return;
      }

      const data = (await res.json()) as { thread?: PersistedThread };
      const restored = data.thread?.messages ?? [];
      const initial = createInitialMessage();
      const restoredMessages = [
        initial,
        ...restored.map((message) => ({
          role: message.role,
          content: message.content,
          createdAt: message.createdAt,
          threadBoard: message.threadBoard,
        })),
      ];
      messagesRef.current = restoredMessages;
      setMessages(restoredMessages);
      if (data.thread) {
        const nextActiveThread = {
          id: data.thread.id,
          title: data.thread.title,
          createdAt: data.thread.createdAt,
          updatedAt: data.thread.updatedAt,
          lastOpenedAt: data.thread.lastOpenedAt,
          lastSavedAt: data.thread.updatedAt,
        };
        activeThreadRef.current = nextActiveThread;
        setActiveThread(nextActiveThread);
      }
      localRevisionRef.current = 0;
      setLocalRevision(0);
      setSaveAuthRequired(false);
      setSaveState("saved");
      void loadThreads();
    } catch {
      setError("Saved thread could not be opened.");
    } finally {
      setLoading(false);
    }
  }

  function startNewThread() {
    const initial = createInitialMessage();
    messagesRef.current = [initial];
    setMessages([initial]);
    setInput("");
    activeThreadRef.current = null;
    setActiveThread(null);
    localRevisionRef.current = 0;
    setLocalRevision(0);
    setSaveAuthRequired(false);
    setSaveState("not_saved");
    setError(null);
  }

  function resetOwnerScopedThreadState(authRequired: boolean) {
    const initial = createInitialMessage();
    messagesRef.current = [initial];
    setMessages([initial]);
    setInput("");
    activeThreadRef.current = null;
    setActiveThread(null);
    setThreads([]);
    localRevisionRef.current = 0;
    setLocalRevision(0);
    setSaveAuthRequired(authRequired);
    setSaveState("not_saved");
    setError(null);
  }

  return (
    <>
      <main className="shell">
        <section className="room" aria-label="Axis thinking room">
          <div className="conversation-panel">
            <header className="site-header">
              <span className="site-mark">Axis</span>
              <span className="site-sub">Develop the work through conversation.</span>
              <ThreadPicker
                activeThreadId={activeThread?.id ?? null}
                onNewThread={startNewThread}
                onOpenThread={(threadId) => void openThread(threadId)}
                onSave={() => void saveCurrentThread()}
                saveAuthRequired={saveAuthRequired}
                saveDisabled={loading || saveState === "saving"}
                savedAt={activeThread?.lastSavedAt ?? null}
                saveState={saveState}
                signedIn={auth.status === "signed_in"}
                threads={threads}
              />
              <AxisAuthControl auth={auth} />
            </header>

            <div className={`thread${isInitial ? " thread--initial" : ""}`}>
              <div className="thread-inner">
                {threadStartedAt && (
                  <time
                    className="thread-start"
                    dateTime={threadStartedAt}
                    title={formatFullDateTime(threadStartedAt)}
                  >
                    Started {formatShortTime(threadStartedAt)}
                  </time>
                )}

                {messages.map((msg, i) => {
                  const previous = messages[i - 1];
                  const showDateSeparator =
                    previous &&
                    !isSameCalendarDay(previous.createdAt, msg.createdAt);

                  return (
                    <div key={`${msg.role}-${msg.createdAt}-${i}`} className="turn">
                      {showDateSeparator && (
                        <time
                          className="date-separator"
                          dateTime={msg.createdAt}
                          title={formatFullDateTime(msg.createdAt)}
                        >
                          {formatDateLabel(msg.createdAt)}
                        </time>
                      )}
                      <div className={`msg msg--${msg.role}`}>{msg.content}</div>
                      <time
                        className="turn-time"
                        dateTime={msg.createdAt}
                        title={formatFullDateTime(msg.createdAt)}
                        aria-label={`${msg.role === "assistant" ? "Axis reply" : "User message"} created ${formatFullDateTime(msg.createdAt)}`}
                      >
                        {formatShortTime(msg.createdAt)}
                      </time>

                      {i === latestAssistantIndex && msg.threadBoard && (
                        <div className="inline-board">
                          <ThreadBoard board={msg.threadBoard} generatedAt={msg.createdAt} />
                        </div>
                      )}
                    </div>
                  );
                })}

                {isInitial && (
                  <p className="helper">Bring the rough version. I&apos;ll help it develop.</p>
                )}

                {loading && (
                  <div className="thinking" aria-label="Thinking">
                    <span />
                    <span />
                    <span />
                  </div>
                )}

                {error && <p className="msg-error">{error}</p>}
                <div ref={bottomRef} />
              </div>
            </div>
          </div>

          <section className="board-stage" aria-label="Thread Board">
            {latestAssistant?.threadBoard ? (
              <ThreadBoard
                board={latestAssistant.threadBoard}
                generatedAt={latestAssistant.createdAt}
              />
            ) : (
              <div className="room-empty">
                <p className="room-empty-title">Board is ready.</p>
              </div>
            )}
          </section>
        </section>

        <div className="composer-wrap">
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <textarea
              ref={inputRef}
              className="composer-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Say the rough version..."
              rows={1}
              autoFocus
            />
            <button
              className="send-btn"
              type="submit"
              disabled={!input.trim() || loading}
            >
              Send
            </button>
          </form>
        </div>
      </main>

      <style jsx global>{`
        *,
        *::before,
        *::after {
          box-sizing: border-box;
        }

        html,
        body {
          background: var(--axis-room);
          color: color-mix(in srgb, var(--axis-ink) 92%, transparent);
          font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
          height: 100%;
          margin: 0;
          overflow: hidden;
          -webkit-font-smoothing: antialiased;
        }

        :root {
          --axis-room: ${AXIS_ROOM_COLORS.room};
          --axis-paper: ${AXIS_ROOM_COLORS.paper};
          --axis-ink: ${AXIS_ROOM_COLORS.ink};
          --axis-line: ${AXIS_ROOM_COLORS.line};
          --axis-grid: ${AXIS_ROOM_COLORS.grid};
        }
      `}</style>

      <style jsx>{`
        .shell {
          background: var(--axis-room);
          display: flex;
          flex-direction: column;
          height: 100dvh;
          overflow: hidden;
          position: relative;
          width: 100%;
        }

        .room {
          display: grid;
          flex: 1;
          gap: clamp(32px, 5vw, 84px);
          grid-template-columns: minmax(280px, 0.68fr) minmax(0, 1.32fr);
          min-height: 0;
          overflow: hidden;
          padding: 20px clamp(18px, 4vw, 64px) 112px;
          width: 100%;
        }

        .conversation-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          min-width: 0;
          width: 100%;
        }

        .site-header {
          align-items: baseline;
          display: flex;
          flex-shrink: 0;
          gap: 12px;
          min-width: 0;
          padding-bottom: 16px;
        }

        .site-mark {
          color: color-mix(in srgb, var(--axis-ink) 26%, transparent);
          flex-shrink: 0;
          font-size: 12px;
          letter-spacing: 0.05em;
          user-select: none;
        }

        .site-sub {
          color: color-mix(in srgb, var(--axis-ink) 20%, transparent);
          flex: 1;
          font-size: 11px;
          letter-spacing: 0.01em;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .thread {
          flex: 1;
          min-height: 0;
          overflow-x: hidden;
          overflow-y: auto;
          padding: 10px 0 46px;
          scroll-padding-bottom: 140px;
          scrollbar-width: none;
        }

        .thread::-webkit-scrollbar {
          display: none;
        }

        .thread--initial {
          padding-top: 10vh;
        }

        .thread-inner {
          display: flex;
          flex-direction: column;
          gap: 18px;
          min-width: 0;
        }

        .turn {
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 0;
        }

        .msg {
          font-size: clamp(18px, 1.55vw, 22px);
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .msg--assistant {
          color: color-mix(in srgb, var(--axis-ink) 76%, transparent);
        }

        .msg--user {
          color: color-mix(in srgb, var(--axis-ink) 96%, transparent);
        }

        .thread-start,
        .date-separator,
        .turn-time {
          color: color-mix(in srgb, var(--axis-ink) 28%, transparent);
          display: block;
          font-size: 10.5px;
          line-height: 1.2;
        }

        .thread-start {
          margin-bottom: 4px;
        }

        .date-separator {
          border-top: 1px solid color-mix(in srgb, var(--axis-line) 8%, transparent);
          margin: 6px 0 2px;
          padding-top: 8px;
        }

        .turn-time {
          margin-top: -2px;
        }

        .helper {
          color: color-mix(in srgb, var(--axis-ink) 32%, transparent);
          font-size: 14px;
          font-style: normal;
          margin: -8px 0 0;
        }

        .msg-error {
          color: rgba(110, 38, 28, 0.72);
          font-size: 14px;
          font-style: normal;
          margin: 0;
        }

        .thinking {
          align-items: center;
          display: flex;
          gap: 5px;
          padding: 6px 0;
        }

        .thinking span {
          animation: pulse 1.1s ease-in-out infinite;
          background: color-mix(in srgb, var(--axis-ink) 28%, transparent);
          border-radius: 999px;
          display: block;
          height: 4px;
          width: 4px;
        }

        .thinking span:nth-child(2) {
          animation-delay: 0.18s;
        }

        .thinking span:nth-child(3) {
          animation-delay: 0.36s;
        }

        .inline-board {
          display: none;
        }

        .board-stage {
          align-self: stretch;
          background:
            linear-gradient(color-mix(in srgb, var(--axis-room) 88%, transparent), color-mix(in srgb, var(--axis-room) 88%, transparent)),
            linear-gradient(color-mix(in srgb, var(--axis-grid) 54%, transparent) 1px, transparent 1px),
            linear-gradient(90deg, color-mix(in srgb, var(--axis-grid) 38%, transparent) 1px, transparent 1px);
          background-size: auto, 38px 38px, 38px 38px;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          min-height: 0;
          min-width: 0;
          overflow-x: hidden;
          overflow-y: auto;
          padding: clamp(18px, 2.5vw, 38px) 0 32px;
          scrollbar-width: none;
          width: 100%;
        }

        .board-stage::-webkit-scrollbar {
          display: none;
        }

        .room-empty {
          border-top: 1px solid color-mix(in srgb, var(--axis-line) 14%, transparent);
          color: color-mix(in srgb, var(--axis-ink) 34%, transparent);
          margin-top: clamp(28px, 10vh, 96px);
          max-width: 620px;
          padding-top: 18px;
        }

        .room-empty-title {
          color: color-mix(in srgb, var(--axis-ink) 52%, transparent);
          font-size: clamp(28px, 4vw, 56px);
          line-height: 1.02;
          margin: 0;
        }

        @keyframes pulse {
          0%,
          80%,
          100% {
            opacity: 0.22;
          }
          40% {
            opacity: 1;
          }
        }

        .composer-wrap {
          background: color-mix(in srgb, var(--axis-room) 94%, transparent);
          backdrop-filter: blur(14px);
          bottom: 0;
          left: 0;
          padding: 0 clamp(16px, 3vw, 36px) max(14px, env(safe-area-inset-bottom));
          position: fixed;
          right: 0;
          width: 100%;
          z-index: 3;
        }

        .composer {
          align-items: flex-end;
          border-top: 1px solid color-mix(in srgb, var(--axis-line) 10%, transparent);
          display: flex;
          gap: 12px;
          margin: 0 auto;
          max-width: 1160px;
          padding: 14px 0 8px;
        }

        .composer-input {
          background: transparent;
          border: 0;
          color: color-mix(in srgb, var(--axis-ink) 92%, transparent);
          flex: 1;
          font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
          font-size: 18px;
          line-height: 1.5;
          max-height: 120px;
          min-height: 28px;
          min-width: 0;
          outline: 0;
          overflow-y: auto;
          padding: 0;
          resize: none;
        }

        .composer-input::placeholder {
          color: color-mix(in srgb, var(--axis-ink) 26%, transparent);
        }

        .send-btn {
          background: color-mix(in srgb, var(--axis-ink) 88%, transparent);
          border: 0;
          border-radius: 3px;
          color: var(--axis-room);
          cursor: pointer;
          flex-shrink: 0;
          font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
          font-size: 13px;
          height: 34px;
          letter-spacing: 0.03em;
          padding: 0 14px;
          transition: opacity 0.12s ease;
        }

        .send-btn:disabled {
          cursor: default;
          opacity: 0.22;
        }

        .send-btn:not(:disabled):hover {
          opacity: 0.72;
        }

        @media (max-width: 760px) {
          .room {
            display: block;
            padding-bottom: max(152px, calc(env(safe-area-inset-bottom) + 132px));
            padding-inline: 12px;
            padding-top: 8px;
          }

          .conversation-panel {
            height: 100%;
          }

          .site-sub {
            display: none;
          }

          .inline-board {
            display: block;
          }

          .board-stage {
            display: none;
          }

          .msg {
            font-size: 15.5px;
            line-height: 1.36;
          }

          .composer-input {
            font-size: 16px;
            line-height: 1.36;
            max-height: 92px;
            min-height: 24px;
          }

          .thread {
            padding-bottom: 122px;
            scroll-padding-bottom: 182px;
          }

          .thread--initial {
            padding-top: 6vh;
          }

          .thread-inner {
            gap: 9px;
          }

          .turn {
            gap: 3px;
          }

          .composer-wrap {
            padding-inline: 11px;
            padding-bottom: max(20px, calc(env(safe-area-inset-bottom) + 12px));
          }

          .composer {
            gap: 8px;
            padding: 8px 0 6px;
          }

          .send-btn {
            height: 30px;
            padding-inline: 11px;
          }
        }

        @media (min-width: 761px) and (max-width: 1180px) {
          .room {
            gap: clamp(20px, 3vw, 36px);
            grid-template-columns: minmax(240px, 0.5fr) minmax(0, 1.5fr);
            padding-inline: clamp(14px, 2.6vw, 32px);
          }

          .board-stage {
            padding-top: clamp(14px, 2vw, 24px);
          }

          .msg {
            font-size: clamp(16px, 1.8vw, 19px);
            line-height: 1.42;
          }
        }

        @media (min-width: 761px) and (max-width: 980px) {
          .room {
            display: block;
            padding-bottom: max(138px, calc(env(safe-area-inset-bottom) + 116px));
            padding-inline: 16px;
          }

          .conversation-panel {
            height: 100%;
          }

          .inline-board {
            display: block;
          }

          .board-stage {
            display: none;
          }

          .thread {
            padding-bottom: 118px;
            scroll-padding-bottom: 172px;
          }

          .thread-inner {
            gap: 12px;
          }
        }
      `}</style>
    </>
  );
}

function formatShortTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFullDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isSameCalendarDay(left: string, right: string) {
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) {
    return true;
  }
  return leftDate.toDateString() === rightDate.toDateString();
}
