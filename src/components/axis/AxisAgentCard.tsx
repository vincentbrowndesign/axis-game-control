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
      {agent.orchestrationContract && (
        <section className="axis-agent-card__contract" aria-label={`${agent.name} orchestration contract`}>
          <h4>Orchestration contract</h4>
          <ContractList title="Accepts" items={agent.orchestrationContract.accepts} />
          <ContractList title="Decides" items={agent.orchestrationContract.decides} />
          <ContractList title="Returns" items={agent.orchestrationContract.returns} />
        </section>
      )}
      {agent.mediaIntakeContract && (
        <section className="axis-agent-card__contract" aria-label={`${agent.name} media intake contract`}>
          <h4>Media intake contract</h4>
          <ContractList title="Accepts" items={agent.mediaIntakeContract.accepts} />
          <ContractList title="Decides" items={agent.mediaIntakeContract.decides} />
          <ContractList title="Returns" items={agent.mediaIntakeContract.returns} />
        </section>
      )}
      {agent.voiceContract && (
        <section className="axis-agent-card__contract" aria-label={`${agent.name} voice contract`}>
          <h4>Voice contract</h4>
          <ContractList title="Accepts" items={agent.voiceContract.accepts} />
          <ContractList title="Decides" items={agent.voiceContract.decides} />
          <ContractList title="Returns" items={agent.voiceContract.returns} />
        </section>
      )}
      {agent.visionContract && (
        <section className="axis-agent-card__contract" aria-label={`${agent.name} vision contract`}>
          <h4>Vision contract</h4>
          <ContractList title="Accepts" items={agent.visionContract.accepts} />
          <ContractList title="Decides" items={agent.visionContract.decides} />
          <ContractList title="Returns" items={agent.visionContract.returns} />
        </section>
      )}
      {agent.videoUnderstandingContract && (
        <section className="axis-agent-card__contract" aria-label={`${agent.name} video understanding contract`}>
          <h4>Video understanding contract</h4>
          <ContractList title="Accepts" items={agent.videoUnderstandingContract.accepts} />
          <ContractList title="Decides" items={agent.videoUnderstandingContract.decides} />
          <ContractList title="Returns" items={agent.videoUnderstandingContract.returns} />
        </section>
      )}
      {agent.sessionMemoryContract && (
        <section className="axis-agent-card__contract" aria-label={`${agent.name} session memory contract`}>
          <h4>Session memory contract</h4>
          <ContractList title="Accepts" items={agent.sessionMemoryContract.accepts} />
          <ContractList title="Decides" items={agent.sessionMemoryContract.decides} />
          <ContractList title="Returns" items={agent.sessionMemoryContract.returns} />
        </section>
      )}
      {agent.reportContract && (
        <section className="axis-agent-card__contract" aria-label={`${agent.name} report contract`}>
          <h4>Report contract</h4>
          <ContractList title="Accepts" items={agent.reportContract.accepts} />
          <ContractList title="Decides" items={agent.reportContract.decides} />
          <ContractList title="Returns" items={agent.reportContract.returns} />
        </section>
      )}
      {agent.followUpContract && (
        <section className="axis-agent-card__contract" aria-label={`${agent.name} follow-up contract`}>
          <h4>Follow-up contract</h4>
          <ContractList title="Accepts" items={agent.followUpContract.accepts} />
          <ContractList title="Decides" items={agent.followUpContract.decides} />
          <ContractList title="Returns" items={agent.followUpContract.returns} />
        </section>
      )}
    </article>
  );
}

function ContractList({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="axis-agent-card__contract-group">
      <strong>{title}</strong>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
