export const runtime = "nodejs";

export async function POST() {
  return Response.json(
    {
      error: "SYNC_VIDEO_DEBUG_DISABLED",
    },
    { status: 410 },
  );
}
