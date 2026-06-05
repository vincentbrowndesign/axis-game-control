export const runtime = "nodejs";

export async function POST() {
  return Response.json(
    {
      created: false,
      error: "SERVER_VIDEO_UPLOAD_DISABLED",
    },
    { status: 410 },
  );
}
