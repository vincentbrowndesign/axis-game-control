"use client";

import type { MoneyMapRefinement } from "../../lib/midheaven/types";

type Props = {
  onRefine: (refinement: MoneyMapRefinement) => void;
};

const refinements: Array<{ id: MoneyMapRefinement; label: string }> = [
  { id: "true", label: "True" },
  { id: "not_me", label: "Not me" },
  { id: "more", label: "More" },
  { id: "less", label: "Less" },
  { id: "build_this", label: "Build this" },
];

export function RefinementControls({ onRefine }: Props) {
  return (
    <div className="midheaven-refinements" aria-label="Refine Money Map">
      {refinements.map((refinement) => (
        <button key={refinement.id} type="button" onClick={() => onRefine(refinement.id)}>
          {refinement.label}
        </button>
      ))}
    </div>
  );
}
