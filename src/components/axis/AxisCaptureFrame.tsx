"use client";

import { useRef, useState } from "react";

type CaptureMode = "camera" | "upload";

type Props = {
  onFrame?: (dataUrl: string) => void;
  overlayActive?: boolean;
};

export function AxisCaptureFrame({ onFrame, overlayActive = false }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [mode, setMode] = useState<CaptureMode>("camera");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [uploadedSrc, setUploadedSrc] = useState<string | null>(null);

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setCameraError(name === "NotAllowedError" ? "Camera permission denied." : "Camera unavailable.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }

  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    onFrame?.(dataUrl);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      setUploadedSrc(src);
      onFrame?.(src);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="axis-capture-frame">
      <div className="axis-capture-mode-tabs">
        <button
          type="button"
          className={mode === "camera" ? "axis-tab axis-tab--active" : "axis-tab"}
          onClick={() => { setMode("camera"); setUploadedSrc(null); stopCamera(); }}
        >
          Camera
        </button>
        <button
          type="button"
          className={mode === "upload" ? "axis-tab axis-tab--active" : "axis-tab"}
          onClick={() => { setMode("upload"); stopCamera(); }}
        >
          Upload
        </button>
      </div>

      <div className="axis-capture-viewport">
        {mode === "camera" && (
          <>
            <video ref={videoRef} autoPlay muted playsInline className="axis-capture-video" />
            {overlayActive && (
              <div className="axis-skeleton-overlay" aria-hidden="true">
                <div className="axis-floor-line" />
              </div>
            )}
            {cameraError && <p className="axis-capture-error">{cameraError}</p>}
            {!cameraActive && !cameraError && (
              <div className="axis-capture-idle">
                <span>Camera off</span>
              </div>
            )}
          </>
        )}

        {mode === "upload" && (
          <>
            {uploadedSrc ? (
              <img src={uploadedSrc} alt="Uploaded frame" className="axis-capture-upload-preview" />
            ) : (
              <div className="axis-capture-idle">
                <span>No frame uploaded</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="axis-capture-controls">
        {mode === "camera" && (
          <>
            {!cameraActive ? (
              <button type="button" className="axis-btn axis-btn--primary" onClick={() => void startCamera()}>
                Turn On Camera
              </button>
            ) : (
              <>
                <button type="button" className="axis-btn" onClick={stopCamera}>Stop</button>
                <button type="button" className="axis-btn axis-btn--primary" onClick={captureFrame}>Capture Frame</button>
              </>
            )}
          </>
        )}

        {mode === "upload" && (
          <>
            <button type="button" className="axis-btn axis-btn--primary" onClick={() => fileInputRef.current?.click()}>
              {uploadedSrc ? "Replace Frame" : "Upload Frame"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              hidden
              onChange={handleFileChange}
            />
          </>
        )}
      </div>

      <canvas ref={canvasRef} hidden />
    </div>
  );
}
