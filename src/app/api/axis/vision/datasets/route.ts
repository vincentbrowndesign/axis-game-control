import { listAxisVisionDatasets } from "../../../../../lib/axis/vision/dataset-registry";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ok: true,
    datasets: listAxisVisionDatasets(),
  });
}
