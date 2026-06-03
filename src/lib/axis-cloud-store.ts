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
  export_artifact_id?: string;
  generated_timestamp?: string;
  product_id?: string;
  product_type?: AxisProductKind;
  source_clips?: string[];
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
  finding?: string;
  meaning?: string;
  action?: string;
  exportDestination?: ExportDestination;
};

export type ExportDestination = "camera-roll" | "instagram" | "tiktok" | "youtube";
export type AxisAssetRecordAction = "save" | "share";
export type AxisAssetRecord = {
  id: string;
  action: AxisAssetRecordAction;
  created_at: string;
  export_artifact_id?: string;
  export_destination?: ExportDestination;
  generated_timestamp: string;
  product_id: string;
  product_type: AxisProductKind;
  source_clips: string[];
  title: string;
};

export type AxisExportArtifact = {
  id: string;
  content: string;
  content_type: string;
  created_at: string;
  destination: ExportDestination;
  file_name: string;
  product_id: string;
  product_type: AxisProductKind;
  source_clips: string[];
};

export type AxisDatasetInsight = {
  id: string;
  datasetId: string;
  name: string;
  value: string;
  confidence: ConfidenceTier;
  sampleSize: number;
  createdAt: string;
};

export type DatasetProductRegistration = {
  datasetId: string;
  products: AxisProductKind[];
};

const FAVORITES_KEY = "axis-cloud-favorites";
const ASSET_RECORDS_KEY = "axis-cloud-asset-records";
const EXPORT_ARTIFACTS_KEY = "axis-cloud-export-artifacts";
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
export const MINIMUM_DATASET_INSIGHT_CONFIDENCE: ConfidenceTier = "Medium";
export const axisDirectionProducts = {
  Train: "practice",
  Improve: "training-focus",
  Teach: "curriculum",
  Scout: "scout-report",
  Recruit: "playlist",
  Highlight: "highlight",
  Custom: "story",
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

export function getAxisAssetRecords() {
  return read<AxisAssetRecord[]>(ASSET_RECORDS_KEY, []);
}

export function getAxisExportArtifacts() {
  return read<AxisExportArtifact[]>(EXPORT_ARTIFACTS_KEY, []);
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
  if (!model?.assetIds.length) return null;

  const productEvidence = buildProductEvidence(kind, model);
  const product: AxisProduct = {
    action: productEvidence.action,
    assetIds: model?.assetIds ?? [],
    createdAt: new Date().toISOString(),
    confidenceTier: productEvidence.confidenceTier,
    finding: productEvidence.finding,
    id: `product-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    meaning: productEvidence.meaning,
    modelId: model?.id ?? "model-library",
    summary: productEvidence.summary,
    title: productLabels[kind],
  };
  write(PRODUCTS_KEY, [product, ...getAxisProducts()]);
  return product;
}

export function saveProductAsAsset(productId: string) {
  const product = getAxisProduct(productId);
  if (!product) return null;

  return createAxisAssetRecord(product, "save");
}

export function createProductExportArtifact(productId: string, destination: ExportDestination) {
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

  write(EXPORT_ARTIFACTS_KEY, [artifact, ...getAxisExportArtifacts()]);
  return artifact;
}

export function exportProduct(productId: string, destination: ExportDestination) {
  const products = getAxisProducts();
  const source = products.find((product) => product.id === productId);

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
  const next = [exported, ...products];
  write(PRODUCTS_KEY, next);
  const assetRecord = createAxisAssetRecord(source, "share", destination, artifact.id);
  return { artifact, assetRecord, product: exported };
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
  const recordedAssets = getAxisAssetRecords().map((record) => assetRecordToAsset(record, favorites));

  return [...recordedAssets, ...productAssets, ...clipnoteAssets, ...sessionAssets].sort(
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
  if (!hasMinimumDatasetInsightConfidence(dataset)) return [];

  if (dataset.id === MAKES_DATASET_ID) return Object.values(axisDirectionProducts);
  if (!dataset.assetIds.length) return defaultDatasetProducts;
  if (dataset.id === "model-library" || dataset.patternLabels.includes("Library")) return libraryDatasetProducts;
  if (dataset.patternLabels.includes("Built from library")) return libraryDatasetProducts;

  return patternDatasetProducts;
}

export function getConfidenceTier(assetCount: number): ConfidenceTier {
  if (assetCount >= 25) return "High";
  if (assetCount >= 10) return "Medium";
  return "Low";
}

export function getDatasetInsights(dataset: AxisModel | null | undefined): AxisDatasetInsight[] {
  if (!dataset) return [];
  return buildDatasetInsights(dataset);
}

function buildDatasetInsights(dataset: AxisModel): AxisDatasetInsight[] {
  const clips = getAssetsForDataset(dataset).filter((asset) => asset.kind !== "product");
  if (!clips.length) return [];

  const zoneCounts = getTopCounts(clips.map((asset) => asset.detail || asset.meanings[0] || "Saved clip"));
  const sourceCounts = getTopCounts(clips.map((asset) => asset.meanings[1]?.replace(/^From /, "") || "Session"));
  const confidence = getConfidenceTier(clips.length);
  const insights: AxisDatasetInsight[] = [];
  const mostCommonZone = zoneCounts[0];
  const mostCommonSource = sourceCounts[0];
  const createdAt = new Date().toISOString();

  if (mostCommonZone) {
    insights.push({
      confidence,
      createdAt,
      datasetId: dataset.id,
      id: "most-makes",
      name: "Most Makes",
      sampleSize: clips.length,
      value: mostCommonZone[0],
    });
  }

  insights.push({
    confidence,
    createdAt,
    datasetId: dataset.id,
    id: "most-common-shot",
    name: "Most Common Shot",
    sampleSize: clips.length,
    value: inferShotType(mostCommonZone?.[0] ?? mostCommonSource?.[0]),
  });

  insights.push({
    confidence,
    createdAt,
    datasetId: dataset.id,
    id: "pressure",
    name: "Pressure",
    sampleSize: clips.length,
    value: inferPressure(mostCommonZone?.[0] ?? mostCommonSource?.[0]),
  });

  return insights;
}

function inferShotType(value?: string) {
  if (!value) return "Catch & Shoot";
  const normalized = value.toLowerCase();
  if (normalized.includes("catch")) return "Catch & Shoot";
  if (normalized.includes("pull")) return "Pull-Up";
  if (normalized.includes("drive")) return "Drive";
  if (normalized.includes("free")) return "Free Throw";
  return "Catch & Shoot";
}

function inferPressure(value?: string) {
  if (!value) return "Mostly Open";
  const normalized = value.toLowerCase();
  if (normalized.includes("contest") || normalized.includes("pressure")) return "Mostly Contested";
  if (normalized.includes("open") || normalized.includes("wing") || normalized.includes("corner")) return "Mostly Open";
  return "Mostly Open";
}

export function hasMinimumDatasetInsightConfidence(dataset: AxisModel | null | undefined) {
  return getDatasetInsights(dataset).some(
    (insight) => confidenceRank(insight.confidence) >= confidenceRank(MINIMUM_DATASET_INSIGHT_CONFIDENCE),
  );
}

function confidenceRank(confidence: ConfidenceTier) {
  if (confidence === "High") return 3;
  if (confidence === "Medium") return 2;
  return 1;
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

function assetRecordToAsset(record: AxisAssetRecord, favorites: string[]): AxisAsset {
  return {
    createdAt: record.created_at,
    detail:
      record.action === "share" && record.export_destination
        ? `Shared to ${formatExportDestination(record.export_destination)}`
        : "Saved output",
    durationLabel: "Axis Asset",
    export_artifact_id: record.export_artifact_id,
    favorite: favorites.includes(record.id),
    generated_timestamp: record.generated_timestamp,
    id: record.id,
    kind: "product",
    meanings: [
      getProductLabel(record.product_type),
      `${record.source_clips.length} source clips`,
      record.action === "share" ? "Export artifact created" : "Saved to Axis",
    ],
    product_id: record.product_id,
    product_type: record.product_type,
    relatedIds: record.source_clips,
    source_clips: record.source_clips,
    sourceId: record.product_id,
    title: record.title,
  };
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

  write(ASSET_RECORDS_KEY, [record, ...getAxisAssetRecords()]);
  return record;
}

function buildExportContent(product: AxisProduct, destination: ExportDestination) {
  const when = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(
    new Date(product.createdAt),
  );
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getAssetsForPattern(pattern: DatasetBin) {
  return getAxisAssets().filter((asset) => asset.meanings.includes(pattern.tag_name));
}

function getAssetsForDataset(dataset: AxisModel) {
  const assetIds = new Set(dataset.assetIds);
  return getAxisAssets().filter((asset) => assetIds.has(asset.id));
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

function buildProductEvidence(kind: AxisProductKind, model: AxisModel | undefined) {
  const insights = getDatasetInsights(model);
  const clipCount = model?.assetIds.length ?? 0;
  const confidenceTier = insights.reduce<ConfidenceTier>(
    (best, insight) => (confidenceRank(insight.confidence) > confidenceRank(best) ? insight.confidence : best),
    "Low",
  );
  const leadMakes = insights.find((i) => i.id === "most-makes");
  const leadShot = insights.find((i) => i.id === "most-common-shot");
  const zone = leadMakes?.value ?? leadShot?.value ?? "your primary zone";
  const n = clipCount || leadMakes?.sampleSize || 0;

  const templates: Record<AxisProductKind, { finding: string; meaning: string; action: string }> = {
    "training-focus": {
      finding: n ? `${n} clips point to ${zone} as your most frequent make location.` : "Add clips to identify your training focus.",
      meaning: "This zone is where your game lives. Build there.",
      action: `Add ${zone} reps to every session until it stops feeling like a decision.`,
    },
    practice: {
      finding: n ? `${n} training clips recorded. ${zone} leads the work.` : "Add training clips to see the pattern.",
      meaning: "Your practice reps are forming a real pattern.",
      action: `Add 10 ${zone} reps this week. Keep the record growing.`,
    },
    highlight: {
      finding: n ? `${n} plays captured across your sessions.` : "Add clips to build your highlight.",
      meaning: "This is your best work on record.",
      action: "Save it. Post it. Let it travel.",
    },
    curriculum: {
      finding: n ? `${n} clips with a repeatable pattern. ${zone} shows up most.` : "Add more clips to build the curriculum.",
      meaning: "Someone else can learn from this. The form transfers.",
      action: "Use these clips in your next walkthrough. Show the moment, not the concept.",
    },
    "scout-report": {
      finding: n ? `${n} clips reviewed. ${zone} is the primary tendency.` : "Add clips to build the scout report.",
      meaning: "This is where the player lives offensively. Defend there first.",
      action: `Test the contest in ${zone}. Track the response over three games.`,
    },
    playlist: {
      finding: n ? `${n} clips showing consistent production.` : "Add clips to build the reel.",
      meaning: "This record speaks for itself. The work is here.",
      action: "Send this. Let the film decide.",
    },
    "shot-profile": {
      finding: n ? `${n} makes tracked. ${zone} leads the distribution.` : "Add makes to build your shot profile.",
      meaning: "This is your shooting identity right now.",
      action: `Own ${zone}. Add the next zone when this one feels automatic.`,
    },
    "hot-zones": {
      finding: n ? `${zone} shows the highest make rate. ${n} clips tracked.` : "Add makes to reveal your hot zones.",
      meaning: "These are your real scoring areas — not just your preferred ones.",
      action: `Attack ${zone} first in every game. Work the percentages.`,
    },
    story: {
      finding: n ? `${n} clips across your history show a clear pattern.` : "Add clips to tell the story.",
      meaning: "This is the story your game is telling.",
      action: "Decide if that's the story you want to keep writing.",
    },
  };

  const { finding, meaning, action } = templates[kind];
  return {
    action,
    confidenceTier,
    finding,
    meaning,
    summary: [finding, meaning, action],
  };
}

function getTopCounts(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
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
