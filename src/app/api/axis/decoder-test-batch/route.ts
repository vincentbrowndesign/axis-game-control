import {
  getExpectedTargetFacts,
  runDecoderTest,
  type DecoderTestBody,
  type DecoderTestResult,
  type TargetFactKey,
} from "../../../../lib/axis-decoder-test-runner";

export const runtime = "nodejs";

type BatchItem = DecoderTestBody & {
  category?: unknown;
  name?: unknown;
};

type FactStats = {
  accuracy: number;
  correct: number;
  incorrect: number;
  total_tests: number;
  wrong: number;
};

const targetFacts: TargetFactKey[] = ["shot_attempt", "make_miss", "paint_touch", "drive"];

const baselineExpectations = {
  clear_jumper: {
    drive: 0,
    paint_touch: 0,
    shot_attempt: 1,
  },
  cut_off_result: {
    make_miss: "unknown",
    shot_attempt: 1,
  },
  drive: {
    drive: 1,
    paint_touch: 1,
  },
  stationary_paint_catch: {
    drive: 0,
    paint_touch: 1,
  },
};

function getString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function getBatchItems(body: unknown) {
  if (Array.isArray(body)) return body as BatchItem[];
  if (body && typeof body === "object" && Array.isArray((body as { tests?: unknown }).tests)) {
    return (body as { tests: BatchItem[] }).tests;
  }
  return null;
}

function hasFact(items: unknown, factKey: TargetFactKey) {
  if (!Array.isArray(items)) return false;
  return items.some((item) => item && typeof item === "object" && (item as { fact_key?: unknown }).fact_key === factKey);
}

function calculateBatchAccuracy(results: { expected: Partial<Record<TargetFactKey, number | string>>; result: DecoderTestResult }[]) {
  const stats = Object.fromEntries(
    targetFacts.map((factKey) => [
      factKey,
      {
        accuracy: 0,
        correct: 0,
        incorrect: 0,
        total_tests: 0,
        wrong: 0,
      } satisfies FactStats,
    ]),
  ) as Record<TargetFactKey, FactStats>;

  for (const entry of results) {
    if ("error" in entry.result) continue;

    for (const factKey of targetFacts) {
      if (!Object.prototype.hasOwnProperty.call(entry.expected, factKey)) continue;

      const factStats = stats[factKey];
      const failed = hasFact(entry.result.wrong, factKey) || hasFact(entry.result.missing, factKey);
      factStats.total_tests += 1;
      if (failed) {
        factStats.incorrect += 1;
        factStats.wrong += 1;
      } else {
        factStats.correct += 1;
      }
    }
  }

  for (const factStats of Object.values(stats)) {
    factStats.accuracy = factStats.total_tests ? Number((factStats.correct / factStats.total_tests).toFixed(4)) : 0;
  }

  return stats;
}

function weakestFact(summary: Record<TargetFactKey, FactStats>) {
  const tested = targetFacts.filter((factKey) => summary[factKey].total_tests > 0);
  if (!tested.length) return null;

  return tested.sort((a, b) => summary[a].accuracy - summary[b].accuracy)[0];
}

export async function GET() {
  return Response.json({
    expected_fact_templates: baselineExpectations,
    minimum_baseline: {
      categories: ["clear_jumper", "drive", "stationary_paint_catch", "cut_off_result"],
      tests_per_category: 3,
      total_tests: 12,
    },
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const tests = getBatchItems(body);
  if (!tests?.length) return Response.json({ error: "A tests array is required." }, { status: 400 });
  if (tests.length > 50) return Response.json({ error: "Batch size is limited to 50 tests." }, { status: 400 });

  const results: {
    category: string;
    expected: Partial<Record<TargetFactKey, number | string>>;
    name: string;
    result: DecoderTestResult;
    upload_id: string;
  }[] = [];

  for (const test of tests) {
    const expected = getExpectedTargetFacts(test.expected);
    if (!expected) {
      results.push({
        category: getString(test.category),
        expected: {},
        name: getString(test.name),
        result: { error: "Expected facts are required.", status: 400 },
        upload_id: getString(test.upload_id) || getString(test.uploadId),
      });
      continue;
    }

    const result = await runDecoderTest(test);
    results.push({
      category: getString(test.category),
      expected,
      name: getString(test.name),
      result,
      upload_id: getString(test.upload_id) || getString(test.uploadId),
    });
  }

  const successfulRuns = results.filter((entry) => !("error" in entry.result));
  const summary = calculateBatchAccuracy(results);
  const passCount = successfulRuns.filter((entry) => !("error" in entry.result) && entry.result.pass).length;

  return Response.json({
    pass_count: passCount,
    per_fact_accuracy: summary,
    results,
    total_tests: tests.length,
    weakest_fact: weakestFact(summary),
  });
}
