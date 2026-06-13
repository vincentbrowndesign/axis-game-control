// ---------------------------------------------------------------------------
// Axis Tracking V1 — CV Adapter output types
//
// CV Adapter owns: bbox, confidence, track_id, timestamp, frame_index
// Axis Session owns: athlete identity, roster, calibration, history
//
// Track IDs are session-scoped visual continuity only.
// They are NOT athlete identity.
// ---------------------------------------------------------------------------

export interface AxisPersonTrack {
  sessionId: string;
  frameIndex: number;
  timestampMs: number;
  trackId: number;
  className: "person";
  confidence: number;
  bbox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
  center: {
    x: number;
    y: number;
  };
  foot: {
    x: number;
    y: number;
  };
}

export interface AxisPersonTrackEvent {
  type: "PERSON_TRACK_UPDATED";
  payload: AxisPersonTrack;
}

export function isPersonTrackEvent(e: unknown): e is AxisPersonTrackEvent {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as AxisPersonTrackEvent).type === "PERSON_TRACK_UPDATED"
  );
}
