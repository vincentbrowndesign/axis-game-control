import type { NapoleonCashLoop } from "../../lib/napoleon/types";
import {
  labelNapoleonCashStreamSystem,
  labelNapoleonIncomeType,
  labelNapoleonWealthLayer,
} from "../../lib/napoleon/seed";

type Props = {
  loop: NapoleonCashLoop;
};

export function NapoleonLoopCard({ loop }: Props) {
  return (
    <article className="napoleon-loop-card">
      <div className="napoleon-loop-card__top">
        <strong>{loop.title}</strong>
        <span data-status={loop.status}>{loop.status}</span>
      </div>
      <dl>
        <div>
          <dt>Income Type</dt>
          <dd>{labelNapoleonIncomeType(loop.incomeType)}</dd>
        </div>
        <div>
          <dt>Wealth Layer</dt>
          <dd>{labelNapoleonWealthLayer(loop.wealthLayer)}</dd>
        </div>
        <div>
          <dt>System Blueprint</dt>
          <dd>{loop.systemBlueprint || labelNapoleonCashStreamSystem(loop.cashStreamSystem)}</dd>
        </div>
        <div>
          <dt>Target</dt>
          <dd>{loop.targetCustomer}</dd>
        </div>
        <div>
          <dt>Offer</dt>
          <dd>{loop.offer}</dd>
        </div>
        <div>
          <dt>Fastest Path</dt>
          <dd>{loop.fastestCashPath}</dd>
        </div>
        <div>
          <dt>Automation Path</dt>
          <dd>{loop.automationPath}</dd>
        </div>
        <div>
          <dt>Reinvestment Rule</dt>
          <dd>{loop.reinvestmentRule}</dd>
        </div>
        <div>
          <dt>Proof</dt>
          <dd>{loop.proofStatus}</dd>
        </div>
        <div>
          <dt>Next</dt>
          <dd>{loop.nextAction}</dd>
        </div>
      </dl>
    </article>
  );
}
