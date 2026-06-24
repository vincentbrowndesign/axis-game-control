export type AxisSurface = "axis" | "measure";
export type AxisSurfaceSetting = AxisSurface | "auto";

export function getAxisSurface(host?: string | null): AxisSurface {
  const setting = getAxisSurfaceSetting();
  if (setting === "measure" || setting === "axis") return setting;
  return getAxisSurfaceFromHost(host);
}

export function getAxisSurfaceSetting(): AxisSurfaceSetting {
  const value = process.env.NEXT_PUBLIC_AXIS_SURFACE;
  if (value === "axis" || value === "measure") return value;
  return "auto";
}

export function getAxisSurfaceFromHost(host?: string | null): AxisSurface {
  const normalizedHost = normalizeHost(host);
  if (normalizedHost === "axismeasure.com" || normalizedHost.endsWith(".axismeasure.com")) return "measure";
  return "axis";
}

export function isAxisMeasureSurface(host?: string | null) {
  return getAxisSurface(host) === "measure";
}

function normalizeHost(host?: string | null) {
  const firstHost = (host || "").split(",")[0]?.trim().toLowerCase() || "";
  return firstHost.replace(/:\d+$/, "");
}
