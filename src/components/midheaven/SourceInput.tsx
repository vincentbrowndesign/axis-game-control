"use client";

import type { FormEvent } from "react";

type Props = {
  busy: boolean;
  source: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function SourceInput({ busy, onChange, onSubmit, source }: Props) {
  return (
    <form className="midheaven-source" onSubmit={onSubmit}>
      <label htmlFor="midheaven-source">Source</label>
      <textarea
        id="midheaven-source"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Add a source…"
        rows={3}
        value={source}
      />
      {source.trim() && (
        <button type="submit" disabled={busy}>
          {busy ? "Forming…" : "Create Money Map"}
        </button>
      )}
    </form>
  );
}
