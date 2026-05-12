"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";

interface ReplayPageProps {
  params: Promise<{
    id: string;
  }>;
}

interface SessionEvent {
  id: string;
  type: string;
  team: string;
  points?: number;

  timestamp: number;
  gameTime: number;

  scoreSnapshot: {
    home: number;
    away: number;
  };

  inferredState?: string;
}

interface AxisSession {
  id: string;

  createdAt: string;

  muxPlaybackId?: string;

  events: SessionEvent[];
}

function formatClock(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(
    2,
    "0"
  )}`;
}

function getClipWindow(timestamp: number) {
  return {
    start: Math.max(timestamp - 8, 0),
    end: timestamp + 8,
  };
}

export default function ReplayPage({
  params,
}: ReplayPageProps) {
  const { id } = use(params);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [session, setSession] =
    useState<AxisSession | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(
      `axis-session-${id}`
    );

    if (!raw) return;

    const parsed = JSON.parse(raw);

    setSession(parsed);
  }, [id]);

  const orderedEvents = useMemo(() => {
    return [...(session?.events ?? [])].sort(
      (a, b) => a.timestamp - b.timestamp
    );
  }, [session]);

  function jumpToEvent(event: SessionEvent) {
    if (!videoRef.current) return;

    const clip = getClipWindow(event.timestamp);

    videoRef.current.currentTime = clip.start;

    videoRef.current.play();
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-zinc-500">
          Loading replay...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="mb-2 text-5xl tracking-[0.45em]">
              AXIS
            </div>

            <div className="text-sm uppercase tracking-[0.3em] text-zinc-500">
              Replay Memory
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-3 text-right">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Events
            </div>

            <div className="text-2xl font-black">
              {orderedEvents.length}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_0.8fr]">
          <div>
            <div className="overflow-hidden rounded-[32px] border border-zinc-800 bg-zinc-950">
              {session.muxPlaybackId ? (
                <video
                  ref={videoRef}
                  controls
                  className="aspect-video w-full"
                  src={`https://stream.mux.com/${session.muxPlaybackId}.m3u8`}
                />
              ) : (
                <div className="flex aspect-video items-center justify-center text-zinc-600">
                  No playback available
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[32px] border border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Timeline
              </div>

              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Replay
              </div>
            </div>

            <div className="space-y-3">
              {orderedEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => jumpToEvent(event)}
                  className="w-full rounded-2xl border border-zinc-800 bg-black p-4 text-left transition hover:border-zinc-600"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-bold uppercase tracking-[0.2em]">
                      {event.type}
                    </div>

                    <div className="text-xs text-zinc-500">
                      {formatClock(event.gameTime)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      {event.team}
                    </div>

                    <div className="text-sm font-bold">
                      {
                        event.scoreSnapshot.home
                      }
                      -
                      {
                        event.scoreSnapshot.away
                      }
                    </div>
                  </div>

                  {event.inferredState && (
                    <div className="mt-2 text-[10px] uppercase tracking-[0.3em] text-zinc-600">
                      {event.inferredState}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}