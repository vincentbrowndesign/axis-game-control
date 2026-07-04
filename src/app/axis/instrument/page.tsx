import type { Metadata } from "next";
import AxisInstrument from "../../../components/axis/AxisInstrument";

export const metadata: Metadata = {
  title: "AXIS",
  description: "Axis broadcast instrument.",
};

export default function AxisInstrumentPage() {
  return <AxisInstrument />;
}
