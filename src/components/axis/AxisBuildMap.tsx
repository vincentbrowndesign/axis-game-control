import { axisBuildAgents, axisBuildOrder, axisBuildScreens } from "../../lib/axis/build-map";
import { AxisAgentCard } from "./AxisAgentCard";
import { AxisMockReference } from "./AxisMockReference";
import { AxisProgressRail } from "./AxisProgressRail";

export function AxisBuildMap() {
  return (
    <main className="axis-build-map">
      <section className="axis-build-hero" aria-labelledby="axis-build-title">
        <div>
          <p>Internal Construction Map</p>
          <h1 id="axis-build-title">AXIS 9 BUILD MAP</h1>
          <strong>Axis turns training, film, practice, and decisions into proof - then sells the proof system.</strong>
        </div>
      </section>

      <section className="axis-map-section" aria-labelledby="axis-agents-title">
        <div className="axis-map-section__heading">
          <p>Section 1</p>
          <h2 id="axis-agents-title">The 9 Agent System</h2>
        </div>
        <div className="axis-agent-grid">
          {axisBuildAgents.map((agent) => (
            <AxisAgentCard agent={agent} key={agent.id} />
          ))}
        </div>
      </section>

      <section className="axis-memory-bar" aria-label="Unified memory layer">
        <span aria-hidden="true" />
        <strong>Unified Memory + Player Profile + Session History + Knowledge Base</strong>
        <p>All 9 agents eventually write to and read from this layer.</p>
      </section>

      <AxisMockReference screens={axisBuildScreens} />
      <AxisProgressRail items={axisBuildOrder} />

      <style>{`
        :root {
          color-scheme: dark;
        }

        html,
        body {
          margin: 0;
          min-height: 100%;
          overflow-x: hidden;
        }

        .axis-build-map,
        .axis-build-map * {
          box-sizing: border-box;
        }

        .axis-build-map {
          --axis-bg: #050608;
          --axis-panel: rgba(12, 16, 24, 0.78);
          --axis-line: rgba(255, 255, 255, 0.13);
          --axis-ink: #f6f2ff;
          --axis-muted: rgba(246, 242, 255, 0.66);
          --axis-purple: #8d42ff;
          --axis-cyan: #33d8ff;
          --axis-green: #70e35f;
          --axis-gold: #ffd35f;
          --axis-orange: #ff8f5f;
          --axis-blue: #65a8ff;
          background:
            radial-gradient(circle at 12% 0%, rgba(141, 66, 255, 0.22), transparent 25rem),
            radial-gradient(circle at 88% 12%, rgba(51, 216, 255, 0.14), transparent 24rem),
            linear-gradient(180deg, #080a10, var(--axis-bg));
          color: var(--axis-ink);
          font-family:
            Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          min-height: 100dvh;
          padding: clamp(1rem, 2vw, 1.5rem);
        }

        .axis-build-hero,
        .axis-map-section,
        .axis-memory-bar {
          border: 1px solid var(--axis-line);
          border-radius: 1.15rem;
          margin: 0 auto 0.75rem;
          max-width: 100rem;
        }

        .axis-build-hero {
          background:
            linear-gradient(135deg, rgba(141, 66, 255, 0.16), rgba(255, 255, 255, 0.03)),
            var(--axis-panel);
          padding: clamp(1.1rem, 3vw, 2rem);
        }

        .axis-build-hero p,
        .axis-map-section__heading p,
        .axis-agent-card dt {
          color: var(--axis-purple);
          font-size: 0.72rem;
          font-weight: 850;
          letter-spacing: 0.12em;
          margin: 0 0 0.4rem;
          text-transform: uppercase;
        }

        .axis-build-hero h1 {
          font-size: clamp(2.5rem, 7vw, 6rem);
          letter-spacing: -0.07em;
          line-height: 0.9;
          margin: 0;
        }

        .axis-build-hero strong {
          color: var(--axis-muted);
          display: block;
          font-size: clamp(1rem, 1.7vw, 1.35rem);
          font-weight: 520;
          line-height: 1.35;
          margin-top: 1rem;
          max-width: 58rem;
        }

        .axis-map-section {
          background: rgba(255, 255, 255, 0.035);
          padding: clamp(1rem, 2vw, 1.25rem);
        }

        .axis-map-section__heading {
          align-items: end;
          display: flex;
          gap: 1rem;
          justify-content: space-between;
          margin-bottom: 1rem;
        }

        .axis-map-section__heading h2 {
          color: var(--axis-purple);
          font-size: clamp(1.1rem, 2vw, 1.6rem);
          letter-spacing: 0.02em;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-agent-grid {
          display: grid;
          gap: 0.75rem;
          grid-template-columns: repeat(9, minmax(0, 1fr));
        }

        .axis-agent-card {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.018));
          border: 1px solid color-mix(in srgb, var(--agent-color) 42%, var(--axis-line));
          border-radius: 0.8rem;
          min-height: 16rem;
          padding: 0.9rem;
        }

        .axis-agent-card:has(.axis-agent-card__contract) {
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--agent-color) 28%, transparent),
            0 0 34px color-mix(in srgb, var(--agent-color) 14%, transparent);
        }

        .axis-agent-card--purple {
          --agent-color: var(--axis-purple);
        }

        .axis-agent-card--gold {
          --agent-color: var(--axis-gold);
        }

        .axis-agent-card--blue {
          --agent-color: var(--axis-blue);
        }

        .axis-agent-card--green {
          --agent-color: var(--axis-green);
        }

        .axis-agent-card--orange {
          --agent-color: var(--axis-orange);
        }

        .axis-agent-card--cyan {
          --agent-color: var(--axis-cyan);
        }

        .axis-agent-card__top {
          align-items: start;
          display: grid;
          gap: 0.65rem;
          grid-template-columns: auto minmax(0, 1fr);
        }

        .axis-agent-card__top span {
          align-items: center;
          border: 1px solid var(--agent-color);
          border-radius: 999px;
          color: var(--agent-color);
          display: inline-flex;
          font-weight: 850;
          height: 1.8rem;
          justify-content: center;
          width: 1.8rem;
        }

        .axis-agent-card h3 {
          color: color-mix(in srgb, var(--agent-color) 70%, var(--axis-ink));
          font-size: 0.86rem;
          line-height: 1.15;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-agent-card p,
        .axis-agent-card dd,
        .axis-memory-bar p,
        .axis-build-step li,
        .axis-agent-card__contract li {
          color: var(--axis-muted);
          font-size: 0.82rem;
          line-height: 1.38;
        }

        .axis-agent-card p {
          margin: 1rem 0;
        }

        .axis-agent-card dl,
        .axis-agent-card dd {
          margin: 0;
        }

        .axis-agent-card dl {
          display: grid;
          gap: 0.6rem;
        }

        .axis-agent-card dt {
          color: color-mix(in srgb, var(--agent-color) 76%, var(--axis-ink));
          margin-bottom: 0.2rem;
        }

        .axis-agent-card__contract {
          border-top: 1px solid color-mix(in srgb, var(--agent-color) 26%, transparent);
          margin-top: 0.8rem;
          padding-top: 0.8rem;
        }

        .axis-agent-card__contract h4 {
          color: color-mix(in srgb, var(--agent-color) 82%, var(--axis-ink));
          font-size: 0.72rem;
          letter-spacing: 0.1em;
          margin: 0 0 0.5rem;
          text-transform: uppercase;
        }

        .axis-agent-card__contract ul {
          display: grid;
          gap: 0.35rem;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .axis-agent-card__contract strong {
          color: var(--axis-ink);
          font-weight: 750;
        }

        .axis-memory-bar {
          align-items: center;
          background: rgba(255, 255, 255, 0.035);
          display: grid;
          gap: 0.35rem 0.8rem;
          grid-template-columns: auto minmax(0, 1fr);
          padding: 0.8rem 1rem;
        }

        .axis-memory-bar span {
          border: 1px solid var(--axis-muted);
          border-radius: 999px;
          height: 1.25rem;
          width: 1.25rem;
        }

        .axis-memory-bar strong {
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }

        .axis-memory-bar p {
          grid-column: 2;
          margin: 0;
        }

        .axis-screen-grid {
          display: grid;
          gap: 0.75rem;
          grid-template-columns: repeat(7, minmax(0, 1fr));
        }

        .axis-progress-rail {
          display: grid;
          gap: 0.65rem;
          grid-template-columns: repeat(17, minmax(0, 1fr));
        }

        .axis-build-step {
          background: rgba(0, 0, 0, 0.26);
          border: 1px solid var(--axis-line);
          border-radius: 0.8rem;
          display: grid;
          gap: 0.7rem;
          min-height: 8rem;
          padding: 0.8rem;
        }

        .axis-build-step > span {
          color: var(--axis-purple);
          font-size: 0.72rem;
          font-weight: 850;
          letter-spacing: 0.08em;
        }

        .axis-build-step h3 {
          font-size: 0.9rem;
          line-height: 1.2;
          margin: 0;
        }

        .axis-build-step ul {
          display: grid;
          gap: 0.25rem;
          list-style: none;
          margin: 0.55rem 0 0;
          padding: 0;
        }

        .axis-build-step li::before {
          color: var(--axis-purple);
          content: "- ";
        }

        @media (max-width: 1400px) {
          .axis-agent-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .axis-screen-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .axis-progress-rail {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .axis-build-map {
            padding: 0.75rem;
          }

          .axis-agent-grid,
          .axis-screen-grid,
          .axis-progress-rail {
            grid-template-columns: 1fr;
          }

          .axis-map-section__heading {
            align-items: start;
            display: grid;
          }

          .axis-memory-bar {
            grid-template-columns: 1fr;
          }

          .axis-memory-bar p {
            grid-column: auto;
          }
        }
      `}</style>
    </main>
  );
}
