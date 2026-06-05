"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AxisAnimationPlayer } from "./AxisAnimationPlayer";
import type { AnimationFact, AnimationTrack } from "../lib/axis-animation-renderer";
import { getMuxStreamUrl } from "../lib/axis-cloud-store";

type ReplayStatus = "idle" | "uploading" | "processing" | "ready" | "failed";

type DecodeResponse = {
  facts?: AnimationFact[];
  tracks?: AnimationTrack[];
  upload_id?: string;
};

type DatasetExportResponse = {
  download_dataset_url?: string;
  frame_count?: number;
  frames_dir?: string;
};

function getBallTrackCount(tracks: AnimationTrack[] | undefined) {
  return tracks?.filter((track) => track.entity_type === "ball").length ?? 0;
}

function getPlayerTrackCount(tracks: AnimationTrack[] | undefined) {
  return tracks?.filter((track) => track.entity_type === "player").length ?? 0;
}

async function uploadToMux(file: File): Promise<{ muxPlaybackId?: string; thumbnailUrl?: string; uploadId: string }> {
  console.info("EXPORT_START", { fileName: file.name, status: "DISABLED" });
  throw new Error("SERVER_VIDEO_UPLOAD_DISABLED");
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
  const [datasetExportState, setDatasetExportState] = useState<"idle" | "exporting" | "ready" | "failed">("idle");
  const [datasetFrameCount, setDatasetFrameCount] = useState<number | null>(null);
  const [muxPlaybackId, setMuxPlaybackId] = useState<string | null>(null);
  const [playbackVideoUrl, setPlaybackVideoUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeBlobRef = useRef<string | null>(null);

  const resetForUpload = useCallback(() => {
    setFacts([]);
    setTracks([]);
    setDatasetExportState("idle");
    setDatasetFrameCount(null);
    setMuxPlaybackId(null);
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
    setDatasetExportState("idle");
    setDatasetFrameCount(null);
    setMuxPlaybackId(null);
    setStatus("uploading");

    try {
      const film = await uploadToMux(file);
      const muxVideoUrl = film.muxPlaybackId ? getMuxStreamUrl(film.muxPlaybackId) : undefined;
      setMuxPlaybackId(film.muxPlaybackId ?? null);
      setThumbnailUrl(film.thumbnailUrl ?? null);
      if (muxVideoUrl) setPlaybackVideoUrl(muxVideoUrl);

      setStatus("processing");
      const decoded = await decodeVideo({
        muxPlaybackId: film.muxPlaybackId,
        uploadId: film.uploadId,
        videoUrl: muxVideoUrl,
      });
      const storedUploadId = decoded?.upload_id ?? film.uploadId;
      if (Array.isArray(decoded?.facts)) setFacts(decoded.facts);
      const decodedTracks = Array.isArray(decoded?.tracks) ? decoded.tracks : [];
      console.info("REPLAY_BALL_TRACK_COUNT", {
        count: getBallTrackCount(decodedTracks),
        processed_upload_id: storedUploadId,
        source: "decode_response",
        uploadId: film.uploadId,
      });
      console.info("REPLAY_PLAYER_TRACK_COUNT", {
        count: getPlayerTrackCount(decodedTracks),
        processed_upload_id: storedUploadId,
        source: "decode_response",
        uploadId: film.uploadId,
      });
      setTracks(decodedTracks);
      setStatus("ready");
      console.info("REPLAY_READY", {
        processed_upload_id: storedUploadId,
        player_tracks_count: getPlayerTrackCount(decodedTracks),
        props_tracks_count: decodedTracks.length,
        uploadId: film.uploadId,
      });
    } catch (error) {
      console.error("Replay processing failed", error);
      setStatus("failed");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const hasVideo = Boolean(localVideoUrl);
  const shownVideoUrl = playbackVideoUrl ?? localVideoUrl;
  const datasetButtonText =
    datasetExportState === "exporting"
      ? "Exporting Frames..."
      : datasetExportState === "ready" && datasetFrameCount
        ? `Download Dataset (${datasetFrameCount})`
        : datasetExportState === "failed"
          ? "Export Failed"
          : "Export Frames";
  const statusText: Record<ReplayStatus, string> = {
    failed: "Replay export failed",
    idle: "Upload Video",
    processing: "Processing replay...",
    ready: "Replay Ready",
    uploading: "Uploading video...",
  };

  async function handleDatasetExport() {
    if (!muxPlaybackId || datasetExportState === "exporting") return;
    setDatasetExportState("exporting");
    setDatasetFrameCount(null);

    try {
      const response = await fetch("/api/axis/dataset-builder", {
        body: JSON.stringify({
          muxPlaybackId,
          sampleEverySeconds: 0.25,
          targetFrameCount: 300,
          videoId: muxPlaybackId,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error("Dataset export unavailable.");
      const dataset = (await response.json().catch(() => null)) as DatasetExportResponse | null;
      if (!dataset?.download_dataset_url) throw new Error("Dataset download unavailable.");
      setDatasetFrameCount(dataset.frame_count ?? null);
      setDatasetExportState("ready");
      window.location.href = dataset.download_dataset_url;
    } catch (error) {
      console.error("Dataset export failed", error);
      setDatasetExportState("failed");
    }
  }

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
          <>
            {muxPlaybackId ? (
              <button
                className="axis-cloud-secondary"
                disabled={datasetExportState === "exporting"}
                onClick={() => void handleDatasetExport()}
                type="button"
              >
                {datasetButtonText}
              </button>
            ) : null}
            <button className="axis-cloud-secondary" onClick={resetForUpload} type="button">
              Upload Another
            </button>
          </>
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
