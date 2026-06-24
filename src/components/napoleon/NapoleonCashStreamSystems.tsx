import { napoleonCashStreamSystems } from "../../lib/napoleon/seed";

export function NapoleonCashStreamSystems() {
  return (
    <section className="napoleon-cash-systems">
      <div className="napoleon-section-heading">
        <span>Cash Stream Systems</span>
        <h2>Blueprints, not fake revenue.</h2>
      </div>
      <div className="napoleon-cash-system-list">
        {napoleonCashStreamSystems.map((system) => (
          <article className="napoleon-cash-system-card" key={system.id}>
            <strong>{system.title}</strong>
            <span>{system.subtitle}</span>
            <p>{system.example}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
