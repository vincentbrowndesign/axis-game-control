"use client";

import type { FormEvent } from "react";
import type { AxisSession } from "../../lib/axis/types";

type SessionTypeOption = {
  label: string;
  value: AxisSession["sessionType"];
};

type Props = {
  errorMessage: string;
  objective: string;
  onObjectiveChange: (value: string) => void;
  onPlayerNameChange: (value: string) => void;
  onSessionTitleChange: (value: string) => void;
  onSessionTypeChange: (value: AxisSession["sessionType"]) => void;
  onStartSession: (event: FormEvent<HTMLFormElement>) => void;
  playerName: string;
  saveLabel: string;
  sessionTitle: string;
  sessionType: AxisSession["sessionType"];
  sessionTypes: SessionTypeOption[];
  signedIn: boolean;
};

export function AxisEmptyState({
  errorMessage,
  objective,
  onObjectiveChange,
  onPlayerNameChange,
  onSessionTitleChange,
  onSessionTypeChange,
  onStartSession,
  playerName,
  saveLabel,
  sessionTitle,
  sessionType,
  sessionTypes,
  signedIn,
}: Props) {
  return (
    <section className="axis-card axis-empty-state">
      <div>
        <p className="axis-empty-state__eyebrow">Today&apos;s Work</p>
        <h1>Log Work</h1>
      </div>

      <p className="axis-empty-state__meta">
        Save what matters without needing the camera.
      </p>

      <form onSubmit={onStartSession}>
        <label>
          Record
          <input
            value={sessionTitle}
            onChange={(event) => onSessionTitleChange(event.target.value)}
            placeholder="Today's work"
          />
        </label>

        <label>
          Player / Players
          <input
            value={playerName}
            onChange={(event) => onPlayerNameChange(event.target.value)}
            placeholder="Player or group"
          />
        </label>

        <label>
          Focus
          <input
            value={objective}
            onChange={(event) => onObjectiveChange(event.target.value)}
            placeholder="What changed?"
          />
        </label>

        <label>
          Work Type
          <select
            value={sessionType}
            onChange={(event) => onSessionTypeChange(event.target.value as AxisSession["sessionType"])}
          >
            {sessionTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>

        <button className="axis-primary" type="submit">
          Save Memory
        </button>
      </form>

      <div className="axis-empty-state__links" aria-label="Memory state">
        <span className="axis-secondary">{signedIn ? "Signed in" : "Local use"}</span>
        <span className="axis-secondary">{saveLabel}</span>
        <span className="axis-secondary">Memory ready</span>
      </div>

      {errorMessage && <p className="axis-empty-state__meta">{errorMessage}</p>}
    </section>
  );
}
