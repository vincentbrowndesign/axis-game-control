"use client";

import type { NapoleonAgentResult as NapoleonAgentResultType } from "../../lib/napoleon/types";
import {
  labelNapoleonIncomeType,
  labelNapoleonWealthLayer,
} from "../../lib/napoleon/seed";

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

      <article className="napoleon-cash-plan" aria-label="Money classification">
        <small>Find Money Result</small>
        <dl>
          <div>
            <dt>Money Type</dt>
            <dd>{labelNapoleonIncomeType(result.cashStream.moneyType)}</dd>
          </div>
          <div>
            <dt>Wealth Layer</dt>
            <dd>{labelNapoleonWealthLayer(result.cashStream.wealthLayer)}</dd>
          </div>
          <div>
            <dt>System Blueprint</dt>
            <dd>{result.cashStream.systemBlueprint}</dd>
          </div>
          <div>
            <dt>Fastest Cash Path</dt>
            <dd>{result.cashStream.fastestCashPath}</dd>
          </div>
          <div>
            <dt>Automation Path</dt>
            <dd>{result.cashStream.automationPath}</dd>
          </div>
          <div>
            <dt>Reinvestment Valve</dt>
            <dd>{result.cashStream.reinvestmentValve}</dd>
          </div>
          <div>
            <dt>Leak Rule</dt>
            <dd>{result.cashStream.leakRule}</dd>
          </div>
          <div>
            <dt>Next Action</dt>
            <dd>{result.cashStream.nextAction}</dd>
          </div>
        </dl>
      </article>

      <button className="napoleon-primary" type="button" onClick={onBuildLoop}>
        Build This Loop
      </button>
    </section>
  );
}
