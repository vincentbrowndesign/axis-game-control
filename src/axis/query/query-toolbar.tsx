"use client";

import { useState, type FormEvent } from "react";

type Props = {
  disabled?: boolean;
  onCamera: () => void;
  onCommand: (raw: string) => string | void | Promise<string | void>;
  onExport: () => string | void | Promise<string | void>;
};

export function AxisQueryToolbar({
  disabled = false,
  onCamera,
  onCommand,
  onExport,
}: Props) {
  const [query, setQuery] = useState("");
  const [confirmation, setConfirmation] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextConfirmation = await onCommand(query);
    setQuery("");
    showConfirmation(nextConfirmation || "Noted");
  }

  async function exportRead() {
    const nextConfirmation = await onExport();
    setQuery("");
    showConfirmation(nextConfirmation || "Exported");
  }

  function showConfirmation(value: string) {
    setConfirmation(value);
    window.setTimeout(() => setConfirmation(""), 1200);
  }

  return (
    <form className="axis-query-toolbar" aria-label="Axis query toolbar" onSubmit={submit}>
      <button className="axis-query-toolbar__small" type="button" onClick={onCamera} aria-label="Flip camera">
        Flip
      </button>
      <div className="axis-query-toolbar__input-wrap">
        <input
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ask Axis about this rep..."
          value={query}
        />
        <button className="axis-query-toolbar__submit" type="submit" aria-label="Submit command">
          Enter
        </button>
        {confirmation && <span className="axis-query-toolbar__toast">{confirmation}</span>}
      </div>
      <button className="axis-query-toolbar__small axis-query-toolbar__export" type="button" disabled={disabled} onClick={exportRead}>
        Export
      </button>
    </form>
  );
}
