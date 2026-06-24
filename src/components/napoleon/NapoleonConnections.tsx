"use client";

import type { NapoleonConnection } from "../../lib/napoleon/types";

type Props = {
  connections: NapoleonConnection[];
  onView: (connection: NapoleonConnection) => void;
};

export function NapoleonConnections({ connections, onView }: Props) {
  return (
    <section className="napoleon-connections">
      <div className="napoleon-section-heading">
        <span>Empire</span>
        <h2>Connections prove the loop later.</h2>
      </div>
      <div className="napoleon-connection-list">
        {connections.map((connection) => (
          <button className="napoleon-connection-card" key={connection.id} type="button" onClick={() => onView(connection)}>
            <div>
              <strong>{connection.name}</strong>
              <span>{connection.status}</span>
            </div>
            <p>{connection.proves}</p>
            <small>{connection.lastSync}</small>
            <dl>
              <div>
                <dt>Events</dt>
                <dd>{connection.events.join(", ")}</dd>
              </div>
              <div>
                <dt>Actions</dt>
                <dd>{connection.actions.join(", ")}</dd>
              </div>
              <div>
                <dt>Loop</dt>
                <dd>{connection.connectedCashLoop}</dd>
              </div>
            </dl>
          </button>
        ))}
      </div>
    </section>
  );
}
