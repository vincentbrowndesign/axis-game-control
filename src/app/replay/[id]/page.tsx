"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AxisAnimationPlayer } from "../../../components/AxisAnimationPlayer";
import {
  exportProduct,
  getAxisProduct,
  getCachedVideoUrl,
  getMuxStreamUrl,
  type AxisProduct,
} from "../../../lib/axis-cloud-store";
import type { AnimationFact, AnimationTrack } from "../../../lib/axis-animation-renderer";

type FactsResponse = { records?: AnimationFact[] };
type TracksResponse = { records?: AnimationTrack[] };

export default function TacticalReplayPage() {
  const { id } = useParams<{ id: string }>();
  const [facts, setFacts] = useState<AnimationFact[] | null>(null);
  const [product, setProduct] = useState<AxisProduct | null>(null);
  const [tracks, setTracks] = useState<AnimationTrack[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    const storedProduct = getAxisProduct(id);
    const uploadId = storedProduct?.assetIds[0] ?? normalizeReplayUploadId(id);
    setProduct(storedProduct);

    const cachedUrl = uploadId ? getCachedVideoUrl(uploadId) : null;
    if (cachedUrl) {
      setVideoUrl(cachedUrl);
    } else if (storedProduct?.muxPlaybackId) {
      setVideoUrl(getMuxStreamUrl(storedProduct.muxPlaybackId));
    }

    setFacts([]);
    setTracks([]);
    setStatus("ready");
    console.info("REPLAY_READY", { replayProductId: id, replay_upload_id: uploadId, uploadId });
    console.info("UI_POLLING_STOPPED", { reason: "replay_shell_ready" });

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4000);
    fetch(`/api/axis/facts?upload_id=${encodeURIComponent(uploadId)}&limit=20`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data: FactsResponse) => {
        const records = data.records ?? [];
        setFacts(records);
      })
      .catch(() => {
        setFacts([]);
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });
    fetch(`/api/axis/tracks?upload_id=${encodeURIComponent(uploadId)}&limit=1000`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data: TracksResponse) => {
        const records = data.records ?? [];
        console.info("REPLAY_TRACKS_READ", {
          first_track_point: records[0] ?? null,
          replay_upload_id: uploadId,
          tracks_read_count: records.length,
        });
        setTracks(records);
      })
      .catch(() => {
        console.info("REPLAY_TRACKS_READ", {
          first_track_point: null,
          replay_upload_id: uploadId,
          tracks_read_count: 0,
        });
        setTracks([]);
      });
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [id]);

  function handleReplaySaved() {
    if (product) exportProduct(product.id, "camera-roll");
  }

  if (status === "loading") {
    return (
      <ReplayShell eyebrow="Replay Video" title="Processing Video">
        <p className="axis-cloud-empty">Processing Video</p>
      </ReplayShell>
    );
  }

  return (
    <ReplayShell eyebrow="Replay Video" title={product?.title ?? "Replay Video"}>
      <AxisAnimationPlayer
        facts={facts ?? []}
        onReplaySaved={product ? handleReplaySaved : undefined}
        tracks={tracks}
        videoUrl={videoUrl}
      />
    </ReplayShell>
  );
}

function normalizeReplayUploadId(value: string) {
  return value.startsWith("replay-") ? value.slice("replay-".length) : value;
}

function ReplayShell({
  children,
  eyebrow,
  title,
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <main className="axis-cloud axis-replay-page">
      <header className="axis-cloud-header">
        <Link className="axis-cloud-mark" href="/">
          AXIS
        </Link>
        <div>
          <p>{eyebrow}</p>
          <h1>{title}</h1>
        </div>
      </header>

      {children}

      <nav className="axis-cloud-nav" aria-label="Axis navigation">
        <Link href="/">Upload Another</Link>
      </nav>
    </main>
  );
}
