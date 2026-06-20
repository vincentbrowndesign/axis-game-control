"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { axisAuthenticatedFetch } from "../../lib/axis-client-auth";
import { AxisContextComposer } from "../../components/axis/context-dashboard/axis-context-composer";
import { AxisContextDashboardShell } from "../../components/axis/context-dashboard/axis-context-dashboard-shell";
import dashboardStyles from "../../components/axis/context-dashboard/axis-context-dashboard.module.css";
import AxisAuthControl, { useAxisAuth } from "./axis-auth-control";
import ThreadBoard, { type ThreadBoardData, type ThreadBoardSection } from "./thread-board";
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

const OPEN_LOOP_LABELS = new Set(["QUESTION", "NEED NEXT", "WATCH NEXT", "DECISION"]);
const ACTION_LABELS = new Set(["ACTION", "NEXT MOVE", "INTERVENTION", "OUTCOME / NEXT MOVE"]);
const PROOF_LABELS = new Set(["PROOF", "PROOF NEEDED", "EVIDENCE", "SIGNALS"]);
const INITIAL_AXIS_MESSAGE_CREATED_AT = "2000-01-01T00:00:00.000Z";
const INITIAL_AXIS_MESSAGE_CONTENT = "What are we working on?";

function createInitialMessage(): Message {
  return {
    role: "assistant",
    content: INITIAL_AXIS_MESSAGE_CONTENT,
    createdAt: INITIAL_AXIS_MESSAGE_CREATED_AT,
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
  const messagesRef = useRef<Message[]>(messages);
  const activeThreadRef = useRef<ActiveThreadMeta | null>(activeThread);
  const localRevisionRef = useRef(localRevision);
  const ownerIdRef = useRef<string | null | undefined>(undefined);

  const latestAssistantIndex = messages.reduce(
    (latest, message, index) => (message.role === "assistant" ? index : latest),
    -1,
  );
  const latestAssistant = messages[latestAssistantIndex];
  const latestBoard = latestAssistant?.threadBoard ?? null;
  const hasUserMessages = messages.some((message) => message.role === "user");
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
  const threadStartedAt =
    activeThread?.createdAt ??
    messages.find((message) => message.role === "user")?.createdAt;
  const threadTitle = activeThread?.title ?? latestBoard?.title ?? "Current thread";

  const sanitizedSections = useMemo(() => sanitizeSections(latestBoard), [latestBoard]);
  const boardDerivatives = useMemo(
    () => deriveBoardPresentation(sanitizedSections),
    [sanitizedSections],
  );
  const timelineItems = useMemo(
    () => createTimelineItems(messages, threadStartedAt),
    [messages, threadStartedAt],
  );

  const loadThreads = useCallback(async () => {
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
  }, [auth]);

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
    // Existing owner isolation must synchronously clear local thread state when the signed-in owner changes.
    resetOwnerScopedThreadState(nextOwnerId === null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (nextOwnerId) void loadThreads();
  }, [auth.status, auth.userId, loadThreads]);

  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
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
      <AxisContextDashboardShell
        activeContext={{
          contextSections: boardDerivatives.centerSections,
          detail: (
            <>
              {hasUserMessages && (
                <section className="axis-active-exchange" aria-label="Latest exchange">
                  {latestUserMessage && (
                    <div>
                      <span>Latest Note</span>
                      <p>{latestUserMessage.content}</p>
                    </div>
                  )}
                  {latestAssistant?.content && (
                    <div>
                      <span>Axis</span>
                      <p>{latestAssistant.content}</p>
                    </div>
                  )}
                </section>
              )}
              {latestBoard && (
                <details className="axis-full-board">
                  <summary>Show Full Board</summary>
                  <ThreadBoard board={latestBoard} generatedAt={latestAssistant?.createdAt} />
                </details>
              )}
            </>
          ),
          label: latestBoard ? "Current Read" : "Conversation",
          mainText: hasUserMessages
            ? latestBoard?.title?.trim() || latestAssistant?.content || "Current thread"
            : "WHAT ARE WE WORKING ON?",
          nextMove: boardDerivatives.nextMove,
          proofNeeded: boardDerivatives.proofNeeded,
          support: hasUserMessages
            ? latestBoard?.summary?.trim() || latestAssistant?.content || "Axis is shaping the first read."
            : "Bring the rough version. Axis will help it develop.",
        }}
        actions={boardDerivatives.actions}
        ariaLabel="Axis live room"
        composer={
          <AxisContextComposer
            ariaLabel="Axis composer"
            disabled={loading}
            inputId="axis-live-composer"
            inputRef={inputRef}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            onSubmit={() => void send()}
            onValueChange={setInput}
            placeholder="Say the rough version…"
            value={input}
            controls={
              <button
                className={dashboardStyles.composerSend}
                type="submit"
                disabled={!input.trim() || loading}
              >
                {loading ? "Sending..." : "Send"}
              </button>
            }
          />
        }
        header={{
          actions: (
            <>
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
            </>
          ),
          threadTitle,
        }}
        openLoops={boardDerivatives.openLoops}
        timelineItems={timelineItems}
      />
      {hasUserMessages && <span className="axis-room-active" aria-hidden="true" />}

      {loading && (
        <div className="axis-live-status" aria-live="polite">
          <span>Axis is shaping the thread...</span>
          <i aria-hidden="true" />
          <i aria-hidden="true" />
          <i aria-hidden="true" />
        </div>
      )}
      {error && (
        <p className="axis-live-error" role="alert">
          {error}
        </p>
      )}

      <style jsx global>{`
        html,
        body {
          margin: 0;
          min-height: 100%;
        }

        main[aria-label="Axis live room"] {
          background: #f4f0e6;
          color: #201d18;
          padding: 0;
        }

        main[aria-label="Axis live room"] > div {
          background: #f7f3ea;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          min-height: 100dvh;
          padding-bottom: max(96px, calc(env(safe-area-inset-bottom) + 86px));
        }

        main[aria-label="Axis live room"] header {
          background: color-mix(in srgb, #f7f3ea 92%, white);
          border-bottom: 1px solid rgba(45, 39, 30, 0.14);
          padding: 10px clamp(12px, 1.8vw, 22px);
          position: sticky;
          top: 0;
          z-index: 8;
        }

        main[aria-label="Axis live room"] header > div:first-child {
          gap: 10px;
        }

        main[aria-label="Axis live room"] header > div:first-child > span:first-child {
          color: rgba(32, 29, 24, 0.72);
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
        }

        main[aria-label="Axis live room"] header > div:nth-child(2) {
          display: none;
        }

        main[aria-label="Axis live room"] header > div:last-child {
          align-items: center;
          gap: 10px;
        }

        main[aria-label="Axis live room"] > div > section[aria-label="Context dashboard"] {
          grid-template-columns: minmax(7.5rem, 0.32fr) minmax(34rem, 1.95fr) minmax(13rem, 0.66fr);
          min-height: 0;
        }

        main[aria-label="Axis live room"] aside[aria-labelledby="axis-context-timeline-title"] {
          opacity: 0.76;
          padding-left: clamp(12px, 1.6vw, 18px);
          padding-right: 12px;
        }

        main[aria-label="Axis live room"] aside[aria-labelledby="axis-context-timeline-title"] li {
          padding-bottom: 14px;
        }

        main[aria-label="Axis live room"] aside[aria-labelledby="axis-context-timeline-title"] p {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
        }

        main[aria-label="Axis live room"] section[aria-labelledby="axis-context-active-title"] {
          padding: clamp(22px, 3.2vh, 38px) clamp(28px, 4.2vw, 62px) 24px;
        }

        main[aria-label="Axis live room"] #axis-context-active-title {
          color: #181510;
          font-size: clamp(52px, 7vw, 92px);
          letter-spacing: 0;
          max-width: 13ch;
        }

        main[aria-label="Axis live room"] section[aria-labelledby="axis-context-active-title"] > p {
          color: rgba(32, 29, 24, 0.78);
          font-size: clamp(18px, 1.55vw, 24px);
          line-height: 1.32;
          max-width: 50ch;
        }

        main[aria-label="Axis live room"] section[aria-labelledby="axis-context-active-title"] > div {
          margin-top: 14px;
        }

        main[aria-label="Axis live room"] section[aria-labelledby="axis-context-active-title"] > div > section {
          background: rgba(255, 253, 247, 0.52);
          border-color: rgba(32, 29, 24, 0.13);
          border-left: 2px solid rgba(126, 86, 45, 0.32);
          border-radius: 8px;
          min-height: 0;
          padding: 12px 14px;
        }

        main[aria-label="Axis live room"] section[aria-labelledby="axis-context-active-title"] > div > section h2 {
          color: rgba(32, 29, 24, 0.54);
          font-size: 10px;
          letter-spacing: 0.1em;
        }

        main[aria-label="Axis live room"] section[aria-labelledby="axis-context-active-title"] > div > section p,
        main[aria-label="Axis live room"] section[aria-labelledby="axis-context-active-title"] > div > section ul {
          color: rgba(24, 21, 16, 0.82);
          font-size: clamp(14px, 1.08vw, 16px);
          line-height: 1.32;
          margin-top: 7px;
        }

        main[aria-label="Axis live room"] section[aria-labelledby="axis-context-active-title"] > div > section li + li {
          margin-top: 4px;
        }

        main[aria-label="Axis live room"] form[aria-label="Axis composer"] {
          background: #fffdf7;
          border: 2px solid rgba(32, 29, 24, 0.24);
          border-radius: 14px;
          bottom: max(12px, env(safe-area-inset-bottom));
          box-shadow: 0 18px 44px rgba(32, 29, 24, 0.12);
          margin: 12px auto 0;
          max-width: min(980px, calc(100vw - 28px));
          padding: 14px 14px 14px 18px;
          position: fixed;
          right: 50%;
          transform: translateX(50%);
          width: min(980px, calc(100vw - 28px));
          z-index: 20;
        }

        main[aria-label="Axis live room"] form[aria-label="Axis composer"] textarea {
          color: #181510;
          font-size: 18px;
          min-height: 30px;
        }

        main[aria-label="Axis live room"] form[aria-label="Axis composer"] textarea::placeholder {
          color: rgba(32, 29, 24, 0.48);
        }

        main[aria-label="Axis live room"]
          aside[aria-label="Context intelligence"]
          section:has(.axis-need-to-lock-dot) {
          border-top-color: rgba(32, 29, 24, 0.1);
        }

        main[aria-label="Axis live room"]
          aside[aria-label="Context intelligence"]
          section:has(.axis-need-to-lock-dot)
          h2 {
          font-size: 0;
        }

        main[aria-label="Axis live room"]
          aside[aria-label="Context intelligence"]
          section:has(.axis-need-to-lock-dot)
          h2::after {
          color: rgba(32, 29, 24, 0.52);
          content: "Need To Lock";
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        main[aria-label="Axis live room"]
          aside[aria-label="Context intelligence"]
          section:has(.axis-need-to-lock-dot)
          h2
          + span {
          display: none;
        }

        main[aria-label="Axis live room"]
          aside[aria-label="Context intelligence"]
          section:has(.axis-need-to-lock-dot)
          ul {
          gap: 7px;
          margin-top: 9px;
        }

        main[aria-label="Axis live room"]
          aside[aria-label="Context intelligence"]
          section:has(.axis-need-to-lock-dot)
          li {
          align-items: start;
          border-bottom: 1px solid rgba(32, 29, 24, 0.12);
          display: grid;
          gap: 8px;
          grid-template-columns: 9px minmax(0, 1fr);
          padding-bottom: 8px;
        }

        main[aria-label="Axis live room"]
          aside[aria-label="Context intelligence"]
          section:has(.axis-need-to-lock-dot)
          li:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }

        main[aria-label="Axis live room"]
          aside[aria-label="Context intelligence"]
          section:has(.axis-need-to-lock-dot)
          p {
          color: rgba(32, 29, 24, 0.76);
          font-size: clamp(13px, 1.05vw, 15px);
          line-height: 1.28;
        }

        .axis-need-to-lock-dot {
          background: rgba(126, 86, 45, 0.72);
          border-radius: 999px;
          display: block;
          height: 6px;
          margin-top: 5px;
          width: 6px;
        }

        main[aria-label="Axis live room"] form[aria-label="Axis composer"] button[type="submit"] {
          background: #181510;
          border-radius: 10px;
          color: #fffdf7;
          font-size: 13px;
          font-weight: 700;
          min-height: 42px;
          min-width: 74px;
        }

        main[aria-label="Axis live room"] form[aria-label="Axis composer"] button[type="submit"]:disabled {
          opacity: 0.32;
        }

        body:has(.axis-room-active)
          main[aria-label="Axis live room"]
          #axis-context-active-title {
          font-size: clamp(32px, 3.3vw, 50px);
          line-height: 1.02;
          max-width: 20ch;
        }

        body:has(.axis-room-active)
          main[aria-label="Axis live room"]
          section[aria-labelledby="axis-context-active-title"] {
          padding-top: clamp(16px, 2vh, 26px);
        }

        body:has(.axis-room-active)
          main[aria-label="Axis live room"]
          section[aria-labelledby="axis-context-active-title"]
          > p {
          color: rgba(24, 21, 16, 0.8);
          font-size: clamp(16px, 1.28vw, 20px);
          line-height: 1.32;
          margin-top: 10px;
        }

        body:has(.axis-room-active)
          main[aria-label="Axis live room"]
          section[aria-labelledby="axis-context-active-title"]
          section {
          background: rgba(255, 253, 247, 0.54);
          border-color: rgba(32, 29, 24, 0.14);
        }

        body:has(.axis-room-active)
          main[aria-label="Axis live room"]
          form[aria-label="Axis composer"] {
          border-color: rgba(32, 29, 24, 0.42);
          box-shadow: 0 16px 34px rgba(32, 29, 24, 0.17);
        }

        main[aria-label="Axis live room"] form[aria-label="Axis composer"]:focus-within {
          border-color: #181510;
          box-shadow:
            0 0 0 3px rgba(32, 29, 24, 0.08),
            0 18px 44px rgba(32, 29, 24, 0.18);
        }

        main[aria-label="Axis live room"] form[aria-label="Axis composer"] button[type="submit"]:not(:disabled):hover {
          background: #342e25;
        }

        @media (max-width: 900px) {
          main[aria-label="Axis live room"] > div {
            padding-bottom: max(108px, calc(env(safe-area-inset-bottom) + 96px));
          }

          main[aria-label="Axis live room"] header {
            align-items: center;
            grid-template-columns: minmax(0, 1fr) auto;
            padding: 9px 12px;
          }

          main[aria-label="Axis live room"] header > div:first-child {
            min-width: 0;
          }

          main[aria-label="Axis live room"] header > div:first-child > span:nth-child(2),
          main[aria-label="Axis live room"] header > div:first-child > button {
            display: none;
          }

          main[aria-label="Axis live room"] header > div:last-child {
            gap: 8px;
            justify-content: flex-end;
            min-width: 0;
          }

          main[aria-label="Axis live room"] > div > section[aria-label="Context dashboard"] {
            display: flex;
            flex-direction: column;
          }

          main[aria-label="Axis live room"] aside[aria-labelledby="axis-context-timeline-title"] {
            order: 3;
          }

          main[aria-label="Axis live room"] #axis-context-active-title,
          body:has(.axis-room-active)
            main[aria-label="Axis live room"]
            #axis-context-active-title {
            font-size: clamp(28px, 8vw, 44px);
            max-width: 16ch;
          }

          main[aria-label="Axis live room"] form[aria-label="Axis composer"] {
            border-radius: 12px;
            max-width: calc(100vw - 18px);
            padding: 11px;
            width: calc(100vw - 18px);
          }

          main[aria-label="Axis live room"] form[aria-label="Axis composer"] textarea {
            font-size: 16px;
          }
        }
      `}</style>

      <style jsx>{`
        .axis-room-active {
          display: none;
        }

        .axis-full-board {
          margin-top: 12px;
        }

        .axis-active-exchange {
          border-bottom: 1px solid rgba(32, 29, 24, 0.12);
          border-top: 1px solid rgba(32, 29, 24, 0.16);
          display: grid;
          gap: 0;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin-top: 14px;
          padding: 10px 0;
        }

        .axis-active-exchange div {
          min-width: 0;
          padding-right: 14px;
        }

        .axis-active-exchange div + div {
          border-left: 1px solid rgba(32, 29, 24, 0.12);
          padding-left: 14px;
          padding-right: 0;
        }

        .axis-active-exchange span {
          color: rgba(32, 29, 24, 0.56);
          display: block;
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .axis-active-exchange p {
          color: rgba(24, 21, 16, 0.84);
          font-size: clamp(14px, 1.05vw, 16px);
          line-height: 1.28;
          margin: 5px 0 0;
          overflow-wrap: anywhere;
        }

        .axis-full-board summary {
          color: color-mix(in srgb, var(--axis-ink) 48%, transparent);
          cursor: pointer;
          font-size: 12px;
          margin-bottom: 12px;
        }

        .axis-live-status,
        .axis-live-error {
          align-items: center;
          background: rgba(255, 253, 247, 0.86);
          border: 1px solid rgba(32, 29, 24, 0.12);
          border-radius: 999px;
          bottom: max(82px, calc(env(safe-area-inset-bottom) + 70px));
          box-shadow: 0 8px 20px rgba(32, 29, 24, 0.08);
          color: color-mix(in srgb, var(--axis-ink) 48%, transparent);
          display: inline-flex;
          font-size: 12px;
          gap: 5px;
          left: 50%;
          padding: 7px 11px;
          pointer-events: none;
          position: fixed;
          transform: translateX(-50%);
          z-index: 12;
        }

        .axis-live-status i {
          animation: axis-dot-pulse 1s ease-in-out infinite;
          background: rgba(32, 29, 24, 0.42);
          border-radius: 999px;
          display: block;
          height: 4px;
          width: 4px;
        }

        .axis-live-status i:nth-of-type(2) {
          animation-delay: 0.14s;
        }

        .axis-live-status i:nth-of-type(3) {
          animation-delay: 0.28s;
        }

        .axis-live-error {
          color: rgba(110, 38, 28, 0.78);
        }

        @keyframes axis-dot-pulse {
          0%,
          80%,
          100% {
            opacity: 0.24;
          }
          40% {
            opacity: 1;
          }
        }

        @media (max-width: 700px) {
          .axis-active-exchange {
            gap: 8px;
            grid-template-columns: 1fr;
          }

          .axis-active-exchange div {
            padding-right: 0;
          }

          .axis-active-exchange div + div {
            border-left: 0;
            border-top: 1px solid rgba(32, 29, 24, 0.1);
            padding-left: 0;
            padding-top: 8px;
          }
        }
      `}</style>
    </>
  );
}

function sanitizeSections(board: ThreadBoardData | null): ThreadBoardSection[] {
  if (!Array.isArray(board?.sections)) return [];

  return board.sections
    .map((section) => ({
      ...section,
      items: Array.isArray(section.items)
        ? section.items.filter((item) => typeof item === "string" && item.trim()).slice(0, 4)
        : [],
    }))
    .filter((section) => section.label.trim() && section.items.length > 0);
}

function deriveBoardPresentation(sections: ThreadBoardSection[]) {
  const centerSections: Array<{ id: string; items: string[]; title: string }> = [];
  const openLoops: Array<{ control?: ReactNode; id: string; text: string }> = [];
  const actions: Array<{ id: string; title: string }> = [];
  let proofNeeded: string | undefined;
  let nextMove: string | undefined;

  sections.forEach((section, index) => {
    const label = normalizeLabel(section.label);
    const id = `${label}-${index}`;

    if (OPEN_LOOP_LABELS.has(label)) {
      section.items.slice(0, 2).forEach((item, itemIndex) => {
        openLoops.push({
          control: <span className="axis-need-to-lock-dot" aria-hidden="true" />,
          id: `${id}-${itemIndex}`,
          text: item,
        });
      });
      return;
    }

    if (PROOF_LABELS.has(label)) {
      proofNeeded = proofNeeded ?? section.items.join(" ");
      return;
    }

    if (ACTION_LABELS.has(label)) {
      nextMove = nextMove ?? section.items[0];
      section.items.forEach((item, itemIndex) => {
        actions.push({ id: `${id}-${itemIndex}`, title: item });
      });
    }

    centerSections.push({
      id,
      items: section.items.slice(0, 3),
      title: getVisibleSectionTitle(section.label),
    });
  });

  return {
    actions,
    centerSections,
    nextMove,
    openLoops,
    proofNeeded,
  };
}

function createTimelineItems(messages: Message[], threadStartedAt?: string) {
  const items = [];

  if (threadStartedAt) {
    items.push({
      id: "thread-started",
      time: formatShortTime(threadStartedAt),
      title: "Thread started",
    });
  }

  messages.forEach((message, index) => {
    if (isInitialAxisMessage(message)) return;

    items.push({
      detail: message.content,
      id: `${message.role}-${message.createdAt}-${index}`,
      time: formatShortTime(message.createdAt),
      title: message.role === "assistant" ? "Axis" : "You",
    });

    if (message.role === "assistant" && message.threadBoard) {
      items.push({
        detail: message.threadBoard.title,
        id: `board-${message.createdAt}-${index}`,
        time: formatShortTime(message.createdAt),
        title: "Board",
      });
    }
  });

  return items;
}

function isInitialAxisMessage(message: Message) {
  return (
    message.role === "assistant" &&
    message.content === INITIAL_AXIS_MESSAGE_CONTENT &&
    message.createdAt === INITIAL_AXIS_MESSAGE_CREATED_AT &&
    !message.threadBoard
  );
}

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function getVisibleSectionTitle(label: string) {
  const normalized = normalizeLabel(label);

  if (normalized === "OBSERVATION") return "What We Know";
  if (OPEN_LOOP_LABELS.has(normalized)) return "Need To Lock";
  return label;
}

function formatShortTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
