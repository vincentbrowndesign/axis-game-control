"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AxisAccessLink,
  AxisEventContainer,
  AxisEventMedia,
  AxisEventPlayer,
  AxisMoment,
  AxisReport,
} from "./axis-event-container";

export type AxisEventDetail = {
  accessLinks: AxisAccessLink[];
  event: AxisEventContainer;
  media: AxisEventMedia[];
  moments: AxisMoment[];
  players: AxisEventPlayer[];
  reports: AxisReport[];
};

export type AxisLoadState = "loading" | "ready" | "error" | "offline";

// Shared loader for every event screen. Keeps stale detail visible during a
// reload instead of flashing back to a spinner.
export function useAxisEventDetail(eventId: string) {
  const [detail, setDetail] = useState<AxisEventDetail | null>(null);
  const [state, setState] = useState<AxisLoadState>("loading");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await fetch(`/api/axis/events/${eventId}`).catch(() => null);
      if (cancelled) return;
      if (!response) {
        setState("offline");
        return;
      }
      if (response.status === 503) {
        setState("offline");
        return;
      }
      if (!response.ok) {
        setState("error");
        return;
      }
      const body = (await response.json().catch(() => null)) as AxisEventDetail | null;
      if (cancelled) return;
      if (!body?.event) {
        setState("error");
        return;
      }
      setDetail(body);
      setState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, reloadKey]);

  const reload = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  // Local optimistic update after a mutation, without a refetch round-trip.
  const mutate = useCallback((updater: (current: AxisEventDetail) => AxisEventDetail) => {
    setDetail((current) => (current ? updater(current) : current));
  }, []);

  return { detail, mutate, reload, state };
}
