"use client";

import { useState } from "react";
import { type NbaPlayerProfile, type NbaPlayerSearchResult } from "@/lib/basketball/nba";

type LookupState = "idle" | "loading" | "error";

export function BasketballPlayerLookup() {
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<NbaPlayerSearchResult[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<NbaPlayerProfile | null>(null);
  const [status, setStatus] = useState<LookupState>("idle");
  const [error, setError] = useState("");

  const search = async () => {
    if (!query.trim()) return;

    setStatus("loading");
    setError("");
    setSelectedProfile(null);

    try {
      const response = await fetch(`/api/basketball/nba/player-search?q=${encodeURIComponent(query)}`);
      const data = (await response.json()) as {
        players?: NbaPlayerSearchResult[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Search failed.");
      }

      setPlayers(data.players || []);
      setStatus("idle");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Search failed.");
    }
  };

  const loadProfile = async (playerId: number) => {
    setStatus("loading");
    setError("");

    try {
      const response = await fetch(`/api/basketball/nba/player/${playerId}`);
      const data = (await response.json()) as {
        profile?: NbaPlayerProfile;
        error?: string;
      };

      if (!response.ok || !data.profile) {
        throw new Error(data.error || "Profile failed.");
      }

      setSelectedProfile(data.profile);
      setStatus("idle");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Profile failed.");
    }
  };

  return (
    <section className="basketball-card player-lookup-card">
      <div className="section-title">
        <span>6</span>
        <h2>Teaching Reference</h2>
      </div>

      <p className="calibration-note">
        NBA/WNBA data is a reference layer. Axis still starts with camera, overlay, AI tags, and coach review.
      </p>

      <div className="lookup-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search NBA player"
        />
        <button type="button" onClick={search} disabled={status === "loading"}>
          Search
        </button>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      {players.length ? (
        <div className="lookup-results">
          {players.map((player) => (
            <button key={player.id} type="button" onClick={() => void loadProfile(player.id)}>
              <strong>{player.fullName}</strong>
              <span>{player.teamName || "Reference"}</span>
            </button>
          ))}
        </div>
      ) : null}

      {selectedProfile ? (
        <div className="profile-card">
          <strong>{selectedProfile.fullName}</strong>
          <span>
            {selectedProfile.position || "Player"} / {selectedProfile.teamName || "NBA"}
          </span>
          <span>
            {selectedProfile.height || "--"} / {selectedProfile.weight || "--"}
          </span>
        </div>
      ) : null}
    </section>
  );
}
