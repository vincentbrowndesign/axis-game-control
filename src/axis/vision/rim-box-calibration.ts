import type { AxisRimBox } from "../core/types";

const rimBoxKeyPrefix = "axis-rim-box";
const minBoxSize = 0.015;

export type AxisRimBoxDraft = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export function createAxisRimBox(input: AxisRimBoxDraft & { sessionId: string }): AxisRimBox | null {
  const draft = normalizeRimBoxDraft(input);
  if (!draft) return null;

  return {
    ...draft,
    confidence: 1,
    createdAt: new Date().toISOString(),
    id: `axis-rim-box-${crypto.randomUUID()}`,
    sessionId: input.sessionId,
    source: "manual_calibration",
  };
}

export function loadAxisRimBox(sessionId: string): AxisRimBox | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(rimBoxKey(sessionId));
    if (!raw) return null;
    return parseRimBox(JSON.parse(raw), sessionId);
  } catch {
    return null;
  }
}

export function saveAxisRimBox(rimBox: AxisRimBox) {
  try {
    if (typeof window === "undefined") return false;
    window.localStorage.setItem(rimBoxKey(rimBox.sessionId), JSON.stringify(rimBox));
    return true;
  } catch {
    return false;
  }
}

export function resetAxisRimBox(sessionId: string) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(rimBoxKey(sessionId));
  } catch {
    // Local calibration should never break the camera loop.
  }
}

export function rimPointerToNormalizedPoint(target: HTMLElement, clientX: number, clientY: number) {
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  return {
    x: clamp01((clientX - rect.left) / rect.width),
    y: clamp01((clientY - rect.top) / rect.height),
  };
}

export function rimDragToDraft(
  start: { x: number; y: number },
  current: { x: number; y: number },
): AxisRimBoxDraft | null {
  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);
  const width = Math.abs(current.x - start.x);
  const height = Math.abs(current.y - start.y);
  return normalizeRimBoxDraft({ height, width, x, y });
}

export function normalizeRimBoxDraft(input: AxisRimBoxDraft): AxisRimBoxDraft | null {
  const x = clamp01(input.x);
  const y = clamp01(input.y);
  const width = Math.min(clamp01(input.width), 1 - x);
  const height = Math.min(clamp01(input.height), 1 - y);
  if (width < minBoxSize || height < minBoxSize) return null;
  return { height, width, x, y };
}

function parseRimBox(value: unknown, sessionId: string): AxisRimBox | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as AxisRimBox;
  if (candidate.sessionId !== sessionId || candidate.source !== "manual_calibration") return null;
  const draft = normalizeRimBoxDraft(candidate);
  if (!draft) return null;
  return {
    ...draft,
    confidence: 1,
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : new Date().toISOString(),
    id: typeof candidate.id === "string" ? candidate.id : `axis-rim-box-${crypto.randomUUID()}`,
    sessionId,
    source: "manual_calibration",
  };
}

function rimBoxKey(sessionId: string) {
  return `${rimBoxKeyPrefix}:${sessionId}`;
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
