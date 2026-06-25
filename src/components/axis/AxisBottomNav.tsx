"use client";

import Link from "next/link";

export type AxisNavKey = "session" | "ask" | "memory" | "players" | "tools";

type Props = {
  active: AxisNavKey;
  onChange: (next: AxisNavKey) => void;
};

const navItems: Array<{ key: AxisNavKey; label: string }> = [
  { key: "session", label: "Log" },
  { key: "memory", label: "Review" },
];

export function AxisBottomNav({ active, onChange }: Props) {
  return (
    <nav className="axis-bottom-nav" aria-label="Axis sections">
      <Link href="/vision">Vision</Link>
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
