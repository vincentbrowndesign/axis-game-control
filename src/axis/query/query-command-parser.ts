import type { AxisCommand } from "./axis-command-types";
import { parseAxisOpenCommand } from "./open-command-parser";

export type AxisQueryCommand = AxisCommand;

export function parseAxisQueryCommand(input: string): AxisQueryCommand {
  return parseAxisOpenCommand(input, {
    cameraReady: true,
  });
}
