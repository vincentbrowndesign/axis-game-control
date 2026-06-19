"use client";

import { useRef, useState } from "react";
import styles from "./axis-lab.module.css";

type Props = {
  onSubmit: (text: string) => void;
};

export default function AxisComposer({ onSubmit }: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  function submit() {
    const text = value.trim();
    if (!text) return;
    onSubmit(text);
    setValue("");
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      inputRef.current.style.height = "auto";
    });
  }

  return (
    <form
      className={styles.composer}
      aria-describedby="axis-lab-composer-note"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <p id="axis-lab-composer-note" className={styles.composerNote}>
        Preview only. This adds a local mock timeline entry and calls no API.
      </p>
      <textarea
        ref={inputRef}
        value={value}
        rows={1}
        placeholder="Add a local preview note..."
        onChange={(event) => {
          setValue(event.target.value);
          event.currentTarget.style.height = "auto";
          event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <button type="submit" disabled={!value.trim()}>
        Add preview
      </button>
    </form>
  );
}
