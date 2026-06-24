import { AxisVisionObjectLock } from "../../components/axis/AxisVisionObjectLock";
import { getAxisSurface } from "../../lib/axis/surface";

export default function VisionPage() {
  const surface = getAxisSurface();
  const productName = surface === "measure" ? "Axis Measure" : "Axis Vision";

  return (
    <AxisVisionObjectLock
      detectEndpoint="/api/vision/detect"
      productName={productName}
      route="/vision"
    />
  );
}
