"use client";

import { useState, type FormEvent } from "react";
import { napoleonGenesisNode, napoleonSeedProof } from "../../lib/napoleon/seed";
import { recordNapoleonEvent, submitNapoleonQuery } from "../../lib/napoleon/client";
import type { NapoleonAgentResult } from "../../lib/napoleon/types";
import { NapoleonActionCards } from "./NapoleonActionCards";
import { NapoleonAgentResult as NapoleonAgentResultView } from "./NapoleonAgentResult";
import { NapoleonCashStreamSystems } from "./NapoleonCashStreamSystems";
import { NapoleonGenesisNode } from "./NapoleonGenesisNode";
import { NapoleonQueryToolbar } from "./NapoleonQueryToolbar";

export function NapoleonPublicEntry() {
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<NapoleonAgentResult | null>(null);
  const [message, setMessage] = useState("");

  async function submitPublicQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setMessage("");
    await recordNapoleonEvent("public_query_preview_submitted", { input: trimmed }, { persist: false });

    try {
      const preview = await submitNapoleonQuery(trimmed);
      setResult(preview);
    } catch {
      setMessage("Napoleon could not preview that yet. Try the rough version.");
    } finally {
      setBusy(false);
    }
  }

  async function requestAccess(label: string) {
    setMessage(`${label} request saved locally for this preview.`);
    await recordNapoleonEvent("request_access_clicked", { label }, { persist: false });
  }

  async function viewGenesis() {
    setMessage("Genesis case preview opened locally.");
    await recordNapoleonEvent("genesis_case_viewed", { nodeId: napoleonGenesisNode.id }, { persist: false });
  }

  function useHelper(value: string) {
    setQuery(value);
  }

  return (
    <>
      <section className="napoleon-public-hero">
        <p>Powered by Axis</p>
        <h1>What are we turning into money today?</h1>
        <span>
          Napoleon turns real-life observations into cash-flow loops, offers, checkout paths,
          fulfillment, and proof.
        </span>
      </section>

      <NapoleonQueryToolbar
        busy={busy}
        onChange={setQuery}
        onHelper={useHelper}
        onSubmit={submitPublicQuery}
        placeholder="Show Napoleon an idea, screenshot, business, service, or cash-flow problem..."
        query={query}
        resultReady={Boolean(result)}
      />

      <NapoleonAgentResultView
        busy={busy}
        ctaLabel="Build this loop"
        onBuildLoop={() => void requestAccess("Build this loop")}
        result={result}
      />

      {result && (
        <section className="napoleon-public-ctas" aria-label="Public result actions">
          <button type="button" onClick={() => void requestAccess("Build this loop")}>
            Build this loop
          </button>
          <button type="button" onClick={() => void requestAccess("Request access")}>
            Request access
          </button>
          <button type="button" onClick={() => void requestAccess("Start with Axis")}>
            Start with Axis
          </button>
        </section>
      )}

      <NapoleonActionCards
        onBuildLoop={() => void requestAccess("Build My First Cash Loop")}
        onFindMoney={() => setQuery("Find money in this service or cash-flow problem.")}
      />

      <NapoleonGenesisNode node={napoleonGenesisNode} onView={viewGenesis} />

      <section className="napoleon-public-layers">
        <div className="napoleon-section-heading">
          <span>Wealth Layers</span>
          <h2>From active work to durable systems.</h2>
        </div>
        <div className="napoleon-public-layer-grid">
          <article>
            <strong>Active Core</strong>
            <p>Earn from the work already closest to reality.</p>
          </article>
          <article>
            <strong>Leveraged Accelerators</strong>
            <p>Turn proof, content, and offers into repeatable loops.</p>
          </article>
          <article>
            <strong>Passive Foundation</strong>
            <p>Future permissioned allocation after the cash loop is real.</p>
          </article>
        </div>
      </section>

      <NapoleonCashStreamSystems />

      <section className="napoleon-proof-feed">
        <div className="napoleon-section-heading">
          <span>Public Proof</span>
          <h2>Historical proof, not a live ledger.</h2>
        </div>
        {napoleonSeedProof
          .filter((proof) => proof.visibility === "public")
          .map((proof) => (
            <article className="napoleon-proof-item" key={proof.id}>
              <small>{proof.type}</small>
              <strong>{proof.text}</strong>
            </article>
          ))}
      </section>

      <section className="napoleon-public-ctas" aria-label="Napoleon access options">
        <button type="button" onClick={() => void requestAccess("Request Napoleon Access")}>
          Request Napoleon Access
        </button>
        <button type="button" onClick={() => void requestAccess("Build My First Cash Loop")}>
          Build My First Cash Loop
        </button>
        <button type="button" onClick={() => void requestAccess("Install Napoleon for My Business")}>
          Install Napoleon for My Business
        </button>
      </section>

      {message && <p className="napoleon-public-message">{message}</p>}
    </>
  );
}
