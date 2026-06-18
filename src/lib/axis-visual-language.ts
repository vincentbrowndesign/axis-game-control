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

function normalizeSectionLabel(label: string) {
  return label
    .trim()
    .toUpperCase()
    .replace(/&/g, "AND")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveAxisSectionStatus(label: string): AxisCardStatus {
  const normalized = normalizeSectionLabel(label);

  if (
    [
      "OBSERVATION",
      "PATTERN",
      "RELATIONSHIP",
      "QUESTION",
      "HYPOTHESIS",
      "INTERVENTION",
      "KNOWN",
    ].includes(normalized)
  ) {
    return "neutral";
  }

  if (
    [
      "GAMEPLAN",
      "TIMEOUT CALL",
      "PLAYER RULE",
      "INSTALL",
      "CORE RULE",
      "NEXT MOVE",
      "OUTCOME NEXT MOVE",
      "ACTION",
      "PLAY",
    ].includes(normalized)
  ) {
    return "use";
  }

  if (
    [
      "ASSUMED",
      "READ",
      "WATCH NEXT",
      "NEED NEXT",
      "CHOICE",
      "DECISION",
    ].includes(normalized)
  ) {
    return "decide";
  }

  if (
    [
      "ADJUSTMENT TRIGGER",
      "FIX",
      "CORRECTION",
      "BREAKING",
      "PROBLEM",
    ].includes(normalized)
  ) {
    return "fix";
  }

  if (["PROOF", "EVIDENCE", "SIGNALS"].includes(normalized)) {
    return "proof";
  }

  if (["PARKED", "HOLD", "LATER", "NOT NOW"].includes(normalized)) {
    return "parked";
  }

  return "neutral";
}
