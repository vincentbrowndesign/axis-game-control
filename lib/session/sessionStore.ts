import { SpurtsSession } from "./types";

const store = new Map<string, SpurtsSession>();

export function saveSession(session: SpurtsSession) {
  store.set(session.id, session);
}

export function getSession(id: string) {
  return store.get(id);
}