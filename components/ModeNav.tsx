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
    <nav className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-black uppercase tracking-[0.2em] text-stone-300/45">
      {modes.map((mode) => (
        <Link
          key={mode.key}
          href={mode.href}
          className={`border-b py-2 transition ${
            active === mode.key
              ? "border-amber-200/55 text-amber-100"
              : "border-transparent hover:border-stone-200/20 hover:text-stone-100"
          }`}
        >
          {mode.label}
        </Link>
      ))}
    </nav>
  )
}
