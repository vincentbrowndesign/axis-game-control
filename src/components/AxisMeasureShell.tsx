"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

import {
  clearStoredRep,
  createAxisRead,
  createAxisRep,
  readStoredRep,
  sessionTypes,
  type AxisRep,
  type AxisSessionType,
  writeStoredRep,
} from "@/lib/axis-measure";

export function AxisMeasureShell() {
  const [hydrated, setHydrated] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [sessionType, setSessionType] = useState<AxisSessionType>("shooting");
  const [rep, setRep] = useState<AxisRep | null>(null);
  const [clipUrl, setClipUrl] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedRep = readStoredRep();
      if (storedRep) {
        setRep(storedRep);
        setPlayerName(storedRep.playerName);
        setSessionType(storedRep.sessionType);
      }
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    return () => {
      if (clipUrl) URL.revokeObjectURL(clipUrl);
    };
  }, [clipUrl]);

  const status = rep?.status ?? (playerName.trim().length > 0 ? "READY" : "EMPTY");
  const canStart = playerName.trim().length > 1;
  const canRead = Boolean(rep?.fileName && clipUrl);
  const canSave = Boolean(rep?.read);

  const helperText = useMemo(() => {
    if (!rep) return "Add a player and choose a session type.";
    if (!rep.fileName) return "Upload one clip to create a replay.";
    if (!clipUrl) return "Clip previews live in this browser session. Choose the clip again after refresh.";
    if (!rep.read) return "Replay is ready. Generate one clean Axis read.";
    if (rep.status === "SAVED") return "Rep saved locally. Run the next one.";
    return "Review the read, save the rep, then run the next one.";
  }, [clipUrl, rep]);

  function persist(nextRep: AxisRep) {
    setRep(nextRep);
    writeStoredRep(nextRep);
  }

  function startRep() {
    if (!canStart) {
      setMessage("Enter a player name.");
      return;
    }

    const nextRep = createAxisRep(playerName, sessionType);
    persist(nextRep);
    setMessage("");
  }

  function uploadClip(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (!rep) {
      setMessage("Start a rep before uploading.");
      event.target.value = "";
      return;
    }
    if (file.size <= 0) {
      setMessage("This video did not load. Choose it again from your device.");
      event.target.value = "";
      return;
    }
    if (!file.type.startsWith("video/") && !/\.(mov|mp4)$/i.test(file.name)) {
      setMessage("Choose a video clip.");
      event.target.value = "";
      return;
    }

    if (clipUrl) URL.revokeObjectURL(clipUrl);
    const nextUrl = URL.createObjectURL(file);
    setClipUrl(nextUrl);
    persist({
      ...rep,
      fileName: file.name,
      fileSize: file.size,
      read: undefined,
      savedAt: undefined,
      status: "UPLOADED",
    });
    setMessage("");
  }

  function generateRead() {
    if (!rep || !canRead) {
      setMessage("Upload a clip before generating a read.");
      return;
    }

    const readingRep: AxisRep = { ...rep, status: "READING" };
    persist(readingRep);

    const reviewedRep: AxisRep = {
      ...readingRep,
      read: createAxisRead(readingRep.sessionType),
      status: "REVIEWED",
    };
    persist(reviewedRep);
    setMessage("");
  }

  function saveRep() {
    if (!rep?.read) {
      setMessage("Generate an Axis read before saving.");
      return;
    }

    persist({
      ...rep,
      savedAt: new Date().toISOString(),
      status: "SAVED",
    });
    setMessage("");
  }

  function nextRep() {
    if (clipUrl) URL.revokeObjectURL(clipUrl);
    clearStoredRep();
    setRep(null);
    setClipUrl("");
    setPlayerName("");
    setSessionType("shooting");
    setMessage("");
  }

  return (
    <main className="axis-shell">
      <section className="axis-panel" aria-label="Axis Measure">
        <header className="axis-header">
          <div>
            <p>Axis Measure</p>
            <h1>Capture. Read. Replay. Improve.</h1>
          </div>
          <span>{hydrated ? status : "EMPTY"}</span>
        </header>

        <section className="axis-section" aria-label="Player">
          <label>
            <span>Player</span>
            <input
              disabled={Boolean(rep)}
              onChange={(event) => setPlayerName(event.target.value)}
              placeholder="Player name"
              value={playerName}
            />
          </label>
        </section>

        <section className="axis-section" aria-label="Session Type">
          <span className="axis-label">Session Type</span>
          <div className="axis-grid">
            {sessionTypes.map((type) => (
              <button
                className={sessionType === type ? "selected" : ""}
                disabled={Boolean(rep)}
                key={type}
                onClick={() => setSessionType(type)}
                type="button"
              >
                {type}
              </button>
            ))}
          </div>
          {!rep ? (
            <button className="axis-primary" disabled={!hydrated || !canStart} onClick={startRep} type="button">
              Start Rep
            </button>
          ) : null}
        </section>

        <section className="axis-section" aria-label="Upload Clip">
          <span className="axis-label">Upload Clip</span>
          <label className={`axis-upload ${!rep ? "disabled" : ""}`}>
            <input accept="video/*,.mov,.mp4" disabled={!rep} onChange={uploadClip} type="file" />
            Choose Clip
          </label>
          {rep?.fileName ? (
            <p className="axis-file">
              {rep.fileName} {rep.fileSize ? `- ${formatBytes(rep.fileSize)}` : ""}
            </p>
          ) : null}
        </section>

        <section className="axis-section" aria-label="Replay">
          <span className="axis-label">Replay</span>
          {clipUrl ? (
            <video controls playsInline src={clipUrl} />
          ) : (
            <div className="axis-empty">
              <strong>No replay loaded.</strong>
              <p>{rep?.fileName ? "Choose the clip again after refresh." : "Upload a clip to see the replay."}</p>
            </div>
          )}
        </section>

        <section className="axis-section" aria-label="Axis Read">
          <span className="axis-label">Axis Read</span>
          {rep?.read ? (
            <div className="axis-read">
              <p>{rep.read.summary}</p>
              <strong>{rep.read.nextAction}</strong>
            </div>
          ) : (
            <div className="axis-empty">
              <strong>No read yet.</strong>
              <p>Generate a read after replay is loaded.</p>
            </div>
          )}
          <button className="axis-primary" disabled={!canRead} onClick={generateRead} type="button">
            Generate Axis Read
          </button>
        </section>

        <section className="axis-section" aria-label="Save Rep">
          <span className="axis-label">Save Rep</span>
          <p className="axis-helper">{message || helperText}</p>
          <div className="axis-actions">
            <button className="axis-primary" disabled={!canSave} onClick={saveRep} type="button">
              Save Rep
            </button>
            <button className="axis-secondary" onClick={nextRep} type="button">
              Next Rep
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
