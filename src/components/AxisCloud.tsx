"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as tus from "tus-js-client";
import {
  addAssetToModel,
  buildMyModel,
  createUploadedSessionAsset,
  exportProduct,
  generateProduct,
  getAxisAsset,
  getAxisAssets,
  getAxisModel,
  getAxisModels,
  getAxisProducts,
  getProductAssetId,
  getProductLabel,
  toggleFavoriteAsset,
  type AxisAsset,
  type AxisModel,
  type AxisProduct,
  type AxisProductKind,
  type ExportDestination,
} from "../lib/axis-cloud-store";

const productKinds: AxisProductKind[] = [
  "highlight",
  "practice",
  "scout-report",
  "film-study",
  "playlist",
  "story",
  "curriculum",
];

const exportDestinations: Array<{ id: ExportDestination; label: string }> = [
  { id: "camera-roll", label: "Camera Roll" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
];

type UploadState = "idle" | "uploading" | "saving";

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
        <Link href="/">Library</Link>
        <Link href="/models">Models</Link>
        <Link href="/create">Create</Link>
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
    router.push(`/models/${model.id}`);
  }

  return (
    <Shell eyebrow="Asset" title={asset.title}>
      <section className="axis-cloud-panel">
        {asset.videoUrl ? (
          <video className="axis-cloud-video" controls playsInline src={asset.videoUrl} />
        ) : asset.thumbnailUrl ? (
          <img alt="" className="axis-cloud-hero-image" src={asset.thumbnailUrl} />
        ) : (
          <div className="axis-cloud-hero-image axis-cloud-blank">{asset.kind}</div>
        )}
        <div className="axis-cloud-actions">
          <button onClick={handleFavorite} type="button">
            {asset.favorite ? "Saved favorite" : "Save favorite"}
          </button>
          <button onClick={handleAddToModel} type="button">
            Add to model
          </button>
          <button onClick={() => router.push(`/create?asset=${asset.id}`)} type="button">
            Create product
          </button>
        </div>
      </section>

      <section className="axis-cloud-section">
        <div className="axis-cloud-row">
          <span>Meanings</span>
          <strong>{asset.meanings.length}</strong>
        </div>
        <div className="axis-chip-list">
          {asset.meanings.map((meaning) => (
            <span key={meaning}>{meaning}</span>
          ))}
        </div>
      </section>

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
              <Link className="axis-model-card" href={`/asset/${getProductAssetId(product.id)}`} key={product.id}>
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
  initialModelId,
}: {
  initialAssetId?: string;
  initialModelId?: string;
}) {
  const { assets, models, products, refresh } = useCloudSnapshot();
  const [selectedModelId, setSelectedModelId] = useState("");
  const [latestProduct, setLatestProduct] = useState<AxisProduct | null>(null);
  const router = useRouter();

  useEffect(() => {
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

    if (!selectedModelId && models[0]) setSelectedModelId(models[0].id);
  }, [assets, initialAssetId, initialModelId, models, refresh, selectedModelId]);

  function handleGenerate(kind: AxisProductKind) {
    const product = generateProduct(kind, selectedModelId || models[0]?.id || buildMyModel(assets.map((asset) => asset.id)).id);
    setLatestProduct(product);
    refresh();
  }

  function handleExport(destination: ExportDestination) {
    if (!latestProduct) return;
    exportProduct(latestProduct.id, destination);
    refresh();
    router.push("/");
  }

  return (
    <Shell eyebrow="Create" title="Models generate products">
      {models.length ? (
        <label className="axis-cloud-search">
          <span>Model</span>
          <select onChange={(event) => setSelectedModelId(event.target.value)} value={selectedModelId}>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {(models.length || assets.length) ? (
        <section className="axis-cloud-section">
          <div className="axis-cloud-row">
            <span>Generate</span>
            <strong>{productKinds.length}</strong>
          </div>
          <div className="axis-create-grid">
            {productKinds.map((kind) => (
              <button onClick={() => handleGenerate(kind)} type="button" key={kind}>
                {getProductLabel(kind)}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <Link className="axis-cloud-primary" href="/">
          Upload to Library
        </Link>
      )}

      {latestProduct ? (
        <section className="axis-cloud-panel">
          <div className="axis-cloud-row">
            <span>Export</span>
            <strong>{latestProduct.title}</strong>
          </div>
          <div className="axis-create-grid">
            {exportDestinations.map((destination) => (
              <button onClick={() => handleExport(destination.id)} type="button" key={destination.id}>
                {destination.label}
              </button>
            ))}
          </div>
        </section>
      ) : products.length ? (
        <section className="axis-cloud-section">
          <div className="axis-cloud-row">
            <span>Recent products</span>
            <strong>{products.length}</strong>
          </div>
          <div className="axis-model-list">
            {products.slice(0, 3).map((product) => (
              <Link className="axis-model-card" href={`/asset/${getProductAssetId(product.id)}`} key={product.id}>
                <strong>{product.title}</strong>
                <span>{getProductLabel(product.kind)}</span>
                <em>{product.exportDestination ? `Exported / ${product.exportDestination}` : "Ready"}</em>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </Shell>
  );
}

export function AccountSettings() {
  return (
    <Shell eyebrow="Account" title="Continuity settings">
      <section className="axis-cloud-panel">
        <div className="axis-cloud-row">
          <span>Environment</span>
          <strong>Preserved</strong>
        </div>
        <p className="axis-cloud-copy">
          Supabase, auth, Mux, uploads, replay, APIs, exports, and check-in data remain underneath this frontend.
        </p>
      </section>
      <section className="axis-cloud-section">
        <div className="axis-chip-list">
          <span>Library</span>
          <span>Models</span>
          <span>Create</span>
          <span>Export loop</span>
        </div>
      </section>
    </Shell>
  );
}
