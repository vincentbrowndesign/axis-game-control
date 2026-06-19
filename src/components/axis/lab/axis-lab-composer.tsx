"use client";

import { useRef, useState } from "react";
import styles from "./axis-lab.module.css";

function MicIcon() {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" fill="none" aria-hidden="true">
      <rect x="4" y="0.65" width="6" height="9" rx="3" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M1 8c0 3.314 2.686 6 6 6s6-2.686 6-6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <line x1="7" y1="14" x2="7" y2="15.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="16" height="13" viewBox="0 0 16 13" fill="none" aria-hidden="true">
      <path
        d="M5.5 1h2l1.2 1.8H15a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5H1a.5.5 0 0 1-.5-.5v-9A.5.5 0 0 1 1 2.8h1.3L3.5 1H5.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="7.4" r="2.4" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function AttachIcon() {
  return (
    <svg width="14" height="15" viewBox="0 0 14 15" fill="none" aria-hidden="true">
      <path
        d="M12.5 6.5L6 13A4.5 4.5 0 0 1 .5 7l5.5-5.5A3 3 0 0 1 10 5.5l-4 4A1.5 1.5 0 0 1 3.88 7.38L7 4.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface Props {
  onSubmit: (text: string) => void;
}

export default function AxisLabComposer({ onSubmit }: Props) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const affordanceNoteId = "composer-preview-note";

  function resize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }

  function handleSubmit() {
    const text = input.trim();
    if (!text) return;
    onSubmit(text);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleWrapperBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setFocused(false);
    }
  }

  return (
    <div
      className={styles.composer}
      onFocus={() => setFocused(true)}
      onBlur={handleWrapperBlur}
    >
      <div className={styles.composerInner}>
        <div className={styles.composerField}>
          <textarea
            ref={textareaRef}
            className={styles.composerInput}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              resize();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Say the rough version…"
            rows={1}
            aria-label="Compose a thought"
          />
          <button
            type="button"
            className={styles.composerSend}
            onClick={handleSubmit}
            disabled={!input.trim()}
            aria-label="Submit thought"
          >
            Send
          </button>
        </div>

        {focused && (
          <div className={styles.composerAffordances}>
            <button
              type="button"
              className={styles.affordanceBtn}
              aria-label="Record audio — preview only, not connected"
              aria-describedby={affordanceNoteId}
            >
              <MicIcon />
            </button>
            <button
              type="button"
              className={styles.affordanceBtn}
              aria-label="Open camera — preview only, not connected"
              aria-describedby={affordanceNoteId}
            >
              <CameraIcon />
            </button>
            <button
              type="button"
              className={styles.affordanceBtn}
              aria-label="Attach file — preview only, not connected"
              aria-describedby={affordanceNoteId}
            >
              <AttachIcon />
            </button>
            <span id={affordanceNoteId} className={styles.affordanceNote}>
              Preview only · not connected
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
