import { createNapoleonId } from "./seed";
import type {
  NapoleonAgentResult,
  NapoleonCashLoop,
  NapoleonEvent,
  NapoleonEventType,
} from "./types";

const localEvents: NapoleonEvent[] = [];

export async function recordNapoleonEvent(
  eventType: NapoleonEventType,
  payload: Record<string, unknown> = {},
) {
  const event: NapoleonEvent = {
    id: createNapoleonId("event"),
    type: eventType,
    createdAt: new Date().toISOString(),
    payload,
  };

  localEvents.push(event);

  try {
    await fetch("/api/napoleon/events", {
      body: JSON.stringify(event),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  } catch {
    // The MVP keeps working locally if the placeholder route is unavailable.
  }

  return event;
}

export async function submitNapoleonQuery(input: string): Promise<NapoleonAgentResult> {
  const response = await fetch("/api/napoleon/query", {
    body: JSON.stringify({ input }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Napoleon could not answer that yet.");
  }

  const data = (await response.json()) as { result?: NapoleonAgentResult };
  if (!data.result) {
    throw new Error("Napoleon did not return a result.");
  }

  return data.result;
}

export async function createNapoleonLoopFromResult(
  result: NapoleonAgentResult,
): Promise<NapoleonCashLoop> {
  const response = await fetch("/api/napoleon/loops", {
    body: JSON.stringify({
      sourceQueryId: result.query.id,
      ...result.suggestedLoop,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Napoleon could not build that loop yet.");
  }

  const data = (await response.json()) as { loop?: NapoleonCashLoop };
  if (!data.loop) {
    throw new Error("Napoleon did not return a loop.");
  }

  return data.loop;
}

export function getLocalNapoleonEvents() {
  return [...localEvents];
}
