"use client";

import type { AxisMemorySession } from "./AxisShell";
import { AxisSurfaceHeader } from "./AxisSurfaceHeader";

type Props = {
  onStartSession: () => void;
  sessions: AxisMemorySession[];
};

export function AxisPlayersSurface({ onStartSession, sessions }: Props) {
  const players = getPlayersFromSessions(sessions);

  return (
    <section className="axis-surface">
      <AxisSurfaceHeader
        eyebrow="Players"
        title="Player memory starts with sessions."
        body="A1 keeps player work attached to session memory before building full player pages."
      />

      {players.length === 0 ? (
        <article className="axis-empty-memory-card">
          <strong>Player memory starts when sessions are saved.</strong>
          <span>Add a player or group when you start the next session.</span>
          <button className="axis-primary" type="button" onClick={onStartSession}>
            Start Session
          </button>
        </article>
      ) : (
        <div className="axis-player-list">
          {players.map((player) => (
            <article className="axis-player-card" key={player.name}>
              <small>{player.sessionCount} session{player.sessionCount === 1 ? "" : "s"}</small>
              <strong>{player.name}</strong>
              <span>{player.latestFocus}</span>
              <span>Next: {player.nextFocus}</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function getPlayersFromSessions(sessions: AxisMemorySession[]) {
  const byName = new Map<string, { latestFocus: string; name: string; nextFocus: string; sessionCount: number }>();

  sessions.forEach((session) => {
    const names = splitPlayerNames(session.playerName);
    names.forEach((name) => {
      const current = byName.get(name);
      if (current) {
        current.sessionCount += 1;
        if (!current.latestFocus && session.objective) current.latestFocus = session.objective;
        if (!current.nextFocus && session.nextFocus) current.nextFocus = session.nextFocus;
      } else {
        byName.set(name, {
          latestFocus: session.objective || session.title,
          name,
          nextFocus: session.nextFocus || "Start with the clearest carryover.",
          sessionCount: 1,
        });
      }
    });
  });

  return [...byName.values()].sort((left, right) => right.sessionCount - left.sessionCount).slice(0, 8);
}

function splitPlayerNames(value?: string) {
  if (!value) return [];
  return value
    .split(/,| and | & /i)
    .map((name) => name.trim())
    .filter(Boolean);
}
