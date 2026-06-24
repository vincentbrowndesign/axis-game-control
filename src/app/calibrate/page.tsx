import { headers } from "next/headers";

import { AxisVisionObjectLock } from "../../components/axis/AxisVisionObjectLock";
import { getAxisSurface } from "../../lib/axis/surface";

export default async function CalibratePage() {
  const requestHeaders = await headers();
  const surface = getAxisSurface(requestHeaders.get("x-forwarded-host") || requestHeaders.get("host"));
  const productName = surface === "measure" ? "Axis Measure" : "Axis Vision";

  return (
    <AxisVisionObjectLock
      detectEndpoint="/api/vision/detect"
      initialRimSetup
      productName={productName}
      route="/calibrate"
    />
  );
}
