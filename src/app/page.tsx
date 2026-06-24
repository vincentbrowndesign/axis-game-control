import Link from "next/link";

export default function AxisMeasureHome() {
  return (
    <main className="axis-measure-home" aria-labelledby="axis-measure-title">
      <section className="axis-measure-home__hero">
        <p>axismeasure.com</p>
        <h1 id="axis-measure-title">Axis Measure</h1>
        <strong>Player detection. Rim lock. Ball detection.</strong>
        <div className="axis-measure-home__actions">
          <Link href="/vision">Open Vision</Link>
          <Link href="/calibrate">Calibrate Rim</Link>
        </div>
      </section>

      <section className="axis-measure-home__strip" aria-label="Measurement scope">
        <span>Player</span>
        <span>Rim</span>
        <span>Ball</span>
      </section>

      <style>{`
        .axis-measure-home,
        .axis-measure-home * {
          box-sizing: border-box;
        }

        .axis-measure-home {
          align-items: stretch;
          background: #050706;
          color: #f7f4eb;
          display: grid;
          font-family: var(--font-geist-sans, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
          min-height: 100dvh;
          padding: max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom));
        }

        .axis-measure-home__hero {
          align-content: center;
          display: grid;
          gap: 1rem;
          justify-items: start;
          min-height: 78dvh;
        }

        .axis-measure-home__hero p {
          color: rgba(247, 244, 235, 0.58);
          font-size: 0.78rem;
          font-weight: 850;
          letter-spacing: 0;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-measure-home h1 {
          font-size: clamp(3.4rem, 18vw, 8.5rem);
          letter-spacing: -0.08em;
          line-height: 0.86;
          margin: 0;
          max-width: 7ch;
        }

        .axis-measure-home__hero strong {
          color: rgba(247, 244, 235, 0.76);
          font-size: clamp(1.1rem, 4vw, 1.8rem);
          line-height: 1.2;
          max-width: 18rem;
        }

        .axis-measure-home__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.7rem;
        }

        .axis-measure-home__actions a {
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

        .axis-measure-home__actions a:last-child {
          background: rgba(247, 244, 235, 0.08);
          color: #f7f4eb;
        }

        .axis-measure-home__strip {
          align-self: end;
          border: 1px solid rgba(247, 244, 235, 0.12);
          border-radius: 1.2rem;
          display: grid;
          gap: 0.45rem;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          padding: 0.6rem;
        }

        .axis-measure-home__strip span {
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
          .axis-measure-home {
            padding: 2rem;
          }

          .axis-measure-home__hero {
            min-height: 72dvh;
          }
        }
      `}</style>
    </main>
  );
}
