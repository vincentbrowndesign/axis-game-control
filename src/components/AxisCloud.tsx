"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import * as tus from "tus-js-client";
import {
  cacheVideoUrl,
  createTacticalReplayProduct,
  createUploadedSessionAsset,
  exportProduct,
  formatExportDestination,
  getAxisProduct,
  getAxisProducts,
  getCachedVideoUrl,
  getMuxStreamUrl,
  getMuxThumbnailUrl,
  saveProductAsAsset,
  type AxisLoopArtifact,
  type AxisProduct,
  type ExportDestination,
} from "../lib/axis-cloud-store";
import { factsHaveReplayUnderstanding, type AnimationFact } from "../lib/axis-animation-renderer";

type UploadState = "idle" | "uploading" | "saving";

const cameraRollDestination: ExportDestination = "camera-roll";

function useCloudSnapshot() {
  const [products, setProducts] = useState<AxisProduct[]>([]);

  const refresh = useCallback(() => {
    setProducts(getAxisProducts());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { products, refresh };
}

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

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await fetch(`/api/film/uploads/${upload.uploadId}`);
    const film = (await response.json().catch(() => null)) as
      | { playbackId?: string; thumbnailUrl?: string; ready?: boolean }
      | null;

    if (response.ok && film?.ready) {
      return { muxPlaybackId: film.playbackId, thumbnailUrl: film.thumbnailUrl };
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  return {};
}

function Shell({
  children,
  eyebrow,
  title,
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <main className="axis-cloud">
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
        <Link href="/">Sources</Link>
        <Link href="/chat">Chat</Link>
        <Link href="/studio">Studio</Link>
      </nav>
    </main>
  );
}

type FirstLoopUnderstanding = {
  muxPlaybackId?: string;
  sourceClipCount: number;
  uploadId: string;
  uploadTimestamp: string;
  videoUrl?: string;
  whatWeFound: string;
};

type FirstLoopExportResponse = {
  export?: {
    content: string;
    contentType: string;
    destination: string;
    fileName: string;
    id: string;
    triggerRunId?: string | null;
  };
};

type FactsResponse = { records?: AnimationFact[] };

type SourcesStatus = "idle" | "uploading" | "processing" | "ready" | "no-understanding";

export function FirstLoopHome() {
  const { products, refresh } = useCloudSnapshot();
  const [status, setStatus] = useState<SourcesStatus>("idle");
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [replayProductId, setReplayProductId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function createReplayIfReady(
    uploadId: string,
    muxPlaybackId: string | undefined,
    whatWeFound: string,
  ) {
    const response = await fetch(
      `/api/axis/facts?upload_id=${encodeURIComponent(uploadId)}&limit=20`,
    );
    if (!response.ok) return "";

    const data = (await response.json().catch(() => null)) as FactsResponse | null;
    const records = data?.records ?? [];
    if (!factsHaveReplayUnderstanding(records)) return "";

    const replayProduct = createTacticalReplayProduct({ muxPlaybackId, uploadId, whatWeFound });
    refresh();
    return replayProduct.id;
  }

  async function handleFile(file: File) {
    // Show video immediately from local blob — no waiting for Mux
    const blobUrl = URL.createObjectURL(file);
    setLocalVideoUrl(blobUrl);
    setReplayProductId("");
    setStatus("uploading");

    try {
      const film = await uploadToMux(file);
      setStatus("processing");
      const assetId = createUploadedSessionAsset(file, film);

      // Cache blob URL so replay page can use it if Mux isn't ready yet
      cacheVideoUrl(assetId, blobUrl);

      const muxVideoUrl = film.muxPlaybackId
        ? getMuxStreamUrl(film.muxPlaybackId)
        : undefined;

      const response = await fetch("/api/axis/first-loop", {
        body: JSON.stringify({
          action: "understand",
          fileName: file.name,
          muxPlaybackId: film.muxPlaybackId,
          priorArtifacts: products.slice(0, 3).map((p) => p.finding ?? p.title),
          sessionId: assetId,
          sourceClipCount: 1,
          uploadId: assetId,
          uploadTimestamp: new Date().toISOString(),
          videoUrl: muxVideoUrl,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as FirstLoopUnderstanding | null;
      const whatWeFound =
        result?.whatWeFound ?? "Clip added. Axis read this footage.";

      const id = await createReplayIfReady(assetId, film.muxPlaybackId, whatWeFound);
      if (id) {
        setReplayProductId(id);
        setStatus("ready");
      } else {
        setStatus("no-understanding");
      }
    } catch {
      const assetId = createUploadedSessionAsset(file);
      cacheVideoUrl(assetId, blobUrl);
      const id = await createReplayIfReady(
        assetId,
        undefined,
        "Clip added from Camera Roll.",
      ).catch(() => "");
      setReplayProductId(id);
      setStatus(id ? "ready" : "no-understanding");
      refresh();
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const statusLabel: Record<SourcesStatus, string> = {
    idle: "Upload Footage",
    uploading: "Uploading",
    processing: "Reading Footage",
    ready: "Overlay Film Ready",
    "no-understanding": "Need Clearer Footage",
  };

  return (
    <main className="axis-cloud axis-sources">
      <header className="axis-sources-header">
        <span className="axis-cloud-mark">AXIS</span>
        <p className="axis-sources-status">{statusLabel[status]}</p>
      </header>

      {/* Video area — shows immediately after file selection */}
      {localVideoUrl ? (
        <div className="axis-source-video-wrap">
          <video
            className="axis-source-video"
            controls
            playsInline
            src={localVideoUrl}
          />

          {status === "ready" && replayProductId ? (
            <Link
              className="axis-replay-cta"
              href={`/replay/${replayProductId}`}
            >
              View Overlay Film
            </Link>
          ) : status === "no-understanding" ? (
            <p className="axis-source-caption">Need clearer footage for replay.</p>
          ) : (
            <p className="axis-source-caption axis-source-processing">
              {status === "uploading" ? "Uploading…" : "Reading footage…"}
            </p>
          )}
        </div>
      ) : (
        <div className="axis-source-empty">
          <p>Upload basketball footage to begin.</p>
        </div>
      )}

      {/* Upload trigger */}
      <div className="axis-source-upload">
        <button
          className="axis-cloud-primary"
          disabled={status === "uploading" || status === "processing"}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          {status === "idle" || status === "ready" || status === "no-understanding"
            ? "Upload"
            : status === "uploading"
              ? "Uploading"
              : "Reading"}
        </button>
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
      </div>

      <nav className="axis-cloud-nav" aria-label="Axis navigation">
        <Link href="/">Sources</Link>
        <Link href="/chat">Chat</Link>
        <Link href="/studio">Studio</Link>
      </nav>
    </main>
  );
}

export function ChatHistory() {
  const { products } = useCloudSnapshot();
  const sorted = [...products].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <Shell eyebrow="Chat" title="What we found">
      {sorted.length ? (
        <section className="axis-cloud-section">
          <div className="axis-chat-feed">
            {sorted.map((product) => (
              <article className="axis-chat-entry" key={product.id}>
                <span className="axis-chat-label">What do you see?</span>
                <p className="axis-chat-body">{product.finding ?? product.title}</p>
                {product.meaning ? (
                  <p className="axis-chat-body">{product.meaning}</p>
                ) : null}
                {product.action ? (
                  <p className="axis-chat-body axis-chat-action">{product.action}</p>
                ) : null}
                <Link className="axis-chat-link" href={`/replay/${product.id}`}>
                  View replay
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <p className="axis-cloud-empty">
          Upload footage in Sources. Understanding appears here.
        </p>
      )}
    </Shell>
  );
}

export function StudioList() {
  const { products } = useCloudSnapshot();
  const sorted = [...products].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <Shell eyebrow="Studio" title="Your Replays">
      {sorted.length ? (
        <section className="axis-cloud-section">
          <div className="axis-replay-grid">
            {sorted.map((product) => {
              const thumb = product.muxPlaybackId
                ? getMuxThumbnailUrl(product.muxPlaybackId)
                : null;
              const uploadId = product.assetIds[0];
              const cachedUrl = uploadId ? getCachedVideoUrl(uploadId) : null;

              return (
                <Link
                  className="axis-replay-card"
                  href={`/replay/${product.id}`}
                  key={product.id}
                >
                  <div className="axis-replay-thumb">
                    {thumb ? (
                      <img alt="" src={thumb} />
                    ) : cachedUrl ? (
                      <video muted playsInline preload="metadata" src={cachedUrl} />
                    ) : (
                      <div className="axis-replay-thumb-blank">
                        <span>&#9654;</span>
                      </div>
                    )}
                    <div className="axis-replay-play-icon" aria-hidden="true">&#9654;</div>
                  </div>
                  <div className="axis-replay-info">
                    <strong>{product.title}</strong>
                    <em>{product.exportDestination ? "Exported" : "Saved"}</em>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : (
        <p className="axis-cloud-empty">
          Upload footage in Sources to generate your first overlay film.
        </p>
      )}
    </Shell>
  );
}

export function ProductDetail({ productId }: { productId: string }) {
  const { refresh } = useCloudSnapshot();
  const [product, setProduct] = useState<AxisProduct | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const [shareState, setShareState] = useState<"idle" | "exported">("idle");
  const [supportsNativeShare, setSupportsNativeShare] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setProduct(getAxisProduct(productId));
  }, [productId]);

  useEffect(() => {
    setSupportsNativeShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    );
  }, []);

  if (!product) {
    return (
      <Shell eyebrow="Artifact" title="Not found">
        <Link className="axis-cloud-primary" href="/studio">
          Back to Studio
        </Link>
      </Shell>
    );
  }

  async function handleSave() {
    if (!product) return;
    await fetch("/api/axis/first-loop", {
      body: JSON.stringify({ action: "save", artifact: productToLoopArtifact(product) }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch(() => null);
    const record = saveProductAsAsset(product.id);
    if (!record) return;
    setSaveState("saved");
    refresh();
  }

  async function handleExport() {
    if (!product) return;
    const loopExport = await exportProductThroughLoop(product, "download");
    if (!loopExport) return;
    exportProduct(product.id, cameraRollDestination);
    downloadLoopExport(loopExport);
    setShareState("exported");
    refresh();
    router.push("/studio");
  }

  async function handleNativeShare() {
    if (!product || !supportsNativeShare) return;
    const loopExport = await exportProductThroughLoop(product, "native-share");
    if (!loopExport) return;
    exportProduct(product.id, cameraRollDestination);
    await shareLoopExport(loopExport);
    setShareState("exported");
    refresh();
    router.push("/studio");
  }

  return (
    <Shell eyebrow="Artifact" title={product.title}>
      {product.finding ? (
        <section className="axis-cloud-section">
          <div className="axis-cloud-row">
            <span>What We Found</span>
          </div>
          <p className="axis-product-body">{product.finding}</p>
        </section>
      ) : null}

      {product.meaning ? (
        <section className="axis-cloud-section">
          <div className="axis-cloud-row">
            <span>What It Means</span>
          </div>
          <p className="axis-product-body">{product.meaning}</p>
        </section>
      ) : null}

      {product.action ? (
        <section className="axis-cloud-section">
          <div className="axis-cloud-row">
            <span>What To Do Next</span>
          </div>
          <p className="axis-product-body">{product.action}</p>
        </section>
      ) : null}

      <section className="axis-cloud-panel">
        <div className="axis-product-actions">
          <button onClick={() => void handleSave()} type="button">
            {saveState === "saved" ? "Saved" : "Save"}
          </button>
          <Link href={`/replay/${productId}`}>View Replay</Link>
          <Link href="/studio">Studio</Link>
        </div>
      </section>

      <section className="axis-cloud-section">
        <div className="axis-cloud-row">
          <span>Export</span>
        </div>
        <div className="axis-create-grid">
          <button onClick={() => void handleExport()} type="button">
            {shareState === "exported"
              ? "Exported"
              : formatExportDestination(cameraRollDestination)}
          </button>
          {supportsNativeShare ? (
            <button onClick={() => void handleNativeShare()} type="button">
              Share
            </button>
          ) : null}
        </div>
      </section>
    </Shell>
  );
}

function productOutcome(product: AxisProduct): AxisLoopArtifact["outcome"] {
  if (product.kind === "training-focus" || product.kind === "practice") return "improve";
  if (
    product.kind === "story" ||
    product.kind === "highlight" ||
    product.kind === "playlist"
  )
    return "share";
  if (product.kind === "curriculum") return "extend";
  return "observe";
}

function productToLoopArtifact(product: AxisProduct): AxisLoopArtifact {
  return {
    body: [product.finding, product.meaning, product.action].filter(Boolean).join("\n\n"),
    createdAt: product.createdAt,
    id: product.id,
    outcome: productOutcome(product),
    sourceClipCount: product.assetIds.length || 1,
    title: product.title,
    uploadId: product.assetIds[0] ?? product.id,
    whatWeFound: product.finding ?? product.summary?.[0] ?? product.title,
  };
}

async function exportProductThroughLoop(product: AxisProduct, destination: string) {
  const response = await fetch("/api/axis/first-loop", {
    body: JSON.stringify({
      action: "export",
      artifact: productToLoopArtifact(product),
      destination,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const result = (await response.json().catch(() => null)) as FirstLoopExportResponse | null;
  return response.ok ? (result?.export ?? null) : null;
}

function downloadLoopExport(
  exportArtifact: NonNullable<FirstLoopExportResponse["export"]>,
) {
  const blob = new Blob([exportArtifact.content], { type: exportArtifact.contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportArtifact.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function shareLoopExport(
  exportArtifact: NonNullable<FirstLoopExportResponse["export"]>,
) {
  const file = new File([exportArtifact.content], exportArtifact.fileName, {
    type: exportArtifact.contentType,
  });
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share: (data: ShareData) => Promise<void>;
  };
  const shareData: ShareData = nav.canShare?.({ files: [file] })
    ? { files: [file], title: exportArtifact.fileName }
    : { text: exportArtifact.content, title: exportArtifact.fileName };

  await nav.share(shareData);
}

export function AccountSettings() {
  return (
    <Shell eyebrow="Account" title="Your Axis">
      <section className="axis-cloud-panel">
        <button
          className="axis-cloud-primary"
          onClick={() => {
            if (typeof window !== "undefined") {
              [
                "axis-cloud-favorites",
                "axis-cloud-asset-records",
                "axis-cloud-export-artifacts",
                "axis-cloud-models",
                "axis-cloud-products",
                "cn-sessions",
                "cn-tags",
              ].forEach((key) => window.localStorage.removeItem(key));
              window.location.href = "/";
            }
          }}
          type="button"
        >
          Reset
        </button>
      </section>
    </Shell>
  );
}
