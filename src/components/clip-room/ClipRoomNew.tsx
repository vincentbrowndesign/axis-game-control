"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { axisAuthenticatedFetch } from "../../lib/axis-client-auth";
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
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [setup, setSetup] = useState<SetupFields>(defaultSetup);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [clipId, setClipId] = useState<string | null>(null);

  const finalFile = videoFile ?? (videoBlob ? new File([videoBlob], "recording.mp4", { type: "video/mp4" }) : null);

  function handleFilePicked(file: File) {
    setVideoFile(file);
    setStage("setup");
  }

  function handleRecordingDone(blob: Blob) {
    setVideoBlob(blob);
    setStage("setup");
  }

  async function handleSetupSubmit() {
    if (!finalFile) { setError("No video file."); return; }
    if (auth.status !== "signed_in") { setError("Sign in to save clips."); return; }

    setStage("uploading");
    setError(null);
    setUploadProgress(0);

    try {
      // 1. Create clip source → get upload URL
      const createRes = await axisAuthenticatedFetch("/api/clip-room/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: mode === "record" ? "recorded" : "uploaded",
          filename: finalFile.name,
          fileSize: finalFile.size,
        }),
      });
      if (!createRes.ok) throw new Error("Failed to create clip source");
      const { clipId: newClipId, uploadUrl } = (await createRes.json()) as { clipId: string; uploadUrl: string; cloudflareUid: string };

      setClipId(newClipId);
      setUploadProgress(10);

      // 2. Save setup (before upload so it's available for processing)
      await axisAuthenticatedFetch(`/api/clip-room/${newClipId}/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectType: setup.subjectType,
          subjectName: setup.subjectName || null,
          sessionType: setup.sessionType,
          jerseyColor: setup.jerseyColor || null,
          scoreboardVisible: setup.scoreboardVisible || null,
        }),
      });

      setUploadProgress(20);

      // 3. TUS upload to Cloudflare Stream
      await tusUpload(finalFile, uploadUrl, (progress) => {
        setUploadProgress(20 + Math.round(progress * 70));
      });

      setUploadProgress(90);

      // 4. Confirm upload + start processing
      await axisAuthenticatedFetch(`/api/clip-room/sources/${newClipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      setUploadProgress(100);
      setStage("done");

      // Navigate to detail page after short delay
      setTimeout(() => router.push(`/axis/clip-room/${newClipId}`), 800);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setStage("setup");
    }
  }

  return (
    <div className="crn-root">
      <header className="crn-header">
        <Link href="/axis/clip-room" className="crn-back">Clip Room</Link>
        <span className="crn-header-title">{mode === "record" ? "Record Clip" : "Upload Clip"}</span>
        <AxisAuthControl auth={auth} />
      </header>

      <main className="crn-main">
        {stage === "capture" && mode === "record" && (
          <ClipRecorder onDone={handleRecordingDone} />
        )}
        {stage === "capture" && mode === "upload" && (
          <ClipUploader onPick={handleFilePicked} />
        )}
        {stage === "setup" && (
          <ClipSetupForm
            setup={setup}
            onChange={setSetup}
            onBack={() => setStage("capture")}
            onSubmit={() => void handleSetupSubmit()}
            error={error}
            authStatus={auth.status}
          />
        )}
        {stage === "uploading" && (
          <div className="crn-uploading">
            <p className="crn-uploading-label">Uploading...</p>
            <div className="crn-progress-track">
              <div className="crn-progress-fill" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="crn-muted">{uploadProgress}%</p>
          </div>
        )}
        {stage === "done" && (
          <div className="crn-done">
            <p className="crn-done-label">Clip received.</p>
            <p className="crn-muted">Axis is processing your clip. Taking you there now...</p>
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

        .crn-uploading,
        .crn-done {
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-width: 360px;
        }

        .crn-uploading-label,
        .crn-done-label {
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

// ─── Recorder ────────────────────────────────────────────────────────────────

function ClipRecorder({ onDone }: { onDone: (blob: Blob) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [state, setState] = useState<"idle" | "active" | "stopped">("idle");
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
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
        onDone(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start(1000);
      mediaRef.current = recorder;
      setState("active");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      setError("Camera access denied or unavailable.");
    }
  }, [onDone]);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRef.current?.stop();
    setState("stopped");
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

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
          <button className="rec-btn rec-btn--start" onClick={() => void start()}>Start Recording</button>
        )}
        {state === "active" && (
          <button className="rec-btn rec-btn--stop" onClick={stop}>Stop Recording</button>
        )}
        {state === "stopped" && (
          <p className="rec-done">Processing recording...</p>
        )}
      </div>
      <style jsx>{`
        .rec-root { display: flex; flex-direction: column; gap: 16px; max-width: 480px; }
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
        .rec-error { color: #e55; font-size: 13px; margin: 0; }
      `}</style>
    </div>
  );
}

// ─── Uploader ────────────────────────────────────────────────────────────────

function ClipUploader({ onPick }: { onPick: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="upl-root">
      <button
        className="upl-zone"
        onClick={() => inputRef.current?.click()}
      >
        <span className="upl-icon">↑</span>
        <span className="upl-label">Choose video file</span>
        <span className="upl-hint">MP4, MOV, up to 2 GB</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
        }}
      />
      <style jsx>{`
        .upl-root { max-width: 480px; }
        .upl-zone { align-items: center; background: transparent; border: 1px dashed var(--axis-line); border-radius: 12px; color: var(--axis-ink); cursor: pointer; display: flex; flex-direction: column; font-family: inherit; gap: 8px; min-height: 200px; padding: 32px; transition: border-color 0.15s; width: 100%; }
        .upl-zone:hover { border-color: rgba(255,255,255,0.3); }
        .upl-icon { color: var(--axis-muted); font-size: 32px; }
        .upl-label { font-size: 18px; font-weight: 700; }
        .upl-hint { color: var(--axis-muted); font-size: 12px; }
      `}</style>
    </div>
  );
}

// ─── Setup form ───────────────────────────────────────────────────────────────

type SetupFormProps = {
  setup: SetupFields;
  onChange: (f: SetupFields) => void;
  onBack: () => void;
  onSubmit: () => void;
  error: string | null;
  authStatus: string;
};

function ClipSetupForm({ setup, onChange, onBack, onSubmit, error, authStatus }: SetupFormProps) {
  function set<K extends keyof SetupFields>(key: K, value: SetupFields[K]) {
    onChange({ ...setup, [key]: value });
  }

  return (
    <div className="csf-root">
      <h2 className="csf-title">Clip Setup</h2>

      <div className="csf-field">
        <label className="csf-label">Who is this for?</label>
        <div className="csf-row">
          {(["player", "team"] as ClipSubjectType[]).map((t) => (
            <button
              key={t}
              className={`csf-chip ${setup.subjectType === t ? "csf-chip--on" : ""}`}
              onClick={() => set("subjectType", t)}
            >
              {t === "player" ? "Player" : "Team"}
            </button>
          ))}
        </div>
      </div>

      <div className="csf-field">
        <label className="csf-label">{setup.subjectType === "player" ? "Player name" : "Team name"}</label>
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
              className={`csf-chip ${setup.sessionType === t ? "csf-chip--on" : ""}`}
              onClick={() => set("sessionType", t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="csf-field">
        <label className="csf-label">Jersey color <span className="csf-optional">(optional)</span></label>
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
              className={`csf-chip ${setup.scoreboardVisible === v ? "csf-chip--on" : ""}`}
              onClick={() => set("scoreboardVisible", v)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="csf-error">{error}</p>}
      {authStatus !== "signed_in" && <p className="csf-warn">Sign in to save and process this clip.</p>}

      <div className="csf-footer">
        <button className="csf-back" onClick={onBack}>Back</button>
        <button
          className="csf-submit"
          onClick={onSubmit}
          disabled={authStatus !== "signed_in"}
        >
          {authStatus === "signed_in" ? "Start Processing" : "Sign in to continue"}
        </button>
      </div>

      <style jsx>{`
        .csf-root { display: flex; flex-direction: column; gap: 24px; max-width: 420px; }
        .csf-title { font-size: clamp(22px, 5vw, 32px); font-weight: 700; letter-spacing: -0.02em; margin: 0; }
        .csf-field { display: flex; flex-direction: column; gap: 8px; }
        .csf-label { color: var(--axis-muted); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
        .csf-optional { font-weight: 400; opacity: 0.7; }
        .csf-row { display: flex; flex-wrap: wrap; gap: 8px; }
        .csf-chip { background: transparent; border: 1px solid var(--axis-line); border-radius: 8px; color: var(--axis-muted); cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 600; min-height: 36px; padding: 0 12px; transition: all 0.12s; }
        .csf-chip--on { background: var(--axis-ink); border-color: var(--axis-ink); color: var(--axis-bg); }
        .csf-input { background: transparent; border: 1px solid var(--axis-line); border-radius: 8px; color: var(--axis-ink); font-family: inherit; font-size: 15px; min-height: 44px; outline: none; padding: 0 12px; transition: border-color 0.12s; width: 100%; box-sizing: border-box; }
        .csf-input:focus { border-color: rgba(255,255,255,0.3); }
        .csf-footer { display: flex; gap: 10px; margin-top: 8px; }
        .csf-back { background: transparent; border: 1px solid var(--axis-line); border-radius: 10px; color: var(--axis-muted); cursor: pointer; font-family: inherit; font-size: 14px; min-height: 48px; padding: 0 16px; }
        .csf-submit { background: var(--axis-live); border: 0; border-radius: 10px; color: #070a04; cursor: pointer; flex: 1; font-family: inherit; font-size: 15px; font-weight: 700; min-height: 48px; padding: 0 20px; }
        .csf-submit:disabled { cursor: default; opacity: 0.4; }
        .csf-error { color: #e55; font-size: 13px; margin: 0; }
        .csf-warn { color: #f4c95d; font-size: 13px; margin: 0; }
      `}</style>
    </div>
  );
}

// ─── TUS upload ───────────────────────────────────────────────────────────────

async function tusUpload(file: File, uploadUrl: string, onProgress: (ratio: number) => void) {
  const { default: tus } = await import("tus-js-client");

  return new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      uploadUrl,
      chunkSize: 5 * 1024 * 1024,
      retryDelays: [0, 1000, 3000],
      metadata: { filename: file.name, filetype: file.type },
      onProgress(bytesSent, bytesTotal) {
        onProgress(bytesTotal > 0 ? bytesSent / bytesTotal : 0);
      },
      onSuccess() { resolve(); },
      onError(err) { reject(err); },
    });
    upload.start();
  });
}

function getSupportedMimeType() {
  const types = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}
