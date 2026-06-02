"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  createSession,
  getDatasetBins,
  getSessions,
  getTag,
  type Clipnote,
  type DatasetBin,
  type Session,
} from "../lib/clipnote-store";

type HomeView = "sessions" | "favorites" | "patterns";

type FavoriteAsset = {
  clipnote: Clipnote;
  session: Session;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
}

export function ClipnoteHome() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [favorites, setFavorites] = useState<FavoriteAsset[]>([]);
  const [patterns, setPatterns] = useState<DatasetBin[]>([]);
  const [activeView, setActiveView] = useState<HomeView>("sessions");
  const router = useRouter();

  useEffect(() => {
    const storedSessions = getSessions();
    setSessions(storedSessions);
    setFavorites(
      storedSessions.flatMap((session) =>
        session.clipnotes.map((clipnote) => ({ clipnote, session })),
      ),
    );
    setPatterns(getDatasetBins());
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
        <div>
          <p className="cn-brand">AXIS</p>
          <p className="cn-home-kicker">Asset Library</p>
        </div>
      </header>

      <button className="cn-new-btn" onClick={handleNewSession} type="button">
        NEW SESSION
      </button>

      <nav className="cn-library-nav" aria-label="Asset library">
        {(["sessions", "favorites", "patterns"] as HomeView[]).map((view) => (
          <button
            className="cn-library-tab"
            data-active={activeView === view ? "true" : undefined}
            key={view}
            onClick={() => setActiveView(view)}
            type="button"
          >
            {view}
          </button>
        ))}
      </nav>

      <section className="cn-library-panel">
        {activeView === "sessions" && (
          <div className="cn-session-list">
            <p className="cn-section-label">SESSIONS</p>
            {sessions.length > 0 ? (
              sessions.map((session) => (
                <Link className="cn-session-card" href={`/session/${session.id}`} key={session.id}>
                  <span className="cn-session-card-title">{session.title}</span>
                  <span className="cn-session-card-meta">
                    <span>{formatDate(session.created_at)}</span>
                    <span>
                      {session.clipnotes.length}{" "}
                      {session.clipnotes.length === 1 ? "Clipnote" : "Clipnotes"}
                    </span>
                  </span>
                </Link>
              ))
            ) : (
              <p className="cn-empty-state">Start your first session.</p>
            )}
          </div>
        )}

        {activeView === "favorites" && (
          <div className="cn-favorites-list">
            <p className="cn-section-label">FAVORITES</p>
            {favorites.length > 0 ? (
              favorites.map(({ clipnote, session }) => {
                const tag = clipnote.tag_id ? getTag(clipnote.tag_id) : null;
                return (
                  <Link
                    className="cn-favorite-card"
                    href={`/clipnote/${clipnote.id}`}
                    key={clipnote.id}
                  >
                    {clipnote.thumbnail_url ? (
                      <img alt="" className="cn-favorite-thumb" src={clipnote.thumbnail_url} />
                    ) : (
                      <div className="cn-favorite-thumb cn-favorite-thumb-empty" />
                    )}
                    <span className="cn-favorite-title">{clipnote.title}</span>
                    <span className="cn-favorite-meta">
                      {tag?.name ?? "Saved"} • {session.title}
                    </span>
                  </Link>
                );
              })
            ) : (
              <p className="cn-empty-state">Saved Clipnotes appear here.</p>
            )}
          </div>
        )}

        {activeView === "patterns" && (
          <div className="cn-patterns-list">
            <p className="cn-section-label">PATTERNS</p>
            {patterns.length > 0 ? (
              patterns.map((pattern) => (
                <div className="cn-pattern-card" key={pattern.tag_id}>
                  <span className="cn-pattern-name">{pattern.tag_name}</span>
                  <span className="cn-pattern-count">
                    {pattern.clipnote_count}{" "}
                    {pattern.clipnote_count === 1 ? "Clipnote" : "Clipnotes"}
                  </span>
                </div>
              ))
            ) : (
              <p className="cn-empty-state">Repeated assets appear here.</p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
