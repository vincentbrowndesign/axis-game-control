import type { CSSProperties } from "react";
import { getAxisStatusStyle } from "../../../lib/axis-visual-language";
import AxisStatusPill from "./axis-status-pill";
import type { AxisLabBoardCardData } from "./axis-lab-types";
import styles from "./axis-lab.module.css";

type Props = {
  card: AxisLabBoardCardData;
  onSelect: () => void;
  selected: boolean;
};

export default function AxisLabBoardCard({ card, onSelect, selected }: Props) {
  const style = getAxisStatusStyle(card.status);

  return (
    <button
      className={`${styles.boardCard}${selected ? ` ${styles.boardCardSelected}` : ""}`}
      data-axis-status={card.status}
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      style={{
        "--axis-card-accent": style.accent,
        "--axis-card-border": style.border,
      } as CSSProperties}
    >
      <span className={styles.cardStripe} aria-hidden="true" />
      <div className={styles.cardHeader}>
        <AxisStatusPill status={card.status} />
        <h3>{card.title}</h3>
      </div>
      <ul>
        {card.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {card.note && <p className={styles.cardNote}>{card.note}</p>}
    </button>
  );
}
