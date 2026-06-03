"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as tus from "tus-js-client";
import { AxisAnimationPlayer } from "./AxisAnimationPlayer";
import type { AnimationFact, AnimationTrack } from "../lib/axis-animation-renderer";
import { getMuxStreamUrl } from "../lib/axis-cloud-store";

type ReplayStatus = "idle" | "uploading" | "processing" | "ready" | "failed";

type DecodeResponse = {
  facts?: AnimationFact[];
  tracks?: AnimationTrack[];
};

function uploadVideoWithTus(uploadUrl: string, file: File) {
  return new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: uploadUrl,
      onError: reject,
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}

async function uploadToMux(file: File) {
  const uploadResponse = await fetch("/api/film/uploads", { method: "POST" });
  const upload = (await uploadResponse.json().catch(() => null)) as
    | { uploadId?: string; uploadUrl?: string }
    | null;

  if (!uploadResponse.ok || !upload?.uploadId || !upload.uploadUrl) {
    throw new Error("Upload endpoint unavailable.");
  }

  await uploadVideoWithTus(upload.uploadUrl, file);
  console.info("UPLOAD_COMPLETE", { uploadId: upload.uploadId });

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await fetch(`/api/film/uploads/${upload.uploadId}`);
    const film = (await response.json().catch(() => null)) as
      | { playbackId?: string; thumbnailUrl?: string; ready?: boolean }
      | null;

    if (response.ok && film?.ready) {
      console.info("MUX_READY", { playbackId: film.playbackId, status: "PASS", uploadId: upload.uploadId });
      return { muxPlaybackId: film.playbackId, thumbnailUrl: film.thumbnailUrl, uploadId: upload.uploadId };
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  console.info("MUX_READY", { reason: "Mux polling exhausted", status: "FAIL", uploadId: upload.uploadId });
  return { uploadId: upload.uploadId };
}

async function decodeVideo({
  muxPlaybackId,
  uploadId,
  videoUrl,
}: {
  muxPlaybackId?: string;
  uploadId: string;
  videoUrl?: string;
}) {
  const response = await fetch("/api/axis/decode-video", {
    body: JSON.stringify({
      muxPlaybackId,
      sourceClipCount: 1,
      uploadId,
      videoUrl,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new Error("Decode endpoint unavailable.");
  return (await response.json().catch(() => null)) as DecodeResponse | null;
}

export function FirstLoopHome() {
  const [status, setStatus] = useState<ReplayStatus>("idle");
  const [facts, setFacts] = useState<AnimationFact[]>([]);
  const [tracks, setTracks] = useState<AnimationTrack[]>([]);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [playbackVideoUrl, setPlaybackVideoUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeBlobRef = useRef<string | null>(null);

  const resetForUpload = useCallback(() => {
    setFacts([]);
    setTracks([]);
    setThumbnailUrl(null);
    setStatus("idle");
    setPlaybackVideoUrl(null);
    if (activeBlobRef.current) URL.revokeObjectURL(activeBlobRef.current);
    activeBlobRef.current = null;
    setLocalVideoUrl(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  useEffect(() => {
    return () => {
      if (activeBlobRef.current) URL.revokeObjectURL(activeBlobRef.current);
    };
  }, []);

  async function handleFile(file: File) {
    if (activeBlobRef.current) URL.revokeObjectURL(activeBlobRef.current);
    const blobUrl = URL.createObjectURL(file);
    activeBlobRef.current = blobUrl;
    setLocalVideoUrl(blobUrl);
    setPlaybackVideoUrl(blobUrl);
    setThumbnailUrl(null);
    setFacts([]);
    setTracks([]);
    setStatus("uploading");

    try {
      const film = await uploadToMux(file);
      const muxVideoUrl = film.muxPlaybackId ? getMuxStreamUrl(film.muxPlaybackId) : undefined;
      setThumbnailUrl(film.thumbnailUrl ?? null);
      if (muxVideoUrl) setPlaybackVideoUrl(muxVideoUrl);

      setStatus("processing");
      const decoded = await decodeVideo({
        muxPlaybackId: film.muxPlaybackId,
        uploadId: film.uploadId,
        videoUrl: muxVideoUrl,
      });
      if (Array.isArray(decoded?.facts)) setFacts(decoded.facts);
      if (Array.isArray(decoded?.tracks)) setTracks(decoded.tracks);
      setStatus("ready");
      console.info("REPLAY_READY", { uploadId: film.uploadId });
    } catch (error) {
      console.error("Replay processing failed", error);
      setStatus("failed");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const hasVideo = Boolean(localVideoUrl);
  const shownVideoUrl = playbackVideoUrl ?? localVideoUrl;
  const statusText: Record<ReplayStatus, string> = {
    failed: "Replay export failed",
    idle: "Upload Video",
    processing: "Processing replay...",
    ready: "Replay Ready",
    uploading: "Uploading video...",
  };

  return (
    <main className="axis-replay-loop" data-state={status}>
      <header className="axis-replay-loop-header">
        <span>AXIS</span>
        <strong>{statusText[status]}</strong>
      </header>

      <section className="axis-replay-loop-stage" aria-label="Video replay">
        {hasVideo ? (
          <AxisAnimationPlayer
            facts={facts}
            replayStatus={status === "ready" ? "ready" : status === "failed" ? "failed" : "processing"}
            thumbnailUrl={thumbnailUrl}
            tracks={tracks}
            videoUrl={shownVideoUrl}
          />
        ) : (
          <button
            className="axis-replay-upload-empty"
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            Upload Video
          </button>
        )}
      </section>

      <div className="axis-replay-loop-actions">
        {status === "failed" ? (
          <button className="axis-cloud-primary" onClick={() => inputRef.current?.click()} type="button">
            Try Again
          </button>
        ) : null}
        {status === "ready" ? (
          <button className="axis-cloud-secondary" onClick={resetForUpload} type="button">
            Upload Another
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        accept="video/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
        type="file"
      />
    </main>
  );
}
