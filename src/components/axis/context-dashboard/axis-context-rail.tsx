import { Plus } from "lucide-react";
import type React from "react";
import type { AxisContextProofCandidate } from "./axis-context-dashboard-types";
import styles from "./axis-context-dashboard.module.css";

export function AxisContextRail({
  actions = [],
  openLoops = [],
  proofCandidates = [],
}: {
  actions?: readonly {
    due?: string;
    id: string;
    title: string;
  }[];
  openLoops?: readonly {
    control?: React.ReactNode;
    id: string;
    text: string;
  }[];
  proofCandidates?: readonly AxisContextProofCandidate[];
}) {
  if (proofCandidates.length === 0 && openLoops.length === 0 && actions.length === 0) {
    return null;
  }

  return (
    <aside className={styles.rightRegion} aria-label="Context intelligence">
      {proofCandidates.length > 0 && (
        <section className={styles.rightSection}>
          <HeaderCount title="Proof Candidates" count={proofCandidates.length} />
          <div className={styles.proofList}>
            {proofCandidates.map((candidate) => (
              <ProofCard candidate={candidate} key={candidate.id} />
            ))}
          </div>
        </section>
      )}

      {openLoops.length > 0 && (
        <section className={styles.rightSection}>
          <HeaderCount title="Open Loops" count={openLoops.length} />
          <ul className={styles.loopList}>
            {openLoops.map((loop) => (
              <li key={loop.id}>
                {loop.control ?? <button type="button" aria-label={`Mark loop complete: ${loop.text}`} />}
                <p>{loop.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {actions.length > 0 && (
        <section className={styles.rightSection}>
          <h2>Actions</h2>
          {actions.map((action) => (
            <article className={styles.actionCard} key={action.id}>
              <p>{action.title}</p>
              {action.due && <span>Due: {action.due}</span>}
            </article>
          ))}
          <button className={styles.addAction} type="button">
            <Plus size={14} aria-hidden="true" />
            Add action
          </button>
        </section>
      )}
    </aside>
  );
}

function HeaderCount({ count, title }: { count: number; title: string }) {
  return (
    <div className={styles.sectionHeader}>
      <h2>{title}</h2>
      <span>{count}</span>
    </div>
  );
}

function ProofCard({ candidate }: { candidate: AxisContextProofCandidate }) {
  return (
    <article className={styles.proofCard}>
      <div className={styles.proofThumb}>
        <span>{candidate.duration}</span>
      </div>
      <div>
        <h3>{candidate.title}</h3>
        {candidate.source && <p>{candidate.source}</p>}
        {candidate.meta && <p>{candidate.meta}</p>}
        {candidate.time && <p>{candidate.time}</p>}
        <span className={styles.unverified}>
          <span aria-hidden="true" />
          {candidate.confidence ?? "Unverified"}
        </span>
        {candidate.boundary && <p className={styles.boundaryText}>{candidate.boundary}</p>}
      </div>
    </article>
  );
}
