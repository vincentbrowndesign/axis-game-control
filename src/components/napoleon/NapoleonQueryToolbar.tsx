"use client";

import type { FormEvent } from "react";

type Props = {
  busy: boolean;
  query: string;
  resultReady: boolean;
  onChange: (value: string) => void;
  onHelper: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

const quickInputs = ["Screenshot", "Photo", "Link", "Voice"];
const helperChips = [
  "Find money in this",
  "Build this into an offer",
  "What's leaking?",
  "Turn this into a cash loop",
];

export function NapoleonQueryToolbar({
  busy,
  onChange,
  onHelper,
  onSubmit,
  query,
  resultReady,
}: Props) {
  return (
    <section className="napoleon-query" data-state={resultReady ? "result" : query ? "active" : "resting"}>
      <form onSubmit={onSubmit}>
        <label htmlFor="napoleon-query-input">Ask Napoleon anything</label>
        <textarea
          id="napoleon-query-input"
          onChange={(event) => onChange(event.target.value)}
          placeholder="Ask Napoleon anything..."
          rows={4}
          value={query}
        />
        <div className="napoleon-query__actions">
          <div className="napoleon-query__inputs" aria-label="Quick inputs">
            {quickInputs.map((input) => (
              <button key={input} type="button" onClick={() => onHelper(`${input}: `)}>
                {input}
              </button>
            ))}
          </div>
          <button className="napoleon-primary" type="submit" disabled={busy || !query.trim()}>
            {busy ? "Finding..." : "Ask"}
          </button>
        </div>
      </form>

      <div className="napoleon-helper-chips" aria-label="Query helpers">
        {helperChips.map((chip) => (
          <button key={chip} type="button" onClick={() => onHelper(chip)}>
            {chip}
          </button>
        ))}
      </div>
    </section>
  );
}
