import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Axis — Basketball Performance Intelligence | Trophy Labs",
  description: "Trophy Labs builds Axis. Axis turns basketball events into film, proof, reports, access, and player memory.",
};

const CONTACT = "vincent.brown.design@gmail.com";

const STEPS = [
  {
    detail: "Point a camera at the event, or attach the film and stream you already have.",
    name: "Capture",
    number: "01",
  },
  {
    detail: "Tap KEEP or FIX the second something happens. Every mark gets a timestamp.",
    name: "Mark",
    number: "02",
  },
  {
    detail: "Marked moments become reports, clips, and access links for players, parents, and teams.",
    name: "Package",
    number: "03",
  },
];

export default function HomePage() {
  return (
    <main className="axis-home">
      <header className="axis-home-topbar">
        <span>Trophy Labs</span>
        <Link href="/axis">Open Axis →</Link>
      </header>

      <section className="axis-home-hero">
        <p className="axis-home-kicker">Trophy Labs builds Axis</p>
        <h1>Axis</h1>
        <p className="axis-home-sub">
          Axis turns basketball events into film, proof, reports, access, and player memory.
        </p>
        <div className="axis-home-ctas">
          <a className="axis-home-cta axis-home-cta--primary" href={`mailto:${CONTACT}?subject=Book%20Training%20with%20Axis`}>
            Book Training
          </a>
          <a className="axis-home-cta" href={`mailto:${CONTACT}?subject=Send%20me%20an%20Axis%20replay`}>
            Watch Replay
          </a>
          <a className="axis-home-cta" href={`mailto:${CONTACT}?subject=Axis%20Team%20Pilot`}>
            Request Team Pilot
          </a>
        </div>
      </section>

      <section className="axis-home-steps" aria-label="How Axis works">
        {STEPS.map((step) => (
          <article key={step.name}>
            <span>{step.number}</span>
            <strong>{step.name}</strong>
            <p>{step.detail}</p>
          </article>
        ))}
      </section>

      <section className="axis-home-proof">
        <p>
          One event in. Film, marked moments, a report, and an access link out. The player&apos;s history compounds
          every time.
        </p>
      </section>

      <footer className="axis-home-footer">
        <span>© {new Date().getFullYear()} Trophy Labs</span>
        <span>Axis · Basketball performance intelligence</span>
      </footer>
    </main>
  );
}
