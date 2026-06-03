import { persistAxisDecoderTest } from "./axis-persistence";
import {
  decodeAndPersistRealityFacts,
  getMuxPlaybackUrl,
  type AxisDecodedFact,
} from "./axis-reality-decoder";

export type TargetFactKey = "shot_attempt" | "make_miss" | "paint_touch" | "drive";

export type DecoderTestBody = {
  artifact_id?: unknown;
  expected?: unknown;
  muxPlaybackId?: unknown;
  name?: unknown;
  sourceClipCount?: unknown;
  upload_id?: unknown;
  uploadId?: unknown;
  video_url?: unknown;
  videoUrl?: unknown;
};

export type FactComparison = {
  actual: number | string | null;
  expected: number | string;
  fact_key: TargetFactKey;
  support_level?: string | null;
  temporal_support?: string | null;
  verification_status?: string | null;
};

export type DecoderTestResult =
  | {
      correct: number;
      facts: {
        fact_key: string;
        fact_text_value?: string | null;
        fact_value: number;
        support_level?: "strong" | "medium" | "weak" | null;
        temporal_support?: string | null;
        verification_status?: "accepted" | "needs_review" | "rejected" | null;
      }[];
      missing: FactComparison[];
      pass: boolean;
      stored: boolean;
      test_result_stored: boolean;
      total: number;
      upload_id: string;
      wrong: FactComparison[];
    }
  | {
      error: string;
      status: number;
    };

const targetFacts: TargetFactKey[] = ["shot_attempt", "make_miss", "paint_touch", "drive"];

function getString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function getSourceClipCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(1, value) : 1;
}

function getExpectedFacts(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const expected = value as Record<string, unknown>;
  const normalized: Partial<Record<TargetFactKey, number | string>> = {};

  for (const factKey of targetFacts) {
    const factValue = expected[factKey];
    if (factKey === "make_miss") {
      if (factValue === "make" || factValue === "miss" || factValue === "unknown") {
        normalized[factKey] = factValue;
      }
      continue;
    }

    if (factValue === 0 || factValue === 1) normalized[factKey] = factValue;
    if (factValue === true) normalized[factKey] = 1;
    if (factValue === false) normalized[factKey] = 0;
  }

  return Object.keys(normalized).length ? normalized : null;
}

function factValue(fact: AxisDecodedFact) {
  if (fact.fact_key === "make_miss") return fact.fact_text_value ?? null;
  return fact.fact_value;
}

function compareFacts(facts: AxisDecodedFact[], expected: Partial<Record<TargetFactKey, number | string>>) {
  const byKey = new Map(facts.map((fact) => [fact.fact_key, fact]));
  const wrong: FactComparison[] = [];
  const missing: FactComparison[] = [];
  const correct: FactComparison[] = [];

  for (const factKey of targetFacts) {
    const expectedValue = expected[factKey];
    if (expectedValue === undefined) continue;

    const fact = byKey.get(factKey);
    if (!fact) {
      missing.push({
        actual: null,
        expected: expectedValue,
        fact_key: factKey,
      });
      continue;
    }

    const actual = factValue(fact);
    const comparison: FactComparison = {
      actual,
      expected: expectedValue,
      fact_key: factKey,
      support_level: fact.support_level,
      temporal_support: fact.temporal_support,
      verification_status: fact.verification_status,
    };

    if (actual === expectedValue) correct.push(comparison);
    else wrong.push(comparison);
  }

  const total = Object.keys(expected).length;
  return {
    correct,
    missing,
    pass: correct.length === total && wrong.length === 0 && missing.length === 0,
    total,
    wrong,
  };
}

export function getExpectedTargetFacts(value: unknown) {
  return getExpectedFacts(value);
}

export async function runDecoderTest(body: DecoderTestBody): Promise<DecoderTestResult> {
  const uploadId = getString(body.upload_id) || getString(body.uploadId);
  if (!uploadId) return { error: "upload_id is required.", status: 400 };

  const expected = getExpectedFacts(body.expected);
  if (!expected) return { error: "Expected facts are required.", status: 400 };

  const muxPlaybackId = getString(body.muxPlaybackId);
  const videoUrl = getString(body.video_url) || getString(body.videoUrl) || getMuxPlaybackUrl(muxPlaybackId);
  const artifactId = getString(body.artifact_id, `decoder-test-${uploadId}`);
  const sourceClipCount = getSourceClipCount(body.sourceClipCount);

  const decoded = await decodeAndPersistRealityFacts({
    artifactId,
    muxPlaybackId,
    sourceClipCount,
    uploadId,
    videoUrl,
  });
  const comparison = compareFacts(decoded.facts, expected);
  const response = {
    correct: comparison.correct.length,
    facts: decoded.facts
      .filter((fact) => targetFacts.includes(fact.fact_key as TargetFactKey))
      .map((fact) => ({
        fact_key: fact.fact_key,
        fact_text_value: fact.fact_text_value,
        fact_value: fact.fact_value,
        support_level: fact.support_level,
        temporal_support: fact.temporal_support,
        verification_status: fact.verification_status,
      })),
    missing: comparison.missing,
    pass: comparison.pass,
    stored: decoded.persistence.stored,
    total: comparison.total,
    upload_id: uploadId,
    wrong: comparison.wrong,
  };

  const persistence = await persistAxisDecoderTest({
    correct: response.correct,
    created_at: new Date().toISOString(),
    decoded: response.facts,
    expected,
    missing: response.missing,
    mux_playback_id: muxPlaybackId || null,
    pass: response.pass,
    test_id: `decoder-test-${crypto.randomUUID()}`,
    total: response.total,
    upload_id: uploadId,
    wrong: response.wrong,
  });

  return {
    ...response,
    test_result_stored: persistence.stored,
  };
}
