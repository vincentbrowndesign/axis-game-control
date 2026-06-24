"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  addMidheavenSource,
  generateMoneyMap,
  recordMidheavenEvent,
  refineMoneyMap,
  shareMoneyMap,
} from "../../lib/midheaven/client";
import { midheavenExamples } from "../../lib/midheaven/seed";
import type { MoneyMap, MoneyMapRefinement, MoneyMapShare } from "../../lib/midheaven/types";
import { MoneyMapCard } from "./MoneyMapCard";
import { RefinementControls } from "./RefinementControls";
import { ShareMoneyMap } from "./ShareMoneyMap";
import { SourceInput } from "./SourceInput";

type Props = {
  mode?: "public" | "founder";
};

export function MidheavenShell({ mode = "public" }: Props) {
  const [source, setSource] = useState("");
  const [moneyMap, setMoneyMap] = useState<MoneyMap | null>(null);
  const [share, setShare] = useState<MoneyMapShare | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    recordMidheavenEvent("midheaven_opened", { mode });
  }, [mode]);

  async function submitSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = source.trim();
    if (!raw || busy) return;

    setBusy(true);
    setMessage("");
    setShare(null);

    try {
      const nextSource = await addMidheavenSource(raw);
      recordMidheavenEvent("source_added", { sourceId: nextSource.id, raw });
      const nextMoneyMap = await generateMoneyMap(nextSource);
      setMoneyMap(nextMoneyMap);
      recordMidheavenEvent("money_map_generated", { moneyMapId: nextMoneyMap.id });
    } catch {
      setMessage("Midheaven could not form that Money Map yet. Try a simpler source.");
    } finally {
      setBusy(false);
    }
  }

  function refine(refinement: MoneyMapRefinement) {
    if (!moneyMap) return;
    refineMoneyMap(moneyMap, refinement);
    setMessage(refinement === "build_this" ? "First loop selected." : "Money Map refined locally.");
  }

  async function shareCurrentMap() {
    if (!moneyMap || shareBusy) return;

    setShareBusy(true);
    setMessage("");

    try {
      const nextShare = await shareMoneyMap(moneyMap);
      setShare(nextShare);
      recordMidheavenEvent("money_map_shared", { moneyMapId: moneyMap.id, shareId: nextShare.id });
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(nextShare.url).catch(() => undefined);
      }
    } catch {
      setMessage("Midheaven could not create a share preview yet.");
    } finally {
      setShareBusy(false);
    }
  }

  return (
    <main className="midheaven-shell" data-mode={mode}>
      <section className="midheaven-surface" aria-live="polite">
        <header className="midheaven-brand">
          <strong>MIDHEAVEN</strong>
          <span>Powered by Axis</span>
        </header>

        <SourceInput busy={busy} onChange={setSource} onSubmit={submitSource} source={source} />

        {!moneyMap && (
          <p className="midheaven-examples" aria-label="Source examples">
            {midheavenExamples.map((example, index) => (
              <span key={example}>
                {index > 0 && <span aria-hidden="true"> / </span>}
                {example}
              </span>
            ))}
          </p>
        )}

        {moneyMap && (
          <>
            <MoneyMapCard moneyMap={moneyMap} />
            <RefinementControls onRefine={refine} />
            <ShareMoneyMap busy={shareBusy} onShare={shareCurrentMap} share={share} />
          </>
        )}

        {message && <p className="midheaven-message">{message}</p>}
      </section>
      <style jsx global>{midheavenStyles}</style>
    </main>
  );
}

const midheavenStyles = `
  html,
  body {
    background: #f8f7f1;
  }

  .midheaven-shell {
    background:
      radial-gradient(circle at top right, rgba(181, 132, 50, 0.08), transparent 28rem),
      linear-gradient(180deg, #fbfaf6 0%, #f4f1e9 100%);
    color: #111111;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    min-height: 100dvh;
    overflow-x: hidden;
  }

  .midheaven-surface {
    display: grid;
    gap: 0.85rem;
    margin: 0 auto;
    max-width: 32rem;
    min-height: 100dvh;
    padding: max(1.35rem, env(safe-area-inset-top)) 1rem calc(2rem + env(safe-area-inset-bottom));
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
  .midheaven-source label,
  .midheaven-map header span,
  .midheaven-map__section h2 {
    color: #8f826e;
    font-size: 0.68rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .midheaven-source {
    align-self: center;
    display: grid;
    gap: 0.65rem;
    margin-top: clamp(5rem, 17vh, 9rem);
  }

  .midheaven-source textarea {
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid rgba(17, 17, 17, 0.1);
    border-radius: 1.25rem;
    color: #111111;
    font: inherit;
    font-size: clamp(1.2rem, 4vw, 1.65rem);
    line-height: 1.25;
    min-height: 8.4rem;
    outline: 0;
    padding: 1.15rem;
    resize: vertical;
    width: 100%;
  }

  .midheaven-source textarea:focus {
    background: rgba(255, 255, 255, 0.92);
    border-color: rgba(181, 132, 50, 0.42);
    box-shadow: 0 0 0 3px rgba(181, 132, 50, 0.08);
  }

  .midheaven-source button,
  .midheaven-refinements button,
  .midheaven-share button {
    border-radius: 999px;
    font: inherit;
    font-size: 0.82rem;
    font-weight: 900;
    min-height: 2.85rem;
  }

  .midheaven-source button,
  .midheaven-share button {
    background: #111111;
    border: 0;
    color: #ffffff;
    padding: 0 1rem;
  }

  .midheaven-source button:disabled,
  .midheaven-share button:disabled {
    cursor: not-allowed;
    opacity: 0.38;
  }

  .midheaven-examples {
    color: #918879;
    font-size: 0.8rem;
    line-height: 1.4;
    margin: 0;
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

  .midheaven-map__section li,
  .midheaven-refinements button {
    border: 1px solid rgba(17, 17, 17, 0.09);
    border-radius: 999px;
    padding: 0.42rem 0.62rem;
  }

  .midheaven-map__section p {
    color: #4f493e;
    line-height: 1.45;
  }

  .midheaven-refinements {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .midheaven-refinements button {
    background: rgba(255, 255, 255, 0.7);
    color: #2a261f;
    padding-inline: 0.85rem;
  }

  .midheaven-refinements button:last-child {
    border-color: rgba(181, 132, 50, 0.42);
    color: #5f4211;
  }

  .midheaven-share {
    display: grid;
    gap: 0.5rem;
  }

  .midheaven-share p,
  .midheaven-message {
    color: #5f584c;
    line-height: 1.4;
    margin: 0;
  }

  .midheaven-share span {
    color: #111111;
    font-weight: 800;
  }

  .midheaven-message {
    border-top: 1px solid rgba(17, 17, 17, 0.08);
    padding-top: 0.75rem;
  }

  @media (min-width: 760px) {
    .midheaven-surface {
      padding-inline: 1.5rem;
    }
  }
`;
