export type AxisSurface = "axis" | "measure";

export function getAxisSurface(): AxisSurface {
  return process.env.NEXT_PUBLIC_AXIS_SURFACE === "measure" ? "measure" : "axis";
}

export function isAxisMeasureSurface() {
  return getAxisSurface() === "measure";
}
