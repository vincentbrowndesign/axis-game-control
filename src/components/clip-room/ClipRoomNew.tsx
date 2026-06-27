"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAxisAccessToken } from "../../lib/axis-client-auth";
import { useAxisAuth } from "../../app/axis/axis-auth-control";
import AxisAuthControl from "../../app/axis/axis-auth-control";
import type { ClipScoreboardVisible, ClipSessionType, ClipSubjectType } from "../../lib/clip-room/types";

type Props = { mode: "record" | "upload" };
type Stage = "capture" | "setup" | "done";
type UploadStatus = "idle" | "uploading" | "uploaded" | "failed";

type SetupFields = {
  subjectType: ClipSubjectType;
  subjectName: string;
  sessionType: ClipSessionType;
  jerseyColor: string;
  scoreboardVisible: ClipScoreboardVisible | "";
};

type UploadedClip = {
  clipSourceId: string | null;
  fileName: string;
  fileSize: number;
  streamVideoId: string | null;
  uploadStatus: UploadStatus;
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
  const [clip, setClip] = useState<UploadedClip | null>(null);
  const [setup, setSetup] = useState<SetupFields>(defaultSetup);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function handleCaptureDone(file: File) {
    const nextClip: UploadedClip = {
      clipSourceId: null,
      fileName: file.name || "clip.mp4",
      fileSize: file.size,
      streamVideoId: null,
      uploadStatus: "uploading",
    };
    setClip(nextClip);
    setError(null);
    setUploadProgress(0);
    setStage("setup");
    void uploadVideo(file);
  }

  async function uploadVideo(file: File) {
    if (auth.status !== "signed_in") {
      setClip((current) => current ? { ...current, uploadStatus: "failed" } : current);
      setError("Sign in to save and process this clip.");
      return;
    }

    try {
      const token = await getAxisAccessToken();
      const uploaded = await xhrVideoUpload(
        "/api/clip-room/ingest",
        file,
        mode,
        token,
        setUploadProgress,
      );
      setClip({
        clipSourceId: uploaded.clipSourceId,
        fileName: uploaded.fileName || file.name || "clip.mp4",
        fileSize: uploaded.fileSize || file.size,
        streamVideoId: uploaded.streamVideoId,
        uploadStatus: "uploaded",
      });
      setUploadProgress(100);
    } catch {
      setClip((current) => current ? { ...current, uploadStatus: "failed" } : current);
      setError("Upload could not start. Please choose a video and try again.");
    }
  }

  function chooseAgain() {
    setClip(null);
    setError(null);
    setUploadProgress(0);
    setStage("capture");
  }

  async function handleStartProcessing() {
    if (clip?.uploadStatus === "failed") {
      chooseAgain();
      return;
    }
    if (setup.subjectType === "team" && !setup.subjectName.trim()) {
      setError("Enter a team name.");
      return;
    }
    if (!clip?.clipSourceId) {
      setError("Video upload did not complete. Please choose the video again.");
      return;
    }
    if (auth.status !== "signed_in") return;

    setError(null);

    try {
      const token = await getAxisAccessToken();
      await saveSetup(clip.clipSourceId, setup, token);
      await startProcessing(clip.clipSourceId, token);
      setStage("done");
      setTimeout(() => router.push(`/clips/${clip.clipSourceId}`), 600);
    } catch {
      setError("Processing could not start. Please try again.");
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
            clip={clip}
            setup={setup}
            onChange={setSetup}
            onBack={chooseAgain}
            onChooseAgain={chooseAgain}
            onSubmit={() => void handleStartProcessing()}
            error={error}
            authStatus={auth.status}
            uploadProgress={uploadProgress}
          />
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
  clip: UploadedClip | null;
  setup: SetupFields;
  onChange: (f: SetupFields) => void;
  onBack: () => void;
  onChooseAgain: () => void;
  onSubmit: () => void;
  error: string | null;
  authStatus: string;
  uploadProgress: number;
};

function ClipSetupForm({ clip, setup, onChange, onBack, onChooseAgain, onSubmit, error, authStatus, uploadProgress }: SetupFormProps) {
  function set<K extends keyof SetupFields>(key: K, value: SetupFields[K]) {
    onChange({ ...setup, [key]: value });
  }

  const buttonLabel =
    authStatus !== "signed_in"
      ? "Sign in to continue"
      : clip?.uploadStatus === "uploading"
        ? "Uploading video..."
        : clip?.uploadStatus === "failed"
          ? "Choose Video Again"
          : "Start Processing";
  const canSubmit = authStatus === "signed_in" && clip?.uploadStatus !== "uploading";

  return (
    <div className="csf-root">
      <h2 className="csf-title">Clip Setup</h2>

      {clip && (
        <div className="csf-file">
          <span className="csf-file-name">{clip.fileName}</span>
          <span className="csf-file-size">{formatBytes(clip.fileSize)}</span>
          <span className={`csf-upload csf-upload--${clip.uploadStatus}`}>
            {clip.uploadStatus === "uploading"
              ? `Uploading video... ${uploadProgress}%`
              : clip.uploadStatus === "uploaded"
                ? "Upload complete"
                : "Upload failed"}
          </span>
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
          onClick={clip?.uploadStatus === "failed" ? onChooseAgain : onSubmit}
          disabled={!canSubmit}
        >
          {buttonLabel}
        </button>
      </div>

      <style jsx>{`
        .csf-root { display: flex; flex-direction: column; gap: 24px; max-width: 420px; width: 100%; }
        .csf-title { font-size: clamp(22px, 5vw, 32px); font-weight: 700; letter-spacing: -0.02em; margin: 0; }
        .csf-file { align-items: baseline; display: flex; flex-wrap: wrap; gap: 8px; }
        .csf-file-name { color: var(--axis-muted); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 28ch; }
        .csf-file-size { color: rgba(244,244,240,0.3); flex-shrink: 0; font-size: 11px; }
        .csf-upload { flex-basis: 100%; font-size: 12px; }
        .csf-upload--uploading { color: #f4c95d; }
        .csf-upload--uploaded { color: var(--axis-live); }
        .csf-upload--failed { color: #e77; }
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

type UploadResponse = {
  clipId?: string;
  clipSourceId?: string;
  fileName?: string;
  fileSize?: number;
  streamVideoId?: string;
};

function xhrVideoUpload(
  url: string,
  file: File,
  origin: "record" | "upload",
  token: string | null,
  onProgress: (pct: number) => void,
): Promise<Required<Pick<UploadResponse, "clipSourceId" | "fileName" | "fileSize" | "streamVideoId">>> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("video", file);
    form.append("origin", origin === "record" ? "recorded" : "uploaded");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 95));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as UploadResponse;
          const clipSourceId = data.clipSourceId ?? data.clipId;
          if (clipSourceId) {
            resolve({
              clipSourceId,
              fileName: data.fileName ?? file.name,
              fileSize: data.fileSize ?? file.size,
              streamVideoId: data.streamVideoId ?? "",
            });
          } else {
            reject(new Error("No clipSourceId returned"));
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

async function saveSetup(clipSourceId: string, setup: SetupFields, token: string | null) {
  const response = await fetch(`/api/clip-room/${clipSourceId}/setup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      subjectType: setup.subjectType,
      subjectName: setup.subjectName,
      sessionType: setup.sessionType,
      jerseyColor: setup.jerseyColor,
      scoreboardVisible: setup.scoreboardVisible || null,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(data?.error ?? "setup save failed");
  }
}

async function startProcessing(clipSourceId: string, token: string | null) {
  const response = await fetch(`/api/clip-room/sources/${clipSourceId}`, {
    method: "PATCH",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(data?.error ?? "processing start failed");
  }
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
