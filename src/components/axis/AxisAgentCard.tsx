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
    </article>
  );
}
