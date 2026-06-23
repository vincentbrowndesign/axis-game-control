"use client";

import type { FormEvent } from "react";

type Props = {
  draft: string;
  onDraftChange: (value: string) => void;
  onQuickMark: (content: string) => void;
  quickMarks: Array<{
    content: string;
    label: string;
  }>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function AxisInputDock({
  draft,
  onDraftChange,
  onQuickMark,
  quickMarks,
  onSubmit,
}: Props) {
  return (
    <aside className="axis-input-dock" aria-label="Session input">
      <form onSubmit={onSubmit}>
        <label>
          Talk, type, or tap what happened.
          <div className="axis-input-dock__row">
            <input
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder="Type the moment..."
            />
            <button className="axis-input-dock__mark" type="submit" disabled={!draft.trim()}>
              Save
            </button>
          </div>
        </label>
      </form>

      <div className="axis-input-dock__quick" aria-label="Quick session actions">
        {quickMarks.map((mark) => (
          <button key={mark.label} type="button" onClick={() => onQuickMark(mark.content)}>
            {mark.label}
          </button>
        ))}
      </div>
    </aside>
  );
}
