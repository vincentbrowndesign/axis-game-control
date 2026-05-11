"use client";

import { useRouter } from "next/navigation";

import { createSession } from "@/lib/session/createSession";
import { saveSession } from "@/lib/session/sessionStore";

export default function HomePage() {
  const router = useRouter();

  function openController() {
    const session = createSession(
      "HOME",
      "AWAY"
    );

    saveSession(session);

    router.push(
      `/session/${session.id}`
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050505] px-6 text-white">
      <div className="w-full max-w-[640px] text-center">
        <div className="mb-4 text-[10px] font-bold tracking-[0.45em] text-cyan-400">
          AXIS
        </div>

        <h1 className="text-[72px] font-black leading-none tracking-[-0.08em]">
          Spurts
        </h1>

        <p className="mt-5 text-[18px] text-white/50">
          Feel momentum. Pressure.
          Collapse. Control.
        </p>

        <button
          onClick={openController}
          className="mt-12 w-full rounded-full bg-cyan-500 px-8 py-6 text-[22px] font-black tracking-[-0.03em] text-black transition-all hover:scale-[1.02]"
        >
          OPEN CONTROLLER
        </button>

        <div className="mt-10 grid grid-cols-2 gap-4 text-left">
          <div className="border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[10px] font-bold tracking-[0.3em] text-white/35">
              LIVE
            </div>

            <div className="mt-2 text-[20px] font-black tracking-[-0.04em]">
              SCORE TRACKING
            </div>

            <p className="mt-2 text-sm text-white/45">
              Track makes, misses,
              turnovers, runs, and
              pressure in real time.
            </p>
          </div>

          <div className="border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[10px] font-bold tracking-[0.3em] text-white/35">
              MEMORY
            </div>

            <div className="mt-2 text-[20px] font-black tracking-[-0.04em]">
              GAME NARRATIVE
            </div>

            <p className="mt-2 text-sm text-white/45">
              Build timelines, sync
              clips, and identify
              momentum swings.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}