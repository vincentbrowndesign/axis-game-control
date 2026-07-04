export type AxisCommand =
  | {
      id: string;
      type: "tool_call";
      raw: string;
      tool: "camera" | "player_lock" | "export" | "session";
      action: string;
      createdAt: string;
    }
  | {
      id: string;
      type: "context_submit";
      raw: "";
      resolvedAction: "open_camera" | "save_read" | "check_player" | "export";
      createdAt: string;
    }
  | {
      id: string;
      type: "note";
      raw: string;
      noteKind: "coach_note" | "correction" | "question" | "intent";
      attachedToReadId?: string;
      createdAt: string;
    };

export type AxisOpenCommandContext = {
  cameraReady: boolean;
  exportContextActive?: boolean;
  latestPlayerRead?: {
    id: string;
    lockState: "searching" | "review" | "locked" | "lost" | "error" | "saved";
  } | null;
};
