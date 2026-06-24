"use client";

import type { FormEvent } from "react";
import type {
  NapoleonAgentResult,
  NapoleonCashLoop,
  NapoleonNextMove,
  NapoleonNode,
  NapoleonProof,
} from "../../lib/napoleon/types";
import { NapoleonActionCards } from "./NapoleonActionCards";
import { NapoleonAgentResult as NapoleonAgentResultView } from "./NapoleonAgentResult";
import { NapoleonGenesisNode } from "./NapoleonGenesisNode";
import { NapoleonLoopCard } from "./NapoleonLoopCard";
import { NapoleonProofFeed } from "./NapoleonProofFeed";
import { NapoleonQueryToolbar } from "./NapoleonQueryToolbar";

type Props = {
  busy: boolean;
  genesisNode: NapoleonNode;
  loops: NapoleonCashLoop[];
  nextMove: NapoleonNextMove;
  proof: NapoleonProof[];
  query: string;
  result: NapoleonAgentResult | null;
  onBuildLoop: () => void;
  onFindMoney: () => void;
  onGenesisView: () => void;
  onQueryChange: (value: string) => void;
  onQueryHelper: (value: string) => void;
  onQuerySubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function NapoleonHome({
  busy,
  genesisNode,
  loops,
  nextMove,
  onBuildLoop,
  onFindMoney,
  onGenesisView,
  onQueryChange,
  onQueryHelper,
  onQuerySubmit,
  proof,
  query,
  result,
}: Props) {
  return (
    <>
      <section className="napoleon-hero">
        <p>Powered by Axis</p>
        <h1>What are we turning into money today?</h1>
        <span>Find opportunities. Build loops. Prove cash flow.</span>
      </section>

      <NapoleonQueryToolbar
        busy={busy}
        onChange={onQueryChange}
        onHelper={onQueryHelper}
        onSubmit={onQuerySubmit}
        query={query}
        resultReady={Boolean(result)}
      />

      <NapoleonAgentResultView busy={busy} onBuildLoop={onBuildLoop} result={result} />

      <NapoleonActionCards onBuildLoop={onBuildLoop} onFindMoney={onFindMoney} />

      <NapoleonGenesisNode node={genesisNode} onView={onGenesisView} />

      <section className="napoleon-loop-section">
        <div className="napoleon-section-heading">
          <span>Active Cash Loops</span>
          <h2>Generated artifacts from the query.</h2>
        </div>
        <div className="napoleon-loop-list">
          {loops.map((loop) => (
            <NapoleonLoopCard key={loop.id} loop={loop} />
          ))}
        </div>
      </section>

      <section className="napoleon-next-move">
        <span>Napoleon's Next Move</span>
        <strong>{nextMove.title}</strong>
        <p>{nextMove.reason}</p>
      </section>

      <NapoleonProofFeed proof={proof} />
    </>
  );
}
