"use client"

import { ReactNode } from "react"

type Props = {
  children: ReactNode
}

export default function AxisShell({
  children,
}: Props) {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-8 px-5 pb-32 pt-6">
        {children}
      </div>
    </main>
  )
}