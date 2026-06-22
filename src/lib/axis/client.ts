import type {
  AxisOutput,
  AxisRunContractPreview,
  AxisRunContractValidation,
  AxisRunExecutionState,
  AxisRunPayload,
  AxisRunRequestPreview,
  AxisRunResultEnvelope,
  AxisRunSubmitGuard,
  AxisRunWiringChecklistItem,
} from "./types";

export const AXIS_UI_V2_ENABLED = process.env.NEXT_PUBLIC_AXIS_UI_V2 === "true";
export const AXIS_RUN_WIRING_ENABLED = false;
export const AXIS_RUN_TARGET_ROUTE = "/api/axis/run" as const;

export function createAxisRunPayloadFromPreview(preview: AxisRunRequestPreview): AxisRunPayload {
  return {
    currentProject: preview.sessionId,
    expectedOutputId: preview.expectedOutputId,
    inputText: preview.inputText,
    localAttachment: preview.localAttachment,
    mediaSourceId: preview.mediaSourceId,
    mode: "type",
    outputType: preview.selectedOutputType,
    previewId: preview.id,
    sessionId: preview.sessionId,
    targetRoute: preview.targetRoute,
  };
}

export function createAxisRunResultEnvelope(
  output: AxisOutput,
  preview?: AxisRunRequestPreview,
): AxisRunResultEnvelope {
  return {
    createdAt: output.createdAt,
    id: `axis-run-result-${output.id}`,
    output,
    payload: preview ? createAxisRunPayloadFromPreview(preview) : undefined,
    source: "local_preview",
    status: output.status,
  };
}

export function createAxisRunContractPreview(
  output: AxisOutput,
  preview?: AxisRunRequestPreview,
): AxisRunContractPreview {
  return {
    execution: getAxisRunExecutionState(),
    isLinkedToOutput: Boolean(preview?.expectedOutputId && preview.expectedOutputId === output.id),
    payload: preview ? createAxisRunPayloadFromPreview(preview) : undefined,
    result: createAxisRunResultEnvelope(output, preview),
  };
}

export function validateAxisRunContractPreview(contract: AxisRunContractPreview): AxisRunContractValidation {
  if (!contract.payload) {
    return {
      ok: false,
      label: "Missing payload",
      message: "This local preview has a result shape, but no future run payload yet.",
    };
  }

  if (contract.payload.targetRoute !== contract.execution.targetRoute) {
    return {
      ok: false,
      label: "Route mismatch",
      message: "The local payload route does not match the execution target.",
    };
  }

  if (!contract.isLinkedToOutput) {
    return {
      ok: false,
      label: "Output link missing",
      message: "The local payload is not matched to this output yet.",
    };
  }

  return {
    ok: true,
    label: "Contract ready",
    message: "Payload, output, and execution boundary match locally.",
  };
}

export function getAxisRunExecutionState(): AxisRunExecutionState {
  return {
    enabled: AXIS_RUN_WIRING_ENABLED,
    label: AXIS_RUN_WIRING_ENABLED ? "Execution ready" : "Execution locked",
    message: AXIS_RUN_WIRING_ENABLED
      ? "Axis run wiring is ready to receive this payload."
      : "Axis run wiring is prepared, but no backend run is called yet.",
    targetRoute: AXIS_RUN_TARGET_ROUTE,
  };
}

export function getAxisRunWiringChecklist(): AxisRunWiringChecklistItem[] {
  return [
    { label: "typed payload", ready: true },
    { label: "result envelope", ready: true },
    { label: "contract validation", ready: true },
    { label: "backend execution", ready: AXIS_RUN_WIRING_ENABLED },
  ];
}

export function getAxisRunSubmitGuard(contract: AxisRunContractPreview): AxisRunSubmitGuard {
  const validation = validateAxisRunContractPreview(contract);

  if (!validation.ok) {
    return {
      canSubmit: false,
      label: "Run needs review",
      message: validation.message,
    };
  }

  if (!contract.execution.enabled) {
    return {
      canSubmit: false,
      label: "Run locked",
      message: contract.execution.message,
    };
  }

  return {
    canSubmit: true,
    label: "Run ready",
    message: "This contract can be submitted to Axis run wiring.",
  };
}

export async function sendAxisRun(_payload: AxisRunPayload) {
  const executionState = getAxisRunExecutionState();
  throw new Error(`${executionState.label}: ${executionState.message}`);
}

export type AxisRecentOutputsResult = {
  message?: string;
  outputs: AxisOutput[];
  source: "backend" | "fallback";
  status: "ready" | "empty" | "error";
};

type AxisBackendRecord = Record<string, unknown>;

const fallbackAxisOutputs: AxisOutput[] = [
  {
    id: "fallback-output-session-note",
    title: "Session note draft",
    type: "text",
    status: "ready",
    createdAt: "2026-01-01T00:00:00.000Z",
    summary: "Local example shown until saved outputs are available.",
    sourceLabel: "Output",
  },
  {
    id: "fallback-output-report",
    title: "Report draft",
    type: "report",
    status: "processing",
    createdAt: "2026-01-01T00:00:00.000Z",
    summary: "A future report output will appear here after backend wiring.",
    sourceLabel: "Report",
  },
];

export function getFallbackAxisOutputs() {
  return fallbackAxisOutputs;
}

export async function fetchRecentAxisOutputs(limit = 8): Promise<AxisRecentOutputsResult> {
  const sources = await Promise.allSettled([
    fetchAxisOutputRecords(`/api/axis/artifacts?limit=${limit}`, "artifact"),
    fetchAxisOutputRecords(`/api/axis/exports?limit=${limit}`, "export"),
  ]);

  const outputs = sources
    .flatMap((source) => (source.status === "fulfilled" ? source.value : []))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, limit);

  if (outputs.length > 0) {
    return {
      outputs,
      source: "backend",
      status: "ready",
    };
  }

  const hadRejectedSource = sources.some((source) => source.status === "rejected");

  return {
    message: hadRejectedSource
      ? "Recent outputs are unavailable. Showing local examples."
      : "No saved outputs yet. Showing local examples.",
    outputs: fallbackAxisOutputs,
    source: "fallback",
    status: hadRejectedSource ? "error" : "empty",
  };
}

async function fetchAxisOutputRecords(url: string, source: "artifact" | "export") {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error("Axis output history is unavailable.");
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  const records = getRecords(payload);
  return records.map((record) => mapRecordToAxisOutput(record, source));
}

function getRecords(payload: unknown): AxisBackendRecord[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const records = (payload as Record<string, unknown>).records;
  return Array.isArray(records) ? records.filter(isRecord) : [];
}

function isRecord(value: unknown): value is AxisBackendRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function mapRecordToAxisOutput(record: AxisBackendRecord, source: "artifact" | "export"): AxisOutput {
  if (source === "artifact") {
    const title = getString(record.artifact_title) || "Axis output";
    const body = getString(record.artifact_body);
    const artifactType = getString(record.artifact_type);

    return {
      id: `artifact-${getString(record.artifact_id) || title}`,
      title,
      type: getOutputType(artifactType, "text"),
      status: "ready",
      createdAt: getDateString(record.created_at),
      summary: body ? summarize(body) : undefined,
      sourceLabel: getSourceLabel(artifactType, "Output"),
    };
  }

  const exportType = getString(record.export_type);
  const destination = getString(record.destination);
  const title = `${getSourceLabel(exportType, "Report")} export`;

  return {
    id: `export-${getString(record.export_id) || getString(record.artifact_id) || title}`,
    title,
    type: getOutputType(exportType, "report"),
    status: "ready",
    createdAt: getDateString(record.created_at),
    summary: destination ? `Prepared for ${normalizeDestination(destination)}.` : "Saved export record.",
    sourceLabel: getSourceLabel(exportType, "Report"),
  };
}

function getOutputType(value: string, fallback: AxisOutput["type"]): AxisOutput["type"] {
  const normalized = value.toLowerCase();
  if (normalized.includes("audio")) return "audio";
  if (normalized.includes("automation")) return "automation";
  if (normalized.includes("clip")) return "clip";
  if (normalized.includes("file") || normalized.includes("document")) return "file";
  if (normalized.includes("image")) return "image";
  if (normalized.includes("report") || normalized.includes("pdf") || normalized.includes("export")) return "report";
  if (normalized.includes("video")) return "video";
  if (normalized.includes("text") || normalized.includes("note")) return "text";
  return fallback;
}

function getSourceLabel(value: string, fallback: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("clip")) return "Clip";
  if (normalized.includes("file") || normalized.includes("document")) return "File";
  if (normalized.includes("report") || normalized.includes("pdf") || normalized.includes("export")) return "Report";
  if (normalized.includes("video")) return "Video";
  if (normalized.includes("image")) return "Image";
  if (normalized.includes("audio")) return "Audio";
  return fallback;
}

function normalizeDestination(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "output";
  if (normalized.includes("parent")) return "parent view";
  if (normalized.includes("coach")) return "coach view";
  if (normalized.includes("player")) return "player view";
  return "output";
}

function summarize(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 150);
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getDateString(value: unknown) {
  const raw = getString(value);
  return raw && Number.isFinite(Date.parse(raw)) ? raw : "2026-01-01T00:00:00.000Z";
}
