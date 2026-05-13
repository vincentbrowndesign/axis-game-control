"use client";

import { useEffect, useState } from "react";
import MuxPlayer from "@mux/mux-player-react";

type Props = {
  sessionId: string;
};

export default function AxisReplayClient({
  sessionId,
}: Props) {
  const [session, setSession] = useState<any>(
    null
  );

  useEffect(() => {
    async function load() {
      const res = await fetch(
        `/api/analyze/session/${sessionId}`
      );

      const data = await res.json();

      setSession(data);
    }

    load();
  }, [sessionId]);

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-[72px] font-black leading-[0.9] tracking-[0.35em]">
          AXIS
          <br />
          REPLAY
        </h1>

        {!session && (
          <div className="mt-12 rounded-[32px] border border-white/10 bg-neutral-950 p-10">
            <p className="text-[32px] tracking-[0.35em] text-white/60">
              LOADING
            </p>
          </div>
        )}

        {session?.playback_id && (
          <div className="mt-12 overflow-hidden rounded-[32px] border border-white/10">
            <MuxPlayer
              playbackId={session.playback_id}
              streamType="on-demand"
              accentColor="#ffffff"
            />
          </div>
        )}
      </div>
    </main>
  );
}