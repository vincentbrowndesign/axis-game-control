import { AxisVisionObjectLock } from "../../components/axis/AxisVisionObjectLock";

export default function AxisMeasureCalibratePage() {
  return (
    <AxisVisionObjectLock
      detectEndpoint="/api/vision/detect"
      initialRimSetup
      productName="Axis Measure"
      route="/calibrate"
    />
  );
}
