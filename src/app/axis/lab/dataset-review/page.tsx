import type { Metadata } from "next";
import {
  axisDatasetFlywheel,
  axisDatasetReviewActions,
  getDatasetReviewStatusLabel,
  listAxisDatasetReviewItems,
} from "../../../../lib/axis/vision/dataset-review";

export const metadata: Metadata = {
  title: "Axis Lab / Dataset Review",
  robots: { follow: false, index: false },
};

export default function AxisLabDatasetReviewPage() {
  const reviewItems = listAxisDatasetReviewItems();

  return (
    <main className="axis-dataset-review" aria-labelledby="axis-dataset-review-title">
      <section className="axis-dataset-review__hero">
        <p className="axis-dataset-review__eyebrow">Axis Lab</p>
        <h1 id="axis-dataset-review-title">Dataset Review</h1>
        <p>
          Reviewed session moments can become dataset examples. The main product stays focused on capturing sessions and saving memory.
        </p>
        <strong>{axisDatasetFlywheel}</strong>
      </section>

      <section className="axis-dataset-review__queue" aria-label="Dataset review queue">
        {reviewItems.map((item) => (
          <article className="axis-dataset-review__card" key={item.id}>
            <div className="axis-dataset-review__card-top">
              <div>
                <p className="axis-dataset-review__eyebrow">{getDatasetReviewStatusLabel(item.reviewStatus)}</p>
                <h2>{item.suggestedDataset}</h2>
              </div>
              <span>Axis Lab</span>
            </div>

            <div className="axis-dataset-review__moment">
              <p>{item.coachNote}</p>
              {item.transcriptText && <blockquote>{item.transcriptText}</blockquote>}
            </div>

            <dl className="axis-dataset-review__memory">
              <div><dt>Situation</dt><dd>{item.situation}</dd></div>
              <div><dt>Actor</dt><dd>{item.actor}</dd></div>
              <div><dt>Action</dt><dd>{item.action}</dd></div>
              <div><dt>Outcome</dt><dd>{item.outcome}</dd></div>
              <div><dt>Cause</dt><dd>{item.cause}</dd></div>
              <div><dt>Correction</dt><dd>{item.correction}</dd></div>
              <div><dt>Evidence</dt><dd>{item.evidence}</dd></div>
            </dl>

            <div className="axis-dataset-review__chips" aria-label={`${item.id} suggested labels`}>
              {item.suggestedLabels.map((label) => <span key={label}>{label}</span>)}
            </div>

            <div className="axis-dataset-review__meta">
              <span>{item.sessionId}</span>
              <span>{item.momentId}</span>
              {item.playerId && <span>{item.playerId}</span>}
              {item.videoClipUrl && <span>clip attached</span>}
              {item.imageUrl && <span>image attached</span>}
            </div>

            <p className="axis-dataset-review__reviewer">{item.reviewerNote}</p>

            <div className="axis-dataset-review__actions" aria-label={`${item.id} review actions`}>
              {axisDatasetReviewActions.map((action) => (
                <button key={action} type="button">
                  {action}
                </button>
              ))}
            </div>
          </article>
        ))}
      </section>

      <style>{`
        .axis-dataset-review,
        .axis-dataset-review * {
          box-sizing: border-box;
        }

        .axis-dataset-review {
          min-height: 100dvh;
          padding: 32px 18px;
          background: #f7f4ef;
          color: #171717;
          font-family: var(--font-geist-sans, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
        }

        .axis-dataset-review__hero,
        .axis-dataset-review__queue {
          width: min(1040px, 100%);
          margin: 0 auto;
        }

        .axis-dataset-review__hero {
          display: grid;
          gap: 12px;
          padding: 20px 0 24px;
          border-bottom: 1px solid rgba(23, 23, 23, 0.14);
        }

        .axis-dataset-review__eyebrow {
          margin: 0;
          color: #5f6f52;
          font-size: 0.78rem;
          font-weight: 800;
          letter-spacing: 0;
          text-transform: uppercase;
        }

        .axis-dataset-review h1,
        .axis-dataset-review h2,
        .axis-dataset-review p {
          margin-top: 0;
        }

        .axis-dataset-review h1 {
          margin-bottom: 0;
          font-size: clamp(2rem, 8vw, 4.25rem);
          line-height: 0.96;
        }

        .axis-dataset-review__hero p {
          max-width: 720px;
          margin-bottom: 0;
          color: #4a4a4a;
          line-height: 1.55;
        }

        .axis-dataset-review__hero strong {
          color: #26351f;
          font-size: 0.92rem;
          overflow-wrap: anywhere;
        }

        .axis-dataset-review__queue {
          display: grid;
          gap: 16px;
          padding: 24px 0;
        }

        .axis-dataset-review__card {
          display: grid;
          gap: 14px;
          padding: 16px;
          border: 1px solid rgba(23, 23, 23, 0.14);
          border-radius: 8px;
          background: #fffefa;
        }

        .axis-dataset-review__card-top {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          justify-content: space-between;
        }

        .axis-dataset-review__card-top h2 {
          margin-bottom: 0;
          font-size: 1.35rem;
          line-height: 1.1;
        }

        .axis-dataset-review__card-top span {
          flex: 0 0 auto;
          border: 1px solid rgba(95, 111, 82, 0.28);
          border-radius: 999px;
          color: #405734;
          font-size: 0.72rem;
          font-weight: 850;
          padding: 5px 8px;
          text-transform: uppercase;
        }

        .axis-dataset-review__moment {
          display: grid;
          gap: 8px;
        }

        .axis-dataset-review__moment p,
        .axis-dataset-review__reviewer {
          color: #464646;
          line-height: 1.45;
          margin-bottom: 0;
        }

        .axis-dataset-review blockquote {
          border-left: 3px solid rgba(95, 111, 82, 0.32);
          color: #252525;
          margin: 0;
          padding-left: 10px;
        }

        .axis-dataset-review__memory {
          display: grid;
          gap: 10px;
          margin: 0;
        }

        .axis-dataset-review__memory div {
          display: grid;
          gap: 3px;
        }

        .axis-dataset-review dt {
          color: #606060;
          font-size: 0.74rem;
          font-weight: 850;
          text-transform: uppercase;
        }

        .axis-dataset-review dd {
          margin: 0;
          line-height: 1.4;
        }

        .axis-dataset-review__chips,
        .axis-dataset-review__meta,
        .axis-dataset-review__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .axis-dataset-review__chips span,
        .axis-dataset-review__meta span {
          border-radius: 999px;
          background: rgba(95, 111, 82, 0.1);
          color: #34482a;
          font-size: 0.76rem;
          font-weight: 800;
          padding: 6px 8px;
        }

        .axis-dataset-review__meta span {
          background: rgba(23, 23, 23, 0.06);
          color: #333333;
        }

        .axis-dataset-review__reviewer {
          border-top: 1px solid rgba(23, 23, 23, 0.1);
          padding-top: 12px;
        }

        .axis-dataset-review__actions button {
          border: 1px solid rgba(23, 23, 23, 0.16);
          border-radius: 999px;
          background: #171717;
          color: #fffefa;
          cursor: pointer;
          font: inherit;
          font-size: 0.8rem;
          font-weight: 850;
          min-height: 2.45rem;
          padding: 0 12px;
        }

        .axis-dataset-review__actions button:last-child {
          background: transparent;
          color: #7a241e;
        }

        @media (min-width: 760px) {
          .axis-dataset-review {
            padding: 48px 24px;
          }

          .axis-dataset-review__memory {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </main>
  );
}
