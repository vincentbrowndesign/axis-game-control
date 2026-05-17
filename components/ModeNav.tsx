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
    <nav className="flex flex-wrap gap-1 bg-black/25 p-1 text-xs font-bold text-stone-300/45">
      {modes.map((mode) => (
        <Link
          key={mode.key}
          href={mode.href}
          className={`px-3 py-2 transition ${
            active === mode.key
              ? "bg-stone-100 text-black"
              : "hover:bg-white/[0.05] hover:text-stone-100"
          }`}
        >
          {mode.label}
        </Link>
      ))}
    </nav>
  )
}
