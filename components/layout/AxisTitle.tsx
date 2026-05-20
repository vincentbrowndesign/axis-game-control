"use client"

type Props = {
  eyebrow?: string
  title: string
  subtitle?: string
}

export default function AxisTitle({
  eyebrow,
  title,
  subtitle,
}: Props) {
  return (
    <div>
      {eyebrow && (
        <p className="axis-mono axis-world-kicker text-[11px] font-black uppercase tracking-[0.24em]">
          {eyebrow}
        </p>
      )}

      <h1 className="axis-world-title mt-5 text-5xl font-black uppercase leading-[0.92] tracking-normal sm:text-7xl">
        {title}
      </h1>

      {subtitle && (
        <p className="mt-6 max-w-[680px] text-lg font-bold leading-[1.35] text-white/48 sm:text-2xl">
          {subtitle}
        </p>
      )}
    </div>
  )
}
