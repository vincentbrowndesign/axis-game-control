export type AxisAudioContext = {
  transcript?: string;
  command?: string;
  confidence?: number;
};

export type AxisCameraContext = {
  calibrationState?: "REFERENCE_SAVED" | "UNCALIBRATED";
  frameId?: string;
  referenceFrameId?: string;
  source?: "camera" | "none";
  timestamp?: string;
};

export type AxisMissionContext = {
  audioContext?: AxisAudioContext | null;
  cameraContext?: AxisCameraContext | null;
  notes?: string | null;
};

export type AxisMissionContextSnapshot = AxisMissionContext & {
  constraint: string;
  objective: string;
  result: number;
  timestamp: string;
};

export function createMissionContextSnapshot({
  audioContext = null,
  cameraContext = null,
  constraint,
  notes = null,
  objective,
  result,
  timestamp,
}: AxisMissionContextSnapshot): AxisMissionContextSnapshot {
  return {
    audioContext,
    cameraContext,
    constraint,
    notes,
    objective,
    result,
    timestamp,
  };
}
