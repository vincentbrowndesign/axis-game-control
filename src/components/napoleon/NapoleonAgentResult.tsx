"use client";

import type { NapoleonAgentResult as NapoleonAgentResultType } from "../../lib/napoleon/types";

type Props = {
  busy: boolean;
  result: NapoleonAgentResultType | null;
  onBuildLoop: () => void;
};

export function NapoleonAgentResult({ busy, onBuildLoop, result }: Props) {
  if (busy) {
    return (
      <section className="napoleon-agent-result" aria-live="polite">
        <p>Napoleon is finding the money shape.</p>
      </section>
    );
  }

  if (!result) return null;

  return (
    <section className="napoleon-agent-result" aria-label="Napoleon result">
      <div className="napoleon-section-heading">
        <span>Agent Result</span>
        <h2>Visionary / Numbers / Words</h2>
      </div>

      <div className="napoleon-agent-grid">
        {result.voices.map((voice) => (
          <article className="napoleon-agent-card" key={voice.id}>
            <small>{voice.label}</small>
            <strong>{voice.headline}</strong>
            <ul>
              {voice.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <button className="napoleon-primary" type="button" onClick={onBuildLoop}>
        Build This Loop
      </button>
    </section>
  );
}
