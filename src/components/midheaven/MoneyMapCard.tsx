import type { MoneyMap } from "../../lib/midheaven/types";

type Props = {
  moneyMap: MoneyMap;
};

export function MoneyMapCard({ moneyMap }: Props) {
  return (
    <article className="midheaven-map">
      <header>
        <span>Money Map</span>
        <h1>Money Map forming</h1>
      </header>

      <MoneyMapSection title="Sources" items={moneyMap.source.items} />
      <MoneyMapSection title="Lanes" items={moneyMap.lanes.map((lane) => lane.label)} />
      <MoneyMapSection title="Streams" items={moneyMap.streams.map((stream) => stream.label)} />

      <section className="midheaven-map__section">
        <h2>First Loop</h2>
        <p>{moneyMap.firstLoop.description}</p>
      </section>

      <section className="midheaven-map__section">
        <h2>Next Step</h2>
        <p>{moneyMap.nextStep}</p>
      </section>
    </article>
  );
}

function MoneyMapSection({ items, title }: { items: string[]; title: string }) {
  return (
    <section className="midheaven-map__section">
      <h2>{title}</h2>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
