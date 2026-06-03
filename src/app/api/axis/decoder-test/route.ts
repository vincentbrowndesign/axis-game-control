import { runDecoderTest, type DecoderTestBody } from "../../../../lib/axis-decoder-test-runner";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as DecoderTestBody | null;
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });

  const result = await runDecoderTest(body);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });

  return Response.json(result);
}
