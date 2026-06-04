import { createClient } from "@supabase/supabase-js";

export type AxisArtifactRecord = {
  artifact_body: string;
  artifact_id: string;
  artifact_title: string;
  artifact_type: string;
  created_at: string;
  source_clip_count: number;
  upload_id: string;
};

export type AxisExportRecord = {
  artifact_id: string;
  created_at: string;
  destination: string;
  export_id: string;
  export_type: string;
};

export type AxisArtifactFactRecord = {
  artifact_id: string;
  created_at: string;
  fact_id: string;
  fact_key: string;
  fact_label: string;
  fact_text_value?: string | null;
  fact_unit: string;
  fact_value: number;
  sample_size: number;
  source?: string | null;
  support_level?: "strong" | "medium" | "weak" | null;
  temporal_support?: string | null;
  upload_id: string;
  verification_status?: "accepted" | "needs_review" | "rejected" | null;
};

export type AxisDecoderTestRecord = {
  correct: number;
  created_at: string;
  decoded: unknown;
  expected: unknown;
  missing: unknown;
  mux_playback_id?: string | null;
  pass: boolean;
  test_id: string;
  total: number;
  upload_id: string;
  wrong: unknown;
};

export type AxisEntityTrackRecord = {
  artifact_id?: string | null;
  confidence?: number | null;
  created_at?: string;
  entity_id: string;
  entity_type: "ball" | "hoop" | "player";
  frame: number;
  id?: string;
  metadata?: Record<string, unknown> | null;
  source?: string | null;
  time?: number;
  track?: Record<string, unknown>;
  track_id?: string;
  upload_id: string;
  x: number;
  y: number;
};

export type AxisPersistenceResult<T> =
  | {
      record: T;
      stored: true;
    }
  | {
      reason: string;
      stored: false;
    };

export function getAxisPersistenceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function persistAxisArtifact(record: AxisArtifactRecord): Promise<AxisPersistenceResult<AxisArtifactRecord>> {
  const supabase = getAxisPersistenceClient();
  if (!supabase) return { reason: "supabase_not_configured", stored: false };

  const { data, error } = await supabase
    .from("axis_artifacts")
    .upsert(record, { onConflict: "artifact_id" })
    .select()
    .single();

  if (error) return { reason: error.message, stored: false };
  return { record: data as AxisArtifactRecord, stored: true };
}

export async function persistAxisExport(record: AxisExportRecord): Promise<AxisPersistenceResult<AxisExportRecord>> {
  const supabase = getAxisPersistenceClient();
  if (!supabase) return { reason: "supabase_not_configured", stored: false };

  const { data, error } = await supabase
    .from("axis_exports")
    .upsert(record, { onConflict: "export_id" })
    .select()
    .single();

  if (error) return { reason: error.message, stored: false };
  return { record: data as AxisExportRecord, stored: true };
}

export async function persistAxisArtifactFacts(records: AxisArtifactFactRecord[]) {
  const supabase = getAxisPersistenceClient();
  if (!supabase) return { reason: "supabase_not_configured", stored: false };
  if (!records.length) return { records: [] as AxisArtifactFactRecord[], stored: true };

  const { data, error } = await supabase
    .from("axis_artifact_facts")
    .upsert(records, { onConflict: "fact_id" })
    .select();

  if (error) return { reason: error.message, stored: false };
  return { records: (data ?? []) as AxisArtifactFactRecord[], stored: true };
}

export async function getAxisArtifactHistory({
  artifactId,
  limit = 50,
  uploadId,
}: {
  artifactId?: string;
  limit?: number;
  uploadId?: string;
}) {
  const supabase = getAxisPersistenceClient();
  if (!supabase) return { error: "supabase_not_configured", records: [] as AxisArtifactRecord[] };

  let query = supabase
    .from("axis_artifacts")
    .select("artifact_id,upload_id,artifact_type,artifact_title,artifact_body,source_clip_count,created_at")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));

  if (artifactId) query = query.eq("artifact_id", artifactId);
  if (uploadId) query = query.eq("upload_id", uploadId);

  const { data, error } = await query;
  return { error: error?.message ?? null, records: (data ?? []) as AxisArtifactRecord[] };
}

export async function getAxisExportHistory({
  artifactId,
  exportId,
  limit = 50,
}: {
  artifactId?: string;
  exportId?: string;
  limit?: number;
}) {
  const supabase = getAxisPersistenceClient();
  if (!supabase) return { error: "supabase_not_configured", records: [] as AxisExportRecord[] };

  let query = supabase
    .from("axis_exports")
    .select("export_id,artifact_id,export_type,destination,created_at")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));

  if (artifactId) query = query.eq("artifact_id", artifactId);
  if (exportId) query = query.eq("export_id", exportId);

  const { data, error } = await query;
  return { error: error?.message ?? null, records: (data ?? []) as AxisExportRecord[] };
}

export async function getAxisArtifactFactHistory({
  artifactId,
  factKey,
  limit = 50,
  uploadId,
}: {
  artifactId?: string;
  factKey?: string;
  limit?: number;
  uploadId?: string;
}) {
  const supabase = getAxisPersistenceClient();
  if (!supabase) return { error: "supabase_not_configured", records: [] as AxisArtifactFactRecord[] };

  let query = supabase
    .from("axis_artifact_facts")
    .select("fact_id,artifact_id,upload_id,fact_key,fact_label,fact_value,fact_text_value,fact_unit,sample_size,source,support_level,temporal_support,verification_status,created_at")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));

  if (artifactId) query = query.eq("artifact_id", artifactId);
  if (factKey) query = query.eq("fact_key", factKey);
  if (uploadId) query = query.eq("upload_id", uploadId);

  const { data, error } = await query;
  return { error: error?.message ?? null, records: (data ?? []) as AxisArtifactFactRecord[] };
}

export async function persistAxisEntityTracks(records: AxisEntityTrackRecord[]) {
  const supabase = getAxisPersistenceClient();
  if (!supabase) return { reason: "supabase_not_configured", stored: false };
  if (!records.length) return { records: [] as AxisEntityTrackRecord[], stored: true };

  const rows = records.map((record) => ({
    confidence: record.confidence ?? null,
    entity_type: record.entity_type,
    metadata: {
      artifact_id: record.artifact_id ?? null,
      track_id: record.track_id ?? null,
    },
    source: record.source ?? "roboflow",
    track: {
      artifact_id: record.artifact_id ?? null,
      confidence: record.confidence ?? null,
      entity_id: record.entity_id,
      entity_type: record.entity_type,
      frame: record.frame,
      time: record.time ?? null,
      x: record.x,
      y: record.y,
    },
    upload_id: record.upload_id,
  }));
  const uploadIds = Array.from(new Set(records.map((record) => record.upload_id)));
  const cleanup = await supabase.from("axis_entity_tracks").delete().in("upload_id", uploadIds);
  if (cleanup.error) return { reason: cleanup.error.message, stored: false };

  const { data, error } = await supabase
    .from("axis_entity_tracks")
    .insert(rows)
    .select();

  if (error) return { reason: error.message, stored: false };
  return { records: mapAxisEntityTrackRows(data ?? []), stored: true };
}

export async function getAxisEntityTracks({
  artifactId,
  entityType,
  limit = 500,
  uploadId,
}: {
  artifactId?: string;
  entityType?: AxisEntityTrackRecord["entity_type"];
  limit?: number;
  uploadId?: string;
}) {
  const supabase = getAxisPersistenceClient();
  if (!supabase) return { error: "supabase_not_configured", records: [] as AxisEntityTrackRecord[] };

  let query = supabase
    .from("axis_entity_tracks")
    .select("id,upload_id,entity_type,track,source,confidence,metadata,created_at")
    .order("created_at", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 2000)));

  if (artifactId) query = query.contains("metadata", { artifact_id: artifactId });
  if (entityType) query = query.eq("entity_type", entityType);
  if (uploadId) query = query.eq("upload_id", uploadId);

  const { data, error } = await query;
  return { error: error?.message ?? null, records: mapAxisEntityTrackRows(data ?? []) };
}

function mapAxisEntityTrackRows(rows: unknown[]): AxisEntityTrackRecord[] {
  return rows
    .map((row): AxisEntityTrackRecord | null => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return null;
      const record = row as Record<string, unknown>;
      const track = record.track && typeof record.track === "object" && !Array.isArray(record.track)
        ? (record.track as Record<string, unknown>)
        : {};
      const metadata = record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
        ? (record.metadata as Record<string, unknown>)
        : null;
      const entityType = getEntityType(record.entity_type ?? track.entity_type);
      const frame = getNumber(track.frame);
      const x = getNumber(track.x);
      const y = getNumber(track.y);
      const entityId = getString(track.entity_id);
      const uploadId = getString(record.upload_id);
      if (!entityType || frame === undefined || x === undefined || y === undefined || !entityId || !uploadId) return null;

      return {
        artifact_id: getString(track.artifact_id) || getString(metadata?.artifact_id) || null,
        confidence: getNumber(record.confidence) ?? getNumber(track.confidence) ?? null,
        created_at: getString(record.created_at),
        entity_id: entityId,
        entity_type: entityType,
        frame,
        id: getString(record.id),
        metadata,
        source: getString(record.source) || null,
        time: getNumber(track.time),
        track,
        track_id: getString(metadata?.track_id),
        upload_id: uploadId,
        x,
        y,
      };
    })
    .filter((record): record is AxisEntityTrackRecord => Boolean(record))
    .sort((a, b) => a.frame - b.frame || (a.time ?? a.frame) - (b.time ?? b.frame));
}

function getEntityType(value: unknown): AxisEntityTrackRecord["entity_type"] | null {
  return value === "ball" || value === "hoop" || value === "player" ? value : null;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function persistAxisDecoderTest(record: AxisDecoderTestRecord): Promise<AxisPersistenceResult<AxisDecoderTestRecord>> {
  const supabase = getAxisPersistenceClient();
  if (!supabase) return { reason: "supabase_not_configured", stored: false };

  const { data, error } = await supabase
    .from("axis_decoder_tests")
    .insert(record)
    .select()
    .single();

  if (error) return { reason: error.message, stored: false };
  return { record: data as AxisDecoderTestRecord, stored: true };
}

export async function getAxisDecoderTests({
  limit = 25,
  pass,
  uploadId,
}: {
  limit?: number;
  pass?: boolean;
  uploadId?: string;
}) {
  const supabase = getAxisPersistenceClient();
  if (!supabase) return { error: "supabase_not_configured", records: [] as AxisDecoderTestRecord[] };

  let query = supabase
    .from("axis_decoder_tests")
    .select("test_id,upload_id,mux_playback_id,expected,decoded,wrong,missing,total,correct,pass,created_at")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));

  if (uploadId) query = query.eq("upload_id", uploadId);
  if (typeof pass === "boolean") query = query.eq("pass", pass);

  const { data, error } = await query;
  return { error: error?.message ?? null, records: (data ?? []) as AxisDecoderTestRecord[] };
}

export async function getAxisDecoderTestHistory({ limit }: { limit?: number } = {}) {
  const supabase = getAxisPersistenceClient();
  if (!supabase) return { error: "supabase_not_configured", records: [] as AxisDecoderTestRecord[] };

  let query = supabase
    .from("axis_decoder_tests")
    .select("test_id,upload_id,mux_playback_id,expected,decoded,wrong,missing,total,correct,pass,created_at")
    .order("created_at", { ascending: false });

  if (typeof limit === "number") query = query.limit(Math.max(1, Math.min(limit, 500)));

  const { data, error } = await query;
  return { error: error?.message ?? null, records: (data ?? []) as AxisDecoderTestRecord[] };
}
