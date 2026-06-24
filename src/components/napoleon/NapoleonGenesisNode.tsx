"use client";

import type { NapoleonNode } from "../../lib/napoleon/types";

type Props = {
  node: NapoleonNode;
  onView: () => void;
};

export function NapoleonGenesisNode({ node, onView }: Props) {
  return (
    <section className="napoleon-genesis">
      <div>
        <span>Axis Genesis Node</span>
        <h2>{node.title}</h2>
        <p>{node.subtitle}</p>
      </div>
      <p className="napoleon-genesis__proof">{node.proof}</p>
      <button type="button" onClick={onView}>
        {node.cta}
      </button>
    </section>
  );
}
