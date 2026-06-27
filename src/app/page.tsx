import Link from "next/link";
import { headers } from "next/headers";

import { ClipRoomMain } from "../components/clip-room/ClipRoomMain";
import { getAxisSurface } from "../lib/axis/surface";

const surfaceCopy = {
  measure: {
    actions: [
      { href: "/vision", label: "Open Object Lock" },
      { href: "/calibrate", label: "Calibrate Rim" },
    ],
    domain: "axismeasure.com",
    strip: ["Player", "Rim", "Ball"],
    subtitle: "Player detection. Rim lock. Ball detection.",
    title: "Axis Measure",
  },
};

export default async function Home() {
  const requestHeaders = await headers();
  const surface = getAxisSurface(requestHeaders.get("x-forwarded-host") || requestHeaders.get("host"));
  if (surface === "axis") {
    return <ClipRoomMain />;
  }

  const copy = surfaceCopy[surface];

  return (
    <main className="axis-surface-home" aria-labelledby="axis-surface-title">
      <section className="axis-surface-home__hero">
        <p>{copy.domain}</p>
        <h1 id="axis-surface-title">{copy.title}</h1>
        <strong>{copy.subtitle}</strong>
        <div className="axis-surface-home__actions">
          {copy.actions.map((action) => (
            <Link href={action.href} key={action.href}>
              {action.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="axis-surface-home__strip" aria-label={surface === "measure" ? "Measurement scope" : "Axis product loop"}>
        {copy.strip.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </section>

      <style>{`
        .axis-surface-home,
        .axis-surface-home * {
          box-sizing: border-box;
        }

        .axis-surface-home {
          align-items: stretch;
          background: #050706;
          color: #f7f4eb;
          display: grid;
          font-family: var(--font-geist-sans, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
          min-height: 100dvh;
          padding: max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom));
        }

        .axis-surface-home__hero {
          align-content: center;
          display: grid;
          gap: 1rem;
          justify-items: start;
          min-height: 78dvh;
        }

        .axis-surface-home__hero p {
          color: rgba(247, 244, 235, 0.58);
          font-size: 0.78rem;
          font-weight: 850;
          letter-spacing: 0;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-surface-home h1 {
          font-size: clamp(3.4rem, 18vw, 8.5rem);
          letter-spacing: -0.08em;
          line-height: 0.86;
          margin: 0;
          max-width: 7ch;
        }

        .axis-surface-home__hero strong {
          color: rgba(247, 244, 235, 0.76);
          font-size: clamp(1.1rem, 4vw, 1.8rem);
          line-height: 1.2;
          max-width: 18rem;
        }

        .axis-surface-home__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.7rem;
        }

        .axis-surface-home__actions a {
          align-items: center;
          background: #f7f4eb;
          border: 1px solid rgba(247, 244, 235, 0.18);
          border-radius: 999px;
          color: #050706;
          display: inline-flex;
          font-size: 0.85rem;
          font-weight: 850;
          min-height: 2.8rem;
          padding: 0 1rem;
          text-decoration: none;
        }

        .axis-surface-home__actions a:not(:first-child) {
          background: rgba(247, 244, 235, 0.08);
          color: #f7f4eb;
        }

        .axis-surface-home__strip {
          align-self: end;
          border: 1px solid rgba(247, 244, 235, 0.12);
          border-radius: 1.2rem;
          display: grid;
          gap: 0.45rem;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          padding: 0.6rem;
        }

        .axis-surface-home__strip span {
          background: rgba(247, 244, 235, 0.08);
          border-radius: 999px;
          color: rgba(247, 244, 235, 0.82);
          font-size: 0.78rem;
          font-weight: 850;
          min-width: 0;
          padding: 0.62rem 0.5rem;
          text-align: center;
        }

        @media (min-width: 760px) {
          .axis-surface-home {
            padding: 2rem;
          }

          .axis-surface-home__hero {
            min-height: 72dvh;
          }
        }
      `}</style>
    </main>
  );
}
