// lib/engine/types.ts

export type AxisTeam = "HOME" | "AWAY";

export type AxisOutcome = "1" | "2" | "3" | "EMPTY";

export interface AxisEvent {
  id: number;
  team: AxisTeam;
  outcome: AxisOutcome;
  value: number;
  possessionNumber: number;
  timestamp: number;
}

export interface AxisRead {
  state: string;
  headline: string;
  evidence: string[];
  pressure: {
    HOME: number;
    AWAY: number;
  };
  control: {
    HOME: number;
    AWAY: number;
  };
  memory: string[];
}