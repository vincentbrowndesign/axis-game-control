"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAxisAccessToken } from "../../lib/axis-client-auth";
import { useAxisAuth } from "../../app/axis/axis-auth-control";
import AxisAuthControl from "../../app/axis/axis-auth-control";
import type { ClipScoreboardVisible, ClipSessionType, ClipSubjectType } from "../../lib/clip-room/types";

type Props = { mode: "record" | "upload" };
type Stage = "capture" | "setup" | "uploading" | "done";

type SetupFields = {
  subjectType: ClipSubjectType;
  subjectName: string;
  sessionType: ClipSessionType;
  jerseyColor: string;
  scoreboardVisible: ClipScoreboardVisible | "";
};

const defaultSetup: SetupFields = {
  subjectType: "player",
  subjectName: "",
  sessionType: "practice",
  jerseyColor: "",
  scoreboardVisible: "",
};

export function ClipRoomNew({ mode }: Props) {
  const auth = useAxisAuth();
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("capture");
  const [file, setFile] = useState<File | null>(null);
  const [setup, setSetup] = useState<SetupFields>(defaultSetup);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function handleCaptureDone(f: File) {
    setFile(f);
    setStage("setup");
  }

  async function handleStartProcessing() {
    if (!file) { setError("Upload could not start. Please choose a video and try again."); return; }
    if (auth.status !== "signed_in") return;

    setStage("uploading");
    setError(null);
    setUploadProgress(0);

    try {
      const token = await getAxisAccessToken();
      const clipId = await xhrFormDataPost(
        "/api/clip-room/ingest",
        file,
        setup,
        mode,
        token,
        setUploadProgress,
      );
      setUploadProgress(100);
      setStage("done");
      setTimeout(() => router.push(`/clips/${clipId}`), 600);
    } catch (err) {
      setError("Upload could not start. Please choose a video and try again.");
      setStage("setup");
    }
  }

  const title = mode === "record" ? "Record Clip" : "Upload Clip";

  return (
    <div className="crn-root">
      <header className="crn-header">
        <Link href="/" className="crn-back">Clip Room</Link>
        <span className="crn-header-title">{title}</span>
        <AxisAuthControl auth={auth} />
      </header>

      <main className="crn-main">
        {stage === "capture" && mode === "upload" && (
          <ClipUploader onPick={handleCaptureDone} />
        )}
        {stage === "capture" && mode === "record" && (
          <ClipRecorder onDone={handleCaptureDone} />
        )}
        {stage === "setup" && (
          <ClipSetupForm
            file={file}
            setup={setup}
            onChange={setSetup}
            onBack={() => setStage("capture")}
            onSubmit={() => void handleStartProcessing()}
            error={error}
            authStatus={auth.status}
          />
        )}
        {stage === "uploading" && (
          <div className="crn-state">
            <p className="crn-state-title">Uploading...</p>
            <div className="crn-progress-track">
              <div className="crn-progress-fill" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="crn-muted">{uploadProgress}%</p>
          </div>
        )}
        {stage === "done" && (
          <div className="crn-state">
            <p className="crn-state-title">Clip received.</p>
            <p className="crn-muted">Axis is processing. Opening your clip...</p>
          </div>
        )}
      </main>

      <style jsx>{`
        .crn-root {
          background: var(--axis-bg);
          color: var(--axis-ink);
          display: flex;
          flex-direction: column;
          font-family: ui-sans-serif, system-ui, sans-serif;
          min-height: 100dvh;
        }
        .crn-header {
          align-items: center;
          border-bottom: 1px solid var(--axis-line);
          display: flex;
          gap: 12px;
          justify-content: space-between;
          min-height: 52px;
          padding: 0 clamp(16px, 4vw, 32px);
        }
        .crn-back {
          color: var(--axis-muted);
          font-size: 13px;
          text-decoration: none;
        }
        .crn-header-title {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .crn-main {
          display: flex;
          flex-direction: column;
          flex: 1;
          padding: clamp(24px, 6vw, 48px) clamp(16px, 4vw, 32px);
        }
        .crn-state {
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-width: 360px;
        }
        .crn-state-title {
          font-size: clamp(22px, 5vw, 32px);
          font-weight: 700;
          letter-spacing: -0.02em;
          margin: 0;
        }
        .crn-progress-track {
          background: rgba(255,255,255,0.08);
          border-radius: 4px;
          height: 4px;
          overflow: hidden;
        }
        .crn-progress-fill {
          background: var(--axis-live);
          border-radius: 4px;
          height: 100%;
          transition: width 0.3s ease;
        }
        .crn-muted {
          color: var(--axis-muted);
          font-size: 13px;
          margin: 0;
        }
      `}</style>
    </div>
  );
}

// ─── Upload step ──────────────────────────────────────────────────────────────

function ClipUploader({ onPick }: { onPick: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<File | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setPicked(f);
      onPick(f);
    }
  }

  return (
    <div className="upl-root">
      <button type="button" className="upl-zone" onClick={() => inputRef.current?.click()}>
        {picked ? (
          <>
            <span className="upl-check">✓</span>
            <span className="upl-label">{picked.name}</span>
            <span className="upl-hint">{formatBytes(picked.size)} — tap to change</span>
          </>
        ) : (
          <>
            <span className="upl-icon">↑</span>
            <span className="upl-label">Choose video file</span>
            <span className="upl-hint">MP4, MOV, up to 500 MB</span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        aria-label="Choose a video file to upload"
        className="upl-hidden"
        onChange={handleChange}
      />
      <style jsx>{`
        .upl-root { max-width: 480px; width: 100%; }
        .upl-zone {
          align-items: center;
          background: transparent;
          border: 1px dashed var(--axis-line);
          border-radius: 12px;
          color: var(--axis-ink);
          cursor: pointer;
          display: flex;
          flex-direction: column;
          font-family: inherit;
          gap: 8px;
          min-height: 200px;
          padding: 32px;
          transition: border-color 0.15s;
          width: 100%;
        }
        .upl-zone:hover { border-color: rgba(255,255,255,0.32); }
        .upl-icon { color: var(--axis-muted); font-size: 32px; }
        .upl-check { color: var(--axis-live); font-size: 28px; }
        .upl-label { font-size: 18px; font-weight: 700; word-break: break-all; text-align: center; }
        .upl-hint { color: var(--axis-muted); font-size: 12px; }
        .upl-hidden { display: none; }
      `}</style>
    </div>
  );
}

// ─── Record step ──────────────────────────────────────────────────────────────

function ClipRecorder({ onDone }: { onDone: (file: File) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [state, setState] = useState<"idle" | "active" | "stopped">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play();
      }
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || "video/mp4" });
        const file = new File([blob], "recording.mp4", { type: mimeType || "video/mp4" });
        stream.getTracks().forEach((t) => t.stop());
        onDone(file);
      };
      recorder.start(1000);
      mediaRef.current = recorder;
      setState("active");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Camera access denied or unavailable.");
    }
  }, [onDone]);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRef.current?.stop();
    setState("stopped");
  }, []);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="rec-root">
      <div className="rec-preview-wrap">
        <video ref={videoRef} className="rec-preview" playsInline muted />
        {state === "active" && (
          <div className="rec-indicator">
            <span className="rec-dot" />
            {mm}:{ss}
          </div>
        )}
      </div>
      {error && <p className="rec-error">{error}</p>}
      <div className="rec-controls">
        {state === "idle" && (
          <button className="rec-btn rec-btn--start" onClick={() => void start()}>
            Start Recording
          </button>
        )}
        {state === "active" && (
          <button className="rec-btn rec-btn--stop" onClick={stop}>
            Stop Recording
          </button>
        )}
        {state === "stopped" && (
          <p className="rec-done">Saving recording...</p>
        )}
      </div>
      <style jsx>{`
        .rec-root { display: flex; flex-direction: column; gap: 16px; max-width: 480px; width: 100%; }
        .rec-preview-wrap { aspect-ratio: 16/9; background: #111; border-radius: 10px; overflow: hidden; position: relative; }
        .rec-preview { height: 100%; object-fit: cover; width: 100%; }
        .rec-indicator { align-items: center; background: rgba(0,0,0,0.6); border-radius: 6px; color: #fff; display: flex; font-size: 13px; font-weight: 700; gap: 6px; left: 12px; padding: 4px 8px; position: absolute; top: 12px; }
        .rec-dot { animation: blink 1s infinite; background: #e55; border-radius: 50%; height: 8px; width: 8px; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        .rec-controls { display: flex; gap: 10px; }
        .rec-btn { border: 0; border-radius: 10px; cursor: pointer; font-family: inherit; font-size: 15px; font-weight: 700; min-height: 52px; padding: 0 20px; }
        .rec-btn--start { background: var(--axis-live); color: #070a04; }
        .rec-btn--stop { background: #e55; color: #fff; }
        .rec-done { color: var(--axis-muted); font-size: 13px; margin: 0; }
        .rec-error { color: #e77; font-size: 13px; margin: 0; }
      `}</style>
    </div>
  );
}

// ─── Setup form ───────────────────────────────────────────────────────────────

type SetupFormProps = {
  file: File | null;
  setup: SetupFields;
  onChange: (f: SetupFields) => void;
  onBack: () => void;
  onSubmit: () => void;
  error: string | null;
  authStatus: string;
};

function ClipSetupForm({ file, setup, onChange, onBack, onSubmit, error, authStatus }: SetupFormProps) {
  function set<K extends keyof SetupFields>(key: K, value: SetupFields[K]) {
    onChange({ ...setup, [key]: value });
  }

  const canSubmit = authStatus === "signed_in" && file !== null;

  return (
    <div className="csf-root">
      <h2 className="csf-title">Clip Setup</h2>

      {file && (
        <div className="csf-file">
          <span className="csf-file-name">{file.name}</span>
          <span className="csf-file-size">{formatBytes(file.size)}</span>
        </div>
      )}

      <div className="csf-field">
        <label className="csf-label">Who is this for?</label>
        <div className="csf-row">
          {(["player", "team"] as ClipSubjectType[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`csf-chip ${setup.subjectType === t ? "csf-chip--on" : ""}`}
              onClick={() => set("subjectType", t)}
            >
              {t === "player" ? "Player" : "Team"}
            </button>
          ))}
        </div>
      </div>

      <div className="csf-field">
        <label className="csf-label">
          {setup.subjectType === "player" ? "Player name" : "Team name"}
        </label>
        <input
          className="csf-input"
          placeholder={setup.subjectType === "player" ? "e.g. Hailey" : "e.g. Varsity Girls"}
          value={setup.subjectName}
          onChange={(e) => set("subjectName", e.target.value)}
        />
      </div>

      <div className="csf-field">
        <label className="csf-label">Session type</label>
        <div className="csf-row">
          {(["game", "practice", "training"] as ClipSessionType[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`csf-chip ${setup.sessionType === t ? "csf-chip--on" : ""}`}
              onClick={() => set("sessionType", t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="csf-field">
        <label className="csf-label">
          Jersey color <span className="csf-optional">(optional)</span>
        </label>
        <input
          className="csf-input"
          placeholder="e.g. White, Red #23"
          value={setup.jerseyColor}
          onChange={(e) => set("jerseyColor", e.target.value)}
        />
      </div>

      <div className="csf-field">
        <label className="csf-label">Scoreboard visible?</label>
        <div className="csf-row">
          {([["yes", "Yes"], ["no", "No"], ["not_sure", "Not sure"]] as [ClipScoreboardVisible, string][]).map(([v, l]) => (
            <button
              key={v}
              type="button"
              className={`csf-chip ${setup.scoreboardVisible === v ? "csf-chip--on" : ""}`}
              onClick={() => set("scoreboardVisible", v)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="csf-error">{error}</p>}
      {authStatus !== "signed_in" && (
        <p className="csf-warn">Sign in to save and process this clip.</p>
      )}

      <div className="csf-footer">
        <button type="button" className="csf-back" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="csf-submit"
          onClick={onSubmit}
          disabled={!canSubmit}
        >
          {authStatus !== "signed_in" ? "Sign in to continue" : "Start Processing"}
        </button>
      </div>

      <style jsx>{`
        .csf-root { display: flex; flex-direction: column; gap: 24px; max-width: 420px; width: 100%; }
        .csf-title { font-size: clamp(22px, 5vw, 32px); font-weight: 700; letter-spacing: -0.02em; margin: 0; }
        .csf-file { align-items: baseline; display: flex; gap: 8px; }
        .csf-file-name { color: var(--axis-muted); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 28ch; }
        .csf-file-size { color: rgba(244,244,240,0.3); flex-shrink: 0; font-size: 11px; }
        .csf-field { display: flex; flex-direction: column; gap: 8px; }
        .csf-label { color: var(--axis-muted); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
        .csf-optional { font-weight: 400; opacity: 0.7; }
        .csf-row { display: flex; flex-wrap: wrap; gap: 8px; }
        .csf-chip { background: transparent; border: 1px solid var(--axis-line); border-radius: 8px; color: var(--axis-muted); cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 600; min-height: 36px; padding: 0 12px; transition: all 0.12s; }
        .csf-chip--on { background: var(--axis-ink); border-color: var(--axis-ink); color: var(--axis-bg); }
        .csf-input { background: transparent; border: 1px solid var(--axis-line); border-radius: 8px; box-sizing: border-box; color: var(--axis-ink); font-family: inherit; font-size: 15px; min-height: 44px; outline: none; padding: 0 12px; transition: border-color 0.12s; width: 100%; }
        .csf-input:focus { border-color: rgba(255,255,255,0.3); }
        .csf-footer { display: flex; gap: 10px; margin-top: 8px; }
        .csf-back { background: transparent; border: 1px solid var(--axis-line); border-radius: 10px; color: var(--axis-muted); cursor: pointer; font-family: inherit; font-size: 14px; min-height: 48px; padding: 0 16px; }
        .csf-submit { background: var(--axis-live); border: 0; border-radius: 10px; color: #070a04; cursor: pointer; flex: 1; font-family: inherit; font-size: 15px; font-weight: 700; min-height: 48px; padding: 0 20px; }
        .csf-submit:disabled { cursor: default; opacity: 0.4; }
        .csf-error { color: #e77; font-size: 13px; margin: 0; }
        .csf-warn { color: #f4c95d; font-size: 13px; margin: 0; }
      `}</style>
    </div>
  );
}

// ─── XHR upload with progress ────────────────────────────────────────────────

function xhrFormDataPost(
  url: string,
  file: File,
  setup: SetupFields,
  origin: "record" | "upload",
  token: string | null,
  onProgress: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("video", file);
    form.append("origin", origin === "record" ? "recorded" : "uploaded");
    form.append("subjectType", setup.subjectType);
    form.append("subjectName", setup.subjectName);
    form.append("sessionType", setup.sessionType);
    form.append("jerseyColor", setup.jerseyColor);
    form.append("scoreboardVisible", setup.scoreboardVisible);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 90));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { clipId?: string };
          if (data.clipId) {
            resolve(data.clipId);
          } else {
            reject(new Error("No clipId returned"));
          }
        } catch {
          reject(new Error("Invalid response"));
        }
      } else {
        try {
          const data = JSON.parse(xhr.responseText) as { error?: string };
          reject(new Error(data.error ?? `Server error ${xhr.status}`));
        } catch {
          reject(new Error(`Server error ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error("Network error"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.timeout = 5 * 60 * 1000; // 5 min

    xhr.send(form);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const types = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}
