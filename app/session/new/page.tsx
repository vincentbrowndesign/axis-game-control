"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSession } from "@/lib/session/createSession";
import { saveSession } from "@/lib/session/sessionStore";

export default function NewSessionPage() {
  const router = useRouter();

  const [home, setHome] = useState("");
  const [away, setAway] = useState("");

  function handleStart() {
    const session = createSession(home, away);

    saveSession(session);

    router.push(`/session/${session.id}`);
  }

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="text-4xl font-semibold">
          NEW SESSION
        </h1>

        <input
          value={home}
          onChange={(e) => setHome(e.target.value)}
          placeholder="HOME TEAM"
          className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-4"
        />

        <input
          value={away}
          onChange={(e) => setAway(e.target.value)}
          placeholder="AWAY TEAM"
          className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-4"
        />

        <button
          onClick={handleStart}
          className="w-full bg-white text-black rounded-xl p-4 font-semibold"
        >
          START SESSION
        </button>
      </div>
    </main>
  );
}