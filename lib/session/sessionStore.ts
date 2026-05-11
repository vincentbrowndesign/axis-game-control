import { SpurtsSession } from "./types";

const STORAGE_KEY = "spurts-live-session";

export function saveSession(
  session: SpurtsSession
) {
  if (typeof window === "undefined") return;

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(session)
  );
}

export function loadSession():
  | SpurtsSession
  | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(
    STORAGE_KEY
  );

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;

  localStorage.removeItem(STORAGE_KEY);
}