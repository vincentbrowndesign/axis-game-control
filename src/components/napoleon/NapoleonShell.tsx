"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  napoleonConnections,
  napoleonGenesisNode,
  napoleonNextMove,
  napoleonSeedLoops,
  napoleonSeedProof,
} from "../../lib/napoleon/seed";
import {
  createNapoleonArtifactPlaceholder,
  createNapoleonLoopFromResult,
  recordNapoleonEvent,
  submitNapoleonQuery,
} from "../../lib/napoleon/client";
import type {
  NapoleonAgentResult,
  NapoleonCashLoop,
  NapoleonConnection,
  NapoleonLoopArtifact,
  NapoleonMode,
  NapoleonProof,
} from "../../lib/napoleon/types";
import { NapoleonBottomNav, type NapoleonView } from "./NapoleonBottomNav";
import { NapoleonCashStreamSystems } from "./NapoleonCashStreamSystems";
import { NapoleonConnections } from "./NapoleonConnections";
import { NapoleonHome } from "./NapoleonHome";
import { NapoleonLoopCard } from "./NapoleonLoopCard";
import { NapoleonPlayerMemoryPassBuilder } from "./NapoleonPlayerMemoryPassBuilder";
import { NapoleonProofFeed } from "./NapoleonProofFeed";
import { NapoleonPublicEntry } from "./NapoleonPublicEntry";
import { NapoleonQueryToolbar } from "./NapoleonQueryToolbar";

type Props = {
  mode?: NapoleonMode;
};

export function NapoleonShell({ mode = "founder" }: Props) {
  const [activeView, setActiveView] = useState<NapoleonView>("home");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<NapoleonAgentResult | null>(null);
  const [loops, setLoops] = useState<NapoleonCashLoop[]>(napoleonSeedLoops);
  const [proof, setProof] = useState<NapoleonProof[]>(napoleonSeedProof);
  const [selectedLoopId, setSelectedLoopId] = useState<string | null>(null);

  const selectedLoop = loops.find((loop) => loop.id === selectedLoopId) ?? null;

  useEffect(() => {
    if (mode === "public") {
      void recordNapoleonEvent("public_entry_viewed", { route: "/" }, { persist: false });
      return;
    }

    void recordNapoleonEvent("founder_mode_opened", { route: "/axis/napoleon" });
    void recordNapoleonEvent("napoleon_opened", { route: "/axis/napoleon" });
  }, [mode]);

  async function runQuery(input: string) {
    const trimmed = input.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setError("");
    setQuery(trimmed);
    await recordNapoleonEvent("query_started", { input: trimmed });
    await recordNapoleonEvent("query_submitted", { input: trimmed });

    try {
      const nextResult = await submitNapoleonQuery(trimmed);
      setResult(nextResult);
      await recordNapoleonEvent("agent_result_generated", { resultId: nextResult.id });
      await recordNapoleonEvent("money_node_detected", { title: nextResult.suggestedLoop.title });
    } catch {
      setError("Napoleon could not answer that yet. Try the rough version.");
    } finally {
      setBusy(false);
    }
  }

  function submitQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runQuery(query);
  }

  function useHelper(value: string) {
    setQuery(value);
  }

  async function findMoney() {
    await recordNapoleonEvent("find_money_started", { source: "primary_action" });
    void runQuery("Find money in basketball training, parents, Bridge, private sessions, and recurring proof.");
  }

  async function buildLoop() {
    await recordNapoleonEvent("build_loop_started", {
      source: result ? "agent_result" : "primary_action",
    });

    if (!result) {
      void runQuery("Build this into an offer: basketball training, parents, Bridge, private sessions, and recurring proof.");
      return;
    }

    try {
      const loop = await createNapoleonLoopFromResult(result);
      setLoops((current) => [loop, ...current.filter((item) => item.id !== loop.id)]);
      setProof((current) => [
        {
          id: `proof-${loop.id}`,
          type: "Awaiting cash wire",
          text: `${loop.title} is drafted. It needs a real buyer signal before it becomes proof.`,
          createdAt: new Date().toISOString(),
          loopId: loop.id,
        },
        ...current,
      ]);
      await recordNapoleonEvent("cash_loop_created", { loopId: loop.id });
    } catch {
      setError("Napoleon could not create that loop yet.");
    }
  }

  async function viewGenesis() {
    await recordNapoleonEvent("axis_genesis_viewed", { nodeId: napoleonGenesisNode.id });
  }

  async function viewConnection(connection: NapoleonConnection) {
    await recordNapoleonEvent("connection_viewed", { connectionId: connection.id });
  }

  async function openLoop(loop: NapoleonCashLoop) {
    if (loop.id !== "loop-player-memory-pass") return;
    setSelectedLoopId(loop.id);
    await recordNapoleonEvent("build_loop_started", { loopId: loop.id, source: "loop_card" });
  }

  function updateSelectedLoop(updater: (loop: NapoleonCashLoop) => NapoleonCashLoop) {
    if (!selectedLoopId) return;
    setLoops((current) => current.map((loop) => (loop.id === selectedLoopId ? updater(loop) : loop)));
  }

  async function createLoopArtifact(artifact: NapoleonLoopArtifact, updates: Partial<NapoleonCashLoop> = {}) {
    const storedArtifact = await createNapoleonArtifactPlaceholder(artifact);

    updateSelectedLoop((loop) => ({
      ...loop,
      ...updates,
      artifacts: [storedArtifact, ...(loop.artifacts ?? [])],
    }));

    const eventTypeByArtifact: Partial<Record<NapoleonLoopArtifact["type"], Parameters<typeof recordNapoleonEvent>[0]>> = {
      landing_page_copy: "landing_page_draft_created",
      parent_offer: "offer_created",
      proof_template: "fulfillment_asset_drafted",
      recap_template: "recap_template_created",
      shopify_product_draft: "shopify_product_draft_created",
      stripe_link_placeholder: "payment_link_placeholder_created",
    };

    if (artifact.type === "stripe_link_placeholder" || artifact.type === "shopify_product_draft" || artifact.type === "landing_page_copy") {
      await recordNapoleonEvent("checkout_wire_started", { loopId: selectedLoopId });
    }

    if (artifact.type === "proof_template" || artifact.type === "recap_template") {
      await recordNapoleonEvent("fulfillment_wire_started", { loopId: selectedLoopId });
    }

    const eventType = eventTypeByArtifact[artifact.type];
    if (eventType) {
      await recordNapoleonEvent(eventType, { artifactId: storedArtifact.id, loopId: selectedLoopId });
    }
  }

  async function createLeakRule() {
    updateSelectedLoop((loop) => ({
      ...loop,
      leakRuleConfig: loop.leakRuleConfig,
    }));
    await recordNapoleonEvent("leak_rule_created", { loopId: selectedLoopId });
  }

  async function testLeakRule() {
    const artifact: NapoleonLoopArtifact = {
      id: `leak-test-${Date.now().toString(36)}`,
      type: "leak_test",
      title: "Leak rule placeholder test",
      body: "Placeholder only: session_completed had no recap_generated or payment_link_created inside the 15-minute window.",
      createdAt: new Date().toISOString(),
    };

    updateSelectedLoop((loop) => ({
      ...loop,
      artifacts: [artifact, ...(loop.artifacts ?? [])],
      leakRuleConfig: loop.leakRuleConfig
        ? { ...loop.leakRuleConfig, testStatus: "placeholder_detected" }
        : loop.leakRuleConfig,
    }));
    await recordNapoleonEvent("leak_detected", { loopId: selectedLoopId, placeholder: true });
  }

  return (
    <main className="napoleon-shell" data-mode={mode}>
      <header className="napoleon-header">
        <div>
          <strong>NAPOLEON</strong>
          <span>{mode === "founder" ? "Founder Mode" : "Powered by Axis"}</span>
        </div>
        <div className="napoleon-header__icons" aria-label="Napoleon controls">
          {mode === "public" ? (
            <button type="button" onClick={() => void recordNapoleonEvent("request_access_clicked", { label: "Header CTA" }, { persist: false })}>
              Request Access
            </button>
          ) : (
            <>
              <button type="button" aria-label="Notifications">!</button>
              <button type="button" aria-label="Settings">Settings</button>
            </>
          )}
        </div>
      </header>

      <section className="napoleon-body" aria-live="polite">
        {mode === "public" && <NapoleonPublicEntry />}

        {mode === "founder" && selectedLoop?.id === "loop-player-memory-pass" && (
          <>
            <NapoleonQueryToolbar
              busy={busy}
              onChange={setQuery}
              onHelper={useHelper}
              onSubmit={submitQuery}
              query={query}
              resultReady={Boolean(result)}
            />
            <NapoleonPlayerMemoryPassBuilder
              loop={selectedLoop}
              onAction={(artifact, updates) => void createLoopArtifact(artifact, updates)}
              onBack={() => setSelectedLoopId(null)}
              onCreateLeakRule={() => void createLeakRule()}
              onTestLeakRule={() => void testLeakRule()}
            />
          </>
        )}

        {mode === "founder" && !selectedLoop && activeView === "home" && (
          <NapoleonHome
            busy={busy}
            genesisNode={napoleonGenesisNode}
            loops={loops}
            nextMove={napoleonNextMove}
            onBuildLoop={buildLoop}
            onFindMoney={findMoney}
            onGenesisView={viewGenesis}
            onOpenLoop={openLoop}
            onQueryChange={setQuery}
            onQueryHelper={useHelper}
            onQuerySubmit={submitQuery}
            proof={proof}
            query={query}
            result={result}
          />
        )}

        {mode === "founder" && !selectedLoop && activeView === "loops" && (
          <section className="napoleon-view">
            <div className="napoleon-section-heading">
              <span>Loops</span>
              <h1>Find Money {"->"} Build Loop.</h1>
            </div>
            <NapoleonQueryToolbar
              busy={busy}
              onChange={setQuery}
              onHelper={useHelper}
              onSubmit={submitQuery}
              query={query}
              resultReady={Boolean(result)}
            />
            <NapoleonCashStreamSystems />
            <div className="napoleon-loop-list">
              {loops.map((loop) => (
                <NapoleonLoopCard key={loop.id} loop={loop} onOpen={openLoop} />
              ))}
            </div>
          </section>
        )}

        {mode === "founder" && !selectedLoop && activeView === "proof" && (
          <section className="napoleon-view">
            <NapoleonQueryToolbar
              busy={busy}
              onChange={setQuery}
              onHelper={useHelper}
              onSubmit={submitQuery}
              query={query}
              resultReady={Boolean(result)}
            />
            <NapoleonProofFeed proof={proof} />
          </section>
        )}

        {mode === "founder" && !selectedLoop && activeView === "empire" && (
          <section className="napoleon-view">
            <NapoleonQueryToolbar
              busy={busy}
              onChange={setQuery}
              onHelper={useHelper}
              onSubmit={submitQuery}
              query={query}
              resultReady={Boolean(result)}
            />
            <NapoleonConnections connections={napoleonConnections} onView={viewConnection} />
          </section>
        )}

        {mode === "founder" && !selectedLoop && activeView === "profile" && (
          <section className="napoleon-view">
            <div className="napoleon-section-heading">
              <span>Profile</span>
              <h1>Axis powers Napoleon.</h1>
            </div>
            <p className="napoleon-profile-copy">
              Napoleon stays query-first. Connections, loops, and proof are artifacts created by the money question.
            </p>
          </section>
        )}

        {error && <p className="napoleon-error">{error}</p>}
      </section>

      {mode === "founder" && <NapoleonBottomNav active={activeView} onChange={setActiveView} />}

      <style jsx global>{napoleonStyles}</style>
    </main>
  );
}

const napoleonStyles = `
  html,
  body {
    background: #f8f7f2;
  }

  .napoleon-shell {
    background:
      radial-gradient(circle at top right, rgba(188, 142, 67, 0.16), transparent 32rem),
      linear-gradient(180deg, #fbfaf6 0%, #f3f1e9 100%);
    color: #111111;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    min-height: 100dvh;
    overflow-x: hidden;
  }

  .napoleon-shell[data-mode="public"] .napoleon-body {
    padding-bottom: calc(2rem + env(safe-area-inset-bottom));
  }

  .napoleon-header {
    align-items: center;
    display: flex;
    justify-content: space-between;
    margin: 0 auto;
    max-width: 34rem;
    padding: max(1rem, env(safe-area-inset-top)) 1rem 0.65rem;
  }

  .napoleon-header div:first-child {
    display: grid;
    gap: 0.1rem;
  }

  .napoleon-header strong {
    font-size: 1rem;
    font-weight: 950;
    letter-spacing: -0.02em;
  }

  .napoleon-header span,
  .napoleon-section-heading span,
  .napoleon-hero p,
  .napoleon-genesis span {
    color: #8b7b62;
    font-size: 0.72rem;
    font-weight: 850;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .napoleon-header__icons {
    align-items: center;
    display: flex;
    gap: 0.4rem;
  }

  .napoleon-header__icons button,
  .napoleon-query__inputs button,
  .napoleon-helper-chips button,
  .napoleon-genesis button,
  .napoleon-bottom-nav button {
    background: rgba(255, 255, 255, 0.76);
    border: 1px solid rgba(17, 17, 17, 0.08);
    border-radius: 999px;
    color: #191919;
    font: inherit;
    font-size: 0.72rem;
    font-weight: 850;
    min-height: 2.45rem;
    padding: 0 0.78rem;
  }

  .napoleon-body {
    display: grid;
    gap: 1rem;
    margin: 0 auto;
    max-width: 34rem;
    padding: 0.4rem 1rem calc(6.4rem + env(safe-area-inset-bottom));
  }

  .napoleon-hero {
    display: grid;
    gap: 0.7rem;
    padding: 1.45rem 0 0.25rem;
  }

  .napoleon-public-hero {
    display: grid;
    gap: 0.75rem;
    padding: 1.8rem 0 0.35rem;
  }

  .napoleon-public-hero p {
    color: #8b7b62;
    font-size: 0.72rem;
    font-weight: 850;
    letter-spacing: 0.12em;
    margin: 0;
    text-transform: uppercase;
  }

  .napoleon-public-hero h1 {
    font-size: clamp(2.75rem, 14vw, 5.8rem);
    letter-spacing: -0.08em;
    line-height: 0.86;
    margin: 0;
  }

  .napoleon-public-hero span {
    color: #5f5a50;
    font-size: 1.04rem;
    line-height: 1.45;
  }

  .napoleon-hero h1,
  .napoleon-section-heading h1,
  .napoleon-section-heading h2 {
    font-size: clamp(2.55rem, 13vw, 5.4rem);
    letter-spacing: -0.075em;
    line-height: 0.88;
    margin: 0;
  }

  .napoleon-hero span,
  .napoleon-profile-copy,
  .napoleon-next-move p {
    color: #5f5a50;
    font-size: 1rem;
    line-height: 1.45;
  }

  .napoleon-query,
  .napoleon-agent-result,
  .napoleon-action-card,
  .napoleon-builder-card,
  .napoleon-genesis,
  .napoleon-loop-card,
  .napoleon-next-move,
  .napoleon-proof-feed,
  .napoleon-proof-item,
  .napoleon-cash-plan,
  .napoleon-cash-systems,
  .napoleon-cash-system-card,
  .napoleon-public-ctas,
  .napoleon-public-layers,
  .napoleon-public-layer-grid article,
  .napoleon-connection-card,
  .napoleon-view {
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(17, 17, 17, 0.08);
    border-radius: 1.55rem;
    box-shadow: 0 1rem 2.7rem rgba(25, 20, 10, 0.07);
  }

  .napoleon-query {
    display: grid;
    gap: 0.8rem;
    padding: 0.85rem;
  }

  .napoleon-query form {
    display: grid;
    gap: 0.65rem;
  }

  .napoleon-query label {
    color: #7a6d56;
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .napoleon-query textarea {
    background: #f7f5ef;
    border: 1px solid rgba(17, 17, 17, 0.09);
    border-radius: 1.1rem;
    color: #111111;
    font: inherit;
    font-size: 1.05rem;
    line-height: 1.35;
    min-height: 8rem;
    padding: 0.95rem;
    resize: vertical;
    width: 100%;
  }

  .napoleon-query textarea:focus {
    border-color: rgba(181, 132, 50, 0.62);
    box-shadow: 0 0 0 3px rgba(181, 132, 50, 0.12);
    outline: 0;
  }

  .napoleon-query__actions {
    display: grid;
    gap: 0.65rem;
  }

  .napoleon-query__inputs,
  .napoleon-helper-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .napoleon-primary {
    background: #b58432;
    border: 1px solid #b58432;
    border-radius: 999px;
    color: #ffffff;
    font: inherit;
    font-size: 0.82rem;
    font-weight: 950;
    min-height: 3.2rem;
    padding: 0 1rem;
    text-transform: uppercase;
  }

  .napoleon-primary:disabled {
    opacity: 0.55;
  }

  .napoleon-action-grid,
  .napoleon-agent-grid,
  .napoleon-loop-list,
  .napoleon-proof-list,
  .napoleon-cash-system-list,
  .napoleon-public-layer-grid,
  .napoleon-connection-list {
    display: grid;
    gap: 0.75rem;
  }

  .napoleon-action-card,
  .napoleon-agent-card,
  .napoleon-builder,
  .napoleon-builder-card,
  .napoleon-genesis,
  .napoleon-loop-card,
  .napoleon-next-move,
  .napoleon-proof-feed,
  .napoleon-proof-item,
  .napoleon-cash-plan,
  .napoleon-cash-systems,
  .napoleon-cash-system-card,
  .napoleon-public-ctas,
  .napoleon-public-layers,
  .napoleon-public-layer-grid article,
  .napoleon-view {
    display: grid;
    gap: 0.65rem;
    padding: 0.95rem;
  }

  .napoleon-action-card {
    text-align: left;
  }

  .napoleon-action-card span,
  .napoleon-agent-card small,
  .napoleon-builder-card dt,
  .napoleon-builder-heading span,
  .napoleon-proof-item small,
  .napoleon-cash-plan small,
  .napoleon-cash-plan dt,
  .napoleon-loop-card dt,
  .napoleon-connection-card dt,
  .napoleon-next-move span {
    color: #9a7a43;
    font-size: 0.68rem;
    font-weight: 900;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .napoleon-action-card strong,
  .napoleon-agent-card strong,
  .napoleon-builder-card strong,
  .napoleon-loop-card strong,
  .napoleon-proof-item strong,
  .napoleon-cash-system-card strong,
  .napoleon-public-layer-grid strong,
  .napoleon-next-move strong {
    font-size: 1.05rem;
    line-height: 1.18;
  }

  .napoleon-agent-result {
    display: grid;
    gap: 0.9rem;
    padding: 0.95rem;
  }

  .napoleon-agent-card {
    background: #f6f3ec;
    border: 1px solid rgba(17, 17, 17, 0.07);
    border-radius: 1.15rem;
  }

  .napoleon-agent-card ul {
    color: #4f4a40;
    display: grid;
    gap: 0.45rem;
    margin: 0;
    padding-left: 1rem;
  }

  .napoleon-genesis {
    border-color: rgba(181, 132, 50, 0.24);
  }

  .napoleon-genesis h2 {
    font-size: 1.35rem;
    letter-spacing: -0.04em;
    margin: 0.2rem 0 0;
  }

  .napoleon-genesis p,
  .napoleon-builder-card dd,
  .napoleon-builder-card li,
  .napoleon-builder-card p,
  .napoleon-proof-item strong,
  .napoleon-cash-plan dd,
  .napoleon-cash-system-card span,
  .napoleon-cash-system-card p,
  .napoleon-public-layer-grid p,
  .napoleon-loop-card dd,
  .napoleon-connection-card p,
  .napoleon-connection-card dd {
    color: #534d42;
    line-height: 1.4;
    margin: 0;
  }

  .napoleon-public-ctas {
    grid-template-columns: 1fr;
  }

  .napoleon-public-ctas button {
    background: #111111;
    border: 0;
    border-radius: 999px;
    color: #ffffff;
    font: inherit;
    font-size: 0.78rem;
    font-weight: 950;
    min-height: 3.1rem;
    padding: 0 1rem;
  }

  .napoleon-public-message {
    background: #f6f1e5;
    border: 1px solid rgba(181, 132, 50, 0.2);
    border-radius: 1rem;
    color: #5f4c2c;
    margin: 0;
    padding: 0.8rem;
  }

  .napoleon-genesis__proof {
    background: #f6f1e5;
    border-radius: 1rem;
    padding: 0.75rem;
  }

  .napoleon-section-heading {
    display: grid;
    gap: 0.4rem;
  }

  .napoleon-section-heading h2 {
    font-size: clamp(1.55rem, 7vw, 2.7rem);
    line-height: 0.98;
  }

  .napoleon-loop-section {
    display: grid;
    gap: 0.75rem;
  }

  .napoleon-loop-card__top {
    align-items: start;
    display: flex;
    gap: 0.75rem;
    justify-content: space-between;
  }

  .napoleon-loop-card__top span {
    background: #f4ead7;
    border-radius: 999px;
    color: #7f5b1b;
    font-size: 0.68rem;
    font-weight: 900;
    padding: 0.35rem 0.55rem;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .napoleon-loop-card dl,
  .napoleon-cash-plan dl,
  .napoleon-builder-card dl,
  .napoleon-connection-card dl {
    display: grid;
    gap: 0.5rem;
    margin: 0;
  }

  .napoleon-loop-card div,
  .napoleon-cash-plan div,
  .napoleon-builder-card dl div,
  .napoleon-connection-card dl div {
    display: grid;
    gap: 0.16rem;
  }

  .napoleon-loop-card dd,
  .napoleon-loop-card dt,
  .napoleon-cash-plan dd,
  .napoleon-cash-plan dt,
  .napoleon-builder-card dd,
  .napoleon-builder-card dt,
  .napoleon-connection-card dd,
  .napoleon-connection-card dt {
    margin: 0;
  }

  .napoleon-builder {
    display: grid;
    gap: 0.85rem;
  }

  .napoleon-builder__back {
    background: transparent;
    border: 1px solid rgba(17, 17, 17, 0.12);
    border-radius: 999px;
    color: #191919;
    font: inherit;
    font-size: 0.78rem;
    font-weight: 900;
    justify-self: start;
    min-height: 2.7rem;
    padding: 0 0.9rem;
  }

  .napoleon-builder-card {
    display: grid;
    gap: 0.75rem;
    padding: 0.95rem;
  }

  .napoleon-builder-header h1 {
    font-size: clamp(2rem, 10vw, 4rem);
    letter-spacing: -0.07em;
    line-height: 0.9;
    margin: 0;
  }

  .napoleon-builder-heading {
    display: grid;
    gap: 0.3rem;
  }

  .napoleon-builder-heading h2 {
    font-size: clamp(1.35rem, 6vw, 2.2rem);
    letter-spacing: -0.055em;
    line-height: 0.98;
    margin: 0;
  }

  .napoleon-price-pill {
    background: #f4ead7;
    border-radius: 999px;
    color: #7f5b1b;
    display: inline-flex;
    font-size: 0.76rem;
    font-weight: 900;
    margin: 0.18rem 0.25rem 0.18rem 0;
    padding: 0.38rem 0.55rem;
  }

  .napoleon-wire-grid,
  .napoleon-copy-list,
  .napoleon-builder-actions {
    display: grid;
    gap: 0.55rem;
  }

  .napoleon-wire-card,
  .napoleon-copy-list article {
    background: #f6f3ec;
    border: 1px solid rgba(17, 17, 17, 0.07);
    border-radius: 1.05rem;
    display: grid;
    gap: 0.3rem;
    padding: 0.75rem;
  }

  .napoleon-wire-card span,
  .napoleon-copy-list small {
    color: #9a7a43;
    font-size: 0.68rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .napoleon-builder-card ul {
    display: grid;
    gap: 0.35rem;
    margin: 0;
    padding-left: 1.1rem;
  }

  .napoleon-builder-actions button {
    background: #111111;
    border: 0;
    border-radius: 999px;
    color: #ffffff;
    font: inherit;
    font-size: 0.78rem;
    font-weight: 900;
    min-height: 3rem;
    padding: 0 0.9rem;
  }

  .napoleon-connections {
    display: grid;
    gap: 0.85rem;
  }

  .napoleon-connection-card {
    background: rgba(255, 255, 255, 0.82);
    color: #111111;
    display: grid;
    gap: 0.55rem;
    padding: 0.9rem;
    text-align: left;
    width: 100%;
  }

  .napoleon-connection-card div:first-child {
    align-items: center;
    display: flex;
    gap: 0.6rem;
    justify-content: space-between;
  }

  .napoleon-connection-card div:first-child span {
    color: #8b7b62;
    font-size: 0.72rem;
    font-weight: 850;
    text-transform: uppercase;
  }

  .napoleon-error {
    background: #fff0e8;
    border: 1px solid rgba(196, 69, 31, 0.2);
    border-radius: 1rem;
    color: #8a2f13;
    margin: 0;
    padding: 0.8rem;
  }

  .napoleon-bottom-nav {
    background: rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(22px);
    border: 1px solid rgba(17, 17, 17, 0.08);
    border-radius: 1.3rem 1.3rem 0 0;
    bottom: 0;
    display: grid;
    gap: 0.25rem;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    left: 50%;
    max-width: 34rem;
    padding: 0.45rem 0.45rem max(0.6rem, env(safe-area-inset-bottom));
    position: fixed;
    transform: translateX(-50%);
    width: 100%;
    z-index: 20;
  }

  .napoleon-bottom-nav button {
    background: transparent;
    box-shadow: none;
    min-height: 3rem;
    padding: 0;
  }

  .napoleon-bottom-nav button[data-active="true"] {
    background: #111111;
    color: #ffffff;
  }

  @media (min-width: 760px) {
    .napoleon-action-grid,
    .napoleon-agent-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .napoleon-agent-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
`;
