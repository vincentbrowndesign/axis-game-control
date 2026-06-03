"use client";

export type AxisProductKind =
  | "curriculum"
  | "film-study"
  | "highlight"
  | "hot-zones"
  | "playlist"
  | "practice"
  | "scout-report"
  | "shot-profile"
  | "story"
  | "training-focus";

export type AxisOutcomeKind = "extend" | "improve" | "observe" | "share";

export type AxisProduct = {
  action?: string;
  assetIds: string[];
  createdAt: string;
  exportDestination?: ExportDestination;
  finding?: string;
  id: string;
  kind: AxisProductKind;
  meaning?: string;
  modelId: string;
  muxPlaybackId?: string;
  summary?: string[];
  title: string;
};

// ─── In-memory video URL cache ─────────────────────────────────────────────────
// Stores ephemeral local blob URLs for the current browser session.
// Falls back to Mux stream on reload.
const _videoCache = new Map<string, string>();
export function cacheVideoUrl(uploadId: string, url: string) {
  _videoCache.set(uploadId, url);
}
export function getCachedVideoUrl(uploadId: string): string | null {
  return _videoCache.get(uploadId) ?? null;
}
export function getMuxStreamUrl(muxPlaybackId: string) {
  return `https://stream.mux.com/${muxPlaybackId}.m3u8`;
}
export function getMuxThumbnailUrl(muxPlaybackId: string) {
  return `https://image.mux.com/${muxPlaybackId}/thumbnail.jpg`;
}

export type AxisLoopArtifact = {
  body: string;
  createdAt: string;
  id: string;
  outcome: AxisOutcomeKind;
  sourceClipCount: number;
  title: string;
  uploadId: string;
  whatWeFound: string;
};

export type ExportDestination = "camera-roll" | "instagram" | "tiktok" | "youtube";

export type AxisAssetRecordAction = "save" | "share";

export type AxisAssetRecord = {
  action: AxisAssetRecordAction;
  created_at: string;
  export_artifact_id?: string;
  export_destination?: ExportDestination;
  generated_timestamp: string;
  id: string;
  product_id: string;
  product_type: AxisProductKind;
  source_clips: string[];
  title: string;
};

export type AxisExportArtifact = {
  content: string;
  content_type: string;
  created_at: string;
  destination: ExportDestination;
  file_name: string;
  id: string;
  product_id: string;
  product_type: AxisProductKind;
  source_clips: string[];
};

const ASSET_RECORDS_KEY = "axis-cloud-asset-records";
const EXPORT_ARTIFACTS_KEY = "axis-cloud-export-artifacts";
const PRODUCTS_KEY = "axis-cloud-products";

export const axisOutcomeProducts = {
  Extend: "curriculum",
  Improve: "training-focus",
  Observe: "film-study",
  Share: "story",
} satisfies Record<string, AxisProductKind>;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getAxisProducts() {
  return read<AxisProduct[]>(PRODUCTS_KEY, []);
}

export function getAxisProduct(id: string) {
  return getAxisProducts().find((product) => product.id === id) ?? null;
}

export function formatExportDestination(destination: ExportDestination) {
  return destination
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function createUploadedSessionAsset(
  _file: File,
  _film?: { muxPlaybackId?: string; thumbnailUrl?: string },
) {
  return `session-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function createProductFromLoopArtifact(artifact: AxisLoopArtifact) {
  const outcomeKey = getOutcomeKey(artifact.outcome);
  const product: AxisProduct = {
    action: artifact.body,
    assetIds: [artifact.uploadId],
    createdAt: artifact.createdAt,
    finding: artifact.whatWeFound,
    id: `product-${artifact.id}`,
    kind: axisOutcomeProducts[outcomeKey],
    meaning: artifact.body,
    modelId: "axis-first-loop",
    summary: [artifact.whatWeFound, artifact.body],
    title: artifact.title,
  };

  write(PRODUCTS_KEY, [product, ...getAxisProducts().filter((p) => p.id !== product.id)]);
  return product;
}

export function createTacticalReplayProduct({
  muxPlaybackId,
  uploadId,
  whatWeFound,
}: {
  muxPlaybackId?: string;
  uploadId: string;
  whatWeFound: string;
}) {
  const product: AxisProduct = {
    action: "Save or share this replay.",
    assetIds: [uploadId],
    createdAt: new Date().toISOString(),
    finding: whatWeFound,
    id: `replay-${uploadId}`,
    kind: "highlight",
    meaning: "Replay generated from the uploaded clip.",
    modelId: "axis-tactical-replay",
    muxPlaybackId,
    summary: [whatWeFound],
    title: "Replay Video",
  };

  write(PRODUCTS_KEY, [product, ...getAxisProducts().filter((p) => p.id !== product.id)]);
  return product;
}

export function updateTacticalReplayProduct(
  productId: string,
  patch: Partial<Pick<AxisProduct, "finding" | "muxPlaybackId" | "summary">>,
) {
  const products = getAxisProducts();
  const product = products.find((item) => item.id === productId);
  if (!product) return null;

  const updated: AxisProduct = { ...product, ...patch };
  write(PRODUCTS_KEY, products.map((item) => (item.id === productId ? updated : item)));
  return updated;
}

export function saveProductAsAsset(productId: string) {
  const product = getAxisProduct(productId);
  if (!product) return null;
  return createAxisAssetRecord(product, "save");
}

export function exportProduct(productId: string, destination: ExportDestination) {
  const products = getAxisProducts();
  const source = products.find((p) => p.id === productId);
  if (!source) return null;

  const artifact = createProductExportArtifact(productId, destination);
  if (!artifact) return null;

  const exported: AxisProduct = {
    ...source,
    createdAt: new Date().toISOString(),
    exportDestination: destination,
    id: `export-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: `${source.title} / ${formatExportDestination(destination)}`,
  };
  write(PRODUCTS_KEY, [exported, ...products]);
  const assetRecord = createAxisAssetRecord(source, "share", destination, artifact.id);
  return { artifact, assetRecord, product: exported };
}

function createProductExportArtifact(productId: string, destination: ExportDestination) {
  const product = getAxisProduct(productId);
  if (!product) return null;

  const artifact: AxisExportArtifact = {
    content: buildExportContent(product, destination),
    content_type: "text/plain;charset=utf-8",
    created_at: new Date().toISOString(),
    destination,
    file_name: `${slugify(product.title)}-${Date.now()}.txt`,
    id: `artifact-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    product_id: product.id,
    product_type: product.kind,
    source_clips: product.assetIds,
  };

  const existing = read<AxisExportArtifact[]>(EXPORT_ARTIFACTS_KEY, []);
  write(EXPORT_ARTIFACTS_KEY, [artifact, ...existing]);
  return artifact;
}

function createAxisAssetRecord(
  product: AxisProduct,
  action: AxisAssetRecordAction,
  destination?: ExportDestination,
  artifactId?: string,
) {
  const record: AxisAssetRecord = {
    action,
    created_at: new Date().toISOString(),
    export_artifact_id: artifactId,
    export_destination: destination,
    generated_timestamp: product.createdAt,
    id: `asset-record-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    product_id: product.id,
    product_type: product.kind,
    source_clips: product.assetIds,
    title:
      action === "share" && destination
        ? `${product.title} / ${formatExportDestination(destination)}`
        : product.title,
  };

  const existing = read<AxisAssetRecord[]>(ASSET_RECORDS_KEY, []);
  write(ASSET_RECORDS_KEY, [record, ...existing]);
  return record;
}

function buildExportContent(product: AxisProduct, destination: ExportDestination) {
  const when = new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(new Date(product.createdAt));

  return [
    product.title,
    "─────────────────────",
    "",
    "What We Found",
    product.finding ?? "",
    "",
    "What It Means",
    product.meaning ?? "",
    "",
    "What To Do Next",
    product.action ?? "",
    "",
    "─────────────────────",
    `${formatExportDestination(destination)} · ${when}`,
  ].join("\n");
}

function getOutcomeKey(outcome: AxisOutcomeKind): keyof typeof axisOutcomeProducts {
  if (outcome === "extend") return "Extend";
  if (outcome === "improve") return "Improve";
  if (outcome === "share") return "Share";
  return "Observe";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
