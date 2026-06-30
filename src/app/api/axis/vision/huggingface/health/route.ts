export const runtime = "nodejs";

export async function GET() {
  const hfToken = process.env.HF_TOKEN;
  const missing: string[] = [];
  if (!hfToken) missing.push("HF_TOKEN");

  return Response.json({
    ok: missing.length === 0,
    hfTokenPresent: Boolean(hfToken),
    runtime: "server",
    env: {
      hfTokenPresent: Boolean(hfToken),
    },
    missing,
  });
}
