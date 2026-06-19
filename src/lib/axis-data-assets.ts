export const AXIS_DATA_ASSET_SCHEMA_VERSION = 1 as const;

export type AxisDataAssetSchemaVersion =
  typeof AXIS_DATA_ASSET_SCHEMA_VERSION;

export type AxisSourceKind =
  | "text"
  | "voice"
  | "image"
  | "clip"
  | "file"
  | "screenshot"
  | "stream"
  | "camera"
  | "manual_note";

export type AxisSubjectType =
  | "player"
  | "team"
  | "practice"
  | "game"
  | "project"
  | "program"
  | "content_stream"
  | "skill";

export type AxisSubjectRef = Readonly<{
  subjectType: AxisSubjectType;
  subjectId: string;
  displayName?: string;
}>;

export type AxisProvenanceOrigin =
  | "user"
  | "axis"
  | "import"
  | "camera"
  | "cv_worker"
  | "system";

export type AxisProvenance = Readonly<{
  origin: AxisProvenanceOrigin;
  createdBy?: string;
  model?: string;
  modelVersion?: string;
  sourceRecordIds?: readonly string[];
}>;

export type AxisDataSensitivity =
  | "standard"
  | "private"
  | "minor_data"
  | "restricted";

// Source is not evidence. Media/file records point to source material only.
export type AxisSourceRecord = Readonly<{
  id: string;
  sourceKind: AxisSourceKind;
  title?: string;

  textContent?: string;

  // Reference only. Never place large file bytes or base64 payloads here.
  sourceRef?: string;

  sourceMessageId?: string;
  sourceThreadId?: string;

  subjectRefs: readonly AxisSubjectRef[];

  capturedAt?: string;
  createdAt: string;

  provenance: AxisProvenance;
  sensitivity: AxisDataSensitivity;
  schemaVersion: AxisDataAssetSchemaVersion;
}>;

export type AxisStructuredRecordType =
  | "event"
  | "observation"
  | "claim"
  | "player_action"
  | "zone"
  | "result"
  | "constraint"
  | "relationship"
  | "source_reference";

export type AxisRecordStage =
  | "suggested"
  | "kept"
  | "verified"
  | "rejected"
  | "archived";

// Confidence is not truth. Verified requires explicit future rules.
export type AxisConfidence =
  | "unknown"
  | "low"
  | "medium"
  | "high";

// Observation is not claim. Kept is not verified.
export type AxisStructuredRecord = Readonly<{
  id: string;
  recordType: AxisStructuredRecordType;
  title: string;
  body?: string;

  subjectRefs: readonly AxisSubjectRef[];
  sourceRecordIds: readonly string[];

  stage: AxisRecordStage;
  confidence: AxisConfidence;
  provenance: AxisProvenance;
  sensitivity: AxisDataSensitivity;

  createdAt: string;
  updatedAt: string;
  schemaVersion: AxisDataAssetSchemaVersion;
}>;

export type AxisDatasetType =
  | "player"
  | "team"
  | "practice"
  | "game"
  | "project"
  | "content"
  | "skill"
  | "program";

export type AxisDatasetStatus =
  | "draft"
  | "active"
  | "archived";

export type AxisDataset = Readonly<{
  id: string;
  datasetType: AxisDatasetType;
  title: string;
  description?: string;

  subjectRefs: readonly AxisSubjectRef[];
  sourceRecordIds: readonly string[];
  structuredRecordIds: readonly string[];

  status: AxisDatasetStatus;
  sensitivity: AxisDataSensitivity;

  createdAt: string;
  updatedAt: string;
  schemaVersion: AxisDataAssetSchemaVersion;
}>;

export type AxisDataAssetType =
  | "player_profile"
  | "team_dataset"
  | "practice_dataset"
  | "game_dataset"
  | "clip_library"
  | "content_bank"
  | "playbook"
  | "challenge_history"
  | "proof_bank";

export type AxisDataAssetStatus =
  | "draft"
  | "active"
  | "verified"
  | "archived";

export type AxisDataAsset = Readonly<{
  id: string;
  assetType: AxisDataAssetType;
  title: string;
  summary: string;

  subjectRefs: readonly AxisSubjectRef[];

  sourceRecordIds: readonly string[];
  structuredRecordIds: readonly string[];
  datasetIds: readonly string[];

  // Kept structured records. This does not create a Keeper Card type.
  keeperRecordIds: readonly string[];

  // Reserved for a future Evidence Layer.
  evidenceObjectIds?: readonly string[];

  confidence: AxisConfidence;
  status: AxisDataAssetStatus;
  sensitivity: AxisDataSensitivity;

  version: number;
  createdAt: string;
  updatedAt: string;
  schemaVersion: AxisDataAssetSchemaVersion;
}>;

export type AxisOutputProductType =
  | "player_recap"
  | "practice_plan"
  | "parent_report"
  | "coach_board"
  | "clip_pack"
  | "playbook"
  | "content_pack";

export type AxisOutputProductStatus =
  | "draft"
  | "rendered"
  | "published"
  | "archived";

// Output is derivative, not the source of truth for underlying records.
export type AxisOutputProduct = Readonly<{
  id: string;
  outputType: AxisOutputProductType;
  title: string;

  sourceAssetIds: readonly string[];
  sourceDatasetIds: readonly string[];

  status: AxisOutputProductStatus;
  sensitivity: AxisDataSensitivity;

  generatedAt?: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: AxisDataAssetSchemaVersion;
}>;

export function isVerifiedAxisRecord(
  record: AxisStructuredRecord,
): boolean {
  return record.stage === "verified";
}

export function canCreateVerifiedAsset(
  records: readonly AxisStructuredRecord[],
): boolean {
  return records.length > 0 && records.every(isVerifiedAxisRecord);
}
