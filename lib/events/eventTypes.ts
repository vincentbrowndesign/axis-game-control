export type TeamSide = "HOME" | "AWAY";

export type EventType =
  | "MAKE"
  | "MISS"
  | "TURNOVER"
  | "MARKER"
  | "SNAPSHOT"
  | "CLIP";

export type BaseEvent = {
  id: string;
  type: EventType;
  createdAt: number;
  sessionTime: number;
};

export type MakeEvent = BaseEvent & {
  type: "MAKE";
  team: TeamSide;
  value: 1 | 2 | 3;
};

export type MissEvent = BaseEvent & {
  type: "MISS";
  team: TeamSide;
};

export type TurnoverEvent = BaseEvent & {
  type: "TURNOVER";
  team: TeamSide;
};

export type MarkerEvent = BaseEvent & {
  type: "MARKER";
  label: string;
};

export type SnapshotEvent = BaseEvent & {
  type: "SNAPSHOT";

  imageUrl: string;

  period?: string;
  clock?: string;

  homeScore?: number;
  awayScore?: number;

  confidence?: number;
};

export type ClipEvent = BaseEvent & {
  type: "CLIP";

  clipUrl: string;

  startTime?: number;
  endTime?: number;
};

export type SpurtsEvent =
  | MakeEvent
  | MissEvent
  | TurnoverEvent
  | MarkerEvent
  | SnapshotEvent
  | ClipEvent;