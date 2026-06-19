import type { AxisCardStatus } from "../../../lib/axis-visual-language";

export type AxisLabSaveStatus =
  | "not_saved"
  | "saving"
  | "saved"
  | "unsaved_changes"
  | "error";

export type AxisLabTimelineEntry = {
  id: string;
  kind: "user" | "axis" | "board";
  label: string;
  text: string;
  timestamp: string;
};

export type AxisLabBoardCardData = {
  id: string;
  title: string;
  items: readonly string[];
  status: AxisCardStatus;
  note?: string;
  createdAt?: string;
};

export type AxisLabFocus = {
  title: string;
  summary: string;
};

export type AxisLabAnnotation = {
  label: string;
  note: string;
};
