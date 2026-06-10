"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CalibrationState =
  | "IDLE"
  | "CAPTURING FRAME"
  | "FRAME CAPTURED"
  | "SENDING TO ROBOFLOW"
  | "ROBOFLOW RESPONSE RECEIVED"
  | "NO ATHLETE DETECTED"
  | "ONE ATHLETE REQUIRED"
  | "CALIBRATION READY"
  | "CALIBRATED"
  | "ROBOFLOW REQUEST FAILED"
  | "ROBOFLOW RESPONSE INVALID"
  | "CAMERA NOT READY";

type CameraState = "CAMERA NOT READY" | "CAMERA READY" | "CAMERA REQUEST FAILED" | "STARTING CAMERA";

type PersonDetectionResponse = {
  detections?: unknown[];
  error?: string;
  visiblePeople?: number;
};

type CalibrationEvidence = {
  athlete_id: string;
  calibration_status: "CALIBRATED";
  camera_type: string;
  created_at: string;
  session_id: string;
};

const athletes = [
  { id: "athlete-1", name: "Athlete 1" },
  { id: "athlete-2", name: "Athlete 2" },
];

export default function CapturePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionId = useMemo(() => `session-${Date.now()}`, []);
  const [activeAthleteId, setActiveAthleteId] = useState(athletes[0]?.id ?? "athlete-1");
  const [cameraState, setCameraState] = useState<CameraState>("STARTING CAMERA");
  const [calibrationEvidence, setCalibrationEvidence] = useState<CalibrationEvidence | null>(null);
  const [calibrationState, setCalibrationState] = useState<CalibrationState>("IDLE");
  const [detectionsCount, setDetectionsCount] = useState(0);
  const [visiblePeople, setVisiblePeople] = useState(0);

  const activeAthlete = athletes.find((athlete) => athlete.id === activeAthleteId) ?? athletes[0];
  const calibrationReady = calibrationState === "CALIBRATION READY";

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState("CAMERA REQUEST FAILED");
        return;
      }

      try {
        setCameraState("STARTING CAMERA");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "environment",
          },
        });
        if (cancelled) {
          stopStream(stream);
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraState("CAMERA READY");
      } catch (error) {
        console.error("CAMERA_REQUEST_FAILED", serializeError(error));
        setCameraState("CAMERA REQUEST FAILED");
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, []);

  async function captureCameraFrame() {
    const video = videoRef.current;
    const width = video?.videoWidth ?? 0;
    const height = video?.videoHeight ?? 0;

    if (!video || width <= 0 || height <= 0) {
      setCameraState("CAMERA NOT READY");
      setCalibrationState("CAMERA NOT READY");
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      setCalibrationState("CAMERA NOT READY");
      return null;
    }

    context.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.82);
  }

  async function startCameraCalibration() {
    setDetectionsCount(0);
    setVisiblePeople(0);
    setCalibrationEvidence(null);
    setCalibrationState("CAPTURING FRAME");

    const frame = await captureCameraFrame();
    if (!frame) return;

    setCalibrationState("FRAME CAPTURED");
    setCalibrationState("SENDING TO ROBOFLOW");

    let response: Response;
    try {
      response = await fetch("/api/roboflow/person-detection", {
        body: JSON.stringify({ image: frame }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
    } catch (error) {
      console.error("ROBOFLOW_PERSON_DETECTION_REQUEST_FAILED", serializeError(error));
      setCalibrationState("ROBOFLOW REQUEST FAILED");
      return;
    }

    const result = (await response.json().catch(() => null)) as PersonDetectionResponse | null;
    if (!response.ok) {
      console.error("ROBOFLOW_PERSON_DETECTION_RESPONSE_FAILED", {
        body: result,
        status: response.status,
      });
      setCalibrationState("ROBOFLOW REQUEST FAILED");
      return;
    }

    setCalibrationState("ROBOFLOW RESPONSE RECEIVED");

    if (!result || typeof result.visiblePeople !== "number" || !Array.isArray(result.detections)) {
      setCalibrationState("ROBOFLOW RESPONSE INVALID");
      return;
    }

    setVisiblePeople(result.visiblePeople);
    setDetectionsCount(result.detections.length);

    if (result.visiblePeople === 0) {
      setCalibrationState("NO ATHLETE DETECTED");
      return;
    }
    if (result.visiblePeople !== 1) {
      setCalibrationState("ONE ATHLETE REQUIRED");
      return;
    }

    setCalibrationState("CALIBRATION READY");
  }

  function captureCalibration() {
    if (!calibrationReady) return;

    const evidence: CalibrationEvidence = {
      athlete_id: activeAthleteId,
      calibration_status: "CALIBRATED",
      camera_type: "environment",
      created_at: new Date().toISOString(),
      session_id: sessionId,
    };

    setCalibrationEvidence(evidence);
    window.localStorage.setItem(`axis.calibration.${sessionId}.${activeAthleteId}`, JSON.stringify(evidence));
    setCalibrationState("CALIBRATED");
  }

  return (
    <main className="axis-calibration">
      <header>
        <span>AXIS</span>
        <strong>LIVE CAMERA</strong>
      </header>

      <section className="camera-stage" aria-label="Live camera">
        <video autoPlay muted playsInline ref={videoRef} />
      </section>

      <section className="calibration-panel" aria-label="Camera calibration">
        <label>
          <span>Active athlete</span>
          <select onChange={(event) => setActiveAthleteId(event.target.value)} value={activeAthleteId}>
            {athletes.map((athlete) => (
              <option key={athlete.id} value={athlete.id}>
                {athlete.name}
              </option>
            ))}
          </select>
        </label>

        <dl>
          <div>
            <dt>Camera state</dt>
            <dd>{cameraState}</dd>
          </div>
          <div>
            <dt>Calibration state</dt>
            <dd>{calibrationState}</dd>
          </div>
          <div>
            <dt>Visible people</dt>
            <dd>{visiblePeople}</dd>
          </div>
          <div>
            <dt>Detections</dt>
            <dd>{detectionsCount}</dd>
          </div>
        </dl>

        <button disabled={cameraState !== "CAMERA READY"} onClick={() => void startCameraCalibration()} type="button">
          START CALIBRATION
        </button>

        {calibrationReady ? (
          <button className="ready" onClick={captureCalibration} type="button">
            CAPTURE CALIBRATION
          </button>
        ) : null}

        {calibrationEvidence ? (
          <p>
            {activeAthlete?.name ?? "Athlete"} calibrated for {calibrationEvidence.session_id}.
          </p>
        ) : null}
      </section>

      <style jsx>{`
        .axis-calibration {
          min-height: 100dvh;
          background: #050505;
          color: #f5f5f0;
          display: grid;
          gap: 20px;
          grid-template-rows: auto minmax(280px, 1fr) auto;
          padding: 20px;
        }

        header {
          align-items: baseline;
          display: flex;
          justify-content: space-between;
          letter-spacing: 0;
          text-transform: uppercase;
        }

        header span {
          color: #b8ff3d;
          font-size: 13px;
          font-weight: 800;
        }

        header strong {
          font-size: 12px;
          font-weight: 700;
          opacity: 0.7;
        }

        .camera-stage {
          background: #111;
          border: 1px solid rgba(255, 255, 255, 0.12);
          display: grid;
          min-height: 280px;
          overflow: hidden;
          place-items: center;
        }

        video {
          height: 100%;
          max-height: 68dvh;
          object-fit: contain;
          width: 100%;
        }

        .calibration-panel {
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          display: grid;
          gap: 14px;
          padding-top: 18px;
        }

        label {
          display: grid;
          gap: 6px;
        }

        label span,
        dt {
          color: rgba(245, 245, 240, 0.54);
          font-size: 11px;
          letter-spacing: 0;
          text-transform: uppercase;
        }

        select,
        button {
          border-radius: 0;
          font: inherit;
        }

        select {
          background: #0f0f0f;
          border: 1px solid rgba(255, 255, 255, 0.18);
          color: #f5f5f0;
          padding: 12px;
        }

        dl {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin: 0;
        }

        dl div {
          display: grid;
          gap: 4px;
        }

        dd {
          font-size: 13px;
          font-weight: 750;
          margin: 0;
        }

        button {
          background: #f5f5f0;
          border: 0;
          color: #050505;
          cursor: pointer;
          font-size: 13px;
          font-weight: 850;
          padding: 15px 16px;
          text-transform: uppercase;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.4;
        }

        button.ready {
          background: #b8ff3d;
        }

        p {
          color: #b8ff3d;
          font-size: 13px;
          margin: 0;
        }
      `}</style>
    </main>
  );
}

function stopStream(stream: MediaStream) {
  for (const track of stream.getTracks()) track.stop();
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }
  return { error };
}
