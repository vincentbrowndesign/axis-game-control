import type {
  MidheavenEvent,
  MidheavenEventType,
  MidheavenSource,
  MoneyMap,
  MoneyMapRefinement,
  MoneyMapShare,
} from "./types";

const localEvents: MidheavenEvent[] = [];

export function recordMidheavenEvent(type: MidheavenEventType, payload: Record<string, unknown> = {}) {
  const event: MidheavenEvent = {
    id: `mid-event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    createdAt: new Date().toISOString(),
    payload,
  };

  localEvents.push(event);
  return event;
}

export async function addMidheavenSource(raw: string): Promise<MidheavenSource> {
  const response = await fetch("/api/midheaven/source", {
    body: JSON.stringify({ raw }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (!response.ok) throw new Error("Midheaven could not read that source yet.");
  const data = (await response.json()) as { source?: MidheavenSource };
  if (!data.source) throw new Error("Midheaven did not return a source.");
  return data.source;
}

export async function generateMoneyMap(source: MidheavenSource): Promise<MoneyMap> {
  const response = await fetch("/api/midheaven/money-map", {
    body: JSON.stringify({ source }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (!response.ok) throw new Error("Midheaven could not form the Money Map yet.");
  const data = (await response.json()) as { moneyMap?: MoneyMap };
  if (!data.moneyMap) throw new Error("Midheaven did not return a Money Map.");
  return data.moneyMap;
}

export async function shareMoneyMap(moneyMap: MoneyMap): Promise<MoneyMapShare> {
  const response = await fetch("/api/midheaven/share", {
    body: JSON.stringify({ moneyMap }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (!response.ok) throw new Error("Midheaven could not create a share preview yet.");
  const data = (await response.json()) as { share?: MoneyMapShare };
  if (!data.share) throw new Error("Midheaven did not return a share preview.");
  return data.share;
}

export function refineMoneyMap(moneyMap: MoneyMap, refinement: MoneyMapRefinement) {
  recordMidheavenEvent("money_map_refined", { moneyMapId: moneyMap.id, refinement });
  if (refinement === "build_this") {
    recordMidheavenEvent("first_loop_selected", { moneyMapId: moneyMap.id, firstLoopId: moneyMap.firstLoop.id });
  }
}

export function getLocalMidheavenEvents() {
  return [...localEvents];
}
