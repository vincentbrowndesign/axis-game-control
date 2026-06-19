import type { AxisLabBoardCardData, AxisLabFocus } from "./axis-lab-types";
import AxisLabBoardCard from "./axis-lab-board-card";
import styles from "./axis-lab.module.css";

type Props = {
  cards: readonly AxisLabBoardCardData[];
  focus: AxisLabFocus;
  onSelectCard: (id: string) => void;
  selectedCardId: string;
};

export default function AxisBoardCanvas({ cards, focus, onSelectCard, selectedCardId }: Props) {
  return (
    <section className={styles.boardCanvas} aria-labelledby="axis-lab-focus-title">
      <div className={styles.focusBlock}>
        <span className={styles.sectionEyebrow}>Current focus</span>
        <h2 id="axis-lab-focus-title">{focus.title}</h2>
        <p>{focus.summary}</p>
      </div>

      <div className={styles.cardGrid} aria-label="Mock Thread Board cards">
        {cards.map((card) => (
          <AxisLabBoardCard
            key={card.id}
            card={card}
            selected={card.id === selectedCardId}
            onSelect={() => onSelectCard(card.id)}
          />
        ))}
      </div>
    </section>
  );
}
