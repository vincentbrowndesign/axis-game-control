import type { CSSProperties } from "react";
import { getAxisStatusStyle } from "../../../lib/axis-visual-language";
import styles from "./axis-lab.module.css";
import type { AxisLabBoardCardData, AxisLabFocus } from "./axis-lab-types";

interface Props {
  focus: AxisLabFocus;
  cards: readonly AxisLabBoardCardData[];
}

export default function AxisCurrentWork({ focus, cards }: Props) {
  return (
    <div className={styles.column}>
      <div className={styles.focusHead}>
        <h1 className={styles.focusTitle}>{focus.title}</h1>
        <p className={styles.focusSummary}>{focus.summary}</p>
      </div>

      <div className={styles.sections}>
        {cards.map((card) => {
          const accent = getAxisStatusStyle(card.status).accent;
          return (
            <section
              key={card.id}
              className={styles.section}
              style={{ "--accent": accent } as CSSProperties}
            >
              <h2 className={styles.sectionLabel}>{card.title}</h2>
              {card.note && <p className={styles.sectionNote}>{card.note}</p>}
              <ul className={styles.sectionItems}>
                {card.items.map((item, i) => (
                  <li key={i} className={styles.sectionItem}>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
