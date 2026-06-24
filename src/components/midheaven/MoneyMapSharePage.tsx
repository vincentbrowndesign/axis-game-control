"use client";

import type { MoneyMap } from "../../lib/midheaven/types";
import { MoneyMapCard } from "./MoneyMapCard";

type Props = {
  moneyMap: MoneyMap;
};

export function MoneyMapSharePage({ moneyMap }: Props) {
  return (
    <main className="midheaven-shell">
      <section className="midheaven-surface">
        <header className="midheaven-brand">
          <strong>MIDHEAVEN</strong>
          <span>Money Map</span>
        </header>
        <MoneyMapCard moneyMap={moneyMap} />
      </section>
      <style jsx global>{midheavenShareStyles}</style>
    </main>
  );
}

const midheavenShareStyles = `
  html,
  body {
    background: #f8f7f1;
  }

  .midheaven-shell {
    background: linear-gradient(180deg, #fbfaf6 0%, #f4f1e9 100%);
    color: #111111;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    min-height: 100dvh;
  }

  .midheaven-surface {
    display: grid;
    gap: 1.2rem;
    margin: 0 auto;
    max-width: 32rem;
    padding: max(1.4rem, env(safe-area-inset-top)) 1rem 2rem;
  }

  .midheaven-brand {
    display: grid;
    gap: 0.1rem;
  }

  .midheaven-brand strong {
    font-size: 1rem;
    font-weight: 950;
    letter-spacing: -0.03em;
  }

  .midheaven-brand span,
  .midheaven-map header span,
  .midheaven-map__section h2 {
    color: #8f826e;
    font-size: 0.68rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .midheaven-map {
    border-top: 1px solid rgba(17, 17, 17, 0.1);
    display: grid;
    gap: 1rem;
    padding-top: 1rem;
  }

  .midheaven-map header {
    display: grid;
    gap: 0.35rem;
  }

  .midheaven-map h1 {
    font-size: clamp(2rem, 10vw, 3.4rem);
    letter-spacing: -0.07em;
    line-height: 0.95;
    margin: 0;
  }

  .midheaven-map__section {
    border-top: 1px solid rgba(17, 17, 17, 0.08);
    display: grid;
    gap: 0.5rem;
    padding-top: 0.85rem;
  }

  .midheaven-map__section h2,
  .midheaven-map__section p {
    margin: 0;
  }

  .midheaven-map__section ul {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .midheaven-map__section li {
    border: 1px solid rgba(17, 17, 17, 0.09);
    border-radius: 999px;
    padding: 0.42rem 0.62rem;
  }

  .midheaven-map__section p {
    color: #4f493e;
    line-height: 1.45;
  }
`;
