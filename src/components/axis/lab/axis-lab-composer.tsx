"use client";

import { useRef, useState } from "react";
import styles from "./axis-lab.module.css";

interface Props {
  onSubmit: (text: string) => void;
}

export default function AxisLabComposer({ onSubmit }: Props) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function resize() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 112)}px`;
  }

  function submit() {
    const text = input.trim();
    if (!text) return;
    onSubmit(text);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
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
      <label className={styles.composerLabel} htmlFor="axis-lab-composer">
        Action
      </label>
      <textarea
        id="axis-lab-composer"
        ref={textareaRef}
        className={styles.composerInput}
        value={input}
        onChange={(event) => {
          setInput(event.target.value);
          resize();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder="Add a local preview note..."
        rows={1}
      />
      <button className={styles.composerSend} type="submit" disabled={!input.trim()}>
        Add
      </button>
      <p id="axis-lab-composer-note" className={styles.composerNote}>
        Preview only. Nothing is saved or sent.
      </p>
    </form>
  );
}
