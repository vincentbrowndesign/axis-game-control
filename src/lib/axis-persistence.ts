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
