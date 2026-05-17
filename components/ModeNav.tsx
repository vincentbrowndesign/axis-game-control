import Link from "next/link"

type Mode = "today" | "watch" | "players" | "team"

const modes: { key: Mode; label: string; href: string }[] = [
  { key: "today", label: "Today", href: "/" },
  { key: "watch", label: "Watch", href: "/sessions" },
  { key: "players", label: "Players", href: "/players" },
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
