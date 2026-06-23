"use client";

export type AxisNavKey = "session" | "ask" | "memory" | "players" | "tools";

type Props = {
  active: AxisNavKey;
  onChange: (next: AxisNavKey) => void;
};

const navItems: Array<{ key: AxisNavKey; label: string }> = [
  { key: "session", label: "Session" },
  { key: "ask", label: "Ask" },
  { key: "memory", label: "Memory" },
  { key: "players", label: "Players" },
  { key: "tools", label: "Tools" },
];

export function AxisBottomNav({ active, onChange }: Props) {
  return (
    <nav className="axis-bottom-nav" aria-label="Axis sections">
      {navItems.map((item) => (
        <button
          key={item.key}
          type="button"
          data-active={active === item.key}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
