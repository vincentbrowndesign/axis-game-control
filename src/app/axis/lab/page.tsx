import { Suspense } from "react";
import type { Metadata } from "next";
import AxisLabPreview from "../../../components/axis/lab/axis-lab-preview";

export const metadata: Metadata = {
  title: "Axis Lab / UI Preview",
  robots: { follow: false, index: false },
};

export default function AxisLabPage() {
  return (
    <Suspense>
      <AxisLabPreview />
    </Suspense>
  );
}
