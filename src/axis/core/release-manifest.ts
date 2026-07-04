import type { AxisReleaseName } from "./types";

export type AxisReleaseManifestItem = {
  name: AxisReleaseName;
  title: string;
  status: "active" | "available" | "planned";
};

export const axisReleaseManifest: AxisReleaseManifestItem[] = [
  { name: "Axis A1.0", status: "active", title: "Camera shell" },
  { name: "Axis A1.1", status: "active", title: "Player lock" },
  { name: "Axis A1.2", status: "active", title: "Open command toolbar" },
  { name: "Axis A1.3", status: "planned", title: "Movement chains" },
  { name: "Axis A1.4", status: "planned", title: "Clips" },
  { name: "Axis A1.5", status: "planned", title: "Memory" },
  { name: "Axis A1.6", status: "planned", title: "AI video agent" },
];

export const axisCurrentActiveRelease: AxisReleaseName = "Axis A1.2";
