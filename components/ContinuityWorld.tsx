import Link from "next/link"
import ContinueMemory from "@/components/ContinueMemory"
import type { ActiveContinuityState } from "@/lib/world/getActiveContinuity"

type WorldLink = {
  href: string
  label: string
  line: string
}

type Props = {
  eyebrow: string
  title: string
  line: string
  primaryHref?: string
  primaryLabel?: string
  links?: WorldLink[]
  preferredWarmupId?: string | null
  identityName?: string | null
  showContinuity?: boolean
}

const defaultLinks: WorldLink[] = [
  {
    href: "/archive",
    label: "Memory",
    line: "Remembered effort.",
  },
  {
    href: "/retrieve",
    label: "Retrieve",
    line: "Find what matters now.",
  },
  {
    href: "/connections",
    label: "Connections",
    line: "See what keeps returning.",
  },
  {
    href: "/team/local",
    label: "Team",
    line: "Shared continuity.",
  },
  {
    href: "/practice",
    label: "Practice",
    line: "Add memory.",
  },
]

export default function ContinuityWorld({
  eyebrow,
  title,
  line,
  primaryHref = "/archive",
  primaryLabel = "Open Memory",
  links = defaultLinks,
  preferredWarmupId = null,
  identityName = null,
  showContinuity = true,
}: Props) {
  const fallbackContinuity: ActiveContinuityState = {
    eyebrow: "Player Continuity",
    title,
    line,
    href: primaryHref,
    actionLabel: primaryLabel,
  }

  return (
    <main className="axis-atmosphere min-h-screen bg-black px-5 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col justify-between">
        <header className="flex items-center justify-between gap-6">
          <Link
            href="/"
            className="text-[10px] uppercase tracking-[0.55em] text-white/30"
          >
            Axis
          </Link>
          <Link
            href="/profile"
            className="text-[10px] uppercase tracking-[0.35em] text-white/35 transition hover:text-white"
          >
            Player
          </Link>
        </header>

        <section className="py-20">
          <p className="text-[10px] uppercase tracking-[0.55em] text-lime-300">
            {eyebrow}
          </p>
          <h1 className="mt-6 max-w-5xl text-[clamp(4.2rem,15vw,11rem)] font-black uppercase leading-[0.78] tracking-[-0.075em]">
            {title}
          </h1>
          <p className="mt-8 max-w-xl text-xl leading-relaxed text-white/45">
            {line}
          </p>
          {showContinuity ? (
            <ContinueMemory
              preferredWarmupId={preferredWarmupId}
              fallbackName={identityName}
              fallback={fallbackContinuity}
            />
          ) : (
            <Link
              href={primaryHref}
              className="mt-10 inline-flex bg-white px-8 py-5 text-sm font-black uppercase tracking-[0.24em] text-black transition hover:bg-lime-300"
            >
              {primaryLabel}
            </Link>
          )}
        </section>

        <nav className="grid gap-px border border-white/10 bg-white/10 md:grid-cols-5">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="bg-black p-5 transition hover:bg-white hover:text-black"
            >
              <p className="text-sm font-black uppercase tracking-[0.22em]">
                {link.label}
              </p>
              <p className="mt-3 text-sm leading-relaxed opacity-50">
                {link.line}
              </p>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  )
}
