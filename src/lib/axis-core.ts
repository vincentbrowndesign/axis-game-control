export type Verdict =
  | "satisfied"
  | "violated"
  | "partial"
  | "unobservable";

export type Modality =
  | "camera"
  | "voice"
  | "coach"
  | "surface"
  | "wearable"
  | "file"
  | "research";

export type WitnessDimension = string;

export interface TimeWindow {
  start: string;
  end: string;
}

export interface Claim {
  verdict?: Verdict;
  summary: string;
  magnitude?: number;
  evidence?: string;
}

export interface WitnessEvent {
  intent_id: string;
  experiment_id: string;
  modality: Modality;
  window: TimeWindow;
  claim: Claim;
  confidence: number;
  raw_ref?: string;
  payload?: Record<string, unknown>;
}
