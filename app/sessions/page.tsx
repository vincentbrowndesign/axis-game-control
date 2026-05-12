"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AxisSession, getAxisSessions } from "@/lib/session/axisSession";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<AxisSession[]>([]);

  useEffect(() => {
    setSessions(getAxisSessions());
  }, []);

  return (
    <main className="min-h-screen bg-[#030608] text-white">
      <div className="mx-auto max-w-[1400px] px-6 py-8">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.35em] text-white/35">
            Axis
          </p>
          <h1 className="mt-2 text-5xl font-light tracking-[0.25em]">
            SESSIONS
          </h1>
        </header>

        <div className="grid gap-4">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/replay/${session.id}`}
              className="rounded-[28px] border border-white/10 bg-white/[0.025] p-6 transition hover:bg-white/[0.05]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-white/35">
                    {new Date(session.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-3 text-3xl font-light">
                    Home {session.homeScore} — Away {session.awayScore}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/35">
                    Status
                  </p>
                  <p className="mt-2 text-sm uppercase tracking-[0.2em] text-violet-300">
                    {session.status}
                  </p>
                </div>
              </div>
            </Link>
          ))}

          {sessions.length === 0 && (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.025] p-8 text-white/40">
              No sessions saved yet.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}