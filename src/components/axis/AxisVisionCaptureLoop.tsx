"use client";

import { useEffect, useRef, useState } from "react";

type CameraState = "idle" | "starting" | "live" | "error";

export function AxisVisionCaptureLoop() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [message, setMessage] = useState("Vision Capture Loop");

  useEffect(() => () => stopCamera(), []);

  async function startCamera() {
    if (cameraState === "starting" || cameraState === "live") return;
    setCameraState("starting");
    setMessage("Starting rear camera");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          height: { ideal: 720 },
          width: { ideal: 1280 },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Camera view is unavailable.");
      video.srcObject = stream;
      await video.play();
      setCameraState("live");
      setMessage("Live video feed");
    } catch {
      setCameraState("error");
      setMessage("Camera permission or device access failed.");
      stopCamera();
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState("idle");
  }

  return (
    <main className="axis-vision-capture">
      <section className="axis-vision-capture__stage" aria-label="Axis Vision Capture Loop">
        <video ref={videoRef} autoPlay className="axis-vision-capture__video" muted playsInline />

        {cameraState !== "live" && (
          <div className="axis-vision-capture__empty">
            <p>Axis Vision</p>
            <h1>Vision Capture Loop</h1>
            <span>Rear camera to live video feed. No detection loop is active here.</span>
          </div>
        )}

        <header className="axis-vision-capture__top">
          <div>
            <strong>Axis Vision</strong>
            <span>{message}</span>
          </div>
        </header>

        <footer className="axis-vision-capture__bottom">
          <div>
            <span>Input</span>
            <strong>rear camera</strong>
          </div>
          <div>
            <span>Provider</span>
            <strong>browser camera</strong>
          </div>
          <div>
            <span>Dataset</span>
            <strong>session draft</strong>
          </div>
          {cameraState === "live" ? (
            <button type="button" onClick={stopCamera}>Stop</button>
          ) : (
            <button type="button" onClick={() => void startCamera()}>Start</button>
          )}
        </footer>
      </section>

      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
  .axis-vision-capture {
    background: #050706;
    color: #f7f4eb;
    min-height: 100dvh;
    overflow: hidden;
  }

  .axis-vision-capture__stage {
    background: #050706;
    min-height: 100dvh;
    position: relative;
  }

  .axis-vision-capture__video {
    height: 100dvh;
    inset: 0;
    object-fit: cover;
    position: absolute;
    width: 100%;
    z-index: 1;
  }

  .axis-vision-capture__empty {
    align-content: center;
    background: #050706;
    display: grid;
    gap: 0.75rem;
    inset: 0;
    justify-items: start;
    padding: 1.2rem;
    position: absolute;
    z-index: 2;
  }

  .axis-vision-capture__empty p,
  .axis-vision-capture__top span,
  .axis-vision-capture__bottom span {
    color: rgba(247, 244, 235, 0.62);
    font-size: 0.68rem;
    font-weight: 850;
    letter-spacing: 0.1em;
    margin: 0;
    text-transform: uppercase;
  }

  .axis-vision-capture__empty h1 {
    font-size: clamp(2.4rem, 12vw, 5.5rem);
    letter-spacing: 0;
    line-height: 0.92;
    margin: 0;
  }

  .axis-vision-capture__empty span {
    color: rgba(247, 244, 235, 0.72);
  }

  .axis-vision-capture__top,
  .axis-vision-capture__bottom {
    backdrop-filter: blur(18px);
    background: rgba(5, 7, 6, 0.54);
    border: 1px solid rgba(247, 244, 235, 0.12);
    border-radius: 0.5rem;
    position: absolute;
    z-index: 3;
  }

  .axis-vision-capture__top {
    left: 0.75rem;
    padding: 0.65rem 0.75rem;
    right: 0.75rem;
    top: max(0.75rem, env(safe-area-inset-top));
  }

  .axis-vision-capture__top div {
    display: grid;
    gap: 0.15rem;
  }

  .axis-vision-capture__bottom {
    align-items: center;
    bottom: max(0.75rem, env(safe-area-inset-bottom));
    display: grid;
    gap: 0.45rem;
    grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
    left: 0.75rem;
    padding: 0.55rem;
    right: 0.75rem;
  }

  .axis-vision-capture__bottom div {
    display: grid;
    gap: 0.08rem;
    min-width: 0;
  }

  .axis-vision-capture__bottom strong {
    font-size: 0.78rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .axis-vision-capture button {
    background: rgba(247, 244, 235, 0.92);
    border: 1px solid rgba(247, 244, 235, 0.18);
    border-radius: 999px;
    color: #050706;
    font: inherit;
    font-size: 0.8rem;
    font-weight: 850;
    min-height: 3rem;
    min-width: 4.6rem;
    padding: 0 0.95rem;
  }

  @media (max-width: 640px) {
    .axis-vision-capture__bottom {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .axis-vision-capture__bottom button {
      grid-column: 1 / -1;
      width: 100%;
    }
  }
`;
