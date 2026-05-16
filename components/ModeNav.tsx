import Link from "next/link"

type Mode = "live" | "systems" | "review" | "team"

const modes: { key: Mode; label: string; href: string }[] = [
  { key: "live", label: "Live", href: "/" },
  { key: "systems", label: "Systems", href: "/systems" },
  { key: "review", label: "Review", href: "/sessions" },
  { key: "team", label: "Team", href: "/team/local" },
]

export default function ModeNav({ active }: { active: Mode }) {
  return (
    <nav className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/45">
      {modes.map((mode) => (
        <Link
          key={mode.key}
          href={mode.href}
          className={`border px-3 py-2 transition ${
            active === mode.key
              ? "border-lime-300/35 text-lime-100"
              : "border-white/10 hover:text-white"
          }`}
        >
          {mode.label}
        </Link>
      ))}
    </nav>
  )
}
