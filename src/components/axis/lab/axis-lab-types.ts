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

export type AxisLabAnnotationKind = "observation" | "proof" | "question" | "keeper";

export type AxisLabAnnotation = {
  label: string;
  note: string;
  kind?: AxisLabAnnotationKind;
};

export type AxisApertureFocus =
  | "quiet"
  | "input_active"
  | "annotation_visible"
  | "make_space"
  | "lens_preview"
  | "source_expanded";

export type LensMockFrame = {
  id: string;
  time: string;
  selected?: boolean;
};

export type LensEvidenceCandidateKind = "source_candidate" | "open_question";

export type LensEvidenceCandidate = {
  id: string;
  kind: LensEvidenceCandidateKind;
  label: string;
  body: string;
  source?: string;
  confidence?: string;
};

export type MakeSpaceItemKind = "keeper" | "question" | "proof" | "next_move";

export type MakeSpaceItem = {
  id: string;
  kind: MakeSpaceItemKind;
  label: string;
  text: string;
  surfacedReason: string;
  createdAt: string;
};
