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

type FavoriteAsset = {
  clipnote: Clipnote;
  session: Session;
};

type PatternAsset = {
  asset?: FavoriteAsset;
  pattern: DatasetBin;
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
  const [search, setSearch] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [selectionNotice, setSelectionNotice] = useState("");
  const router = useRouter();

  useEffect(() => {
    const storedSessions = getSessions();
    const storedFavorites = storedSessions.flatMap((session) =>
      session.clipnotes.map((clipnote) => ({ clipnote, session })),
    );
    setSessions(storedSessions);
    setFavorites(storedFavorites);
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

  function handleReview() {
    const firstAsset =
      selectedAssetIds.length > 0
        ? favorites.find(({ clipnote }) => clipnote.id === selectedAssetIds[0])
        : favorites[0];
    if (firstAsset) router.push(`/clipnote/${firstAsset.clipnote.id}`);
  }

  function toggleSelectionMode() {
    setSelectionNotice("");
    setSelectionMode((current) => {
      if (current) setSelectedAssetIds([]);
      return !current;
    });
  }

  function toggleAssetSelection(clipnoteId: string) {
    setSelectionNotice("");
    setSelectedAssetIds((current) =>
      current.includes(clipnoteId)
        ? current.filter((id) => id !== clipnoteId)
        : [...current, clipnoteId],
    );
  }

  function handleSelectionAction(action: "combine" | "compare") {
    if (selectedAssetIds.length < 2) return;
    setSelectionNotice(
      action === "combine"
        ? `${selectedAssetIds.length} assets ready to combine.`
        : `${selectedAssetIds.length} assets ready to compare.`,
    );
  }

  function formatClipnoteDuration(clipnote: Clipnote) {
    const seconds = Math.max(0, Math.round(clipnote.close_time - clipnote.open_time));
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${minutes}:${remaining.toString().padStart(2, "0")}`;
  }

  const normalizedSearch = search.trim().toLowerCase();
  const matchesSearch = (value: string) =>
    !normalizedSearch || value.toLowerCase().includes(normalizedSearch);

  const filteredFavorites = favorites.filter(({ clipnote, session }) => {
    const tag = clipnote.tag_id ? getTag(clipnote.tag_id) : null;
    return [clipnote.title, session.title, tag?.name ?? ""].some(matchesSearch);
  });

  const recentAssets = [...filteredFavorites]
    .sort(
      (a, b) =>
        new Date(b.clipnote.created_at).getTime() -
        new Date(a.clipnote.created_at).getTime(),
    )
    .slice(0, 8);

  const patternAssets: PatternAsset[] = patterns
    .filter((pattern) => matchesSearch(pattern.tag_name))
    .map((pattern) => ({
      pattern,
      asset: favorites.find(({ clipnote }) => clipnote.tag_id === pattern.tag_id),
    }));

  const filteredSessions = sessions.filter((session) => matchesSearch(session.title));
  const selectedAssets = favorites.filter(({ clipnote }) =>
    selectedAssetIds.includes(clipnote.id),
  );
  const selectedDurationSeconds = selectedAssets.reduce(
    (total, { clipnote }) =>
      total + Math.max(0, Math.round(clipnote.close_time - clipnote.open_time)),
    0,
  );
  const selectedDuration = `${Math.floor(selectedDurationSeconds / 60)}:${(
    selectedDurationSeconds % 60
  )
    .toString()
    .padStart(2, "0")}`;

  function renderAssetCard({ clipnote, session }: FavoriteAsset) {
    const tag = clipnote.tag_id ? getTag(clipnote.tag_id) : null;
    const selected = selectedAssetIds.includes(clipnote.id);
    const cardBody = (
      <>
        <span className="cn-asset-select-indicator" aria-hidden="true" />
        {clipnote.thumbnail_url ? (
          <img alt="" className="cn-asset-thumb" src={clipnote.thumbnail_url} />
        ) : (
          <div className="cn-asset-thumb cn-asset-thumb-empty" />
        )}
        <span className="cn-asset-title">{clipnote.title}</span>
        <span className="cn-asset-meta">
          <span>{formatClipnoteDuration(clipnote)}</span>
          <span>{tag?.name ?? session.title}</span>
          <span>Favorite</span>
        </span>
      </>
    );

    if (selectionMode) {
      return (
        <button
          aria-pressed={selected}
          className="cn-asset-card cn-selectable-asset"
          data-selected={selected ? "true" : undefined}
          key={clipnote.id}
          onClick={() => toggleAssetSelection(clipnote.id)}
          type="button"
        >
          {cardBody}
        </button>
      );
    }

    return (
      <Link className="cn-asset-card" href={`/clipnote/${clipnote.id}`} key={clipnote.id}>
        {cardBody}
      </Link>
    );
  }

  return (
    <main className="cn-home cn-asset-library">
      <header className="cn-home-header">
        <div>
          <p className="cn-brand">AXIS</p>
          <p className="cn-home-kicker">Asset Library</p>
        </div>
        <button
          className="cn-select-toggle"
          disabled={!favorites.length}
          onClick={toggleSelectionMode}
          type="button"
        >
          {selectionMode ? "Done" : "Select"}
        </button>
      </header>

      <label className="cn-search-wrap">
        <span>Search</span>
        <input
          aria-label="Search assets"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Find assets, sessions, patterns"
          type="search"
          value={search}
        />
      </label>

      <section className="cn-asset-section">
        <div className="cn-section-heading-row">
          <p className="cn-section-label">Recent Assets</p>
          <span>{recentAssets.length}</span>
        </div>
        {recentAssets.length > 0 ? (
          <div className="cn-asset-scroll">
            {recentAssets.map((asset) => renderAssetCard(asset))}
          </div>
        ) : (
          <p className="cn-empty-state">Favorite a moment to create an asset.</p>
        )}
      </section>

      <section className="cn-asset-section">
        <div className="cn-section-heading-row">
          <p className="cn-section-label">Favorite Assets</p>
          <span>{filteredFavorites.length}</span>
        </div>
        {filteredFavorites.length > 0 ? (
          <div className="cn-asset-grid">
            {filteredFavorites.map((asset) => renderAssetCard(asset))}
          </div>
        ) : (
          <p className="cn-empty-state">Kept assets appear here.</p>
        )}
      </section>

      <section className="cn-asset-section">
        <div className="cn-section-heading-row">
          <p className="cn-section-label">Pattern Assets</p>
          <span>{patternAssets.length}</span>
        </div>
        {patternAssets.length > 0 ? (
          <div className="cn-pattern-asset-grid">
            {patternAssets.map(({ asset, pattern }) => (
              <div className="cn-pattern-asset-card" key={pattern.tag_id}>
                {asset?.clipnote.thumbnail_url ? (
                  <img alt="" className="cn-asset-thumb" src={asset.clipnote.thumbnail_url} />
                ) : (
                  <div className="cn-asset-thumb cn-asset-thumb-empty" />
                )}
                <span className="cn-asset-title">{pattern.tag_name}</span>
                <span className="cn-asset-meta">
                  {pattern.clipnote_count}{" "}
                  {pattern.clipnote_count === 1 ? "Asset" : "Assets"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="cn-empty-state">Repeated assets appear here.</p>
        )}
      </section>

      <section className="cn-asset-section">
        <div className="cn-section-heading-row">
          <p className="cn-section-label">Library</p>
          <span>{filteredSessions.length}</span>
        </div>
        <div className="cn-session-list">
          {filteredSessions.length > 0 ? (
            filteredSessions.map((session) => (
              <Link className="cn-session-card" href={`/session/${session.id}`} key={session.id}>
                <span className="cn-session-card-title">{session.title}</span>
                <span className="cn-session-card-meta">
                  <span>{formatDate(session.created_at)}</span>
                  <span>
                    {session.clipnotes.length}{" "}
                    {session.clipnotes.length === 1 ? "Asset" : "Assets"}
                  </span>
                </span>
              </Link>
            ))
          ) : (
            <p className="cn-empty-state">No matching sessions.</p>
          )}
        </div>
      </section>

      {!selectionMode && (
        <nav className="cn-bottom-library-nav" aria-label="Library actions">
          <button onClick={() => setSearch("")} type="button">
            Library
          </button>
          <button disabled={!favorites.length} onClick={handleReview} type="button">
            Review
          </button>
          <button onClick={handleNewSession} type="button">
            Create
          </button>
        </nav>
      )}

      {selectionMode && (
        <div className="cn-selection-tray" aria-live="polite">
          <div className="cn-selection-summary">
            <strong>
              {selectedAssets.length} {selectedAssets.length === 1 ? "Asset" : "Assets"}
            </strong>
            <span>{selectedDuration}</span>
            <span>
              {selectedAssets.length}{" "}
              {selectedAssets.length === 1 ? "Favorite" : "Favorites"}
            </span>
          </div>
          {selectionNotice && <p className="cn-selection-notice">{selectionNotice}</p>}
          <div className="cn-selection-actions">
            <button
              disabled={selectedAssets.length < 2}
              onClick={() => handleSelectionAction("combine")}
              type="button"
            >
              Combine
            </button>
            <button
              disabled={selectedAssets.length < 2}
              onClick={() => handleSelectionAction("compare")}
              type="button"
            >
              Compare
            </button>
            <button disabled={!selectedAssets.length} onClick={handleReview} type="button">
              Review
            </button>
            <button onClick={handleNewSession} type="button">
              Create
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
