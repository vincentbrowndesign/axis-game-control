"use client";

type Props = {
  onBuildLoop: () => void;
  onFindMoney: () => void;
};

export function NapoleonActionCards({ onBuildLoop, onFindMoney }: Props) {
  return (
    <section className="napoleon-action-grid" aria-label="Primary actions">
      <button className="napoleon-action-card" type="button" onClick={onFindMoney}>
        <span>Find Money</span>
        <strong>Spot opportunities hiding in what you already do.</strong>
      </button>
      <button className="napoleon-action-card" type="button" onClick={onBuildLoop}>
        <span>Build Loop</span>
        <strong>Turn an idea into an offer, checkout path, and proof system.</strong>
      </button>
    </section>
  );
}
