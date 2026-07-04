import type { AxisCommand, AxisOpenCommandContext } from "./axis-command-types";

const cameraStartPattern = /^(camera|open camera|start camera)$/;
const cameraFlipPattern = /^(flip|flip camera|switch camera)$/;
const cameraFrontPattern = /^(front|front camera|selfie)$/;
const cameraRearPattern = /^(rear|rear camera|back camera)$/;
const playerSavePattern = /^(save|save this|save player|use this|keep this)$/;
const playerCheckPattern = /^(check|check player|track player|lock player)$/;
const exportPattern = /^(export|export this|download)$/;
const resetPattern = /^(reset|clear)$/;

const intentWords = ["watch", "look", "focus", "track", "remember", "flag"];
const correctionWords = ["bad", "too", "late", "early", "fix", "correct", "wrong", "missed", "not right"];

export function parseAxisOpenCommand(input: string, context: AxisOpenCommandContext): AxisCommand {
  const raw = input;
  const normalized = normalizeCommand(input);
  const createdAt = new Date().toISOString();
  const id = `axis-command-${crypto.randomUUID()}`;

  if (!normalized) {
    return {
      createdAt,
      id,
      raw: "",
      resolvedAction: resolveEmptySubmit(context),
      type: "context_submit",
    };
  }

  const toolCommand = parseToolCommand(normalized, raw, id, createdAt);
  if (toolCommand) return toolCommand;

  return {
    attachedToReadId: context.latestPlayerRead?.id,
    createdAt,
    id,
    noteKind: noteKindFor(raw, normalized),
    raw,
    type: "note",
  };
}

function resolveEmptySubmit(context: AxisOpenCommandContext): "open_camera" | "save_read" | "check_player" | "export" {
  if (!context.cameraReady) return "open_camera";
  if (context.latestPlayerRead?.lockState === "locked" || context.latestPlayerRead?.lockState === "review") {
    return "save_read";
  }
  if (!context.latestPlayerRead || context.latestPlayerRead.lockState === "searching") return "check_player";
  if (context.exportContextActive) return "export";
  return "check_player";
}

function parseToolCommand(
  normalized: string,
  raw: string,
  id: string,
  createdAt: string,
): AxisCommand | null {
  if (cameraStartPattern.test(normalized)) {
    return { action: "start", createdAt, id, raw, tool: "camera", type: "tool_call" };
  }
  if (cameraFlipPattern.test(normalized)) {
    return { action: "flip", createdAt, id, raw, tool: "camera", type: "tool_call" };
  }
  if (cameraFrontPattern.test(normalized)) {
    return { action: "front", createdAt, id, raw, tool: "camera", type: "tool_call" };
  }
  if (cameraRearPattern.test(normalized)) {
    return { action: "rear", createdAt, id, raw, tool: "camera", type: "tool_call" };
  }
  if (playerSavePattern.test(normalized)) {
    return { action: "save", createdAt, id, raw, tool: "player_lock", type: "tool_call" };
  }
  if (playerCheckPattern.test(normalized)) {
    return { action: "check", createdAt, id, raw, tool: "player_lock", type: "tool_call" };
  }
  if (exportPattern.test(normalized)) {
    return { action: "frame", createdAt, id, raw, tool: "export", type: "tool_call" };
  }
  if (resetPattern.test(normalized)) {
    return { action: "reset_current", createdAt, id, raw, tool: "session", type: "tool_call" };
  }
  return null;
}

function noteKindFor(raw: string, normalized: string): "coach_note" | "correction" | "question" | "intent" {
  if (raw.trim().endsWith("?")) return "question";
  if (intentWords.some((word) => normalized.includes(word))) return "intent";
  if (correctionWords.some((word) => normalized.includes(word))) return "correction";
  return "coach_note";
}

function normalizeCommand(input: string) {
  return input.trim().toLowerCase().replace(/[.!,]+$/g, "").replace(/\s+/g, " ");
}
