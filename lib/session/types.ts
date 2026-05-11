export type TeamSide = "HOME" | "AWAY";

export type OutcomeType = "EMPTY" | "SCORE";

export type PossessionEvent = {
  id: string;
  type: "possession";
  team: TeamSide;
  value: 0 | 1 | 2 | 3;
  createdAt: number;
  sessionTime: number;
};

export type SnapshotEvent = {
  id: string;
  type: "snapshot";
  imageUrl: string;
  period?: string;
  clock?: string;
  homeScore?: number;
  awayScore?: number;
  confidence?: number;
  createdAt: number;
};

export type SessionMarker = {
  id: string;
  label: string;
  createdAt: number;
};

export type SpurtsSession = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  createdAt: number;

  events: PossessionEvent[];
  snapshots: SnapshotEvent[];
  markers: SessionMarker[];
};