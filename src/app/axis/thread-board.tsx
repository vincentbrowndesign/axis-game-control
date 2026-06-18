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
    <section className="thread-board" aria-label="Thread board">
      {board.title.trim() && <h3 className="thread-board-title">{board.title}</h3>}
      {typeof board.summary === "string" && board.summary.trim() && (
        <p className="thread-board-summary">{board.summary}</p>
      )}

      {sections.length > 0 && (
        <div className="thread-board-sections">
          {sections.map((section, index) => (
            <section
              key={`${section.type}-${section.label}-${index}`}
              className="thread-board-section"
            >
              <h4 className="thread-board-label">{section.label}</h4>
              <ul className="thread-board-items">
                {section.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <style jsx>{`
        .thread-board {
          max-width: 720px;
        }

        .thread-board-title {
          color: rgba(25, 24, 21, 0.72);
          font-size: 18px;
          font-weight: 600;
          line-height: 1.35;
          margin: 0 0 4px;
        }

        .thread-board-summary {
          color: rgba(25, 24, 21, 0.5);
          font-size: 14px;
          line-height: 1.45;
          margin: 0 0 12px;
        }

        .thread-board-sections {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .thread-board-section {
          border-left: 1px solid rgba(25, 24, 21, 0.1);
          padding-left: 12px;
        }

        .thread-board-label {
          color: rgba(25, 24, 21, 0.42);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.05em;
          margin: 0 0 6px;
          text-transform: uppercase;
        }

        .thread-board-items {
          color: rgba(25, 24, 21, 0.7);
          font-size: 14px;
          line-height: 1.45;
          margin: 0;
          padding-left: 18px;
        }

        .thread-board-items li + li {
          margin-top: 4px;
        }
      `}</style>
    </section>
  );
}
