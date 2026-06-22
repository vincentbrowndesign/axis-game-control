"use client";

import { useState, type FormEvent } from "react";
import { getAxisRunExecutionState } from "../../lib/axis/client";
import type { AxisCommandValidationResult, AxisLocalAttachment, AxisOutput } from "../../lib/axis/types";

type AxisCommandMode = Extract<AxisOutput["type"], "automation" | "file" | "report" | "text" | "video">;

const commandModes: Array<{ label: string; value: AxisCommandMode }> = [
  { label: "Text", value: "text" },
  { label: "Report", value: "report" },
  { label: "Video", value: "video" },
  { label: "File", value: "file" },
  { label: "Automation", value: "automation" },
];

export function AxisCommandComposer({
  attachment,
  onCreateOutput,
  onRemoveAttachment,
}: {
  attachment?: AxisLocalAttachment | null;
  onCreateOutput: (
    command: string,
    outputType: AxisCommandMode,
    shouldFail: boolean,
  ) => AxisCommandValidationResult;
  onRemoveAttachment?: () => void;
}) {
  const [command, setCommand] = useState("");
  const [selectedMode, setSelectedMode] = useState<AxisCommandMode>("text");
  const [shouldFail, setShouldFail] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const readiness = getReadinessState(command, selectedMode, attachment);
  const runExecutionState = getAxisRunExecutionState();

  function submitCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedCommand = command.trim();
    if (!trimmedCommand) {
      setValidationMessage("Add a command first.");
      return;
    }

    const validationResult = onCreateOutput(trimmedCommand, selectedMode, shouldFail);
    if (!validationResult.ok) {
      setValidationMessage(validationResult.message);
      return;
    }

    setValidationMessage("");
    setCommand("");
    setShouldFail(false);
  }

  return (
    <form className="axis-command-composer" onSubmit={submitCommand}>
      <label htmlFor="axis-command-input">Axis command</label>
      <div className="axis-command-composer__modes" aria-label="Output type">
        {commandModes.map((mode) => (
          <button
            aria-pressed={selectedMode === mode.value}
            key={mode.value}
            onClick={() => {
              setSelectedMode(mode.value);
              setValidationMessage("");
            }}
            type="button"
          >
            {mode.label}
          </button>
        ))}
      </div>
      <div className="axis-command-composer__bar">
        <input
          id="axis-command-input"
          onChange={(event) => {
            setCommand(event.target.value);
            if (validationMessage) setValidationMessage("");
          }}
          placeholder="What do you want Axis to do?"
          value={command}
        />
        <button disabled={!command.trim()} type="submit">
          Send
        </button>
      </div>
      <p className="axis-command-composer__readiness" data-state={readiness.state}>
        {readiness.message}
      </p>
      {validationMessage && <p className="axis-command-composer__error">{validationMessage}</p>}
      {attachment && (
        <div className="axis-command-composer__attachment" aria-label="Local media attachment">
          <div>
            <span>Attached</span>
            <strong>{attachment.name}</strong>
            <small>
              {formatAttachmentType(attachment.type)} - {attachment.size ? formatAttachmentSize(attachment.size) : "Ready for preview"}
            </small>
          </div>
          {onRemoveAttachment && (
            <button onClick={onRemoveAttachment} type="button">
              Remove
            </button>
          )}
        </div>
      )}
      <div className="axis-command-composer__footer">
        <p>
          {runExecutionState.label}. Target: {runExecutionState.targetRoute}. {runExecutionState.message}
        </p>
        <label>
          <input
            checked={shouldFail}
            onChange={(event) => setShouldFail(event.target.checked)}
            type="checkbox"
          />
          Simulate fail
        </label>
      </div>

      <style>{`
        .axis-command-composer,
        .axis-command-composer * {
          box-sizing: border-box;
        }

        .axis-command-composer {
          bottom: max(1rem, env(safe-area-inset-bottom));
          display: grid;
          gap: 0.45rem;
          left: 50%;
          position: fixed;
          transform: translateX(-50%);
          width: min(38rem, calc(100vw - 2rem));
          z-index: 2;
        }

        .axis-command-composer label {
          color: rgba(244, 241, 234, 0.54);
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .axis-command-composer__modes {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }

        .axis-command-composer__modes button {
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          color: rgba(244, 241, 234, 0.68);
          cursor: pointer;
          font: inherit;
          font-size: 0.74rem;
          min-height: 1.9rem;
          padding: 0 0.7rem;
        }

        .axis-command-composer__modes button[aria-pressed="true"] {
          border-color: rgba(141, 66, 255, 0.62);
          color: #f4f1ea;
        }

        .axis-command-composer__bar {
          align-items: center;
          background: rgba(12, 14, 20, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 999px;
          box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.32);
          display: flex;
          gap: 0.5rem;
          padding: 0.35rem;
        }

        .axis-command-composer input {
          background: transparent;
          border: 0;
          color: #f4f1ea;
          flex: 1;
          font: inherit;
          min-height: 2.65rem;
          min-width: 0;
          outline: none;
          padding: 0 0.85rem;
        }

        .axis-command-composer input::placeholder {
          color: rgba(244, 241, 234, 0.42);
        }

        .axis-command-composer__bar button {
          background: #8d42ff;
          border: 1px solid rgba(141, 66, 255, 0.7);
          border-radius: 999px;
          color: #f4f1ea;
          cursor: pointer;
          font: inherit;
          min-height: 2.65rem;
          padding: 0 1rem;
        }

        .axis-command-composer__bar button:disabled {
          cursor: default;
          opacity: 0.45;
        }

        .axis-command-composer__footer {
          align-items: center;
          display: flex;
          gap: 0.75rem;
          justify-content: space-between;
          margin-left: 0.5rem;
        }

        .axis-command-composer__attachment {
          align-items: center;
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(141, 66, 255, 0.22);
          border-radius: 0.85rem;
          display: flex;
          gap: 0.75rem;
          justify-content: space-between;
          margin: 0 0.5rem;
          min-width: 0;
          padding: 0.55rem 0.65rem;
        }

        .axis-command-composer__attachment div {
          display: grid;
          gap: 0.12rem;
          min-width: 0;
        }

        .axis-command-composer__attachment span,
        .axis-command-composer__attachment small {
          color: rgba(244, 241, 234, 0.48);
          font-size: 0.66rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .axis-command-composer__attachment strong {
          color: rgba(244, 241, 234, 0.82);
          font-size: 0.78rem;
          font-weight: 650;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .axis-command-composer__attachment small {
          color: rgba(244, 241, 234, 0.5);
          letter-spacing: 0.06em;
        }

        .axis-command-composer__attachment button {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 999px;
          color: rgba(244, 241, 234, 0.74);
          cursor: pointer;
          flex: none;
          font: inherit;
          font-size: 0.72rem;
          min-height: 1.85rem;
          padding: 0 0.62rem;
        }

        .axis-command-composer__attachment button:hover,
        .axis-command-composer__attachment button:focus-visible {
          border-color: rgba(141, 66, 255, 0.56);
          outline: none;
        }

        .axis-command-composer p,
        .axis-command-composer__readiness,
        .axis-command-composer__error,
        .axis-command-composer__footer label {
          color: rgba(244, 241, 234, 0.42);
          font-size: 0.74rem;
          margin: 0;
        }

        .axis-command-composer__readiness {
          margin-left: 0.5rem;
        }

        .axis-command-composer__readiness[data-state="ready"] {
          color: rgba(121, 226, 145, 0.72);
        }

        .axis-command-composer__readiness[data-state="waiting"] {
          color: rgba(244, 241, 234, 0.48);
        }

        .axis-command-composer__readiness[data-state="blocked"] {
          color: #ffb4a8;
        }

        .axis-command-composer__error {
          color: #ffb4a8;
          margin-left: 0.5rem;
        }

        .axis-command-composer__footer label {
          align-items: center;
          cursor: pointer;
          display: inline-flex;
          gap: 0.35rem;
          white-space: nowrap;
        }

        .axis-command-composer__footer input {
          accent-color: #8d42ff;
          flex: none;
          min-height: auto;
          padding: 0;
          width: auto;
        }

        @media (max-width: 720px) {
          .axis-command-composer {
            bottom: max(1rem, env(safe-area-inset-bottom));
          }

          .axis-command-composer__attachment {
            align-items: stretch;
            flex-direction: column;
            gap: 0.5rem;
          }

          .axis-command-composer__attachment button {
            align-self: start;
          }

          .axis-command-composer__footer {
            display: none;
          }
        }
      `}</style>
    </form>
  );
}

function formatAttachmentType(type: AxisLocalAttachment["type"]) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatAttachmentSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getReadinessState(
  command: string,
  selectedMode: AxisCommandMode,
  attachment?: AxisLocalAttachment | null,
) {
  const trimmedCommand = command.trim();
  const needsAttachment = selectedMode === "video" || selectedMode === "file";

  if (needsAttachment && !attachment) {
    return {
      message: `Attach media to preview ${formatOutputMode(selectedMode)}.`,
      state: "blocked" as const,
    };
  }

  if (!trimmedCommand) {
    return {
      message: needsAttachment ? "Media is ready. Add a command." : "Add a command to create a local preview.",
      state: "waiting" as const,
    };
  }

  return {
    message: `Ready for ${formatOutputMode(selectedMode)} preview. No backend run yet.`,
    state: "ready" as const,
  };
}

function formatOutputMode(mode: AxisCommandMode) {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}
