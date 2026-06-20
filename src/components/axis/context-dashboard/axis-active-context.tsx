import type React from "react";
import { Bookmark, Plus } from "lucide-react";
import { AxisContextSection } from "./axis-context-section";
import styles from "./axis-context-dashboard.module.css";

export function AxisActiveContext({
  contextSections = [],
  detail,
  keeper,
  label = "Active Context",
  mainText,
  nextMove,
  proofNeeded,
  support,
  tags = [],
}: {
  contextSections?: readonly {
    id: string;
    items: readonly string[];
    title: string;
  }[];
  detail?: React.ReactNode;
  keeper?: string;
  label?: string;
  mainText: string;
  nextMove?: string;
  proofNeeded?: string;
  support?: string;
  tags?: readonly string[];
}) {
  return (
    <section className={styles.contextRegion} aria-labelledby="axis-context-active-title">
      <span className={styles.contextPill}>{label}</span>
      <h1 id="axis-context-active-title">{mainText}</h1>
      {support && <p className={styles.contextSupport}>{support}</p>}

      {(proofNeeded || nextMove) && (
        <div className={styles.contextPair}>
          {proofNeeded && <AxisContextSection title="Proof Needed">{proofNeeded}</AxisContextSection>}
          {nextMove && <AxisContextSection title="Next Move">{nextMove}</AxisContextSection>}
        </div>
      )}

      {contextSections.length > 0 && (
        <div className={styles.contextSectionStack}>
          {contextSections.map((section) => (
            <AxisContextSection title={section.title} key={section.id}>
              <ul className={styles.contextSectionList}>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </AxisContextSection>
          ))}
        </div>
      )}

      {keeper && (
        <section className={styles.keeperBlock}>
          <div>
            <h2>Keeper</h2>
            <p>{keeper}</p>
          </div>
          <Bookmark size={18} aria-label="Keeper" />
        </section>
      )}

      {detail}

      {tags.length > 0 && (
        <div className={styles.tagRow} aria-label="Topic chips">
          {tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
          <button type="button" aria-label="Add topic">
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}
