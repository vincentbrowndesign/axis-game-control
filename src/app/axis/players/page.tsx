"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AxisOsNotice, AxisOsSection } from "../../../components/axis/AxisOsKit";
import { AxisSuiteShell } from "../../../components/axis/AxisSuiteShell";
import type { AxisEventContainer, AxisEventPlayer } from "../../../lib/axis-event-container";

type PlayerEntry = {
  name: string;
  jersey: string | null;
  sessionCount: number;
  lastSessionId: string;
  lastSessionTitle: string;
};

export default function AxisPlayersPage() {
  const [players, setPlayers] = useState<PlayerEntry[]>([]);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error" | "offline">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await fetch("/api/axis/events").catch(() => null);
      if (cancelled) return;
      if (!response || response.status === 503) {
        setState("offline");
        return;
      }
      if (!response.ok) {
        setState("error");
        return;
      }
      const events = (await response.json()) as { active: AxisEventContainer[]; recent: AxisEventContainer[] };
      if (cancelled) return;
      // Profiles are built from session rosters (newest sessions first).
      const sources = [...(events.active ?? []), ...(events.recent ?? [])].slice(0, 8);
      const details = await Promise.all(
        sources.map((event) =>
          fetch(`/api/axis/events/${event.id}`)
            .then((res) => (res.ok ? (res.json() as Promise<{ players: AxisEventPlayer[] }>) : null))
            .then((body) => (body ? { event, players: body.players } : null))
            .catch(() => null),
        ),
      );
      if (cancelled) return;
      const byName = new Map<string, PlayerEntry>();
      for (const detail of details) {
        if (!detail) continue;
        for (const player of detail.players) {
          const existing = byName.get(player.display_name);
          if (existing) {
            existing.sessionCount += 1;
          } else {
            byName.set(player.display_name, {
              jersey: player.jersey_number,
              lastSessionId: detail.event.id,
              lastSessionTitle: detail.event.title,
              name: player.display_name,
              sessionCount: 1,
            });
          }
        }
      }
      setPlayers([...byName.values()].sort((a, b) => a.name.localeCompare(b.name)));
      setState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = query.trim()
    ? players.filter((player) => player.name.toLowerCase().includes(query.trim().toLowerCase()))
    : players;

  return (
    <AxisSuiteShell backHref="/axis" backLabel="Axis" title="Players">
      <section className="axis-suite-hero">
        <input
          className="axis-suite-cmd"
          onChange={(input) => setQuery(input.target.value)}
          placeholder="Find a player"
          value={query}
        />
      </section>

      <AxisOsSection label="Players" title="From your sessions">
        {state === "loading" && <AxisOsNotice tone="loading">Loading players…</AxisOsNotice>}
        {state === "offline" && <AxisOsNotice tone="offline">Session memory is offline right now.</AxisOsNotice>}
        {state === "error" && <AxisOsNotice tone="error">Players did not load. Pull to refresh.</AxisOsNotice>}
        {state === "ready" && !players.length && (
          <AxisOsNotice tone="empty">
            No players yet. Add them inside a <Link href="/axis/events/new">session</Link>.
          </AxisOsNotice>
        )}
        {state === "ready" && players.length > 0 && !filtered.length && (
          <AxisOsNotice tone="empty">No players match “{query}”.</AxisOsNotice>
        )}
        {filtered.map((player) => (
          <Link className="axis-os-row" href={`/axis/events/${player.lastSessionId}`} key={player.name}>
            <div className="axis-os-row-main">
              <strong>{player.name}</strong>
              <span>
                {player.jersey ? `#${player.jersey} · ` : ""}
                {player.sessionCount} session{player.sessionCount === 1 ? "" : "s"} · last: {player.lastSessionTitle}
              </span>
            </div>
            <em className="axis-os-row-go">Open →</em>
          </Link>
        ))}
      </AxisOsSection>
    </AxisSuiteShell>
  );
}
