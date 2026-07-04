import type { AxisDetectedObject, AxisDetectedObjectKind, AxisEvidence } from "../core/types";

type AxisObjectDetectionResponse = {
  evidence?: AxisEvidence;
  objects?: Array<{
    box?: {
      height?: number;
      width?: number;
      x?: number;
      y?: number;
    };
    label?: string;
    point?: {
      x?: number;
      y?: number;
    };
    score?: number;
  }>;
  ok?: boolean;
};

export type AxisObjectDetectionResult = {
  evidence: AxisEvidence | null;
  ok: boolean;
  objects: AxisDetectedObject[];
  source: "huggingface";
};

export async function detectAxisBasketballObjects(input: {
  image: string;
  signal?: AbortSignal;
  sessionId: string;
  timestampMs: number;
}): Promise<AxisObjectDetectionResult> {
  const response = await fetch("/api/axis/vision/huggingface/detect", {
    body: JSON.stringify({ image: input.image, sessionId: input.sessionId }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal: input.signal,
  }).catch(() => null);

  if (!response) return { evidence: null, objects: [], ok: false, source: "huggingface" };

  const payload = (await response.json().catch(() => null)) as AxisObjectDetectionResponse | null;
  return {
    evidence: payload?.evidence ?? null,
    ok: payload?.ok === true,
    objects: normalizeDetectedObjects(payload?.objects ?? [], input.timestampMs),
    source: "huggingface",
  };
}

export function normalizeDetectedObjects(
  objects: NonNullable<AxisObjectDetectionResponse["objects"]>,
  timestampMs: number,
): AxisDetectedObject[] {
  return objects
    .map((object, index): AxisDetectedObject | null => {
      const kind = mapObjectKind(object.label);
      const box = object.box;
      const normalizedBox = box && finite(box.x) && finite(box.y) && finite(box.width) && finite(box.height)
        ? {
            height: Math.max(1, box.height),
            width: Math.max(1, box.width),
            x: box.x,
            y: box.y,
          }
        : undefined;
      const point = object.point && finite(object.point.x) && finite(object.point.y)
        ? { x: object.point.x, y: object.point.y }
        : normalizedBox
          ? { x: normalizedBox.x + normalizedBox.width / 2, y: normalizedBox.y + normalizedBox.height / 2 }
          : undefined;

      return {
        box: normalizedBox,
        confidence: typeof object.score === "number" ? object.score : 0.5,
        id: `axis-object-${timestampMs}-${index}-${kind}`,
        kind,
        label: kind,
        point,
        source: "huggingface",
      };
    })
    .filter((object): object is AxisDetectedObject => Boolean(object))
    .slice(0, 8);
}

function mapObjectKind(label: string | undefined): AxisDetectedObjectKind {
  const normalized = (label ?? "").toLowerCase().trim();
  if (
    normalized === "person" ||
    normalized === "human" ||
    normalized === "athlete" ||
    normalized === "player" ||
    normalized.includes("person") ||
    normalized.includes("human") ||
    normalized.includes("athlete") ||
    normalized.includes("player")
  ) return "player";
  if (
    normalized === "sports ball" ||
    normalized === "basketball" ||
    normalized === "ball" ||
    normalized.includes("sports ball") ||
    normalized.includes("basketball")
  ) return "ball";
  if (
    normalized === "rim" ||
    normalized === "hoop" ||
    normalized === "basket" ||
    normalized === "backboard" ||
    normalized.includes("rim") ||
    normalized.includes("hoop") ||
    normalized.includes("basket") ||
    normalized.includes("backboard")
  ) return "rim";
  return "unknown";
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
