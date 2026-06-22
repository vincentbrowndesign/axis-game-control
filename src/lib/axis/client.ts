import type {
  AxisOutput,
  AxisRunAdapterContract,
  AxisRunAdapterDryRunPreview,
  AxisRunCompatibilityState,
  AxisRunContractPreview,
  AxisRunContractValidation,
  AxisRunAdapterStatusPreview,
  AxisRunDryRunRequest,
  AxisRunDryRunResponse,
  AxisRunDryRunResult,
  AxisRunExecutionState,
  AxisRunAdapterPreview,
  AxisRunDryRunGuard,
  AxisRunPayload,
  AxisRunRequestPreview,
  AxisRunResultEnvelope,
  AxisRunRouteCompatibility,
  AxisRunSubmitGuard,
  AxisRunSubmitReadinessSummary,
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
    { label: "route adapter", ready: getAxisRunCompatibilityState().compatible },
    { label: "backend execution", ready: AXIS_RUN_WIRING_ENABLED },
  ];
}

export function getAxisRunCompatibilityState(): AxisRunCompatibilityState {
  return {
    compatible: false,
    label: "Adapter needed",
    message: "Current /api/axis/run is legacy AxisUnderstanding. Unified AxisOutput transport is not wired yet.",
    route: AXIS_RUN_TARGET_ROUTE,
  };
}

export function getAxisRunRouteCompatibility(contract: AxisRunContractPreview): AxisRunRouteCompatibility {
  const missing: string[] = [];
  const validation = validateAxisRunContractPreview(contract);

  if (!validation.ok) missing.push(validation.label);
  missing.push("real AxisOutput adapter implementation");
  missing.push("explicit submit unlock");

  return {
    canDryRun: validation.ok,
    canSubmit: false,
    compatible: validation.ok,
    missing,
    reason: validation.ok
      ? "Adapter contract ready. Submit is still locked."
      : validation.message,
  };
}

export function buildAxisRunAdapterPreview(contract: AxisRunContractPreview): AxisRunAdapterPreview {
  const routeCompatibility = getAxisRunRouteCompatibility(contract);
  const payloadPreview = buildAxisRunPayloadPreview(contract.payload);

  return {
    compatible: routeCompatibility.compatible,
    dryRunOnly: true,
    expectedResponsePreview: {
      cards: "AxisCard[]",
      comparison: "legacy comparison | null",
      operatingSystem: "legacy operating system | null",
      sidebarThreads: "legacy sidebar thread list",
      threadId: "string",
      understanding: "AxisUnderstanding",
    },
    method: "POST",
    missing: routeCompatibility.missing,
    outputAdapterPreview: mapAxisRunResponseToAxisOutputPreview(contract),
    payloadPreview,
    route: AXIS_RUN_TARGET_ROUTE,
    submitLocked: true,
  };
}

export function buildAxisRunAdapterDryRunPreview(contract: AxisRunContractPreview): AxisRunAdapterDryRunPreview {
  const adapterPreview = buildAxisRunAdapterPreview(contract);
  const outputType = adapterPreview.outputAdapterPreview.outputType;

  return {
    message: "Dry-run preview only. No route was called and no output was created.",
    routeCalled: false,
    status: "dry_run_only",
    wouldCreateOutput: {
      id: `axis-dry-run-${contract.result.output.id}`,
      title: contract.result.output.title || "Axis run output",
      type: outputType,
      status: adapterPreview.outputAdapterPreview.status,
      createdAt: contract.result.createdAt,
      localAttachment: contract.result.output.localAttachment,
      summary: "Would map legacy Axis run response into an AxisOutput after route adapter wiring.",
      sourceLabel: "Dry Run",
    },
    wouldReceive: adapterPreview.expectedResponsePreview,
    wouldSend: adapterPreview.payloadPreview,
  };
}

export function getAxisRunDryRunGuard(contract: AxisRunContractPreview): AxisRunDryRunGuard {
  const validation = validateAxisRunContractPreview(contract);

  if (!validation.ok) {
    return {
      canDryRun: false,
      label: "Dry run needs review",
      message: validation.message,
    };
  }

  return {
    canDryRun: true,
    label: "Route dry-run ready",
    message: "No write, no job, no model call. Real submit is still locked.",
  };
}

export function buildAxisRunDryRunRequest(contract: AxisRunContractPreview): AxisRunDryRunRequest {
  const payload = contract.payload;
  const requestedOutputType = payload?.outputType ?? contract.result.output.type;
  const media = payload?.localAttachment
    ? {
        id: payload.localAttachment.id,
        type: payload.localAttachment.type,
        name: payload.localAttachment.name,
        size: payload.localAttachment.size,
      }
    : undefined;

  return {
    dryRun: true,
    input: payload?.inputText ?? contract.result.output.title,
    mode: mapAxisOutputTypeToDryRunMode(requestedOutputType),
    sessionId: payload?.sessionId,
    projectId: payload?.currentProject,
    media,
    requestedOutputType,
    createdAt: new Date().toISOString(),
  };
}

export async function testAxisRunDryRun(contract: AxisRunContractPreview): Promise<AxisRunDryRunResult> {
  const guard = getAxisRunDryRunGuard(contract);
  if (!guard.canDryRun) {
    return {
      ok: false,
      message: guard.message,
    };
  }

  const response = await fetch(AXIS_RUN_TARGET_ROUTE, {
    body: JSON.stringify(buildAxisRunDryRunRequest(contract)),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    return {
      ok: false,
      message: getDryRunErrorMessage(payload) || "Route dry-run did not finish. Try again.",
    };
  }

  if (!isAxisRunDryRunResponse(payload)) {
    return {
      ok: false,
      message: "Route dry-run returned an unexpected preview shape.",
    };
  }

  return {
    ok: true,
    response: payload,
  };
}

export function mapAxisRunDryRunToAdapterStatus(
  result: AxisRunDryRunResult | null,
): AxisRunAdapterStatusPreview | null {
  if (!result) return null;

  if (!result.ok) {
    return {
      accepted: false,
      label: "Adapter handshake blocked",
      message: result.message,
      noJob: true,
      noModelCall: true,
      noUpload: true,
      noWrite: true,
      route: AXIS_RUN_TARGET_ROUTE,
      submitLocked: true,
    };
  }

  const plan = result.response.executionPlanPreview;

  return {
    accepted: true,
    label: "Adapter handshake ready",
    message: "Dry-run route accepted the local run payload and returned a no-side-effect execution preview.",
    nextAgent: plan.nextAgent,
    noJob: !plan.willStartJob,
    noModelCall: !plan.willCallModel,
    noUpload: !plan.willUploadMedia,
    noWrite: !plan.willWrite,
    outputType: plan.outputType,
    route: result.response.route,
    submitLocked: true,
  };
}

export function getAxisRunSubmitReadinessSummary(
  contract: AxisRunContractPreview,
  dryRunResult?: AxisRunDryRunResult | null,
): AxisRunSubmitReadinessSummary {
  const validation = validateAxisRunContractPreview(contract);
  const dryRunAccepted = dryRunResult?.ok === true;
  const completed = [
    "typed local payload",
    "AxisOutput result envelope",
    "submit guard",
    ...(validation.ok ? ["contract validation"] : []),
    ...(dryRunAccepted ? ["route dry-run handshake"] : []),
    ...(dryRunAccepted ? ["no-side-effect route preview"] : []),
  ];
  const remaining = [
    ...(!validation.ok ? [validation.label] : []),
    ...(!dryRunAccepted ? ["successful route dry-run"] : []),
    "real AxisOutput adapter implementation",
    "execution feature flag unlock",
    "server-side submit policy",
    "side-effect gates for writes, jobs, uploads, and model calls",
  ];

  return {
    canUnlockSubmit: false,
    completed,
    label: "Submit still locked",
    message: dryRunAccepted
      ? "Dry-run proved the route handshake. Real submit still needs the execution adapter and side-effect gates."
      : "Local contract is prepared, but real submit needs a successful route dry-run and execution adapter work.",
    remaining,
  };
}

export function mapAxisRunResponseToAxisOutputPreview(
  contract: AxisRunContractPreview,
): AxisRunAdapterPreview["outputAdapterPreview"] {
  return {
    outputType: contract.payload?.outputType ?? contract.result.output.type,
    status: "processing",
    willMapToAxisOutput: true,
  };
}

export function getAxisRunAdapterContract(): AxisRunAdapterContract {
  return {
    accepts: [
      "AxisRunPayload",
      "selected output type",
      "local attachment reference",
      "optional session/project context",
    ],
    returns: [
      "AxisOutput",
      "run status",
      "optional file or artifact link",
      "user-facing summary",
    ],
    status: "needed",
    targetRoute: AXIS_RUN_TARGET_ROUTE,
  };
}

function buildAxisRunPayloadPreview(payload: AxisRunPayload | undefined) {
  return {
    attachmentPath: null,
    attachmentType: payload?.localAttachment?.type ?? null,
    attachmentUrl: null,
    evidenceId: null,
    fileName: payload?.localAttachment?.name ?? null,
    message: payload?.inputText ?? "",
    threadId: payload?.sessionId ?? null,
  };
}

function mapAxisOutputTypeToDryRunMode(outputType: AxisOutput["type"]): AxisRunDryRunRequest["mode"] {
  if (outputType === "audio") return "voice";
  if (outputType === "clip") return "video";
  if (outputType === "image") return "image";
  return outputType;
}

function isAxisRunDryRunResponse(value: unknown): value is AxisRunDryRunResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.ok === true && record.dryRun === true && record.route === AXIS_RUN_TARGET_ROUTE;
}

function getDryRunErrorMessage(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Record<string, unknown>;
  return typeof record.error === "string" ? record.error : "";
}

export function getAxisRunSubmitGuard(contract: AxisRunContractPreview): AxisRunSubmitGuard {
  const validation = validateAxisRunContractPreview(contract);
  const compatibility = getAxisRunCompatibilityState();

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
      label: compatibility.compatible ? "Run locked" : compatibility.label,
      message: compatibility.compatible ? contract.execution.message : compatibility.message,
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
