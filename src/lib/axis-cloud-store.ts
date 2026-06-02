"use client";

import {
  createSession,
  getClipnote,
  getDatasetBins,
  getSession,
  getSessions,
  getTag,
  saveSession,
  type Clipnote,
  type DatasetBin,
  type Session,
} from "./clipnote-store";

export type AxisAssetKind = "session" | "clipnote" | "product";
export type AxisProductKind =
  | "highlight"
  | "practice"
  | "scout-report"
  | "film-study"
  | "playlist"
  | "story"
  | "curriculum"
  | "shot-profile"
  | "hot-zones"
  | "training-focus";

export type ConfidenceTier = "Low" | "Medium" | "High";

export type AxisAsset = {
  id: string;
  sourceId: string;
  kind: AxisAssetKind;
  title: string;
  detail: string;
  createdAt: string;
  durationLabel: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  muxPlaybackId?: string;
  favorite: boolean;
  meanings: string[];
  relatedIds: string[];
};

export type AxisModel = {
  id: string;
  name: string;
  assetIds: string[];
  createdAt: string;
  patternLabels: string[];
};

export type AxisProduct = {
  id: string;
  title: string;
  kind: AxisProductKind;
  modelId: string;
  assetIds: string[];
  createdAt: string;
  confidenceTier?: ConfidenceTier;
  summary?: string[];
  exportDestination?: ExportDestination;
};

export type ExportDestination = "camera-roll" | "instagram" | "tiktok" | "youtube";
export type DatasetProductRegistration = {
  datasetId: string;
  products: AxisProductKind[];
};

const FAVORITES_KEY = "axis-cloud-favorites";
const MODELS_KEY = "axis-cloud-models";
const PRODUCTS_KEY = "axis-cloud-products";
const MAKES_DATASET_ID = "dataset-makes";

const productLabels: Record<AxisProductKind, string> = {
  curriculum: "Curriculum",
  "film-study": "Film study",
  highlight: "Highlight",
  playlist: "Playlist",
  practice: "Practice",
  "scout-report": "Scout report",
  "hot-zones": "Hot Zones",
  "shot-profile": "Shot Profile",
  story: "Story",
  "training-focus": "Training Focus",
};

const defaultDatasetProducts: AxisProductKind[] = ["highlight", "story"];
const libraryDatasetProducts: AxisProductKind[] = ["highlight", "playlist", "story"];
const patternDatasetProducts: AxisProductKind[] = ["highlight", "practice", "film-study"];
const makesDatasetProducts: AxisProductKind[] = ["shot-profile", "hot-zones", "training-focus"];

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

function formatDuration(open: number, close: number) {
  const seconds = Math.max(0, Math.round(close - open));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function sessionAssetId(id: string) {
  return `session-${id}`;
}

function clipnoteAssetId(id: string) {
  return `clipnote-${id}`;
}

export function getProductAssetId(id: string) {
  return id.startsWith("product-") ? id : `product-${id}`;
}

function getMuxThumbnail(playbackId?: string) {
  return playbackId ? `https://image.mux.com/${playbackId}/thumbnail.jpg` : undefined;
}

function getMuxStream(playbackId?: string) {
  return playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : undefined;
}

export function getFavoriteAssetIds() {
  return read<string[]>(FAVORITES_KEY, []);
}

export function toggleFavoriteAsset(assetId: string) {
  const favorites = getFavoriteAssetIds();
  const next = favorites.includes(assetId)
    ? favorites.filter((id) => id !== assetId)
    : [assetId, ...favorites];
  write(FAVORITES_KEY, next);
  return next;
}

export function saveFavoriteAsset(assetId: string) {
  const favorites = getFavoriteAssetIds();
  const next = favorites.includes(assetId) ? favorites : [assetId, ...favorites];
  write(FAVORITES_KEY, next);
  return next;
}

export function getAxisProducts() {
  return read<AxisProduct[]>(PRODUCTS_KEY, []);
}

export function getAxisProduct(id: string) {
  return getAxisProducts().find((product) => product.id === id) ?? null;
}

export function getAxisModels() {
  const stored = read<AxisModel[]>(MODELS_KEY, []);
  const makesDataset = buildMakesDatasetFromFavorites();

  if (stored.length) {
    return makesDataset
      ? [makesDataset, ...stored.filter((model) => model.id !== MAKES_DATASET_ID)]
      : stored.filter((model) => model.id !== MAKES_DATASET_ID);
  }

  const bins = getDatasetBins();
  if (!bins.length) return makesDataset ? [makesDataset, createDefaultModel([])] : [createDefaultModel([])];

  const derivedModels = bins.map((bin) => ({
    assetIds: getAssetsForPattern(bin).map((asset) => asset.id),
    createdAt: new Date().toISOString(),
    id: `model-${bin.tag_slug}`,
    name: bin.tag_name,
    patternLabels: [bin.tag_name],
  }));

  return makesDataset ? [makesDataset, ...derivedModels] : derivedModels;
}

export function saveAxisModels(models: AxisModel[]) {
  write(MODELS_KEY, models);
}

export function buildMyModel(assetIds: string[]) {
  const models = getAxisModels();
  const model: AxisModel = {
    assetIds: Array.from(new Set(assetIds)),
    createdAt: new Date().toISOString(),
    id: `model-${Date.now()}`,
    name: "My model",
    patternLabels: ["Built from library"],
  };
  saveAxisModels([model, ...models.filter((item) => item.id !== model.id)]);
  return model;
}

export function addAssetToModel(assetId: string, modelId?: string) {
  const models = getAxisModels();
  const target = modelId ? models.find((model) => model.id === modelId) : models[0];

  if (!target) {
    const model = buildMyModel([assetId]);
    return model;
  }

  const next = models.map((model) =>
    model.id === target.id
      ? { ...model, assetIds: Array.from(new Set([assetId, ...model.assetIds])) }
      : model,
  );
  saveAxisModels(next);
  return next.find((model) => model.id === target.id) ?? target;
}

export function generateProduct(kind: AxisProductKind, modelId: string) {
  const model = getAxisModels().find((item) => item.id === modelId) ?? getAxisModels()[0];
  const productEvidence = buildProductEvidence(kind, model?.assetIds ?? []);
  const product: AxisProduct = {
    assetIds: model?.assetIds ?? [],
    createdAt: new Date().toISOString(),
    confidenceTier: productEvidence.confidenceTier,
    id: `product-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    modelId: model?.id ?? "model-library",
    summary: productEvidence.summary,
    title: `${productLabels[kind]} / ${model?.name ?? "Library"}`,
  };
  write(PRODUCTS_KEY, [product, ...getAxisProducts()]);
  return product;
}

export function exportProduct(productId: string, destination: ExportDestination) {
  const products = getAxisProducts();
  const source = products.find((product) => product.id === productId);

  if (!source) return null;

  const exported: AxisProduct = {
    ...source,
    createdAt: new Date().toISOString(),
    exportDestination: destination,
    id: `export-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: `${source.title} / ${formatExportDestination(destination)}`,
  };
  const next = [exported, ...products];
  write(PRODUCTS_KEY, next);
  return exported;
}

export function createUploadedSessionAsset(file: File, film?: { muxPlaybackId?: string; thumbnailUrl?: string }) {
  const session = createSession(file.name.replace(/\.[^.]+$/, "") || "Camera Roll");
  saveSession({
    ...session,
    mux_playback_id: film?.muxPlaybackId,
    status: "complete",
    title: session.title,
  });
  return sessionAssetId(session.id);
}

export function getAxisAssets(): AxisAsset[] {
  const favorites = getFavoriteAssetIds();
  const sessions = getSessions();
  const sessionAssets = sessions.map((session) => sessionToAsset(session, favorites));
  const clipnoteAssets = sessions.flatMap((session) =>
    session.clipnotes.map((clipnote) => clipnoteToAsset(clipnote, session, favorites)),
  );
  const productAssets = getAxisProducts().map((product) => productToAsset(product, favorites));

  return [...productAssets, ...clipnoteAssets, ...sessionAssets].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getAxisAsset(id: string) {
  return getAxisAssets().find((asset) => asset.id === id) ?? null;
}

export function getAxisModel(id: string) {
  return getAxisModels().find((model) => model.id === id) ?? null;
}

export function getProductLabel(kind: AxisProductKind) {
  return productLabels[kind];
}

export function formatExportDestination(destination: ExportDestination) {
  return destination
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getRegisteredProductsForDataset(dataset: AxisModel | null | undefined): AxisProductKind[] {
  if (!dataset) return [];

  if (dataset.id === MAKES_DATASET_ID) return makesDatasetProducts;
  if (!dataset.assetIds.length) return defaultDatasetProducts;
  if (dataset.id === "model-library" || dataset.patternLabels.includes("Library")) return libraryDatasetProducts;
  if (dataset.patternLabels.includes("Built from library")) return libraryDatasetProducts;

  return patternDatasetProducts;
}

export function getConfidenceTier(assetCount: number): ConfidenceTier {
  if (assetCount >= 8) return "High";
  if (assetCount >= 3) return "Medium";
  return "Low";
}

function sessionToAsset(session: Session, favorites: string[]): AxisAsset {
  const id = sessionAssetId(session.id);
  const clipCount = session.clipnotes.length;

  return {
    createdAt: session.created_at,
    detail: clipCount ? `${clipCount} saved ${clipCount === 1 ? "asset" : "assets"}` : "Uploaded session",
    durationLabel: "Session",
    favorite: favorites.includes(id),
    id,
    kind: "session",
    meanings: [
      session.status === "complete" ? "Session complete" : "Session active",
      clipCount ? "Replay memory attached" : "Ready for model building",
    ],
    muxPlaybackId: session.mux_playback_id,
    relatedIds: session.clipnotes.map((clipnote) => clipnoteAssetId(clipnote.id)),
    sourceId: session.id,
    thumbnailUrl: getMuxThumbnail(session.mux_playback_id),
    title: session.title,
    videoUrl: getMuxStream(session.mux_playback_id),
  };
}

function clipnoteToAsset(clipnote: Clipnote, session: Session, favorites: string[]): AxisAsset {
  const id = clipnoteAssetId(clipnote.id);
  const tag = clipnote.tag_id ? getTag(clipnote.tag_id) : null;

  return {
    createdAt: clipnote.created_at,
    detail: tag?.name ?? session.title,
    durationLabel: formatDuration(clipnote.open_time, clipnote.close_time),
    favorite: favorites.includes(id),
    id,
    kind: "clipnote",
    meanings: [tag?.name ?? "Saved moment", `From ${session.title}`, formatDate(clipnote.created_at)],
    muxPlaybackId: session.mux_playback_id,
    relatedIds: [sessionAssetId(session.id)],
    sourceId: clipnote.id,
    thumbnailUrl: clipnote.thumbnail_url ?? getMuxThumbnail(session.mux_playback_id),
    title: clipnote.title,
    videoUrl: clipnote.clip_url ?? getMuxStream(session.mux_playback_id),
  };
}

function productToAsset(product: AxisProduct, favorites: string[]): AxisAsset {
  const id = getProductAssetId(product.id);
  return {
    createdAt: product.createdAt,
    detail: product.exportDestination ? `Exported to ${formatExportDestination(product.exportDestination)}` : "Generated product",
    durationLabel: "Product",
    favorite: favorites.includes(id),
    id,
    kind: "product",
    meanings: [
      getProductLabel(product.kind),
      product.confidenceTier ? `${product.confidenceTier} confidence` : "Low confidence",
      `${product.assetIds.length} source assets`,
    ],
    relatedIds: product.assetIds,
    sourceId: product.id,
    title: product.title,
  };
}

function getAssetsForPattern(pattern: DatasetBin) {
  return getAxisAssets().filter((asset) => asset.meanings.includes(pattern.tag_name));
}

function buildMakesDatasetFromFavorites(): AxisModel | null {
  const favoriteIds = new Set(getFavoriteAssetIds());
  const favoriteClips = getAxisAssets().filter((asset) => favoriteIds.has(asset.id) && asset.kind === "clipnote");

  if (!favoriteClips.length) return null;

  const oldestClip = favoriteClips.reduce((oldest, asset) =>
    new Date(asset.createdAt).getTime() < new Date(oldest.createdAt).getTime() ? asset : oldest,
  );

  return {
    assetIds: favoriteClips.map((asset) => asset.id),
    createdAt: oldestClip.createdAt,
    id: MAKES_DATASET_ID,
    name: "Makes Dataset",
    patternLabels: ["Makes", "Favorited clips", getConfidenceTier(favoriteClips.length)],
  };
}

function buildProductEvidence(kind: AxisProductKind, assetIds: string[]) {
  const assets = getAxisAssets().filter((asset) => assetIds.includes(asset.id));
  const confidenceTier = getConfidenceTier(assets.length);
  const zoneCounts = countBy(assets.map((asset) => asset.detail || asset.meanings[0] || "Saved clip"));
  const topZones = Array.from(zoneCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (kind === "shot-profile") {
    return {
      confidenceTier,
      summary: [
        `${assets.length} favorited clips aggregated`,
        `${topZones[0]?.[0] ?? "No dominant pattern"} leads the sample`,
        `${confidenceTier} confidence`,
      ],
    };
  }

  if (kind === "hot-zones") {
    return {
      confidenceTier,
      summary: topZones.length
        ? topZones.map(([zone, count]) => `${zone}: ${count} clips`)
        : ["No hot zones yet", `${confidenceTier} confidence`],
    };
  }

  if (kind === "training-focus") {
    return {
      confidenceTier,
      summary: [
        topZones[0] ? `Keep building ${topZones[0][0]}` : "Add more makes",
        assets.length >= 3 ? "Use repeated clips as the practice anchor" : "Favorite more clips to strengthen the dataset",
        `${confidenceTier} confidence`,
      ],
    };
  }

  return {
    confidenceTier,
    summary: [`${assets.length} source assets`, `${confidenceTier} confidence`],
  };
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function createDefaultModel(assetIds: string[]): AxisModel {
  return {
    assetIds,
    createdAt: new Date().toISOString(),
    id: "model-library",
    name: "Library model",
    patternLabels: ["Library"],
  };
}

export function getLegacyClipnoteRoute(asset: AxisAsset) {
  if (asset.kind !== "clipnote") return null;
  const record = getClipnote(asset.sourceId);
  return record ? `/clipnote/${record.clipnote.id}` : null;
}

export function getLegacySessionRoute(asset: AxisAsset) {
  if (asset.kind !== "session") return null;
  return getSession(asset.sourceId) ? `/session/${asset.sourceId}` : null;
}
