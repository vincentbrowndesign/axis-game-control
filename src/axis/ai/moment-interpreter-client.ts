import type { AxisMomentCandidate, AxisVisionRead } from "../core/types";

export async function interpretMomentFromVisionRead(input: {
  note?: string;
  sessionContext?: string;
  visionRead: AxisVisionRead;
}): Promise<AxisMomentCandidate> {
  const response = await fetch("/api/axis/moment-candidate", {
    body: JSON.stringify(input),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }).catch(() => null);

  if (!response?.ok) return fallbackMomentCandidate(input.visionRead);

  const payload = (await response.json().catch(() => null)) as { candidate?: AxisMomentCandidate } | null;
  return payload?.candidate ?? fallbackMomentCandidate(input.visionRead);
}

function fallbackMomentCandidate(read: AxisVisionRead): AxisMomentCandidate {
  return {
    action: read.motionHints.map((hint) => hint.summary).join(", ") || "Moment marked",
    evidenceIds: [`axis-evidence-${read.id}`],
    id: `axis-moment-${crypto.randomUUID()}`,
    reviewState: read.confidence >= 0.45 ? "needs_review" : "uncertain",
    sessionId: read.sessionId,
    situation: "Marked camera moment",
    timestampMs: read.timestampMs,
    title: read.objects.length ? `Marked: ${read.objects.map((object) => object.label).join(" / ")}` : "Marked moment",
  };
}
