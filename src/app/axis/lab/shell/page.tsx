import type { Metadata } from "next";
import { AxisShell } from "../../../../components/axis/AxisShell";

export const metadata: Metadata = {
  title: "Axis Lab Shell",
  robots: { follow: false, index: false },
};

// The pre-v0.1 session shell, preserved as an internal lab tool after
// /axis became the Trophy Labs product dashboard.
export default function AxisLabShellPage() {
  return <AxisShell />;
}
