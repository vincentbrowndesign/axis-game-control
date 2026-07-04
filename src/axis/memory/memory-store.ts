import type { AxisMemoryPage, AxisSessionObject } from "../core/types";

const memoryPageKey = "axis-local-memory-pages";

export function sessionObjectToMemoryPage(object: AxisSessionObject): AxisMemoryPage {
  return {
    createdAt: object.createdAt,
    id: `axis-memory-page-${object.id}`,
    objectIds: [object.id],
    searchableText: object.searchableText,
    sessionId: object.sessionId,
    title: object.label,
  };
}

export function saveAxisMemoryPage(page: AxisMemoryPage) {
  if (typeof window === "undefined") return false;

  try {
    const current = listAxisMemoryPages();
    window.localStorage.setItem(memoryPageKey, JSON.stringify([page, ...current].slice(0, 100)));
    return true;
  } catch {
    try {
      window.localStorage.setItem(memoryPageKey, JSON.stringify([page]));
      return true;
    } catch {
      return false;
    }
  }
}

export function listAxisMemoryPages(): AxisMemoryPage[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(memoryPageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AxisMemoryPage[]) : [];
  } catch {
    return [];
  }
}
