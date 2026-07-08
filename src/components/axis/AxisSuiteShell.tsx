"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

// Suite chrome for Axis product pages: brand mark, app launcher,
// what's-new notice, account/help, and an optional command bar slot.
// Live/field mode keeps its own minimal header on purpose.

export type AxisSuiteApp = {
  name: string;
  sub: string;
  href: string;
  glyph: string;
};

export const AXIS_APPS: AxisSuiteApp[] = [
  { glyph: "S", href: "/axis", name: "Sessions", sub: "Capture work" },
  { glyph: "L", href: "/axis/events/new", name: "Live", sub: "Field mode" },
  { glyph: "F", href: "/axis/clip-room", name: "Film", sub: "Replay + clips" },
  { glyph: "P", href: "/axis/players", name: "Players", sub: "Profiles" },
  { glyph: "K", href: "/axis/packages", name: "Packages", sub: "Share + sell" },
  { glyph: "I", href: "/axis/lab/datasets", name: "Intelligence", sub: "Data + memory" },
  { glyph: "X", href: "/axis/lab", name: "Lab", sub: "Experiments" },
];

const WHATS_NEW = [
  {
    action: "Go live",
    detail: "See the court on the live stage while you mark moments.",
    href: "/axis/events/new",
    title: "Camera preview",
  },
  {
    action: "Open Intelligence",
    detail: "Everything Axis learns from, gathered in one place.",
    href: "/axis/lab/datasets",
    title: "Axis Intelligence",
  },
  {
    action: "Build one",
    detail: "Turn a session into a recap, teaching points, and a share link.",
    href: "/axis/packages",
    title: "Package builder",
  },
];

const WHATS_NEW_KEY = "axis-whats-new-v1";

function AppLauncher({ onNavigate }: { onNavigate: () => void }) {
  return (
    <nav className="axis-suite-pop axis-suite-pop--apps" aria-label="Axis apps">
      {AXIS_APPS.map((app) => (
        <Link className="axis-suite-app" href={app.href} key={app.name} onClick={onNavigate}>
          <span className="axis-suite-glyph">{app.glyph}</span>
          <strong>{app.name}</strong>
          <span className="axis-suite-app-sub">{app.sub}</span>
        </Link>
      ))}
    </nav>
  );
}

export function AxisSuiteShell({
  backHref,
  backLabel,
  title,
  right,
  children,
}: {
  backHref?: string;
  backLabel?: string;
  title?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState<"apps" | "new" | "account" | null>(null);
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    // Deferred so the unseen-dot state lands after hydration, not during it.
    const timer = window.setTimeout(() => {
      if (!window.localStorage.getItem(WHATS_NEW_KEY)) setHasNew(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggle(panel: "apps" | "new" | "account") {
    if (panel === "new" && open !== "new") {
      window.localStorage.setItem(WHATS_NEW_KEY, "seen");
      setHasNew(false);
    }
    setOpen((current) => (current === panel ? null : panel));
  }

  return (
    <main className="axis-os axis-suite">
      <header className="axis-suite-topbar">
        <div className="axis-os-brand">
          {backHref ? (
            <Link className="axis-os-back" href={backHref}>
              ← {backLabel ?? "Axis"}
            </Link>
          ) : (
            <span>Trophy Labs</span>
          )}
          <strong>{title ?? "Axis"}</strong>
        </div>
        <div className="axis-suite-actions">
          {right}
          <button
            aria-label="What's new in Axis"
            className="axis-suite-iconbtn"
            onClick={() => toggle("new")}
            type="button"
          >
            ✦{hasNew && <i className="axis-suite-dot" />}
          </button>
          <button aria-label="Axis apps" className="axis-suite-iconbtn" onClick={() => toggle("apps")} type="button">
            <span className="axis-suite-gridglyph">
              <i /><i /><i /><i /><i /><i /><i /><i /><i />
            </span>
          </button>
          <button
            aria-label="Account and help"
            className="axis-suite-iconbtn"
            onClick={() => toggle("account")}
            type="button"
          >
            TL
          </button>

          {open && <button aria-label="Close menu" className="axis-suite-overlay" onClick={() => setOpen(null)} type="button" />}
          {open === "apps" && <AppLauncher onNavigate={() => setOpen(null)} />}
          {open === "new" && (
            <div className="axis-suite-pop axis-suite-pop--list" aria-label="New in Axis">
              <p className="axis-suite-pop-title">New in Axis</p>
              {WHATS_NEW.map((item) => (
                <div className="axis-suite-newitem" key={item.title}>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                  <Link href={item.href} onClick={() => setOpen(null)}>
                    {item.action} →
                  </Link>
                </div>
              ))}
            </div>
          )}
          {open === "account" && (
            <div className="axis-suite-pop axis-suite-pop--list" aria-label="Account and help">
              <p className="axis-suite-pop-title">Trophy Labs</p>
              <div className="axis-suite-newitem">
                <strong>Axis</strong>
                <p>Signed in on this device.</p>
                <Link href="/" onClick={() => setOpen(null)}>
                  Public site →
                </Link>
              </div>
              <div className="axis-suite-newitem">
                <strong>Help</strong>
                <p>Questions or a stuck session?</p>
                <a href="mailto:vincent.brown.design@gmail.com?subject=Axis%20help">Get help →</a>
              </div>
            </div>
          )}
        </div>
      </header>
      {children}
    </main>
  );
}
