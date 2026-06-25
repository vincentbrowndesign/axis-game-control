"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CameraStatus = "ready" | "live" | "stopped" | "error";

export function AxisVisionCaptureLoop() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("ready");
  const [errorMessage, setErrorMessage] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stopTracks(), [stopTracks]);

  async function startCamera() {
    if (isStarting || cameraStatus === "live") return;
    setIsStarting(true);
    setErrorMessage("");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera is not available in this browser.");
      }

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
      setCameraStatus("live");
    } catch (error) {
      stopTracks();
      setCameraStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Camera permission or device access failed.");
    } finally {
      setIsStarting(false);
    }
  }

  function stopCamera() {
    stopTracks();
    setCameraStatus("stopped");
    setErrorMessage("");
  }

  return (
    <main className="axis-vision-capture">
      <section className="axis-vision-capture__stage" aria-label="Axis Vision Capture Loop">
        <video ref={videoRef} autoPlay className="axis-vision-capture__video" muted playsInline />

        {cameraStatus !== "live" && (
          <div className="axis-vision-capture__empty">
            <h1>Axis Vision</h1>
          </div>
        )}

        <header className="axis-vision-capture__top">
          <strong>Axis Vision</strong>
          <a href="/axis/space">Axis Space</a>
        </header>

        <footer className="axis-vision-capture__bottom">
          <div className="axis-vision-capture__status" aria-live="polite">
            <span>CAMERA: {cameraStatus}</span>
            {errorMessage && <p>{errorMessage}</p>}
          </div>
          {cameraStatus === "live" ? (
            <button type="button" onClick={stopCamera}>Stop Camera</button>
          ) : (
            <button type="button" disabled={isStarting} onClick={() => void startCamera()}>
              {isStarting ? "Starting Camera" : "Start Camera"}
            </button>
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
    inset: 0;
    justify-items: center;
    padding: 1.2rem;
    position: absolute;
    z-index: 2;
  }

  .axis-vision-capture__empty h1 {
    font-size: clamp(2.2rem, 10vw, 4.8rem);
    letter-spacing: 0;
    line-height: 1;
    margin: 0;
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
    align-items: center;
    display: flex;
    justify-content: space-between;
    left: 0.75rem;
    padding: 0.65rem 0.75rem;
    right: 0.75rem;
    top: max(0.75rem, env(safe-area-inset-top));
  }

  .axis-vision-capture__top a {
    color: rgba(247, 244, 235, 0.68);
    font-size: 0.78rem;
    font-weight: 800;
    text-decoration: none;
  }

  .axis-vision-capture__bottom {
    align-items: center;
    bottom: max(0.75rem, env(safe-area-inset-bottom));
    display: flex;
    gap: 0.75rem;
    justify-content: space-between;
    left: 0.75rem;
    padding: 0.65rem;
    right: 0.75rem;
  }

  .axis-vision-capture__status {
    display: grid;
    gap: 0.2rem;
    min-width: 0;
  }

  .axis-vision-capture__status span {
    color: rgba(247, 244, 235, 0.82);
    font-size: 0.78rem;
    font-weight: 850;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .axis-vision-capture__status p {
    color: rgba(247, 244, 235, 0.74);
    font-size: 0.82rem;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
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

  .axis-vision-capture button:disabled {
    opacity: 0.7;
  }

  @media (max-width: 640px) {
    .axis-vision-capture__bottom {
      align-items: stretch;
      flex-direction: column;
    }

    .axis-vision-capture__bottom button {
      width: 100%;
    }
  }
`;
