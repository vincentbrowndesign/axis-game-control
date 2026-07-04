import type { AxisEvidence, AxisVisionRead } from "../core/types";

const evidenceKey = "axis-local-evidence";

export function saveAxisEvidence(evidence: AxisEvidence) {
  if (typeof window === "undefined") return false;

  try {
    const current = listAxisEvidence();
    window.localStorage.setItem(evidenceKey, JSON.stringify([toStoredEvidence(evidence), ...current].slice(0, 100)));
    return true;
  } catch {
    try {
      window.localStorage.setItem(evidenceKey, JSON.stringify([toStoredEvidence(evidence)].slice(0, 1)));
      return true;
    } catch {
      return false;
    }
  }
}

export function createManualMarkEvidence(input: {
  frameId?: string;
  sessionId: string;
  timestampMs: number;
}): AxisEvidence {
  return {
    capabilityId: "manual.mark",
    capturedAt: new Date(input.timestampMs).toISOString(),
    id: `axis-manual-mark-${crypto.randomUUID()}`,
    kind: "manual_mark",
    metadata: {
      frameId: input.frameId,
    },
    sessionId: input.sessionId,
    summary: "Moment manually marked",
    trust: "user_captured",
  };
}

export function saveAxisVisionReadEvidence(read: AxisVisionRead) {
  return saveAxisEvidence(axisVisionReadToStoredEvidence(read));
}

export function axisVisionReadToStoredEvidence(read: AxisVisionRead): AxisEvidence {
  const player = read.objects.find((object) => object.label === "player");

  return {
    capabilityId: "player.lock",
    capturedAt: new Date(read.timestampMs).toISOString(),
    id: `axis-evidence-${read.id}`,
    kind: "vision_read",
    metadata: {
      read: compactVisionRead(read),
    },
    observations: player
      ? [
          { label: "player", unit: "state", value: read.lockState },
          { label: "source", unit: "state", value: player.source },
        ]
      : [{ label: "player", unit: "state", value: read.lockState }],
    sessionId: read.sessionId,
    summary: player ? playerSummary(read) : "No player",
    trust: "local_computed",
  };
}

export function listAxisEvidence(): AxisEvidence[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(evidenceKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as AxisEvidence[] : [];
  } catch {
    return [];
  }
}

function toStoredEvidence(evidence: AxisEvidence): AxisEvidence {
  const media = evidence.media
    ? {
        height: evidence.media.height,
        mimeType: evidence.media.mimeType,
        objectUrl: evidence.media.objectUrl,
        width: evidence.media.width,
      }
    : undefined;

  return {
    ...evidence,
    media,
    metadata: compactMetadata(evidence.metadata),
  };
}

function compactMetadata(metadata: AxisEvidence["metadata"]) {
  if (!metadata) return undefined;
  const read = metadata.read;
  if (!read || typeof read !== "object") return metadata;

  const candidate = read as {
    cameraFacingMode?: unknown;
    command?: unknown;
    confidence?: unknown;
    id?: unknown;
    lockState?: unknown;
    note?: unknown;
    objects?: Array<{ box?: unknown; confidence?: unknown; kind?: unknown; label?: unknown; point?: unknown; source?: unknown }>;
    reviewState?: unknown;
    sessionId?: unknown;
    source?: unknown;
    timestampMs?: unknown;
  };

  return {
    ...metadata,
    read: {
      command: candidate.command,
      cameraFacingMode: candidate.cameraFacingMode,
      confidence: candidate.confidence,
      id: candidate.id,
      lockState: candidate.lockState,
      note: candidate.note,
      objects: Array.isArray(candidate.objects)
        ? candidate.objects.map((object) => ({
            box: object.box,
            confidence: object.confidence,
            label: object.label,
            point: object.point,
            source: object.source,
          }))
        : [],
      reviewState: candidate.reviewState,
      sessionId: candidate.sessionId,
      source: candidate.source,
      timestampMs: candidate.timestampMs,
    },
  };
}

function compactVisionRead(read: AxisVisionRead) {
  return {
    command: read.command,
    cameraFacingMode: read.cameraFacingMode,
    confidence: read.confidence,
    id: read.id,
    lockState: read.lockState,
    note: read.note,
    objects: read.objects
      .filter((object) => object.label === "player")
      .map((object) => ({
        box: object.box,
        confidence: object.confidence,
        id: object.id,
        label: object.label,
        point: object.point,
        source: object.source,
      })),
    reviewState: read.reviewState,
    sessionId: read.sessionId,
    source: read.source,
    timestampMs: read.timestampMs,
  };
}

function playerSummary(read: AxisVisionRead) {
  if (read.lockState === "locked" || read.lockState === "saved") return "Player read saved";
  if (read.lockState === "review") return "Player read saved";
  if (read.lockState === "error") return "Player error";
  return "No player";
}
