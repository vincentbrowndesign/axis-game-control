import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { axisServerSupabaseOptions, getAxisSupabaseServerEnv } from "../axis-supabase-server";

const BUCKET = "axis-clip-originals";
const MAX_FILE_SIZE = 500 * 1024 * 1024;

export type OriginalClipUpload = {
  contentType: string;
  filename: string;
  filePath: string;
  ownerId: string;
};

export async function saveOriginalClipForAnalysis({
  contentType,
  filename,
  filePath,
  ownerId,
}: OriginalClipUpload) {
  const db = getStorageClient();
  if (!db.ok) return { error: db.error, uri: null };

  const bucketError = await ensureOriginalClipBucket(db.client);
  if (bucketError) return { error: bucketError, uri: null };

  const safeName = sanitizeFilename(filename || "clip.mp4");
  const objectPath = `${ownerId}/${Date.now()}-${randomUUID()}-${safeName}`;
  const file = await createFileBackedBlob(filePath, contentType);

  const { error } = await db.client.storage
    .from(BUCKET)
    .upload(objectPath, file, {
      cacheControl: "31536000",
      contentType,
      upsert: false,
    });

  if (error) return { error: error.message, uri: null };
  return { error: null, uri: toOriginalClipUri(objectPath) };
}

export async function createOriginalClipSignedUrl(uri: string) {
  const objectPath = fromOriginalClipUri(uri);
  if (!objectPath) return { error: "Original clip storage reference is invalid.", url: null };

  const db = getStorageClient();
  if (!db.ok) return { error: db.error, url: null };

  const { data, error } = await db.client.storage
    .from(BUCKET)
    .createSignedUrl(objectPath, 60 * 60);

  if (error || !data?.signedUrl) {
    return { error: error?.message ?? "Original clip signed URL could not be created.", url: null };
  }

  return { error: null, url: data.signedUrl };
}

function getStorageClient() {
  const env = getAxisSupabaseServerEnv();
  if (!env.ok) return { error: env.reason, ok: false as const };
  return {
    client: createClient(env.url, env.key, axisServerSupabaseOptions),
    ok: true as const,
  };
}

async function ensureOriginalClipBucket(client: ReturnType<typeof createClient>) {
  const { data } = await client.storage.getBucket(BUCKET);
  if (data) return null;

  const { error } = await client.storage.createBucket(BUCKET, {
    allowedMimeTypes: [
      "video/mp4",
      "video/quicktime",
      "video/webm",
      "video/x-m4v",
      "video/avi",
      "video/mpeg",
    ],
    fileSizeLimit: MAX_FILE_SIZE,
    public: false,
  });

  return error?.message ?? null;
}

async function createFileBackedBlob(filePath: string, contentType: string) {
  const fsModule = await import("node:fs");
  const maybeOpenAsBlob = (fsModule as typeof fsModule & {
    openAsBlob?: (path: string, options?: { type?: string }) => Promise<Blob>;
  }).openAsBlob;

  if (maybeOpenAsBlob) return maybeOpenAsBlob(filePath, { type: contentType });

  const bytes = await fsModule.promises.readFile(filePath);
  return new Blob([bytes], { type: contentType });
}

function toOriginalClipUri(objectPath: string) {
  return `supabase://${BUCKET}/${objectPath}`;
}

function fromOriginalClipUri(uri: string) {
  const prefix = `supabase://${BUCKET}/`;
  return uri.startsWith(prefix) ? uri.slice(prefix.length) : null;
}

function sanitizeFilename(filename: string) {
  const parsed = path.parse(filename);
  const base = parsed.name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "clip";
  const ext = parsed.ext.replace(/[^a-zA-Z0-9.]/g, "") || ".mp4";
  return `${base}${ext}`;
}
