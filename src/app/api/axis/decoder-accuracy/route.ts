import { getAxisDecoderTestHistory, type AxisDecoderTestRecord } from "../../../../lib/axis-persistence";

export const runtime = "nodejs";

type FactKey = "shot_attempt" | "make_miss" | "paint_touch" | "drive";

type FactStats = {
  accuracy: number;
  correct: number;
  incorrect: number;
  total_tests: number;
  wrong: number;
};

const factKeys: FactKey[] = ["shot_attempt", "make_miss", "paint_touch", "drive"];

function getLimit(window: string | null) {
  if (window === "last10") return 10;
  if (window === "last50") return 50;
  if (window === "all" || !window) return undefined;
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getExpectedKeys(test: AxisDecoderTestRecord) {
  if (!isRecord(test.expected)) return [];
  return factKeys.filter((factKey) => Object.prototype.hasOwnProperty.call(test.expected as Record<string, unknown>, factKey));
}

function comparisonHasFact(value: unknown, factKey: FactKey) {
  if (!Array.isArray(value)) return false;
  return value.some((item) => isRecord(item) && item.fact_key === factKey);
}

function calculateAccuracy(records: AxisDecoderTestRecord[]) {
  const initial = Object.fromEntries(
    factKeys.map((factKey) => [
      factKey,
      {
        accuracy: 0,
        correct: 0,
        incorrect: 0,
        total_tests: 0,
        wrong: 0,
      } satisfies FactStats,
    ]),
  ) as Record<FactKey, FactStats>;

  for (const record of records) {
    for (const factKey of getExpectedKeys(record)) {
      const stats = initial[factKey];
      const failed = comparisonHasFact(record.wrong, factKey) || comparisonHasFact(record.missing, factKey);
      stats.total_tests += 1;
      if (failed) {
        stats.incorrect += 1;
        stats.wrong += 1;
      } else {
        stats.correct += 1;
      }
    }
  }

  for (const stats of Object.values(initial)) {
    stats.accuracy = stats.total_tests ? Number((stats.correct / stats.total_tests).toFixed(4)) : 0;
  }

  return initial;
}

function weakestFact(summary: Record<FactKey, FactStats>) {
  const tested = factKeys.filter((factKey) => summary[factKey].total_tests > 0);
  if (!tested.length) return null;

  return tested.sort((a, b) => summary[a].accuracy - summary[b].accuracy)[0];
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const window = url.searchParams.get("window") ?? "all";
  const history = await getAxisDecoderTestHistory({ limit: getLimit(window) });

  if (history.error) return Response.json({ error: history.error }, { status: 502 });

  const summary = calculateAccuracy(history.records);
  return Response.json({
    ...summary,
    tests_count: history.records.length,
    weakest_fact: weakestFact(summary),
    window,
  });
}
