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
        <p className="text-[11px] uppercase tracking-[0.42em] text-zinc-600">
          {eyebrow}
        </p>
      )}

      <h1 className="mt-5 text-[72px] font-black leading-[0.85] tracking-[-0.08em] text-white">
        {title}
      </h1>

      {subtitle && (
        <p className="mt-8 max-w-[680px] text-[30px] leading-[1.35] text-zinc-400">
          {subtitle}
        </p>
      )}
    </div>
  )
}