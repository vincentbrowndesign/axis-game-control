"use client"

import { ButtonHTMLAttributes } from "react"

type Props = ButtonHTMLAttributes<HTMLButtonElement>

export default function AxisButton({
  children,
  className = "",
  ...props
}: Props) {
  return (
    <button
      {...props}
      className={`
        w-full
        rounded-full
        bg-white
        px-6
        py-5
        text-lg
        font-black
        text-black
        transition-all
        active:scale-[0.985]
        disabled:opacity-50
        ${className}
      `}
    >
      {children}
    </button>
  )
}