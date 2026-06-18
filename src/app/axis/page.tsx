"use client";

import { useEffect, useRef, useState } from "react";
import ThreadBoard, { type ThreadBoardData } from "./thread-board";

interface Message {
  role: "user" | "assistant";
  content: string;
  threadBoard?: ThreadBoardData | null;
}

const INITIAL: Message = { role: "assistant", content: "What are we working on?" };

export default function AxisPage() {
  const [messages, setMessages] = useState<Message[]>([INITIAL]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isInitial = messages.length === 1 && !loading;
  const latestAssistantIndex = messages.reduce(
    (latest, message, index) => (message.role === "assistant" ? index : latest),
    -1,
  );

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
    const apiHistory = [...messages.slice(1), userMsg].map(
      ({ role, content }) => ({ role, content }),
    );

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

      const data = (await res.json()) as {
        reply: string;
        threadBoard: ThreadBoardData | null;
      };

      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "user", content: text },
        {
          role: "assistant",
          content: data.reply,
          threadBoard: data.threadBoard,
        },
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
      <main className="shell">
        <section className="conversation" aria-label="Axis conversation">
          <div className="conversation-inner">
            <header className="site-header">
              <span className="site-mark">Axis</span>
              <span className="site-sub">Develop the work through conversation.</span>
            </header>

            <div className={`thread${isInitial ? " thread--initial" : ""}`}>
              <div className="thread-inner">
                {messages.map((msg, i) => (
                  <div key={i} className="turn">
                    <div className={`msg msg--${msg.role}`}>{msg.content}</div>

                    {i === latestAssistantIndex && msg.threadBoard && (
                      <ThreadBoard board={msg.threadBoard} />
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
          </div>
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
          background: #fbfaf7;
          color: rgba(25, 24, 21, 0.92);
          font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
          height: 100%;
          margin: 0;
          overflow: hidden;
          -webkit-font-smoothing: antialiased;
        }
      `}</style>

      <style jsx>{`
        .shell {
          background: #fbfaf7;
          display: flex;
          flex-direction: column;
          height: 100dvh;
          overflow: hidden;
          position: relative;
          width: 100vw;
        }

        .conversation {
          flex: 1;
          min-height: 0;
          overflow: hidden;
          padding: 18px clamp(16px, 4vw, 48px) 112px;
          width: 100%;
        }

        .conversation-inner {
          display: flex;
          flex-direction: column;
          height: 100%;
          margin: 0 auto;
          max-width: 820px;
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
          color: rgba(25, 24, 21, 0.26);
          flex-shrink: 0;
          font-size: 12px;
          letter-spacing: 0.05em;
          user-select: none;
        }

        .site-sub {
          color: rgba(25, 24, 21, 0.2);
          font-size: 11px;
          letter-spacing: 0.01em;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .thread {
          flex: 1;
          min-height: 0;
          overflow-x: hidden;
          overflow-y: auto;
          padding: 10px 0 28px;
          scrollbar-width: none;
        }

        .thread::-webkit-scrollbar {
          display: none;
        }

        .thread--initial {
          padding-top: 12vh;
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
          gap: 12px;
          min-width: 0;
        }

        .msg {
          font-size: 20px;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .msg--assistant {
          color: rgba(25, 24, 21, 0.76);
        }

        .msg--user {
          color: rgba(25, 24, 21, 0.96);
        }

        .helper {
          color: rgba(25, 24, 21, 0.32);
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
          padding: 0 clamp(16px, 3vw, 36px) max(14px, env(safe-area-inset-bottom));
          position: fixed;
          right: 0;
          z-index: 3;
        }

        .composer {
          align-items: flex-end;
          border-top: 1px solid rgba(25, 24, 21, 0.1);
          display: flex;
          gap: 12px;
          margin: 0 auto;
          max-width: 1160px;
          padding: 14px 0 8px;
        }

        .composer-input {
          background: transparent;
          border: 0;
          color: rgba(25, 24, 21, 0.92);
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

        @media (max-width: 760px) {
          .conversation {
            padding-inline: 16px;
            padding-top: 14px;
          }

          .site-sub {
            display: none;
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
