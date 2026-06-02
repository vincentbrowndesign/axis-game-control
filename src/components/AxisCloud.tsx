"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as tus from "tus-js-client";
import {
  addAssetToModel,
  axisDirectionProducts,
  buildMyModel,
  createUploadedSessionAsset,
  exportProduct,
  formatExportDestination,
  generateProduct,
  getAxisAsset,
  getAxisAssets,
  getAxisModel,
  getAxisModels,
  getAxisProduct,
  getAxisProducts,
  getDatasetInsights,
  getProductAssetId,
  getProductLabel,
  getRegisteredProductsForDataset,
  hasMinimumDatasetInsightConfidence,
  saveFavoriteAsset,
  toggleFavoriteAsset,
  type AxisAsset,
  type AxisDatasetInsight,
  type AxisModel,
  type AxisProduct,
  type AxisProductKind,
  type ExportDestination,
} from "../lib/axis-cloud-store";

type UploadState = "idle" | "uploading" | "saving";

const exportDestinations: ExportDestination[] = ["camera-roll", "instagram", "tiktok", "youtube"];

function useCloudSnapshot() {
  const [assets, setAssets] = useState<AxisAsset[]>([]);
  const [models, setModels] = useState<AxisModel[]>([]);
  const [products, setProducts] = useState<AxisProduct[]>([]);

  const refresh = useCallback(() => {
    setAssets(getAxisAssets());
    setModels(getAxisModels());
    setProducts(getAxisProducts());
  }, []);

  useEffect(() => {
    refresh();
  }, []);

  return { assets, models, products, refresh };
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
  const uploadResponse = await fetch("/api/film/uploads", {
    method: "POST",
  });

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
      return {
        muxPlaybackId: film.playbackId,
        thumbnailUrl: film.thumbnailUrl,
      };
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
      <nav className="axis-cloud-nav" aria-label="Axis cloud navigation">
        <Link href="/">Axis</Link>
        <Link href="/account">Account</Link>
      </nav>
    </main>
  );
}

function AssetGrid({ assets }: { assets: AxisAsset[] }) {
  if (!assets.length) {
    return <p className="axis-cloud-empty">Upload from Camera Roll to start the Library.</p>;
  }

  return (
    <div className="axis-cloud-grid">
      {assets.map((asset) => (
        <Link className="axis-asset-tile" href={`/asset/${asset.id}`} key={asset.id}>
          {asset.thumbnailUrl ? (
            <img alt="" src={asset.thumbnailUrl} />
          ) : (
            <span className="axis-asset-blank">{asset.kind}</span>
          )}
          <strong>{asset.title}</strong>
          <em>{asset.durationLabel} / {asset.detail}</em>
          {asset.favorite ? <span className="axis-cloud-signal">Favorite</span> : null}
        </Link>
      ))}
    </div>
  );
}

export function LibraryHome() {
  const { assets, refresh } = useCloudSnapshot();
  const [search, setSearch] = useState("");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const filteredAssets = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return assets;
    return assets.filter((asset) =>
      [asset.title, asset.detail, asset.kind, ...asset.meanings].some((item) =>
        item.toLowerCase().includes(value),
      ),
    );
  }, [assets, search]);

  async function handleFile(file: File) {
    setUploadState("uploading");
    try {
      const film = await uploadToMux(file);
      setUploadState("saving");
      const assetId = createUploadedSessionAsset(file, film);
      refresh();
      router.push(`/asset/${assetId}`);
    } catch {
      const assetId = createUploadedSessionAsset(file);
      refresh();
      router.push(`/asset/${assetId}`);
    } finally {
      setUploadState("idle");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Shell eyebrow="Library" title="Assets build models">
      <section className="axis-cloud-panel axis-upload-panel">
        <button
          className="axis-cloud-primary"
          disabled={uploadState !== "idle"}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          {uploadState === "idle" ? "Upload from Camera Roll" : "Uploading"}
        </button>
        <input
          ref={inputRef}
          accept="video/*,image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
          type="file"
        />
      </section>

      <label className="axis-cloud-search">
        <span>Search</span>
        <input
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Assets, sessions, patterns"
          type="search"
          value={search}
        />
      </label>

      <section className="axis-cloud-section">
        <div className="axis-cloud-row">
          <span>Asset grid</span>
          <strong>{filteredAssets.length}</strong>
        </div>
        <AssetGrid assets={filteredAssets} />
      </section>
    </Shell>
  );
}

export function DatasetsHome() {
  const { assets, models, refresh } = useCloudSnapshot();
  const [generatedProducts, setGeneratedProducts] = useState<AxisProduct[]>([]);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const activeModel = models.find((model) => model.assetIds.length) ?? models[0] ?? null;
  const activeAssets = activeModel
    ? activeModel.assetIds
        .map((assetId) => assets.find((asset) => asset.id === assetId))
        .filter((asset): asset is AxisAsset => Boolean(asset))
        .filter((asset) => asset.kind !== "product")
    : [];
  const insights = getDatasetInsights(activeModel);
  const mostMakes = insights.find((insight) => insight.id === "most-makes") ?? insights[0] ?? null;
  const mostCommonShot = insights.find((insight) => insight.id === "most-common-shot") ?? null;
  const pressure = insights.find((insight) => insight.id === "pressure") ?? null;
  const canGenerateProduct = Boolean(activeModel && activeAssets.length);
  const directions = Object.entries(axisDirectionProducts) as Array<[string, AxisProductKind]>;

  async function handleFile(file: File) {
    setUploadState("uploading");
    try {
      const film = await uploadToMux(file);
      setUploadState("saving");
      const assetId = createUploadedSessionAsset(file, film);
      addAssetToModel(assetId, activeModel?.id);
      refresh();
    } catch {
      const assetId = createUploadedSessionAsset(file);
      addAssetToModel(assetId, activeModel?.id);
      refresh();
    } finally {
      setUploadState("idle");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleDirection(kind: AxisProductKind) {
    if (!activeModel || !canGenerateProduct) return;
    const product = generateProduct(kind, activeModel.id);
    if (!product) return;
    setGeneratedProducts([product]);
    refresh();
    router.push(`/product/${product.id}`);
  }

  return (
    <Shell eyebrow="Axis" title="What We Found">
      <section className="axis-cloud-panel axis-upload-panel">
        <button
          className="axis-cloud-primary"
          disabled={uploadState !== "idle"}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          {uploadState === "idle" ? "Upload" : "Uploading"}
        </button>
        <input
          ref={inputRef}
          accept="video/*,image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
          type="file"
        />
      </section>

      <section className="axis-understanding-card">
        <div className="axis-understanding">
          <strong>{activeAssets.length} Clips</strong>
          <div>
            <span>Most Makes:</span>
            <p>{mostMakes?.value ?? "Add clips"}</p>
          </div>
          <div>
            <span>Most Common Shot:</span>
            <p>{mostCommonShot?.value ?? "Add clips"}</p>
          </div>
          <div>
            <span>Pressure:</span>
            <p>{pressure?.value ?? "Add clips"}</p>
          </div>
        </div>

        <div className="axis-direction-rule" aria-hidden="true" />

        {canGenerateProduct ? (
          <div className="axis-direction-grid">
            {directions.map(([label, kind]) => (
              <button onClick={() => handleDirection(kind)} type="button" key={label}>
                {label}
              </button>
            ))}
          </div>
        ) : (
          <p className="axis-create-locked">Add more clips to unlock generation.</p>
        )}
      </section>

      {generatedProducts.length ? (
        <section className="axis-cloud-section">
          <div className="axis-model-list">
            {generatedProducts.map((product) => (
              <Link className="axis-model-card" href={`/product/${product.id}`} key={product.id}>
                <strong>{product.title}</strong>
                <em>{product.assetIds.length} clips</em>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </Shell>
  );
}

export function DatasetDetail({ datasetId }: { datasetId: string }) {
  const { assets, refresh } = useCloudSnapshot();
  const [dataset, setDataset] = useState<AxisModel | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    setDataset(getAxisModel(datasetId));
  }, [datasetId, assets]);

  async function handleFile(file: File) {
    setUploadState("uploading");
    try {
      const film = await uploadToMux(file);
      setUploadState("saving");
      const assetId = createUploadedSessionAsset(file, film);
      addAssetToModel(assetId, datasetId);
      refresh();
    } catch {
      const assetId = createUploadedSessionAsset(file);
      addAssetToModel(assetId, datasetId);
      refresh();
    } finally {
      setUploadState("idle");
      if (inputRef.current) inputRef.current.value = "";
      setDataset(getAxisModel(datasetId));
    }
  }

  function getDatasetAssets(model: AxisModel) {
    return model.assetIds
      .map((assetId) => assets.find((asset) => asset.id === assetId))
      .filter((asset): asset is AxisAsset => Boolean(asset))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  if (!dataset) {
    return (
      <Shell eyebrow="Dataset" title="Not found">
        <Link className="axis-cloud-primary" href="/">
          Back
        </Link>
      </Shell>
    );
  }

  const recentClips = getDatasetAssets(dataset);
  const clipCount = recentClips.filter((asset) => asset.kind === "clipnote").length || recentClips.length;
  const insights = getDatasetInsights(dataset);
  const canGenerateProduct = hasMinimumDatasetInsightConfidence(dataset);

  function openCreate() {
    if (!canGenerateProduct) return;
    router.push(`/create?dataset=${datasetId}`);
  }

  return (
    <Shell eyebrow="Dataset" title={dataset.name}>
      <section className="axis-cloud-section">
        <p className="axis-dataset-clip-count">{clipCount} clips</p>
      </section>

      <section className="axis-cloud-panel axis-upload-panel">
        <div className="axis-dataset-actions axis-dataset-detail-actions">
          <button
            disabled={uploadState !== "idle"}
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            {uploadState === "idle" ? "Add Clips" : "Uploading"}
          </button>
          <Link href="/">Back</Link>
        </div>
        <input
          ref={inputRef}
          accept="video/*,image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
          type="file"
        />
      </section>

      <section className="axis-cloud-section">
        <div className="axis-cloud-row">
          <span>Discoveries</span>
        </div>
        <div className="axis-insight-list">
          {insights.length ? (
            insights.map((insight) => <InsightRow insight={insight} key={`${insight.datasetId}-${insight.id}`} />)
          ) : (
            <p className="axis-create-locked">
              {clipCount ? "Discover insights first." : "Add clips first."}
            </p>
          )}
        </div>
      </section>

      <section className="axis-cloud-panel axis-upload-panel">
        <div className="axis-dataset-actions">
          <button disabled={!canGenerateProduct} onClick={openCreate} type="button">
            Generate
          </button>
        </div>
      </section>

      <section className="axis-cloud-section">
        <div className="axis-cloud-row">
          <span>Recent Clips</span>
          <strong>{recentClips.length}</strong>
        </div>
        <AssetGrid assets={recentClips.slice(0, 8)} />
      </section>
    </Shell>
  );
}

function InsightRow({ insight }: { insight: AxisDatasetInsight }) {
  return (
    <article className="axis-insight-row">
      <strong>{insight.name}</strong>
      <span>{insight.value}</span>
      <span className="axis-insight-confidence">
        {insight.confidence === "High"
          ? "reliable"
          : insight.confidence === "Medium"
            ? "pattern forming"
            : "early signal"}
        {" · "}
        {insight.sampleSize} clips
      </span>
    </article>
  );
}

export function AssetDetail({ assetId }: { assetId: string }) {
  const { assets, models, refresh } = useCloudSnapshot();
  const [asset, setAsset] = useState<AxisAsset | null>(null);
  const router = useRouter();

  useEffect(() => {
    setAsset(getAxisAsset(assetId));
  }, [assetId, assets]);

  if (!asset) {
    return (
      <Shell eyebrow="Asset" title="Not in Library">
        <Link className="axis-cloud-primary" href="/">
          Return to Library
        </Link>
      </Shell>
    );
  }

  const currentAsset = asset;
  const related = asset.relatedIds
    .map((id) => assets.find((item) => item.id === id))
    .filter((item): item is AxisAsset => Boolean(item));

  function handleFavorite() {
    toggleFavoriteAsset(currentAsset.id);
    refresh();
    setAsset(getAxisAsset(currentAsset.id));
  }

  function handleAddToModel() {
    const model = addAssetToModel(currentAsset.id, models[0]?.id);
    router.push(`/dataset/${model.id}`);
  }

  const visibleMeanings = asset.meanings.filter(
    (meaning) =>
      ![
        "Saved moment",
        "Replay memory attached",
        "Ready for model building",
        "Returned to Library",
        "Session complete",
        "Session active",
      ].includes(meaning),
  );

  return (
    <Shell eyebrow="Asset" title={asset.title}>
      <section className="axis-cloud-panel">
        {asset.videoUrl ? (
          <video className="axis-cloud-video" controls playsInline src={asset.videoUrl} />
        ) : asset.thumbnailUrl ? (
          <img alt="" className="axis-cloud-hero-image" src={asset.thumbnailUrl} />
        ) : (
          <div className="axis-cloud-hero-image axis-cloud-blank">No preview</div>
        )}
        <div className="axis-cloud-actions">
          <button onClick={handleFavorite} type="button">
            {asset.favorite ? "Saved favorite" : "Save favorite"}
          </button>
          <button onClick={handleAddToModel} type="button">
            Add to Dataset
          </button>
          <button onClick={() => router.push(`/create?asset=${asset.id}`)} type="button">
            Generate
          </button>
        </div>
      </section>

      {visibleMeanings.length ? (
        <section className="axis-cloud-section">
        <div className="axis-chip-list">
          {visibleMeanings.map((meaning) => (
            <span key={meaning}>{meaning}</span>
          ))}
        </div>
        </section>
      ) : null}

      {related.length ? (
        <section className="axis-cloud-section">
          <div className="axis-cloud-row">
            <span>Related assets</span>
            <strong>{related.length}</strong>
          </div>
          <AssetGrid assets={related} />
        </section>
      ) : null}
    </Shell>
  );
}

export function ModelsIndex() {
  const { assets, models } = useCloudSnapshot();
  const router = useRouter();

  function handleBuildModel() {
    const sourceIds = assets.filter((asset) => asset.favorite).map((asset) => asset.id);
    const model = buildMyModel(sourceIds.length ? sourceIds : assets.slice(0, 6).map((asset) => asset.id));
    router.push(`/models/${model.id}`);
  }

  return (
    <Shell eyebrow="Models" title="Assets become patterns">
      {assets.length ? (
        <button className="axis-cloud-primary" onClick={handleBuildModel} type="button">
          Build my model
        </button>
      ) : null}

      <section className="axis-cloud-section">
        <div className="axis-cloud-row">
          <span>Model cards</span>
          <strong>{models.length}</strong>
        </div>
        <div className="axis-model-list">
          {models.map((model) => (
            <Link className="axis-model-card" href={`/models/${model.id}`} key={model.id}>
              <strong>{model.name}</strong>
              <span>{model.assetIds.length} assets</span>
              <em>{model.patternLabels.join(" / ")}</em>
            </Link>
          ))}
        </div>
      </section>
    </Shell>
  );
}

export function ModelDetail({ modelId }: { modelId: string }) {
  const { assets, products } = useCloudSnapshot();
  const [model, setModel] = useState<AxisModel | null>(null);
  const router = useRouter();

  useEffect(() => {
    setModel(getAxisModel(modelId));
  }, [modelId]);

  if (!model) {
    return (
      <Shell eyebrow="Model" title="Not built yet">
        <Link className="axis-cloud-primary" href="/models">
          Return to Models
        </Link>
      </Shell>
    );
  }

  const modelAssets = model.assetIds
    .map((id) => assets.find((asset) => asset.id === id))
    .filter((asset): asset is AxisAsset => Boolean(asset));
  const modelProducts = products.filter((product) => product.modelId === model.id);

  return (
    <Shell eyebrow="Model" title={model.name}>
      {modelAssets.length ? (
        <button className="axis-cloud-primary" onClick={() => router.push(`/create?model=${model.id}`)} type="button">
          Create from model
        </button>
      ) : null}

      <section className="axis-cloud-section">
        <div className="axis-cloud-row">
          <span>Assets</span>
          <strong>{modelAssets.length}</strong>
        </div>
        <AssetGrid assets={modelAssets} />
      </section>

      <section className="axis-cloud-section">
        <div className="axis-cloud-row">
          <span>Patterns</span>
          <strong>{model.patternLabels.length}</strong>
        </div>
        <div className="axis-chip-list">
          {model.patternLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </section>

      {modelProducts.length ? (
        <section className="axis-cloud-section">
          <div className="axis-cloud-row">
            <span>Products</span>
            <strong>{modelProducts.length}</strong>
          </div>
          <div className="axis-model-list">
            {modelProducts.map((product) => (
              <Link className="axis-model-card" href={`/product/${product.id}`} key={product.id}>
                <strong>{product.title}</strong>
                <span>{getProductLabel(product.kind)}</span>
                <em>{product.exportDestination ? `Exported / ${product.exportDestination}` : "Ready to export"}</em>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </Shell>
  );
}

export function CreateProduct({
  initialAssetId,
  initialDatasetId,
  initialModelId,
}: {
  initialAssetId?: string;
  initialDatasetId?: string;
  initialModelId?: string;
}) {
  const { assets, models, refresh } = useCloudSnapshot();
  const [selectedModelId, setSelectedModelId] = useState("");
  const [generatedProducts, setGeneratedProducts] = useState<AxisProduct[]>([]);
  const router = useRouter();
  const selectedDataset = models.find((model) => model.id === selectedModelId) ?? null;
  const hasDiscoverableInsights = hasMinimumDatasetInsightConfidence(selectedDataset);
  const allowedProducts = getRegisteredProductsForDataset(selectedDataset);

  useEffect(() => {
    if (initialDatasetId && models.some((model) => model.id === initialDatasetId)) {
      setSelectedModelId(initialDatasetId);
      return;
    }

    if (initialModelId && models.some((model) => model.id === initialModelId)) {
      setSelectedModelId(initialModelId);
      return;
    }

    if (initialAssetId && assets.some((asset) => asset.id === initialAssetId)) {
      const existingModel = models.find((model) => model.assetIds.includes(initialAssetId));
      if (existingModel) {
        setSelectedModelId(existingModel.id);
        return;
      }

      const model = buildMyModel([initialAssetId]);
      refresh();
      setSelectedModelId(model.id);
      return;
    }

  }, [assets, initialAssetId, initialDatasetId, initialModelId, models, refresh, selectedModelId]);

  function handleGenerate() {
    if (!selectedDataset || !hasDiscoverableInsights || !allowedProducts.length) return;

    const products = allowedProducts
      .map((kind) => generateProduct(kind, selectedDataset.id))
      .filter((product): product is AxisProduct => Boolean(product));
    setGeneratedProducts(products);
    refresh();
  }

  return (
    <Shell eyebrow="Create" title="Generate product">
      {!selectedDataset ? (
        <Link className="axis-cloud-primary" href="/">
          Back
        </Link>
      ) : (
        <>
          <section className="axis-cloud-section">
            <div className="axis-cloud-row">
              <span>Dataset</span>
              <strong>{selectedDataset.name}</strong>
            </div>
          </section>

          <section className="axis-cloud-panel axis-create-actions">
            {hasDiscoverableInsights ? (
              <button className="axis-cloud-primary" onClick={handleGenerate} type="button">
                Generate Product
              </button>
            ) : (
              <p className="axis-create-locked">Add more clips to unlock generation.</p>
            )}
            <Link className="axis-cloud-secondary" href={`/dataset/${selectedDataset.id}`}>
              Back
            </Link>
          </section>

          {generatedProducts.length ? (
            <section className="axis-cloud-section">
              <div className="axis-cloud-row">
                <span>Ready</span>
              </div>
              <div className="axis-model-list">
                {generatedProducts.map((product) => (
                  <Link className="axis-model-card" href={`/product/${product.id}`} key={product.id}>
                    <strong>{product.title}</strong>
                    <span>{getProductLabel(product.kind)}</span>
                    <em>{product.assetIds.length} clips</em>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </Shell>
  );
}

export function ProductDetail({ productId }: { productId: string }) {
  const { refresh } = useCloudSnapshot();
  const [product, setProduct] = useState<AxisProduct | null>(null);
  const router = useRouter();

  useEffect(() => {
    setProduct(getAxisProduct(productId));
  }, [productId]);

  if (!product) {
    return (
      <Shell eyebrow="Product" title="Not found">
        <Link className="axis-cloud-primary" href="/">
          Back
        </Link>
      </Shell>
    );
  }

  function handleSave() {
    if (!product) return;
    saveFavoriteAsset(getProductAssetId(product.id));
    refresh();
  }

  function handleExport(destination: ExportDestination) {
    if (!product) return;
    exportProduct(product.id, destination);
    refresh();
    router.push("/");
  }

  return (
    <Shell eyebrow="Product" title={product.title}>
      <section className="axis-cloud-section">
        <div className="axis-cloud-row">
          <span>Generated Output</span>
          <strong>{product.title}</strong>
        </div>
        <div className="axis-cloud-row">
          <span>Source Clip Count</span>
          <strong>{product.assetIds.length}</strong>
        </div>
      </section>

      {product.summary?.length ? (
        <section className="axis-cloud-section">
          <div className="axis-cloud-row">
            <span>What we found</span>
          </div>
          <div className="axis-chip-list">
            {product.summary.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="axis-cloud-panel">
        <div className="axis-product-actions">
          <button onClick={handleSave} type="button">
            Save
          </button>
          <Link href="/">Back</Link>
        </div>
      </section>

      <section className="axis-cloud-section">
        <div className="axis-cloud-row">
          <span>Share</span>
        </div>
        <div className="axis-create-grid">
          {exportDestinations.map((destination) => (
            <button onClick={() => handleExport(destination)} type="button" key={destination}>
              {formatExportDestination(destination)}
            </button>
          ))}
        </div>
      </section>
    </Shell>
  );
}

export function AccountSettings() {
  const { assets, products } = useCloudSnapshot();

  return (
    <Shell eyebrow="Account" title="Your Axis">
      <section className="axis-cloud-panel">
        <div className="axis-cloud-row">
          <span>Clips</span>
          <strong>{assets.filter((asset) => asset.kind === "clipnote").length}</strong>
        </div>
        <div className="axis-cloud-row">
          <span>Products</span>
          <strong>{products.length}</strong>
        </div>
      </section>
      <section className="axis-cloud-panel">
        <button
          className="axis-cloud-primary"
          onClick={() => {
            if (typeof window !== "undefined") {
              [
                "axis-cloud-favorites",
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
