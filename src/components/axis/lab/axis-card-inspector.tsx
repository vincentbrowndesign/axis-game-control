import type { AxisLabBoardCardData, AxisLabFocus } from "./axis-lab-types";
import AxisStatusPill, { getAxisLabStatusLabel, getAxisLabStatusMeaning } from "./axis-status-pill";
import styles from "./axis-lab.module.css";

type Props = {
  card: AxisLabBoardCardData | null;
  focus: AxisLabFocus;
};

export default function AxisCardInspector({ card, focus }: Props) {
  if (!card) {
    return (
      <section className={styles.inspector}>
        <span className={styles.sectionEyebrow}>Inspector</span>
        <p className={styles.inspectorEmpty}>Select a card to preview its read-only details.</p>
      </section>
    );
  }

  return (
    <section className={styles.inspector} aria-labelledby="axis-lab-inspector-title">
      <span className={styles.sectionEyebrow}>Selected card</span>
      <h2 id="axis-lab-inspector-title">{card.title}</h2>
      <AxisStatusPill status={card.status} />

      <dl className={styles.inspectorMeta}>
        <div>
          <dt>Status</dt>
          <dd>{getAxisLabStatusLabel(card.status)}</dd>
        </div>
        <div>
          <dt>Meaning</dt>
          <dd>{getAxisLabStatusMeaning(card.status)}</dd>
        </div>
        {card.createdAt && (
          <div>
            <dt>Created</dt>
            <dd>
              <time dateTime={card.createdAt} title={formatFullDateTime(card.createdAt)}>
                {formatShortTime(card.createdAt)}
              </time>
            </dd>
          </div>
        )}
        <div>
          <dt>Mock relationship</dt>
          <dd>Supports the current focus: {focus.title}</dd>
        </div>
      </dl>

      <ul className={styles.inspectorItems}>
        {card.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      {card.note && <p className={styles.inspectorNote}>{card.note}</p>}
    </section>
  );
}

function formatShortTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatFullDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
