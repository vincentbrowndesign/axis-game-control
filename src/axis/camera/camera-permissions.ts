export type AxisCameraPermissionState = "granted" | "prompt" | "denied" | "unsupported" | "unknown";

export async function getAxisCameraPermissionState(): Promise<AxisCameraPermissionState> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return "unsupported";
  if (!navigator.permissions?.query) return "unknown";

  try {
    const status = await navigator.permissions.query({ name: "camera" as PermissionName });
    if (status.state === "granted" || status.state === "prompt" || status.state === "denied") {
      return status.state;
    }
  } catch {
    return "unknown";
  }

  return "unknown";
}
