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
  | "curriculum";

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
  exportDestination?: ExportDestination;
};

export type ExportDestination = "camera-roll" | "instagram" | "tiktok" | "youtube";

const FAVORITES_KEY = "axis-cloud-favorites";
const MODELS_KEY = "axis-cloud-models";
const PRODUCTS_KEY = "axis-cloud-products";

const productLabels: Record<AxisProductKind, string> = {
  curriculum: "Curriculum",
  "film-study": "Film study",
  highlight: "Highlight",
  playlist: "Playlist",
  practice: "Practice",
  "scout-report": "Scout report",
  story: "Story",
};

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

export function getAxisProducts() {
  return read<AxisProduct[]>(PRODUCTS_KEY, []);
}

export function getAxisModels() {
  const stored = read<AxisModel[]>(MODELS_KEY, []);
  if (stored.length) return stored;

  const bins = getDatasetBins();
  if (!bins.length) return [createDefaultModel([])];

  return bins.map((bin) => ({
    assetIds: getAssetsForPattern(bin).map((asset) => asset.id),
    createdAt: new Date().toISOString(),
    id: `model-${bin.tag_slug}`,
    name: bin.tag_name,
    patternLabels: [bin.tag_name],
  }));
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
  const product: AxisProduct = {
    assetIds: model?.assetIds ?? [],
    createdAt: new Date().toISOString(),
    id: `product-${Date.now()}`,
    kind,
    modelId: model?.id ?? "model-library",
    title: `${productLabels[kind]} / ${model?.name ?? "Library"}`,
  };
  write(PRODUCTS_KEY, [product, ...getAxisProducts()]);
  return product;
}

export function exportProduct(productId: string, destination: ExportDestination) {
  const products = getAxisProducts();
  const next = products.map((product) =>
    product.id === productId ? { ...product, exportDestination: destination } : product,
  );
  write(PRODUCTS_KEY, next);
  return next.find((product) => product.id === productId) ?? null;
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
    detail: product.exportDestination ? `Exported to ${product.exportDestination.replace("-", " ")}` : "Generated product",
    durationLabel: "Product",
    favorite: favorites.includes(id),
    id,
    kind: "product",
    meanings: [getProductLabel(product.kind), "Returned to Library", `${product.assetIds.length} source assets`],
    relatedIds: product.assetIds,
    sourceId: product.id,
    title: product.title,
  };
}

function getAssetsForPattern(pattern: DatasetBin) {
  return getAxisAssets().filter((asset) => asset.meanings.includes(pattern.tag_name));
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
