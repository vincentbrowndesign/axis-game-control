import type { AxisVisionRead } from "../core/types";
import type { AxisCommand } from "./axis-command-types";

const commandStorageKey = "axis-local-commands";

type StoredAxisCommand = {
  attachedToReadId?: string;
  commandType: AxisCommand["type"];
  createdAt: string;
  id: string;
  noteKind?: "coach_note" | "correction" | "question" | "intent";
  playerRead?: {
    command?: string;
    confidence: number;
    id: string;
    lockState: AxisVisionRead["lockState"];
    reviewState: AxisVisionRead["reviewState"];
    sessionId: string;
    source: AxisVisionRead["source"];
    timestampMs: number;
  };
  raw: string;
  resolvedAction?: "open_camera" | "save_read" | "check_player" | "export" | string;
  tool?: "camera" | "player_lock" | "export" | "session";
};

export function saveAxisCommandMetadata(command: AxisCommand, read?: AxisVisionRead | null) {
  if (typeof window === "undefined") return false;

  const stored: StoredAxisCommand = {
    attachedToReadId: command.type === "note" ? command.attachedToReadId : read?.id,
    commandType: command.type,
    createdAt: command.createdAt,
    id: command.id,
    noteKind: command.type === "note" ? command.noteKind : undefined,
    playerRead: read ? compactRead(read) : undefined,
    raw: command.raw,
    resolvedAction: resolvedAction(command),
    tool: command.type === "tool_call" ? command.tool : undefined,
  };

  try {
    const current = listStoredCommands();
    window.localStorage.setItem(commandStorageKey, JSON.stringify([stored, ...current].slice(0, 100)));
    return true;
  } catch {
    try {
      window.localStorage.setItem(commandStorageKey, JSON.stringify([stored]));
      return true;
    } catch {
      return false;
    }
  }
}

function listStoredCommands(): StoredAxisCommand[] {
  try {
    const raw = window.localStorage.getItem(commandStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as StoredAxisCommand[] : [];
  } catch {
    return [];
  }
}

function resolvedAction(command: AxisCommand) {
  if (command.type === "context_submit") return command.resolvedAction;
  if (command.type === "tool_call") return command.action;
  return command.noteKind;
}

function compactRead(read: AxisVisionRead): StoredAxisCommand["playerRead"] {
  return {
    command: read.command,
    confidence: read.confidence,
    id: read.id,
    lockState: read.lockState,
    reviewState: read.reviewState,
    sessionId: read.sessionId,
    source: read.source,
    timestampMs: read.timestampMs,
  };
}
