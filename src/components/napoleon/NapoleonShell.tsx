"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { recordNapoleonEvent, submitNapoleonQuery } from "../../lib/napoleon/client";
import type { NapoleonAgentResult, NapoleonMode } from "../../lib/napoleon/types";

type Props = {
  mode?: NapoleonMode;
};

type MoneyMode = "find" | "build" | "fix";

type FocusedResult = {
  eyebrow: string;
  title: string;
  rows: Array<{
    label: string;
    value: string;
  }>;
  action: string;
};

const modes: Array<{ id: MoneyMode; label: string }> = [
  { id: "find", label: "Find" },
  { id: "build", label: "Build" },
  { id: "fix", label: "Fix" },
];

export function NapoleonShell({ mode = "public" }: Props) {
  const [activeMode, setActiveMode] = useState<MoneyMode>("find");
  const [signal, setSignal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<NapoleonAgentResult | null>(null);
  const [lastAction, setLastAction] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    void recordNapoleonEvent("napoleon_surface_opened", { mode }, { persist: mode === "public" ? false : undefined });
    if (mode === "founder") {
      void recordNapoleonEvent("founder_mode_opened", { route: "/axis/napoleon" });
    }
  }, [mode]);

  const focusedResult = useMemo(() => {
    if (!result) return null;
    return createFocusedResult(activeMode, result);
  }, [activeMode, result]);

  function selectMode(nextMode: MoneyMode) {
    setActiveMode(nextMode);
    setLastAction("");
    void recordNapoleonEvent("mode_selected", { mode: nextMode }, { persist: mode === "public" ? false : undefined });
  }

  async function submitSignal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = signal.trim();
    if (!input || busy) return;

    setBusy(true);
    setError("");
    setLastAction("");

    const eventOptions = { persist: mode === "public" ? false : undefined };
    await recordNapoleonEvent("signal_submitted", { mode: activeMode, input }, eventOptions);

    try {
      const nextResult = await submitNapoleonQuery(createModePrompt(activeMode, input));
      setResult(nextResult);

      const generatedEvent =
        activeMode === "find"
          ? "find_result_generated"
          : activeMode === "build"
            ? "build_result_generated"
            : "fix_result_generated";

      await recordNapoleonEvent(generatedEvent, { resultId: nextResult.id, mode: activeMode }, eventOptions);
    } catch {
      setError("Napoleon could not read that signal yet. Bring in the rough version.");
    } finally {
      setBusy(false);
    }
  }

  async function selectNextAction(action: string) {
    setLastAction(`${action} is staged. Napoleon will wire the next step when execution unlocks.`);
    await recordNapoleonEvent(
      "next_action_selected",
      { action, mode: activeMode, resultId: result?.id },
      { persist: mode === "public" ? false : undefined },
    );
  }

  return (
    <main className="napoleon-minimal-shell" data-app-mode={mode}>
      <section className="napoleon-minimal-surface" aria-live="polite">
        <header className="napoleon-minimal-header">
          <div>
            <strong>NAPOLEON</strong>
            <span>{mode === "founder" ? "Founder Mode" : "Powered by Axis"}</span>
          </div>
          <button
            aria-expanded={menuOpen}
            aria-label="Open Napoleon menu"
            className="napoleon-menu-button"
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
          >
            Menu
          </button>
        </header>

        {menuOpen && (
          <nav className="napoleon-hidden-menu" aria-label="Hidden Napoleon surfaces">
            <button type="button">Loops</button>
            <button type="button">Proof</button>
            <button type="button">Wires</button>
            <button type="button">Genesis</button>
          </nav>
        )}

        <form className="napoleon-signal-form" onSubmit={submitSignal}>
          <label htmlFor="napoleon-signal">Signal</label>
          <textarea
            id="napoleon-signal"
            onChange={(event) => setSignal(event.target.value)}
            placeholder="Bring in a signal..."
            rows={3}
            value={signal}
          />
          <button type="submit" disabled={busy || !signal.trim()}>
            {busy ? "Reading..." : "Run"}
          </button>
        </form>

        <div className="napoleon-mode-strip" aria-label="Napoleon modes">
          {modes.map((item) => (
            <button
              key={item.id}
              data-active={activeMode === item.id}
              type="button"
              onClick={() => selectMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {focusedResult && (
          <article className="napoleon-focused-card">
            <span>{focusedResult.eyebrow}</span>
            <h1>{focusedResult.title}</h1>
            <dl>
              {focusedResult.rows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
            <button type="button" onClick={() => void selectNextAction(focusedResult.action)}>
              {focusedResult.action}
            </button>
          </article>
        )}

        {lastAction && <p className="napoleon-action-note">{lastAction}</p>}
        {error && <p className="napoleon-error">{error}</p>}
      </section>

      <style jsx global>{napoleonMinimalStyles}</style>
    </main>
  );
}

function createModePrompt(mode: MoneyMode, signal: string) {
  if (mode === "build") {
    return `Build this signal into a loop, offer, checkout path, fulfillment path, and proof rule: ${signal}`;
  }

  if (mode === "fix") {
    return `Find leaks, broken wires, missed follow-up, missing checkout, weak offer, or unclaimed cash in this signal: ${signal}`;
  }

  return `Find money hidden in this signal: ${signal}`;
}

function createFocusedResult(mode: MoneyMode, result: NapoleonAgentResult): FocusedResult {
  const loop = result.suggestedLoop;

  if (mode === "build") {
    return {
      eyebrow: "Build",
      title: loop.title,
      rows: [
        { label: "Offer", value: loop.offer },
        { label: "Price / Starting Price", value: "Start with the smallest paid proof path." },
        { label: "Checkout Wire", value: loop.fastestCashPath },
        { label: "Fulfillment Wire", value: loop.automationPath },
        { label: "Proof Metric", value: loop.proofStatus },
      ],
      action: "Create path",
    };
  }

  if (mode === "fix") {
    return {
      eyebrow: "Fix",
      title: "Leak detected",
      rows: [
        { label: "What it costs", value: "Unclaimed cash from missed follow-up or weak offer wiring." },
        { label: "Broken Wire", value: loop.leakRule },
        { label: "Repair Action", value: loop.nextAction },
      ],
      action: "Fix this",
    };
  }

  return {
    eyebrow: "Find",
    title: loop.title,
    rows: [
      { label: "Money node", value: loop.offer },
      { label: "Buyer / Customer", value: loop.targetCustomer },
      { label: "Fastest Cash Path", value: loop.fastestCashPath },
    ],
    action: "Build",
  };
}

const napoleonMinimalStyles = `
  html,
  body {
    background: #f8f7f1;
  }

  .napoleon-minimal-shell {
    background:
      radial-gradient(circle at top right, rgba(181, 132, 50, 0.12), transparent 30rem),
      linear-gradient(180deg, #fbfaf6 0%, #f4f1e9 100%);
    color: #111111;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    min-height: 100dvh;
    overflow-x: hidden;
  }

  .napoleon-minimal-surface {
    display: grid;
    gap: 1rem;
    margin: 0 auto;
    max-width: 38rem;
    min-height: 100dvh;
    padding: max(1rem, env(safe-area-inset-top)) 1rem calc(2rem + env(safe-area-inset-bottom));
  }

  .napoleon-minimal-header {
    align-items: center;
    display: flex;
    justify-content: space-between;
  }

  .napoleon-minimal-header div {
    display: grid;
    gap: 0.1rem;
  }

  .napoleon-minimal-header strong {
    font-size: 1rem;
    font-weight: 950;
    letter-spacing: -0.03em;
  }

  .napoleon-minimal-header span,
  .napoleon-signal-form label,
  .napoleon-focused-card span,
  .napoleon-focused-card dt {
    color: #8f826e;
    font-size: 0.68rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .napoleon-menu-button,
  .napoleon-hidden-menu button,
  .napoleon-mode-strip button,
  .napoleon-signal-form button,
  .napoleon-focused-card button {
    border-radius: 999px;
    font: inherit;
    font-size: 0.82rem;
    font-weight: 900;
    min-height: 2.8rem;
  }

  .napoleon-menu-button,
  .napoleon-hidden-menu button {
    background: rgba(255, 255, 255, 0.62);
    border: 1px solid rgba(17, 17, 17, 0.08);
    color: #28241d;
    padding: 0 0.85rem;
  }

  .napoleon-hidden-menu {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    justify-content: flex-end;
  }

  .napoleon-signal-form {
    align-self: center;
    display: grid;
    gap: 0.65rem;
    margin-top: clamp(4rem, 14vh, 8rem);
  }

  .napoleon-signal-form textarea {
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(17, 17, 17, 0.1);
    border-radius: 1.4rem;
    box-shadow: 0 1.5rem 4rem rgba(36, 28, 14, 0.08);
    color: #111111;
    font: inherit;
    font-size: clamp(1.2rem, 4vw, 1.65rem);
    line-height: 1.25;
    min-height: 9rem;
    outline: 0;
    padding: 1.15rem;
    resize: vertical;
    width: 100%;
  }

  .napoleon-signal-form textarea:focus {
    border-color: rgba(181, 132, 50, 0.5);
    box-shadow:
      0 0 0 4px rgba(181, 132, 50, 0.1),
      0 1.5rem 4rem rgba(36, 28, 14, 0.08);
  }

  .napoleon-signal-form button,
  .napoleon-focused-card button {
    background: #111111;
    border: 0;
    color: #ffffff;
    padding: 0 1.05rem;
  }

  .napoleon-signal-form button:disabled {
    cursor: not-allowed;
    opacity: 0.38;
  }

  .napoleon-mode-strip {
    display: grid;
    gap: 0.45rem;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .napoleon-mode-strip button {
    background: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(17, 17, 17, 0.08);
    color: #2a261f;
  }

  .napoleon-mode-strip button[data-active="true"] {
    background: #b58432;
    border-color: #b58432;
    color: #ffffff;
  }

  .napoleon-focused-card,
  .napoleon-action-note,
  .napoleon-error {
    background: rgba(255, 255, 255, 0.84);
    border: 1px solid rgba(17, 17, 17, 0.08);
    border-radius: 1.45rem;
    box-shadow: 0 1rem 2.8rem rgba(36, 28, 14, 0.07);
  }

  .napoleon-focused-card {
    display: grid;
    gap: 0.9rem;
    padding: 1rem;
  }

  .napoleon-focused-card h1 {
    font-size: clamp(1.55rem, 7vw, 3rem);
    letter-spacing: -0.06em;
    line-height: 0.95;
    margin: 0;
  }

  .napoleon-focused-card dl {
    display: grid;
    gap: 0.75rem;
    margin: 0;
  }

  .napoleon-focused-card div {
    display: grid;
    gap: 0.18rem;
  }

  .napoleon-focused-card dt,
  .napoleon-focused-card dd {
    margin: 0;
  }

  .napoleon-focused-card dd {
    color: #4f493e;
    line-height: 1.4;
  }

  .napoleon-action-note,
  .napoleon-error {
    color: #534d42;
    margin: 0;
    padding: 0.85rem;
  }

  .napoleon-error {
    background: #fff0e8;
    border-color: rgba(196, 69, 31, 0.2);
    color: #8a2f13;
  }

  @media (min-width: 760px) {
    .napoleon-minimal-surface {
      padding-inline: 1.5rem;
    }
  }
`;
