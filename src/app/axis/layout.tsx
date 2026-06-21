import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Axis",
  description: "Axis command and output layer.",
};

export default function AxisLayout({ children }: { children: React.ReactNode }) {
  return children;
}
