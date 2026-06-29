"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BasketballAIEventReview } from "@/components/BasketballAIEventReview";
import { BasketballPlayerLookup } from "@/components/BasketballPlayerLookup";
import {
  courtSidePresetLabels,
  defaultOverlayCalibration,
  defaultOverlaySettings,
  defaultOverlayTransform,
  type BasketballOverlayConfig,
  type BasketballOverlayCalibration,
  type BasketballOverlayTransform,
  type BasketballCourtSidePreset,
  type BasketballOverlayMode,
  type BasketballRecording,
  type BasketballSession,
  type BasketballSessionType,
  overlayModeLabels,
  sessionTypes,
} from "@/lib/basketball";

type CameraState = "idle" | "requesting" | "ready" | "denied" | "error";
type SaveState = "unsaved" | "saving" | "saved" | "error";
type RecordingState = "idle" | "starting" | "recording" | "stopping" | "complete" | "error";

const modeOptions: BasketballOverlayMode[] = [
  "court-zones",
  "delta-offense",
  "shot-chart",
  "spacing-shapes",
];

const localUserKey = "axis-basketball-local-user-id";
const courtSidePresets = Object.keys(courtSidePresetLabels) as BasketballCourtSidePreset[];

function getLocalUserId() {
  const existing = window.localStorage.getItem(localUserKey);
  if (existing) return existing;

  const id = crypto.randomUUID();
  window.localStorage.setItem(localUserKey, id);
  return id;
}

export function BasketballCameraOverlay() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingSecondsRef = useRef(0);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const [userId, setUserId] = useState("");
  const [title, setTitle] = useState("Live court");
  const [sessionType, setSessionType] = useState<BasketballSessionType>("training");
  const [location, setLocation] = useState("");
  const [session, setSession] = useState<BasketballSession | null>(null);
  const [sessionError, setSessionError] = useState("");
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [cameraError, setCameraError] = useState("");
  const [overlayMode, setOverlayMode] = useState<BasketballOverlayMode>("court-zones");
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [opacity, setOpacity] = useState(72);
  const [transform, setTransform] =
    useState<BasketballOverlayTransform>(defaultOverlayTransform);
  const [calibration, setCalibration] =
    useState<BasketballOverlayCalibration>(defaultOverlayCalibration);
  const [saveState, setSaveState] = useState<SaveState>("unsaved");
  const [lastSavedConfig, setLastSavedConfig] = useState<BasketballOverlayConfig | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingError, setRecordingError] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [activeRecording, setActiveRecording] = useState<BasketballRecording | null>(null);
  const [recordings, setRecordings] = useState<BasketballRecording[]>([]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      recorderRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (recordingState !== "recording") return;

    const interval = window.setInterval(() => {
      recordingSecondsRef.current += 1;
      setRecordingSeconds(recordingSecondsRef.current);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [recordingState]);

  const permissionLabel = useMemo(() => {
    if (cameraState === "ready") return "Camera ready";
    if (cameraState === "requesting") return "Asking for camera";
    if (cameraState === "denied") return "Camera permission needed";
    if (cameraState === "error") return "Camera unavailable";
    return "Camera off";
  }, [cameraState]);

  const ensureUserId = () => {
    if (userId) return userId;

    const nextUserId = getLocalUserId();
    setUserId(nextUserId);
    return nextUserId;
  };

  const markOverlayUnsaved = () => {
    setSaveState((current) => (current === "saving" ? current : "unsaved"));
  };

  const updateTransform = (nextTransform: Partial<BasketballOverlayTransform>) => {
    setTransform((current) => ({ ...current, ...nextTransform }));
    markOverlayUnsaved();
  };

  const updateCalibration = (nextCalibration: Partial<BasketballOverlayCalibration>) => {
    setCalibration((current) => ({
      ...current,
      ...nextCalibration,
      cornerPins: {
        ...current.cornerPins,
        ...nextCalibration.cornerPins,
      },
    }));
    markOverlayUnsaved();
  };

  const startSession = async () => {
    setSessionError("");

    if (!title.trim()) {
      setSessionError("Add a session title.");
      return;
    }

    const activeUserId = ensureUserId();

    try {
      const response = await fetch("/api/basketball/sessions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: activeUserId,
          title: title.trim(),
          sessionType,
          location: location.trim() || null,
        }),
      });
      const data = (await response.json()) as { session?: BasketballSession; error?: string };

      if (!response.ok || !data.session) {
        throw new Error(data.error || "Session could not start.");
      }

      setSession(data.session);
      setSaveState("unsaved");
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Session could not start.");
    }
  };

  const startCamera = useCallback(async () => {
    setCameraState("requesting");
    setCameraError("");

    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());

      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraState("ready");
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      setCameraState(name === "NotAllowedError" ? "denied" : "error");
      setCameraError(
        name === "NotAllowedError"
          ? "Allow camera access to use the overlay."
          : "The camera could not start on this device.",
      );
    }
  }, []);

  const saveOverlay = async () => {
    if (!session) return null;

    const activeUserId = ensureUserId();
    setSaveState("saving");

    try {
      const response = await fetch("/api/basketball/overlays/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: activeUserId,
          sessionId: session.id,
          overlayType: overlayMode,
          opacity: opacity / 100,
          visible: overlayVisible,
          transform: {
            ...transform,
            visible: overlayVisible,
          },
          calibration,
          settings: defaultOverlaySettings,
        }),
      });
      const data = (await response.json()) as { overlay?: BasketballOverlayConfig; error?: string };

      if (!response.ok || !data.overlay) {
        throw new Error(data.error || "Overlay could not save.");
      }

      setLastSavedConfig(data.overlay);
      setSaveState("saved");
      return data.overlay;
    } catch {
      setSaveState("error");
      return null;
    }
  };

  const resetOverlay = () => {
    setOverlayMode("court-zones");
    setOverlayVisible(true);
    setOpacity(72);
    setTransform(defaultOverlayTransform);
    setCalibration(defaultOverlayCalibration);
    markOverlayUnsaved();
  };

  const startOverlayDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: transform.translateX,
      originY: transform.translateY,
    };
  };

  const moveOverlayDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const deltaX = (event.clientX - drag.startX) / bounds.width;
    const deltaY = (event.clientY - drag.startY) / bounds.height;

    setTransform((current) => ({
      ...current,
      translateX: Number((drag.originX + deltaX).toFixed(3)),
      translateY: Number((drag.originY + deltaY).toFixed(3)),
    }));
    markOverlayUnsaved();
  };

  const endOverlayDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  const getVideoMetadata = () => {
    const track = streamRef.current?.getVideoTracks()[0];
    const settings = track?.getSettings();

    return {
      width: settings?.width || videoRef.current?.videoWidth || undefined,
      height: settings?.height || videoRef.current?.videoHeight || undefined,
      fps: settings?.frameRate || undefined,
    };
  };

  const ensureActiveOverlayConfig = async () => {
    if (lastSavedConfig && saveState === "saved") return lastSavedConfig;

    return saveOverlay();
  };

  const startRecording = async () => {
    setRecordingError("");

    if (!session) {
      setRecordingError("Start a session first.");
      return;
    }

    if (!streamRef.current || cameraState !== "ready") {
      setRecordingError("Turn on the camera first.");
      return;
    }

    if (!window.MediaRecorder) {
      setRecordingError("Recording is not available in this browser.");
      return;
    }

    setRecordingState("starting");
    const overlayConfig = await ensureActiveOverlayConfig();

    if (!overlayConfig) {
      setRecordingState("error");
      setRecordingError("Save the overlay before recording.");
      return;
    }

    const activeUserId = ensureUserId();
    const metadata = getVideoMetadata();
    const mimeType = getSupportedRecordingMimeType();

    try {
      const response = await fetch("/api/basketball/recordings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: activeUserId,
          sessionId: session.id,
          overlayConfigId: overlayConfig.id,
          ...metadata,
          metadata: { mimeType },
        }),
      });
      const data = (await response.json()) as { recording?: BasketballRecording; error?: string };

      if (!response.ok || !data.recording) {
        throw new Error(data.error || "Recording could not start.");
      }

      const createdRecording = data.recording;
      recordedChunksRef.current = [];
      recordingSecondsRef.current = 0;
      setRecordingSeconds(0);
      setActiveRecording(createdRecording);

      const recorder = new MediaRecorder(
        streamRef.current,
        mimeType ? { mimeType } : undefined,
      );
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        void completeRecording(createdRecording, overlayConfig.id, mimeType);
      };
      recorder.start();
      setRecordingState("recording");
    } catch (error) {
      setRecordingState("error");
      setRecordingError(error instanceof Error ? error.message : "Recording could not start.");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") {
      setRecordingState("stopping");
      recorderRef.current.stop();
    }
  };

  const completeRecording = async (
    recording: BasketballRecording,
    overlayConfigId: string,
    mimeType: string,
  ) => {
    const durationSeconds = Math.max(1, recordingSecondsRef.current || recordingSeconds);
    const blob = new Blob(recordedChunksRef.current, {
      type: mimeType || "video/webm",
    });
    const localBlobUrl = URL.createObjectURL(blob);
    const metadata = getVideoMetadata();

    try {
      const response = await fetch("/api/basketball/recordings/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: recording.userId,
          recordingId: recording.id,
          sessionId: recording.sessionId,
          overlayConfigId,
          localBlobUrl,
          durationSeconds,
          ...metadata,
          metadata: {
            mimeType,
            localBlobSize: blob.size,
          },
        }),
      });
      const data = (await response.json()) as { recording?: BasketballRecording; error?: string };

      if (!response.ok || !data.recording) {
        throw new Error(data.error || "Recording could not complete.");
      }

      const complete = {
        ...data.recording,
        localBlobUrl,
      };
      setActiveRecording(complete);
      setRecordings((current) => [complete, ...current]);
      setRecordingState("complete");
    } catch (error) {
      setRecordingState("error");
      setRecordingError(error instanceof Error ? error.message : "Recording could not save.");
    } finally {
      recorderRef.current = null;
      recordedChunksRef.current = [];
      recordingSecondsRef.current = 0;
    }
  };

  return (
    <main className="basketball-shell">
      <section className="basketball-stack">
        <header className="basketball-header">
          <p>Axis Basketball</p>
          <h1>Camera Overlay</h1>
          <span>Live court context</span>
        </header>

        <section className="basketball-card">
          <div className="section-title">
            <span>1</span>
            <h2>Start Session</h2>
          </div>

          <label>
            Session title
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>

          <div className="type-grid">
            {sessionTypes.map((type) => (
              <button
                key={type}
                className={sessionType === type ? "selected" : ""}
                type="button"
                onClick={() => setSessionType(type)}
              >
                {type}
              </button>
            ))}
          </div>

          <label>
            Location
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Optional"
            />
          </label>

          <button className="primary-button" type="button" onClick={startSession}>
            {session ? "Session Active" : "Start Session"}
          </button>
          {sessionError ? <p className="error-text">{sessionError}</p> : null}
        </section>

        <section className="camera-stage">
          <div className="camera-topline">
            <div>
              <p>Camera View</p>
              <strong>{permissionLabel}</strong>
            </div>
            <button type="button" onClick={startCamera}>
              Turn On Camera
            </button>
          </div>

          <div className="video-wrap">
            <video ref={videoRef} playsInline muted autoPlay />
            {overlayVisible ? (
              <div
                className="calibrated-overlay"
                onPointerDown={startOverlayDrag}
                onPointerMove={moveOverlayDrag}
                onPointerUp={endOverlayDrag}
                onPointerCancel={endOverlayDrag}
                style={{
                  transform: `translate(${transform.translateX * 100}%, ${
                    (transform.translateY + transform.verticalOffset) * 100
                  }%) rotate(${transform.rotation}deg) scale(${
                    transform.flipHorizontal ? -transform.scale : transform.scale
                  }, ${transform.scale})`,
                }}
              >
                <Overlay mode={overlayMode} opacity={opacity / 100} />
              </div>
            ) : null}
            {cameraState !== "ready" ? (
              <div className="camera-empty">
                <strong>{permissionLabel}</strong>
                <span>{cameraError || "Start the camera to align the overlay."}</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="basketball-card">
          <div className="section-title">
            <span>2</span>
            <h2>Overlay Controls</h2>
          </div>

          <div className="mode-grid">
            {modeOptions.map((mode) => (
              <button
                key={mode}
                className={overlayMode === mode ? "selected" : ""}
                type="button"
                onClick={() => {
                  setOverlayMode(mode);
                  markOverlayUnsaved();
                }}
              >
                {overlayModeLabels[mode]}
              </button>
            ))}
          </div>

          <label>
            Opacity
            <input
              aria-label="Overlay opacity"
              max="100"
              min="15"
              type="range"
              value={opacity}
              onChange={(event) => {
                setOpacity(Number(event.target.value));
                markOverlayUnsaved();
              }}
            />
          </label>

          <div className="button-row">
            <button
              type="button"
              onClick={() => {
                setOverlayVisible((visible) => !visible);
                markOverlayUnsaved();
              }}
            >
              {overlayVisible ? "Hide Overlay" : "Show Overlay"}
            </button>
            <button type="button" onClick={resetOverlay}>
              Reset Overlay
            </button>
          </div>

          <button className="primary-button" type="button" onClick={saveOverlay} disabled={!session}>
            {saveState === "saving" ? "Saving..." : "Save Overlay Setup"}
          </button>
        </section>

        <BasketballOverlayCalibration
          calibration={calibration}
          opacity={opacity}
          transform={transform}
          onCalibrationChange={updateCalibration}
          onOpacityChange={(nextOpacity) => {
            setOpacity(nextOpacity);
            markOverlayUnsaved();
          }}
          onReset={resetOverlay}
          onSave={saveOverlay}
          onTransformChange={updateTransform}
          saveDisabled={!session}
          saveState={saveState}
        />

        <details className="workflow-details">
          <summary>Recording</summary>
          <BasketballCameraRecorder
            activeOverlayConfig={lastSavedConfig}
            activeRecording={activeRecording}
            cameraReady={cameraState === "ready"}
            onStart={startRecording}
            onStop={stopRecording}
            recordingError={recordingError}
            recordingSeconds={recordingSeconds}
            recordingState={recordingState}
            recordings={recordings}
            session={session}
          />
        </details>

        <details className="workflow-details">
          <summary>Review suggested moments</summary>
          <BasketballAIEventReview session={session} />
        </details>

        <details className="workflow-details">
          <summary>Teaching reference</summary>
          <BasketballPlayerLookup />
        </details>

        <section className="status-panel">
          <StatusLine label="Active session" value={session ? session.title : "Not started"} />
          <StatusLine label="Camera" value={cameraState === "ready" ? "ready" : "not ready"} />
          <StatusLine label="Overlay mode" value={overlayModeLabels[overlayMode]} />
          <StatusLine
            label="Overlay setup"
            value={
              saveState === "saved"
                ? lastSavedConfig?.persisted
                  ? "saved"
                  : "saved locally"
                : saveState === "error"
                  ? "save failed"
                  : "unsaved"
            }
          />
          <StatusLine
            label="Recording"
            value={recordingState === "recording" ? "recording" : recordingState}
          />
        </section>
      </section>
    </main>
  );
}

function BasketballCameraRecorder({
  activeOverlayConfig,
  activeRecording,
  cameraReady,
  recordingError,
  recordings,
  recordingSeconds,
  recordingState,
  session,
  onStart,
  onStop,
}: {
  activeOverlayConfig: BasketballOverlayConfig | null;
  activeRecording: BasketballRecording | null;
  cameraReady: boolean;
  recordingError: string;
  recordings: BasketballRecording[];
  recordingSeconds: number;
  recordingState: RecordingState;
  session: BasketballSession | null;
  onStart: () => void;
  onStop: () => void;
}) {
  const canStart = Boolean(session && cameraReady && recordingState !== "recording" && recordingState !== "starting");
  const isRecording = recordingState === "recording" || recordingState === "stopping";

  return (
    <section className="basketball-card recorder-card">
      <div className="section-title">
        <span>4</span>
        <h2>Record</h2>
      </div>

      <div className="recording-meter">
        <span>{recordingState}</span>
        <strong>{formatRecordingTime(recordingSeconds)}</strong>
      </div>

      <div className="button-row">
        <button type="button" onClick={onStart} disabled={!canStart || isRecording}>
          Start Recording
        </button>
        <button type="button" onClick={onStop} disabled={!isRecording}>
          Stop Recording
        </button>
      </div>

      <p className="calibration-note">
        Overlay setup: {activeOverlayConfig ? "saved for this recording" : "save on start"}
      </p>
      {recordingError ? <p className="error-text">{recordingError}</p> : null}

      {activeRecording?.localBlobUrl ? (
        <video className="recording-preview" controls src={activeRecording.localBlobUrl} />
      ) : null}

      {recordings.length ? (
        <div className="recording-list">
          {recordings.slice(0, 3).map((recording) => (
            <div key={recording.id}>
              <strong>{formatRecordingTime(recording.durationSeconds || 0)}</strong>
              <span>{recording.overlayConfigId}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function getSupportedRecordingMimeType() {
  const types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function formatRecordingTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function BasketballOverlayCalibration({
  calibration,
  opacity,
  transform,
  saveDisabled,
  saveState,
  onCalibrationChange,
  onOpacityChange,
  onReset,
  onSave,
  onTransformChange,
}: {
  calibration: BasketballOverlayCalibration;
  opacity: number;
  transform: BasketballOverlayTransform;
  saveDisabled: boolean;
  saveState: SaveState;
  onCalibrationChange: (nextCalibration: Partial<BasketballOverlayCalibration>) => void;
  onOpacityChange: (nextOpacity: number) => void;
  onReset: () => void;
  onSave: () => void;
  onTransformChange: (nextTransform: Partial<BasketballOverlayTransform>) => void;
}) {
  return (
    <section className="basketball-card calibration-card">
      <div className="section-title">
        <span>3</span>
        <h2>Calibration</h2>
      </div>

      <p className="calibration-note">
        Align the overlay to the live court. Axis will use this court context later.
      </p>

      <div className="preset-row">
        {courtSidePresets.map((preset) => (
          <button
            key={preset}
            className={calibration.courtSidePreset === preset ? "selected" : ""}
            type="button"
            onClick={() => onCalibrationChange({ courtSidePreset: preset })}
          >
            {courtSidePresetLabels[preset]}
          </button>
        ))}
      </div>

      <div className="calibration-grid">
        <label>
          Scale
          <input
            max="180"
            min="55"
            type="range"
            value={Math.round(transform.scale * 100)}
            onChange={(event) =>
              onTransformChange({ scale: Number(event.target.value) / 100 })
            }
          />
        </label>

        <label>
          Rotate
          <input
            max="35"
            min="-35"
            type="range"
            value={transform.rotation}
            onChange={(event) => onTransformChange({ rotation: Number(event.target.value) })}
          />
        </label>

        <label>
          Vertical offset
          <input
            max="35"
            min="-35"
            type="range"
            value={Math.round(transform.verticalOffset * 100)}
            onChange={(event) =>
              onTransformChange({ verticalOffset: Number(event.target.value) / 100 })
            }
          />
        </label>

        <label>
          Opacity
          <input
            max="100"
            min="15"
            type="range"
            value={opacity}
            onChange={(event) => onOpacityChange(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="button-row">
        <button type="button" onClick={() => onTransformChange({ flipHorizontal: !transform.flipHorizontal })}>
          {transform.flipHorizontal ? "Unflip" : "Flip"}
        </button>
        <button type="button" onClick={onReset}>
          Reset
        </button>
      </div>

      <button className="primary-button" type="button" onClick={onSave} disabled={saveDisabled}>
        {saveState === "saving" ? "Saving..." : "Save Calibration"}
      </button>
    </section>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Overlay({ mode, opacity }: { mode: BasketballOverlayMode; opacity: number }) {
  return (
    <svg
      aria-label={`${overlayModeLabels[mode]} overlay`}
      className="overlay-layer"
      role="img"
      viewBox="0 0 100 100"
      style={{ opacity }}
    >
      <CourtBase />
      {mode === "court-zones" ? <CourtZones /> : null}
      {mode === "delta-offense" ? <DeltaOffense /> : null}
      {mode === "shot-chart" ? <ShotChart /> : null}
      {mode === "spacing-shapes" ? <SpacingShapes /> : null}
    </svg>
  );
}

function CourtBase() {
  return (
    <g className="court-base">
      <rect x="4" y="5" width="92" height="90" rx="2" />
      <line x1="4" y1="50" x2="96" y2="50" />
      <circle cx="50" cy="12" r="4" />
      <path d="M34 5v25h32V5" />
      <path d="M28 30a22 22 0 0 0 44 0" />
      <path d="M18 5a32 32 0 0 0 64 0" />
    </g>
  );
}

function CourtZones() {
  return (
    <g className="zone-overlay">
      <rect x="36" y="5" width="28" height="25" />
      <circle cx="39" cy="34" r="4" />
      <circle cx="61" cy="34" r="4" />
      <circle cx="25" cy="64" r="4" />
      <circle cx="75" cy="64" r="4" />
      <circle cx="12" cy="84" r="4" />
      <circle cx="88" cy="84" r="4" />
      <circle cx="36" cy="20" r="3" />
      <circle cx="64" cy="20" r="3" />
      <circle cx="50" cy="82" r="4" />
      <text x="50" y="19">rim</text>
      <text x="50" y="43">paint</text>
      <text x="25" y="72">wing</text>
      <text x="75" y="72">wing</text>
      <text x="50" y="92">top</text>
    </g>
  );
}

function DeltaOffense() {
  return (
    <g className="delta-overlay">
      <Marker x={50} y={78} label="Top / get" tone="green" />
      <Marker x={36} y={34} label="Elbow" tone="yellow" />
      <Marker x={12} y={84} label="Corner DHO" tone="green" />
      <Marker x={64} y={22} label="PnR setter" tone="red" />
      <Marker x={88} y={84} label="Spacer" tone="yellow" />
      <path d="M50 78 36 34 12 84" />
      <path d="M64 22 88 84" />
    </g>
  );
}

function ShotChart() {
  return (
    <g className="shot-overlay">
      <circle cx="50" cy="13" r="7" />
      <rect x="34" y="5" width="32" height="28" />
      <path d="M24 35a32 32 0 0 0 52 0" />
      <path d="M7 5a43 43 0 0 0 86 0" />
      <circle cx="14" cy="76" r="5" />
      <circle cx="86" cy="76" r="5" />
      <circle cx="26" cy="55" r="5" />
      <circle cx="74" cy="55" r="5" />
      <circle cx="50" cy="73" r="5" />
      <text x="50" y="24">rim</text>
      <text x="50" y="44">paint</text>
      <text x="50" y="88">top 3</text>
    </g>
  );
}

function SpacingShapes() {
  return (
    <g className="spacing-overlay">
      <Marker x={50} y={78} label="5" />
      <Marker x={24} y={60} label="out" />
      <Marker x={76} y={60} label="out" />
      <Marker x={12} y={84} label="corner" />
      <Marker x={88} y={84} label="corner" />
      <path d="M12 84 50 35 88 84Z" />
      <path d="M34 35h32" />
      <path d="M25 20v45" />
      <path d="M75 20v45" />
      <text x="50" y="52">triangle</text>
      <text x="50" y="68">horns / lanes</text>
    </g>
  );
}

function Marker({
  x,
  y,
  label,
  tone,
}: {
  x: number;
  y: number;
  label: string;
  tone?: "green" | "yellow" | "red";
}) {
  return (
    <g className={tone ? `priority ${tone}` : "priority"}>
      <circle cx={x} cy={y} r="4" />
      <text x={x} y={y - 7}>
        {label}
      </text>
    </g>
  );
}
