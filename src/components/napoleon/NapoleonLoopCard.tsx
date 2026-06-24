import type { NapoleonCashLoop } from "../../lib/napoleon/types";

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
          <dt>Target</dt>
          <dd>{loop.targetCustomer}</dd>
        </div>
        <div>
          <dt>Offer</dt>
          <dd>{loop.offer}</dd>
        </div>
        <div>
          <dt>Next</dt>
          <dd>{loop.nextAction}</dd>
        </div>
        <div>
          <dt>Proof</dt>
          <dd>{loop.proofStatus}</dd>
        </div>
      </dl>
    </article>
  );
}
