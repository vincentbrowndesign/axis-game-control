export type AxisCardStatus =
  | "neutral"
  | "use"
  | "decide"
  | "fix"
  | "proof"
  | "parked";

export const AXIS_ROOM_COLORS = {
  room: "#F7F3EA",
  paper: "#FFFDF7",
  ink: "#151515",
  line: "#2A2926",
  grid: "#E6DDCF",
  use: "#2F6B4F",
  decide: "#C89A2D",
  fix: "#B74E3B",
  proof: "#2F5F9E",
  parked: "#8E877B",
} as const;

export type AxisStatusStyle = Readonly<{
  accent: string;
  background: string;
  border: string;
  text: string;
  mutedText: string;
}>;

export const AXIS_STATUS_STYLES: Record<AxisCardStatus, AxisStatusStyle> = {
  neutral: {
    accent: AXIS_ROOM_COLORS.line,
    background: AXIS_ROOM_COLORS.paper,
    border: AXIS_ROOM_COLORS.grid,
    text: AXIS_ROOM_COLORS.ink,
    mutedText: AXIS_ROOM_COLORS.parked,
  },
  use: {
    accent: AXIS_ROOM_COLORS.use,
    background: AXIS_ROOM_COLORS.paper,
    border: AXIS_ROOM_COLORS.grid,
    text: AXIS_ROOM_COLORS.ink,
    mutedText: AXIS_ROOM_COLORS.parked,
  },
  decide: {
    accent: AXIS_ROOM_COLORS.decide,
    background: AXIS_ROOM_COLORS.paper,
    border: AXIS_ROOM_COLORS.grid,
    text: AXIS_ROOM_COLORS.ink,
    mutedText: AXIS_ROOM_COLORS.parked,
  },
  fix: {
    accent: AXIS_ROOM_COLORS.fix,
    background: AXIS_ROOM_COLORS.paper,
    border: AXIS_ROOM_COLORS.grid,
    text: AXIS_ROOM_COLORS.ink,
    mutedText: AXIS_ROOM_COLORS.parked,
  },
  proof: {
    accent: AXIS_ROOM_COLORS.proof,
    background: AXIS_ROOM_COLORS.paper,
    border: AXIS_ROOM_COLORS.grid,
    text: AXIS_ROOM_COLORS.ink,
    mutedText: AXIS_ROOM_COLORS.parked,
  },
  parked: {
    accent: AXIS_ROOM_COLORS.parked,
    background: AXIS_ROOM_COLORS.paper,
    border: AXIS_ROOM_COLORS.grid,
    text: AXIS_ROOM_COLORS.ink,
    mutedText: AXIS_ROOM_COLORS.parked,
  },
};

export function getAxisStatusStyle(
  status: AxisCardStatus = "neutral",
): AxisStatusStyle {
  return AXIS_STATUS_STYLES[status];
}
