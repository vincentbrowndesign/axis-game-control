import Link from "next/link"

type Mode = "live" | "systems" | "review" | "team"

const modes: { key: Mode; label: string; href: string }[] = [
  { key: "live", label: "Record", href: "/" },
  { key: "review", label: "Watch", href: "/sessions" },
  { key: "team", label: "Team", href: "/team/local" },
]

export default function ModeNav({ active }: { active: Mode }) {
  return (
    <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-stone-300/40">
      {modes.map((mode) => (
        <Link
          key={mode.key}
          href={mode.href}
          className={`py-2 transition ${
            active === mode.key
              ? "text-stone-100"
              : "hover:text-stone-100"
          }`}
        >
          {mode.label}
        </Link>
      ))}
    </nav>
  )
}
