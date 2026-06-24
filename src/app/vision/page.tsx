import { AxisVisionObjectLock } from "../../components/axis/AxisVisionObjectLock";

export default function AxisMeasureVisionPage() {
  return (
    <AxisVisionObjectLock
      detectEndpoint="/api/vision/detect"
      productName="Axis Measure"
      route="/vision"
    />
  );
}
