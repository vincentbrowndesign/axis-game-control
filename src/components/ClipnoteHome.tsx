"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSession, getSessions, type Session } from "../lib/clipnote-store";

export function ClipnoteHome() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const router = useRouter();

  useEffect(() => {
    setSessions(getSessions());
  }, []);

  function handleNewSession() {
    const today = new Date().toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
    });
    const session = createSession(`Session ${today}`);
    router.push(`/session/${session.id}`);
  }

  return (
    <main className="cn-home">
      <header className="cn-home-header">
        <p className="cn-brand">CLIPNOTE</p>
      </header>

      <button className="cn-new-btn" onClick={handleNewSession} type="button">
        NEW SESSION
      </button>

      {sessions.length > 0 ? (
        <section className="cn-session-list">
          <p className="cn-section-label">SESSIONS</p>
          {sessions.map((session) => (
            <Link className="cn-session-card" href={`/session/${session.id}`} key={session.id}>
              <span className="cn-session-card-title">{session.title}</span>
              <span className="cn-session-card-meta">
                <span>
                  {new Date(session.created_at).toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <span>
                  {session.clipnotes.length} {session.clipnotes.length === 1 ? "clipnote" : "clipnotes"}
                </span>
              </span>
            </Link>
          ))}
        </section>
      ) : (
        <p className="cn-empty-state">Start your first session.</p>
      )}
    </main>
  );
}
