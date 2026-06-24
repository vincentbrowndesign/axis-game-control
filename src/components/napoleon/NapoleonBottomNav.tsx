"use client";

export type NapoleonView = "home" | "loops" | "proof" | "empire" | "profile";

type Props = {
  active: NapoleonView;
  onChange: (view: NapoleonView) => void;
};

const items: Array<{ label: string; view: NapoleonView }> = [
  { label: "Home", view: "home" },
  { label: "Loops", view: "loops" },
  { label: "Proof", view: "proof" },
  { label: "Empire", view: "empire" },
  { label: "Profile", view: "profile" },
];

export function NapoleonBottomNav({ active, onChange }: Props) {
  return (
    <nav className="napoleon-bottom-nav" aria-label="Napoleon sections">
      {items.map((item) => (
        <button
          data-active={active === item.view}
          key={item.view}
          onClick={() => onChange(item.view)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
