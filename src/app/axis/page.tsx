"use client";

import { useEffect, useRef, useState } from "react";
import WhiteboardView from "./whiteboard-view";

interface Annotation {
  label: string;
  note: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  annotation?: Annotation;
}

const INITIAL: Message = { role: "assistant", content: "What are we working on?" };

export default function AxisPage() {
  const [messages, setMessages] = useState<Message[]>([INITIAL]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"conversation" | "whiteboard">("conversation");

  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isInitial = messages.length === 1 && !loading;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  }, [input]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const apiHistory = [...messages.slice(1), userMsg];

    setMessages((prev) => [...prev, userMsg]);
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
        setMessages((prev) => prev.slice(0, -1));
        setError("Something went wrong. Try again.");
        setLoading(false);
        return;
      }

      const data = (await res.json()) as { reply: string; annotation?: Annotation };
      // Annotation belongs to the user message being read, not the Axis reply.
      // Replace the optimistic user message with the annotated version, then add the reply.
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "user", content: text, ...(data.annotation ? { annotation: data.annotation } : {}) },
        { role: "assistant", content: data.reply },
      ]);
    } catch {
      setMessages((prev) => prev.slice(0, -1));
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <main className={`shell${view === "whiteboard" ? " shell--whiteboard" : ""}`}>
        <header className="site-header">
          <span className="site-mark">Axis</span>
          <span className="site-sub">Develop the work through conversation.</span>
          <nav className="view-nav" aria-label="View">
            <button
              type="button"
              className={`view-btn${view === "conversation" ? " view-btn--on" : ""}`}
              onClick={() => setView("conversation")}
            >
              Conversation
            </button>
            <button
              type="button"
              className={`view-btn${view === "whiteboard" ? " view-btn--on" : ""}`}
              onClick={() => setView("whiteboard")}
            >
              Whiteboard
            </button>
          </nav>
        </header>

        {view === "whiteboard" && (
          <WhiteboardView
            history={messages
              .slice(1)
              .map(({ role, content }) => ({ role, content }))}
          />
        )}

        <div
          className={`thread${isInitial ? " thread--initial" : ""}${view === "whiteboard" ? " thread--hidden" : ""}`}
          ref={threadRef}
        >
          <div className="thread-inner">
            {messages.map((msg, i) => (
              <div key={i} className={`msg msg--${msg.role}`}>
                {msg.content}
                {msg.annotation && (
                  <p className="msg-annotation">
                    {msg.annotation.label} · {msg.annotation.note}
                  </p>
                )}
              </div>
            ))}

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
              placeholder="Say the rough version…"
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
          <p className="support-line">Axis helps the work develop one layer at a time.</p>
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
          background: #fbfaf7;
          color: rgba(25, 24, 21, 0.92);
          font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
          -webkit-font-smoothing: antialiased;
          margin: 0;
          min-height: 100%;
          overflow-x: hidden;
        }
      `}</style>

      <style jsx>{`
        .shell {
          display: flex;
          flex-direction: column;
          height: 100svh;
          margin: 0 auto;
          max-width: 800px;
          padding: 0 clamp(20px, 5vw, 60px);
          transition: max-width 0.18s ease, padding 0.18s ease;
        }

        .shell--whiteboard {
          max-width: 1280px;
          padding: 0 clamp(10px, 2.5vw, 34px);
        }

        .site-header {
          align-items: baseline;
          display: flex;
          gap: 16px;
          padding: 18px 0 0;
          flex-shrink: 0;
        }

        .site-mark {
          color: rgba(25, 24, 21, 0.22);
          font-size: 12px;
          letter-spacing: 0.05em;
          user-select: none;
        }

        .site-sub {
          color: rgba(25, 24, 21, 0.18);
          font-size: 11px;
          letter-spacing: 0.01em;
        }

        .view-nav {
          display: flex;
          gap: 1px;
          margin-left: auto;
        }

        .view-btn {
          background: transparent;
          border: 0;
          border-radius: 3px;
          color: rgba(25, 24, 21, 0.28);
          cursor: pointer;
          font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
          font-size: 11px;
          letter-spacing: 0.04em;
          padding: 2px 7px;
          transition: color 0.1s ease;
        }

        .view-btn--on {
          color: rgba(25, 24, 21, 0.75);
        }

        .view-btn:not(.view-btn--on):hover {
          color: rgba(25, 24, 21, 0.5);
        }

        .thread--hidden {
          display: none;
        }

        .thread {
          flex: 1;
          overflow-y: auto;
          padding: 32px 0 180px;
        }

        .thread--initial {
          padding-top: 14vh;
        }

        .thread-inner {
          display: flex;
          flex-direction: column;
          gap: 26px;
          max-width: 660px;
        }

        .msg {
          font-size: clamp(19px, 2.3vw, 26px);
          line-height: 1.56;
        }

        .msg--assistant {
          color: rgba(25, 24, 21, 0.82);
        }

        .msg--user {
          color: rgba(25, 24, 21, 0.98);
        }

        .helper {
          color: rgba(25, 24, 21, 0.32);
          font-size: 15px;
          font-style: normal;
          margin: -8px 0 0;
        }

        .msg-annotation {
          color: rgba(25, 24, 21, 0.28);
          font-size: 11px;
          letter-spacing: 0.04em;
          margin: 10px 0 0;
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
          background: rgba(25, 24, 21, 0.28);
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
          background: rgba(251, 250, 247, 0.94);
          backdrop-filter: blur(14px);
          bottom: 0;
          left: 0;
          padding: 0 clamp(20px, 5vw, 60px) max(18px, env(safe-area-inset-bottom));
          position: fixed;
          right: 0;
        }

        .composer {
          align-items: flex-end;
          border-top: 1px solid rgba(25, 24, 21, 0.1);
          display: flex;
          gap: 12px;
          margin: 0 auto;
          max-width: 800px;
          padding: 14px 0 10px;
        }

        .composer-input {
          background: transparent;
          border: 0;
          color: rgba(25, 24, 21, 0.92);
          flex: 1;
          font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
          font-size: 18px;
          line-height: 1.5;
          max-height: 160px;
          min-height: 28px;
          min-width: 0;
          outline: 0;
          overflow-y: auto;
          padding: 0;
          resize: none;
        }

        .composer-input::placeholder {
          color: rgba(25, 24, 21, 0.26);
        }

        .send-btn {
          background: rgba(25, 24, 21, 0.88);
          border: 0;
          border-radius: 3px;
          color: #fbfaf7;
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

        .support-line {
          color: rgba(25, 24, 21, 0.2);
          font-size: 11px;
          letter-spacing: 0.01em;
          margin: 0 auto;
          max-width: 800px;
          padding: 0 0 6px;
          text-align: center;
        }

        @media (max-width: 600px) {
          .thread--initial {
            padding-top: 12vh;
          }
          .msg {
            font-size: 18px;
          }
          .composer-input {
            font-size: 16px;
          }
        }
      `}</style>
    </>
  );
}
