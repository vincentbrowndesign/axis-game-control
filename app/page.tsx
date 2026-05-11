"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#08111d] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.45em] text-cyan-400">
            Axis
          </div>

          <h1 className="mt-2 text-6xl font-black tracking-[-0.06em]">
            Spurts
          </h1>

          <p className="mt-5 text-base text-white/45">
            Feel momentum. Pressure. Collapse. Control.
          </p>
        </div>

        <Link
          href="/controller/spurts"
          className="mt-12 flex h-20 w-full items-center justify-center rounded-[28px] bg-cyan-400/20 text-2xl font-black tracking-[-0.04em] text-cyan-200 shadow-[0_0_50px_rgba(34,211,238,0.15)] transition-all duration-200 active:scale-[0.98]"
        >
          OPEN CONTROLLER
        </Link>
      </div>
    </main>
  );
}