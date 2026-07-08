"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

// Suite chrome for Axis product pages: brand mark, app launcher, and one
// overflow menu (what's new, public site, help). Live/field mode keeps its
// own minimal header on purpose.

export type AxisSuiteApp = {
  name: string;
  sub: string;
  href: string;
  glyph: string;
  tone?: "live";
};

// Every app lands exactly where its word promises.
export const AXIS_APPS: AxisSuiteApp[] = [
  { glyph: "▤", href: "/axis/sessions", name: "Sessions", sub: "All capture work" },
  { glyph: "●", href: "/axis/live", name: "Live", sub: "Field mode", tone: "live" },
  { glyph: "◎", href: "/axis/players", name: "Players", sub: "Profiles" },
  { glyph: "▣", href: "/axis/packages", name: "Packages", sub: "Share + sell" },
  { glyph: "✦", href: "/axis/lab/datasets", name: "Intelligence", sub: "Data + memory" },
  { glyph: "△", href: "/axis/lab", name: "Lab", sub: "Experiments" },
];

const WHATS_NEW = [
  {
    action: "Go live",
    detail: "See the court on the live stage while you mark moments.",
    href: "/axis/live",
    title: "Camera preview",
  },
  {
    action: "Open Intelligence",
    detail: "Everything Axis learns from, in one place.",
    href: "/axis/lab/datasets",
    title: "Axis Intelligence",
  },
  {
    action: "Build one",
    detail: "Turn a session into a recap and a share link.",
    href: "/axis/packages",
    title: "Package builder",
  },
];

const WHATS_NEW_KEY = "axis-whats-new-v1";

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
  const [open, setOpen] = useState<"apps" | "more" | null>(null);
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    // Deferred so the unseen-dot state lands after hydration, not during it.
    const timer = window.setTimeout(() => {
      if (!window.localStorage.getItem(WHATS_NEW_KEY)) setHasNew(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggle(panel: "apps" | "more") {
    if (panel === "more" && open !== "more") {
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
          <button aria-label="Axis apps" className="axis-suite-iconbtn" onClick={() => toggle("apps")} type="button">
            <span className="axis-suite-gridglyph">
              <i /><i /><i /><i /><i /><i /><i /><i /><i />
            </span>
          </button>
          <button
            aria-label="More: what's new and help"
            className="axis-suite-iconbtn"
            onClick={() => toggle("more")}
            type="button"
          >
            ⋯{hasNew && <i className="axis-suite-dot" />}
          </button>

          {open && (
            <button aria-label="Close menu" className="axis-suite-overlay" onClick={() => setOpen(null)} type="button" />
          )}
          {open === "apps" && (
            <nav className="axis-suite-pop axis-suite-pop--apps" aria-label="Axis apps">
              {AXIS_APPS.map((app) => (
                <Link className="axis-suite-app" href={app.href} key={app.name} onClick={() => setOpen(null)}>
                  <span className={app.tone === "live" ? "axis-suite-glyph axis-suite-glyph--live" : "axis-suite-glyph"}>
                    {app.glyph}
                  </span>
                  <strong>{app.name}</strong>
                  <span className="axis-suite-app-sub">{app.sub}</span>
                </Link>
              ))}
            </nav>
          )}
          {open === "more" && (
            <div className="axis-suite-pop axis-suite-pop--list" aria-label="What's new and help">
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
              <div className="axis-suite-newitem axis-suite-newitem--divider">
                <Link href="/" onClick={() => setOpen(null)}>
                  Public site →
                </Link>
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
