"use client"

import { ReactNode } from "react"

type Props = {
  children: ReactNode
  className?: string
}

export default function AxisCard({
  children,
  className = "",
}: Props) {
  return (
    <section
      className={`
        rounded-[34px]
        border
        border-white/10
        bg-white/[0.03]
        p-6
        backdrop-blur-sm
        ${className}
      `}
    >
      {children}
    </section>
  )
}