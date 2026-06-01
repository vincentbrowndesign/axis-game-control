"use client";

import { type TouchEvent, useEffect, useMemo, useRef, useState } from "react";

type ProofCard = {
  clip: string;
  duration: string;
  id: string;
  poster: string;
  timestamp?: string;
  title: string;
  tone: "cut" | "glass" | "paint";
};

type ProofStack = {
  currentStreak: number;
  id: string;
  longestStreak: number;
  nextUnlock: string;
  proofCount: number;
  title: string;
};

type StoredReplayAnchor = {
  eventId?: unknown;
  eventType?: unknown;
  replayLabel?: unknown;
  timestamp?: unknown;
  videoTimestamp?: unknown;
};

type StoredShotEvent = {
  filmTimeSeconds?: unknown;
  shotId?: unknown;
  timestamp?: unknown;
  type?: unknown;
};

type StoredSession = {
  endedAt?: unknown;
  id?: unknown;
  muxPlaybackId?: unknown;
  replayAnchors?: unknown;
  shotEvents?: unknown;
  startedAt?: unknown;
  thumbnailUrl?: unknown;
};

type StoredProofSave = {
  sessions?: unknown;
};

type ProofData = {
  proofs: ProofCard[];
  stack: ProofStack;
};

const temporaryProofs: ProofCard[] = [
  {
    clip: "",
    duration: "0:12",
    id: "shot-after-miss",
    poster:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 1600'%3E%3Crect width='1200' height='1600' fill='%23030303'/%3E%3Cpath d='M0 250h1200M0 510h1200M0 770h1200M0 1030h1200M0 1290h1200M220 0v1600M600 0v1600M980 0v1600' stroke='%23f4f4f0' stroke-opacity='.08' stroke-width='2'/%3E%3Ccircle cx='600' cy='800' r='250' fill='none' stroke='%23a8d933' stroke-opacity='.42' stroke-width='10'/%3E%3Ccircle cx='600' cy='800' r='82' fill='%23a8d933' fill-opacity='.16'/%3E%3C/svg%3E",
    title: "You took the shot after a miss.",
    tone: "paint",
  },
  {
    clip: "",
    duration: "0:09",
    id: "back-after-turnover",
    poster:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 1600'%3E%3Crect width='1200' height='1600' fill='%23030303'/%3E%3Cpath d='M180 1300 980 160M320 1420 1120 280M40 1040 820 40' stroke='%23f4f4f0' stroke-opacity='.08' stroke-width='12'/%3E%3Crect x='420' y='560' width='360' height='520' rx='180' fill='none' stroke='%23a8d933' stroke-opacity='.38' stroke-width='10'/%3E%3C/svg%3E",
    title: "You got back after the turnover.",
    tone: "cut",
  },
  {
    clip: "",
    duration: "0:07",
    id: "pass-before-basket",
    poster:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 1600'%3E%3Crect width='1200' height='1600' fill='%23030303'/%3E%3Ccircle cx='280' cy='720' r='140' fill='none' stroke='%23f4f4f0' stroke-opacity='.12' stroke-width='8'/%3E%3Ccircle cx='875' cy='920' r='210' fill='none' stroke='%23a8d933' stroke-opacity='.34' stroke-width='10'/%3E%3Cpath d='M285 720 C460 560 690 1110 875 920' fill='none' stroke='%23a8d933' stroke-opacity='.5' stroke-width='12'/%3E%3C/svg%3E",
    title: "You made the pass before the basket.",
    tone: "glass",
  },
  {
    clip: "",
    duration: "0:10",
    id: "called-for-ball",
    poster:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 1600'%3E%3Crect width='1200' height='1600' fill='%23030303'/%3E%3Cpath d='M160 1180 C360 780 600 760 1010 410' fill='none' stroke='%23a8d933' stroke-opacity='.42' stroke-width='12'/%3E%3Ccircle cx='250' cy='1110' r='132' fill='none' stroke='%23f4f4f0' stroke-opacity='.12' stroke-width='8'/%3E%3Ccircle cx='980' cy='390' r='92' fill='%23a8d933' fill-opacity='.12'/%3E%3C/svg%3E",
    title: "You called for the ball.",
    tone: "glass",
  },
  {
    clip: "",
    duration: "0:11",
    id: "there-first",
    poster:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 1600'%3E%3Crect width='1200' height='1600' fill='%23030303'/%3E%3Cpath d='M260 240h680v1120H260z' fill='none' stroke='%23f4f4f0' stroke-opacity='.08' stroke-width='8'/%3E%3Cpath d='M250 1070h900' stroke='%23a8d933' stroke-opacity='.4' stroke-width='14'/%3E%3Ccircle cx='385' cy='1068' r='118' fill='none' stroke='%23a8d933' stroke-opacity='.38' stroke-width='10'/%3E%3C/svg%3E",
    title: "You got there first.",
    tone: "paint",
  },
];

const proofStacks: ProofStack[] = [
  {
    currentStreak: 3,
    id: "after-the-miss",
    longestStreak: 8,
    nextUnlock: "Still Shooting",
    proofCount: temporaryProofs.length,
    title: "AFTER THE MISS",
  },
];

const storageKey = "axis-ritual-save";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getMuxThumbnail(playbackId: string) {
  return playbackId ? `https://image.mux.com/${playbackId}/thumbnail.jpg` : "";
}

function getMuxClip(playbackId: string) {
  return playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : "";
}

function getFallbackTone(index: number): ProofCard["tone"] {
  return index % 3 === 0 ? "paint" : index % 3 === 1 ? "cut" : "glass";
}

function getProofTitle(type: string, fallback: string) {
  const normalized = type.toLowerCase();

  if (normalized === "make") return "You took the shot after a miss.";
  if (normalized === "miss") return "You kept shooting.";
  if (normalized === "rebound") return "You got there first.";
  if (normalized === "assist") return "You made the pass before the basket.";
  if (normalized === "turnover") return "You got back after the turnover.";
  if (normalized === "foul") return "You stayed in the play.";
  if (normalized === "steal") return "You got there first.";
  if (normalized === "block") return "You met the shot.";

  return fallback || "You made the moment count.";
}

function formatDurationFromSeconds(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;

  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function normalizeDay(timestamp: string) {
  const date = new Date(timestamp);

  if (!Number.isFinite(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Chicago",
    year: "numeric",
  }).format(date);
}

function calculateStreaks(sessions: StoredSession[]) {
  const days = Array.from(
    new Set(
      sessions
        .map((session) => normalizeDay(getString(session.endedAt) || getString(session.startedAt)))
        .filter(Boolean),
    ),
  ).sort((a, b) => new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime());

  if (!days.length) {
    return {
      currentStreak: proofStacks[0].currentStreak,
      longestStreak: proofStacks[0].longestStreak,
    };
  }

  let longestStreak = 1;
  let runningStreak = 1;
  let currentStreak = 1;

  for (let index = 1; index < days.length; index += 1) {
    const previous = new Date(`${days[index - 1]}T00:00:00`);
    const current = new Date(`${days[index]}T00:00:00`);
    const dayDifference = Math.round((previous.getTime() - current.getTime()) / 86_400_000);

    if (dayDifference === 1) {
      runningStreak += 1;
      longestStreak = Math.max(longestStreak, runningStreak);
      if (index === currentStreak) currentStreak += 1;
    } else {
      runningStreak = 1;
    }
  }

  const today = normalizeDay(new Date().toISOString());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = normalizeDay(yesterdayDate.toISOString());

  return {
    currentStreak: days[0] === today || days[0] === yesterday ? currentStreak : 0,
    longestStreak,
  };
}

function readStoredSessions() {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return [];

    const parsed = JSON.parse(stored) as StoredProofSave;
    if (!Array.isArray(parsed.sessions)) return [];

    return parsed.sessions.filter(isRecord) as StoredSession[];
  } catch {
    return [];
  }
}

function createProofsFromStoredSessions(sessions: StoredSession[]) {
  return sessions
    .flatMap((session, sessionIndex) => {
      const sessionId = getString(session.id) || `session-${sessionIndex}`;
      const playbackId = getString(session.muxPlaybackId);
      const thumbnail = getString(session.thumbnailUrl) || getMuxThumbnail(playbackId);
      const clip = getMuxClip(playbackId);
      const replayAnchors = Array.isArray(session.replayAnchors) ? (session.replayAnchors.filter(isRecord) as StoredReplayAnchor[]) : [];
      const shotEvents = Array.isArray(session.shotEvents) ? (session.shotEvents.filter(isRecord) as StoredShotEvent[]) : [];

      const anchorProofs = replayAnchors.map<ProofCard>((anchor, anchorIndex) => {
        const type = getString(anchor.eventType);
        const videoTimestamp = getNumber(anchor.videoTimestamp);

        return {
          clip,
          duration: formatDurationFromSeconds(videoTimestamp || 8),
          id: getString(anchor.eventId) || `${sessionId}-anchor-${anchorIndex}`,
          poster: thumbnail,
          timestamp: getString(anchor.timestamp),
          title: getProofTitle(type, getString(anchor.replayLabel)),
          tone: getFallbackTone(anchorIndex),
        };
      });

      const shotProofs = shotEvents.map<ProofCard>((shot, shotIndex) => {
        const type = getString(shot.type);
        const filmTimeSeconds = getNumber(shot.filmTimeSeconds);

        return {
          clip,
          duration: formatDurationFromSeconds(filmTimeSeconds || 8),
          id: getString(shot.shotId) || `${sessionId}-shot-${shotIndex}`,
          poster: thumbnail,
          timestamp: getString(shot.timestamp),
          title: getProofTitle(type, ""),
          tone: getFallbackTone(anchorProofs.length + shotIndex),
        };
      });

      return [...anchorProofs, ...shotProofs];
    })
    .filter((proof) => proof.title)
    .slice(0, 12);
}

function getProofData(): ProofData {
  const sessions = readStoredSessions();
  const storedProofs = createProofsFromStoredSessions(sessions);
  const proofs = storedProofs.length ? storedProofs : temporaryProofs;
  const streaks = calculateStreaks(sessions);

  return {
    proofs,
    stack: {
      ...proofStacks[0],
      currentStreak: streaks.currentStreak,
      longestStreak: streaks.longestStreak,
      proofCount: proofs.length,
    },
  };
}

function getNextIndex(currentIndex: number, direction: 1 | -1, proofCount: number) {
  return (currentIndex + direction + proofCount) % proofCount;
}

export function ProofFeed() {
  const [proofData, setProofData] = useState<ProofData>({
    proofs: temporaryProofs,
    stack: proofStacks[0],
  });
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const activeProof = useMemo(() => (activeIndex === null ? null : proofData.proofs[activeIndex]), [activeIndex, proofData.proofs]);

  useEffect(() => {
    setProofData(getProofData());
  }, []);

  useEffect(() => {
    if (activeIndex === null) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowLeft") setActiveIndex((current) => (current === null ? current : getNextIndex(current, -1, proofData.proofs.length)));
      if (event.key === "ArrowRight") setActiveIndex((current) => (current === null ? current : getNextIndex(current, 1, proofData.proofs.length)));
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, proofData.proofs.length]);

  function openProof(index: number) {
    setActiveIndex(index);
  }

  function closeProof() {
    setActiveIndex(null);
  }

  function goToProof(direction: 1 | -1) {
    setActiveIndex((current) => (current === null ? current : getNextIndex(current, direction, proofData.proofs.length)));
  }

  function onTouchStart(event: TouchEvent<HTMLElement>) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(event: TouchEvent<HTMLElement>) {
    if (touchStartX.current === null) return;

    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const deltaX = endX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(deltaX) < 44) return;
    goToProof(deltaX < 0 ? 1 : -1);
  }

  return (
    <main className="proof-shell">
      <header className="proof-header">
        <span>PROOF</span>
        <h1>TODAY&apos;S PROOF</h1>
      </header>

      <section className="proof-feed" aria-label="Today's proof">
        {proofData.proofs.map((proof, index) => (
          <button className="proof-card" key={proof.id} onClick={() => openProof(index)} type="button">
            <span className="proof-thumb" data-tone={proof.tone}>
              <span className="proof-play" aria-hidden="true">
                PLAY
              </span>
            </span>
            <span className="proof-card-body">
              <strong>{proof.title}</strong>
              <em>{proof.duration}</em>
            </span>
          </button>
        ))}
      </section>

      <section className="proof-stack-section" aria-label="Proof stack">
        <article className="proof-stack">
          <strong>{proofData.stack.title}</strong>
          <span>{`${proofData.stack.proofCount} Proofs`}</span>
          <span>{`Current Streak: ${proofData.stack.currentStreak}`}</span>
          <span>{`Longest Streak: ${proofData.stack.longestStreak}`}</span>
          <em>{`Next Unlock: ${proofData.stack.nextUnlock}`}</em>
        </article>
      </section>

      {activeProof ? (
        <section
          aria-label="Proof player"
          className="proof-player"
          onTouchEnd={onTouchEnd}
          onTouchStart={onTouchStart}
        >
          <button aria-label="Close proof" className="proof-player-close" onClick={closeProof} type="button">
            BACK
          </button>

          <div className="proof-player-frame" data-tone={activeProof.tone}>
            <div className="proof-player-copy">
              <strong>{activeProof.title}</strong>
            </div>
            {activeProof.clip ? (
              <video
                autoPlay
                className="proof-player-video"
                muted
                onEnded={() => goToProof(1)}
                playsInline
                poster={activeProof.poster}
                src={activeProof.clip}
              />
            ) : (
              <div
                aria-label="Proof clip preview"
                className="proof-player-video proof-player-video-placeholder"
                data-tone={activeProof.tone}
                role="img"
              />
            )}
            <button aria-label="Next proof" className="proof-player-nav proof-player-next" onClick={() => goToProof(1)} type="button">
              NEXT
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
