export type ThreadBoardSectionType =
  | "observation"
  | "pattern"
  | "relationship"
  | "question"
  | "hypothesis"
  | "intervention"
  | "outcome";

export interface ThreadBoardSection {
  type: ThreadBoardSectionType;
  label: string;
  items: string[];
}

export interface ThreadBoardData {
  title: string;
  summary: string;
  sections: ThreadBoardSection[];
}

interface Props {
  board?: ThreadBoardData | null;
}

function sectionToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export default function ThreadBoard({ board }: Props) {
  if (!board || typeof board.title !== "string") return null;

  const sections = Array.isArray(board.sections)
    ? board.sections
        .map((section) => ({
          ...section,
          items: Array.isArray(section.items)
            ? section.items
                .filter((item) => typeof item === "string" && item.trim())
                .slice(0, 3)
            : [],
        }))
        .filter(
          (section) =>
            typeof section.label === "string" &&
            section.label.trim() &&
            section.items.length > 0,
        )
    : [];

  if (!board.title.trim() && !board.summary?.trim() && sections.length === 0) {
    return null;
  }

  return (
    <section className="thread-board" aria-label="Thread Board">
      <div className="thread-board-anchor">
        {board.title.trim() && <h3 className="thread-board-title">{board.title}</h3>}
        {typeof board.summary === "string" && board.summary.trim() && (
          <p className="thread-board-summary">{board.summary}</p>
        )}
      </div>

      {sections.length > 0 && (
        <div className="thread-board-sections">
          {sections.map((section, index) => {
            const labelToken = sectionToken(section.label);
            const typeToken = sectionToken(section.type);

            return (
              <section
                key={`${section.type}-${section.label}-${index}`}
                className={`thread-board-section thread-board-section--${typeToken} thread-board-section--${labelToken}`}
                data-section-type={typeToken}
                data-section-label={labelToken}
              >
                <h4 className="thread-board-label">{section.label}</h4>
                <ul className="thread-board-items">
                  {section.items.map((item, itemIndex) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .thread-board {
          display: grid;
          gap: clamp(22px, 3vw, 42px);
          grid-template-columns: minmax(0, 0.92fr) minmax(260px, 1.08fr);
          margin: 0;
          max-width: 980px;
          min-height: min(640px, calc(100dvh - 180px));
          padding: 0;
          width: 100%;
        }

        .thread-board-anchor {
          align-self: start;
          border-top: 2px solid rgba(25, 24, 21, 0.78);
          max-width: 34rem;
          padding-top: clamp(14px, 2vw, 24px);
        }

        .thread-board-title {
          color: rgba(25, 24, 21, 0.86);
          font-size: clamp(34px, 5.2vw, 72px);
          font-weight: 600;
          line-height: 0.98;
          margin: 0 0 14px;
        }

        .thread-board-summary {
          color: rgba(25, 24, 21, 0.62);
          font-size: clamp(17px, 1.55vw, 22px);
          line-height: 1.42;
          margin: 0;
          max-width: 38ch;
        }

        .thread-board-sections {
          display: grid;
          gap: clamp(16px, 2vw, 28px);
          grid-auto-rows: minmax(110px, auto);
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .thread-board-section {
          align-self: start;
          background: rgba(255, 254, 251, 0.82);
          border: 1px solid rgba(25, 24, 21, 0.16);
          border-radius: 2px;
          box-shadow: 0 1px 0 rgba(25, 24, 21, 0.06);
          min-width: 0;
          padding: clamp(12px, 1.35vw, 18px);
          position: relative;
        }

        .thread-board-section::before {
          background: rgba(25, 24, 21, 0.54);
          content: "";
          height: 1px;
          left: clamp(12px, 1.35vw, 18px);
          position: absolute;
          right: clamp(12px, 1.35vw, 18px);
          top: 9px;
        }

        .thread-board-section:nth-child(2n) {
          margin-top: clamp(18px, 4vw, 52px);
        }

        .thread-board-section:nth-child(3n) {
          grid-column: span 2;
          max-width: 82%;
        }

        .thread-board-section--outcome,
        .thread-board-section--intervention,
        .thread-board-section--timeout_call,
        .thread-board-section--player_rule,
        .thread-board-section--adjustment_trigger {
          border-color: rgba(25, 24, 21, 0.28);
        }

        .thread-board-section--question,
        .thread-board-section--watch_next {
          background: rgba(255, 254, 251, 0.78);
        }

        .thread-board-section--hypothesis,
        .thread-board-section--pattern {
          border-style: dashed;
        }

        .thread-board-label {
          color: rgba(25, 24, 21, 0.5);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.05em;
          margin: 0 0 10px;
          padding-top: 10px;
          text-transform: uppercase;
        }

        .thread-board-items {
          color: rgba(25, 24, 21, 0.78);
          font-size: clamp(15px, 1.25vw, 18px);
          line-height: 1.38;
          margin: 0;
          padding-left: 18px;
        }

        .thread-board-items li + li {
          margin-top: 8px;
        }

        @media (max-width: 980px) {
          .thread-board {
            grid-template-columns: 1fr;
            min-height: 0;
          }

          .thread-board-anchor {
            max-width: 48rem;
          }

          .thread-board-sections {
            max-width: 100%;
          }
        }

        @media (max-width: 640px) {
          .thread-board {
            gap: 9px;
            padding-bottom: 0;
            padding-top: 5px;
          }

          .thread-board-title {
            font-size: 20px;
            line-height: 1.03;
            margin-bottom: 4px;
          }

          .thread-board-summary {
            font-size: 12.5px;
            line-height: 1.3;
          }

          .thread-board-items {
            font-size: 13.5px;
            line-height: 1.3;
          }

          .thread-board-sections {
            grid-template-columns: 1fr;
            gap: 7px;
          }

          .thread-board-anchor {
            border-top-width: 1px;
            padding-top: 7px;
          }

          .thread-board-label {
            font-size: 10px;
            margin-bottom: 4px;
            padding-top: 7px;
          }

          .thread-board-section {
            padding: 8px 9px;
          }

          .thread-board-section::before {
            left: 9px;
            right: 9px;
            top: 7px;
          }

          .thread-board-items li + li {
            margin-top: 3px;
          }

          .thread-board-section,
          .thread-board-section:nth-child(2n),
          .thread-board-section:nth-child(3n) {
            grid-column: auto;
            margin-top: 0;
            max-width: none;
          }
        }
      `}</style>
    </section>
  );
}
