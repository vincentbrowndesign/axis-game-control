export type AxisCameraPowerState = "OFF" | "ON" | "UNAVAILABLE";

export type AxisCalibrationState = "REFERENCE_SAVED" | "UNCALIBRATED";

export type AxisReferenceFrame = {
  createdAt: string;
  dataUrl: string;
  height: number;
  id: string;
  width: number;
};

export type AxisCameraFoundationState = {
  calibrationState: AxisCalibrationState;
  powerState: AxisCameraPowerState;
  referenceFrame: AxisReferenceFrame | null;
  updatedAt: string;
};

const cameraFoundationStorageKey = "axis.camera.foundation.v1";

export function createEmptyCameraFoundationState(): AxisCameraFoundationState {
  return {
    calibrationState: "UNCALIBRATED",
    powerState: "OFF",
    referenceFrame: null,
    updatedAt: new Date().toISOString(),
  };
}

export function loadCameraFoundationState(): AxisCameraFoundationState {
  if (typeof window === "undefined") return createEmptyCameraFoundationState();
  try {
    const raw = window.localStorage.getItem(cameraFoundationStorageKey);
    const parsed = raw ? JSON.parse(raw) : null;
    return isCameraFoundationState(parsed) ? parsed : createEmptyCameraFoundationState();
  } catch {
    return createEmptyCameraFoundationState();
  }
}

export function saveCameraFoundationState(state: AxisCameraFoundationState) {
  if (typeof window === "undefined") return state;
  const nextState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(cameraFoundationStorageKey, JSON.stringify(nextState));
  return nextState;
}

export function createReferenceFrame({
  dataUrl,
  height,
  width,
}: {
  dataUrl: string;
  height: number;
  width: number;
}): AxisReferenceFrame {
  return {
    createdAt: new Date().toISOString(),
    dataUrl,
    height,
    id: createReferenceFrameId(),
    width,
  };
}

function isCameraFoundationState(value: unknown): value is AxisCameraFoundationState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    isPowerState(record.powerState) &&
    isCalibrationState(record.calibrationState) &&
    (record.referenceFrame === null || isReferenceFrame(record.referenceFrame)) &&
    typeof record.updatedAt === "string"
  );
}

function isReferenceFrame(value: unknown): value is AxisReferenceFrame {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.dataUrl === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.height === "number" &&
    typeof record.width === "number"
  );
}

function isPowerState(value: unknown): value is AxisCameraPowerState {
  return value === "OFF" || value === "ON" || value === "UNAVAILABLE";
}

function isCalibrationState(value: unknown): value is AxisCalibrationState {
  return value === "REFERENCE_SAVED" || value === "UNCALIBRATED";
}

function createReferenceFrameId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `reference_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
