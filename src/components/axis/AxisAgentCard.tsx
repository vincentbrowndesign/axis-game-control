import type { AxisAgent } from "../../lib/axis/types";

export function AxisAgentCard({ agent }: { agent: AxisAgent }) {
  return (
    <article className={`axis-agent-card axis-agent-card--${agent.accent}`}>
      <div className="axis-agent-card__top">
        <span>{agent.id}</span>
        <h3>{agent.name}</h3>
      </div>
      <p>{agent.purpose}</p>
      <dl>
        <div>
          <dt>Status</dt>
          <dd>{agent.status}</dd>
        </div>
        <div>
          <dt>Future wiring</dt>
          <dd>{agent.futureWiring}</dd>
        </div>
      </dl>
      {agent.routeContract && (
        <section className="axis-agent-card__contract" aria-label={`${agent.name} routing contract`}>
          <h4>Router contract</h4>
          <ul>
            <li>
              <strong>Accepts:</strong> {agent.routeContract.accepts}
            </li>
            <li>
              <strong>Decides:</strong> {agent.routeContract.decides}
            </li>
            <li>
              <strong>Returns:</strong> {agent.routeContract.returns}
            </li>
          </ul>
        </section>
      )}
    </article>
  );
}
