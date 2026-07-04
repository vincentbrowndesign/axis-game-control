import type { AxisMomentCandidate, AxisSessionObject, AxisVisionRead } from "../core/types";

const objectKey = "axis-local-session-objects";

export function momentCandidateToSessionObject(candidate: AxisMomentCandidate): AxisSessionObject {
  const parts = [
    candidate.title,
    candidate.situation,
    candidate.actor,
    candidate.action,
    candidate.outcome,
    candidate.cause,
    candidate.correction,
  ].filter(Boolean);

  return {
    createdAt: new Date(candidate.timestampMs).toISOString(),
    evidenceIds: candidate.evidenceIds,
    id: `axis-session-object-${candidate.id}`,
    kind: "moment",
    label: candidate.title,
    reviewState: candidate.reviewState,
    searchableText: parts.join(" "),
    sessionId: candidate.sessionId,
  };
}

export function visionReadToSessionObject(read: AxisVisionRead): AxisSessionObject {
  const player = read.objects.find((object) => object.label === "player");
  const label = playerLabel(read);

  return {
    createdAt: new Date(read.timestampMs).toISOString(),
    evidenceIds: [`axis-evidence-${read.id}`],
    id: `axis-session-object-${read.id}`,
    kind: "vision_read",
    label,
    reviewState: read.reviewState === "error" ? "uncertain" : read.reviewState,
    searchableText: [
      label,
      "player",
      read.lockState,
      read.reviewState,
      read.command,
      read.note,
      player?.source,
    ].filter(Boolean).join(" "),
    sessionId: read.sessionId,
  };
}

export function saveAxisSessionObject(object: AxisSessionObject) {
  try {
    if (typeof window === "undefined") return false;
    const current = listAxisSessionObjects();
    window.localStorage.setItem(objectKey, JSON.stringify([object, ...current].slice(0, 100)));
    return true;
  } catch {
    try {
      window.localStorage.setItem(objectKey, JSON.stringify([object].slice(0, 1)));
      return true;
    } catch {
      return false;
    }
  }
}

function playerLabel(read: AxisVisionRead) {
  if (read.lockState === "locked" || read.lockState === "saved") return "Player read";
  if (read.lockState === "review") return "Player read";
  if (read.lockState === "error") return "Player error";
  return "No player";
}

export function listAxisSessionObjects(): AxisSessionObject[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(objectKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as AxisSessionObject[] : [];
  } catch {
    return [];
  }
}
