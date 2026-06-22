"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { AXIS_RUN_TARGET_ROUTE, AXIS_UI_V2_ENABLED } from "../../lib/axis/client";
import type {
  AxisAsk,
  AxisChatMessage,
  AxisCommandValidationResult,
  AxisLocalAttachment,
  AxisMediaSource,
  AxisOutput,
  AxisRunRequestPreview,
  AxisSession,
} from "../../lib/axis/types";
import { AxisCommandComposer } from "./AxisCommandComposer";
import { AxisOutputSurface } from "./AxisOutputSurface";
import { AxisSidebar } from "./AxisSidebar";
import { AxisStatus } from "./AxisStatus";

type SessionType = AxisSession["sessionType"];
type LocalMemoryStatus = "loading" | "ready" | "saved" | "unavailable";

type AxisLocalMemorySnapshot = {
  activeSession: AxisSession | null;
  latestAsk: AxisAsk | null;
  askMessages: AxisChatMessage[];
  latestMediaSource: AxisMediaSource | null;
};

const AXIS_LOCAL_MEMORY_KEY = "axis-ui-v2-local-memory";

const sessionTypes: Array<{ label: string; value: SessionType }> = [
  { label: "Training", value: "training" },
  { label: "Game", value: "game" },
  { label: "Film", value: "film" },
  { label: "Practice", value: "practice" },
  { label: "Other", value: "other" },
];

const localRunOutputTypes: AxisOutput["type"][] = ["automation", "file", "report", "text", "video"];
const maxLocalCommandLength = 240;

export function AxisShell() {
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isAskingAxis, setIsAskingAxis] = useState(false);
  const [isViewingSessionDetail, setIsViewingSessionDetail] = useState(false);
  const [isViewingPlayerProfile, setIsViewingPlayerProfile] = useState(false);
  const [isViewingReportPreview, setIsViewingReportPreview] = useState(false);
  const [activeSession, setActiveSession] = useState<AxisSession | null>(null);
  const [localFailedOutputIds, setLocalFailedOutputIds] = useState<string[]>([]);
  const [localPendingOutputs, setLocalPendingOutputs] = useState<AxisOutput[]>([]);
  const [latestRunPreview, setLatestRunPreview] = useState<AxisRunRequestPreview | null>(null);
  const [runPreviewHistory, setRunPreviewHistory] = useState<AxisRunRequestPreview[]>([]);
  const [latestAsk, setLatestAsk] = useState<AxisAsk | null>(null);
  const [askMessages, setAskMessages] = useState<AxisChatMessage[]>([]);
  const [latestMediaSource, setLatestMediaSource] = useState<AxisMediaSource | null>(null);
  const [title, setTitle] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [sessionType, setSessionType] = useState<SessionType>("training");
  const [askContent, setAskContent] = useState("");
  const [reportActionNotice, setReportActionNotice] = useState("");
  const [followUpNotice, setFollowUpNotice] = useState("");
  const [hasHydratedLocalMemory, setHasHydratedLocalMemory] = useState(false);
  const [localMemoryStatus, setLocalMemoryStatus] = useState<LocalMemoryStatus>("loading");

  useEffect(() => {
    try {
      const rawSnapshot = window.localStorage.getItem(AXIS_LOCAL_MEMORY_KEY);
      if (rawSnapshot) {
        const snapshot = JSON.parse(rawSnapshot) as Partial<AxisLocalMemorySnapshot>;
        setActiveSession(snapshot.activeSession ?? null);
        setLatestAsk(snapshot.latestAsk ?? null);
        setAskMessages(Array.isArray(snapshot.askMessages) ? snapshot.askMessages : []);
        setLatestMediaSource(snapshot.latestMediaSource ?? null);
      }
      setLocalMemoryStatus("ready");
    } catch {
      setLocalMemoryStatus("unavailable");
    } finally {
      setHasHydratedLocalMemory(true);
    }
  }, []);

  useEffect(() => {
    if (!hasHydratedLocalMemory || localMemoryStatus === "unavailable") return;

    try {
      const snapshot: AxisLocalMemorySnapshot = {
        activeSession,
        latestAsk,
        askMessages,
        latestMediaSource,
      };
      window.localStorage.setItem(AXIS_LOCAL_MEMORY_KEY, JSON.stringify(snapshot));
      setLocalMemoryStatus("saved");
    } catch {
      setLocalMemoryStatus("unavailable");
    }
  }, [activeSession, askMessages, hasHydratedLocalMemory, latestAsk, latestMediaSource, localMemoryStatus]);

  useEffect(() => {
    const processingOutputIds = localPendingOutputs
      .filter((output) => output.status === "processing")
      .map((output) => output.id);

    if (processingOutputIds.length === 0) return;

    const timer = window.setTimeout(() => {
      setLocalPendingOutputs((outputs) =>
        outputs.map((output) =>
          processingOutputIds.includes(output.id)
            ? {
                ...output,
                status: localFailedOutputIds.includes(output.id) ? "failed" : "ready",
                summary: localFailedOutputIds.includes(output.id)
                  ? `${formatOutputType(output.type)} output failed locally for preview. No backend run was called.`
                  : `${formatOutputType(output.type)} output preview is ready locally. No backend run was called.`,
              }
            : output,
        ),
      );
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [localFailedOutputIds, localPendingOutputs]);

  function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const nextSession: AxisSession = {
      id: createLocalId(),
      title: trimmedTitle,
      playerName: playerName.trim() || undefined,
      sessionType,
      status: "draft",
      createdAt: new Date().toISOString(),
    };

    setActiveSession(nextSession);
    setIsViewingSessionDetail(true);
    setIsCreatingSession(false);
  }

  function createAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedAsk = askContent.trim();
    if (!trimmedAsk) return;

    const nextAsk = {
      id: createLocalId(),
      content: trimmedAsk,
      createdAt: new Date().toISOString(),
      sessionId: activeSession?.id,
      status: "draft" as const,
    };

    setLatestAsk(nextAsk);
    setAskMessages((messages) => [
      ...messages,
      {
        ...nextAsk,
        role: "user",
        status: "local",
      },
    ]);
    setAskContent("");
  }

  function createMediaSource(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLatestMediaSource({
      id: createLocalId(),
      fileName: file.name,
      fileType: file.type || "unknown",
      mediaType: inferMediaType(file.type, file.name),
      sizeBytes: file.size,
      status: "local",
      createdAt: new Date().toISOString(),
      sessionId: activeSession?.id,
    });

    event.target.value = "";
  }

  function createPendingOutput(
    command: string,
    outputType: AxisOutput["type"],
    shouldFail: boolean,
  ): AxisCommandValidationResult {
    const validationResult = validateLocalRunCommand(command, outputType, latestMediaSource);
    if (!validationResult.ok) return validationResult;
    if (hasDuplicateProcessingOutput(localPendingOutputs, command, outputType)) {
      return { message: "That preview is already running locally.", ok: false };
    }

    const outputId = createLocalId("axis-output");
    const createdAt = new Date().toISOString();
    const attachmentSnapshot = latestMediaSource ? createLocalAttachment(latestMediaSource) : undefined;
    const nextOutput: AxisOutput = {
      id: outputId,
      title: command,
      type: outputType,
      status: "processing",
      createdAt,
      localAttachment: attachmentSnapshot,
      summary: shouldFail
        ? `${formatOutputType(outputType)} output drafted locally with failed-state simulation.`
        : `${formatOutputType(outputType)} output drafted locally. Axis run wiring is not active yet.`,
      sourceLabel: formatOutputType(outputType),
    };
    const nextRunPreview: AxisRunRequestPreview = {
      id: createLocalId("axis-run-preview"),
      inputText: command,
      selectedOutputType: outputType,
      targetRoute: AXIS_RUN_TARGET_ROUTE,
      createdAt,
      status: "local_preview",
      sessionId: activeSession?.id,
      mediaSourceId: latestMediaSource?.id,
      localAttachment: attachmentSnapshot,
      expectedOutputId: outputId,
    };

    if (shouldFail) {
      setLocalFailedOutputIds((outputIds) => [outputId, ...outputIds].slice(0, 8));
    }
    setLatestRunPreview(nextRunPreview);
    setRunPreviewHistory((previews) => [nextRunPreview, ...previews].slice(0, 5));
    setLocalPendingOutputs((outputs) => [nextOutput, ...outputs].slice(0, 4));
    return { ok: true };
  }

  function retryLocalOutput(outputId: string) {
    const outputToRetry = localPendingOutputs.find((output) => output.id === outputId && output.status === "failed");
    if (!outputToRetry) return;

    const previousPreview = runPreviewHistory.find((preview) => preview.expectedOutputId === outputId);
    const retryPreview: AxisRunRequestPreview = {
      id: createLocalId("axis-run-preview"),
      inputText: outputToRetry.title,
      selectedOutputType: outputToRetry.type,
      targetRoute: AXIS_RUN_TARGET_ROUTE,
      createdAt: new Date().toISOString(),
      status: "local_preview",
      sessionId: previousPreview?.sessionId,
      mediaSourceId: previousPreview?.mediaSourceId,
      localAttachment: outputToRetry.localAttachment,
      expectedOutputId: outputId,
    };

    setLocalFailedOutputIds((outputIds) => outputIds.filter((id) => id !== outputId));
    setLatestRunPreview(retryPreview);
    setRunPreviewHistory((previews) => [retryPreview, ...previews].slice(0, 5));
    setLocalPendingOutputs((outputs) =>
      outputs.map((output) =>
        output.id === outputId && output.status === "failed"
          ? {
              ...output,
              status: "processing",
              summary: `${formatOutputType(output.type)} output retry is running locally. No backend run was called.`,
            }
          : output,
      ),
    );
  }

  function clearLocalOutputs() {
    setLocalFailedOutputIds([]);
    setLocalPendingOutputs([]);
    setLatestRunPreview(null);
    setRunPreviewHistory([]);
  }

  function removeLocalAttachment() {
    setLatestMediaSource(null);
  }

  const localAttachment = latestMediaSource ? createLocalAttachment(latestMediaSource) : null;

  return (
    <main className="axis-blank" data-axis-ui-v2={AXIS_UI_V2_ENABLED ? "true" : "false"}>
      <AxisSidebar />
      <AxisStatus
        activeOutput={localPendingOutputs[0]}
        runPreview={latestRunPreview}
        runPreviewHistory={runPreviewHistory}
      />
      <AxisOutputSurface
        localRunPreviews={runPreviewHistory}
        localOutputs={localPendingOutputs}
        onClearLocalOutputs={clearLocalOutputs}
        onRetryOutput={retryLocalOutput}
        retryableOutputIds={localPendingOutputs
          .filter((output) => output.status === "failed")
          .map((output) => output.id)}
      />
      <AxisCommandComposer
        attachment={localAttachment}
        onCreateOutput={createPendingOutput}
        onRemoveAttachment={removeLocalAttachment}
      />
      <section className="axis-blank__identity" aria-label="Axis entry">
        <h1>AXIS <span>9</span></h1>
        <div className="axis-blank__actions">
          <button type="button" onClick={() => setIsCreatingSession(true)}>
            New Session
          </button>
          <button type="button" onClick={() => setIsAskingAxis(true)}>
            Ask Axis
          </button>
          <label className="axis-upload-trigger">
            Upload Media
            <input
              accept="audio/*,image/*,video/*,.pdf,.txt,.doc,.docx"
              onChange={createMediaSource}
              type="file"
            />
          </label>
          <Link href="/axis/build-map">Open Build Map</Link>
        </div>
      </section>

      {isCreatingSession && (
        <section className="axis-session-panel" aria-labelledby="axis-new-session-title">
          <div className="axis-session-panel__header">
            <div>
              <p>Local draft</p>
              <h2 id="axis-new-session-title">New Session</h2>
            </div>
            <button type="button" onClick={() => setIsCreatingSession(false)}>
              Close
            </button>
          </div>
          <form onSubmit={createSession}>
            <label>
              Session title
              <input
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Handles under pressure"
              />
            </label>
            <label>
              Player name <span>optional</span>
              <input
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder="Hailey Johnson"
              />
            </label>
            <label>
              Session type
              <select value={sessionType} onChange={(event) => setSessionType(event.target.value as SessionType)}>
                {sessionTypes.map((type) => (
                  <option value={type.value} key={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={!title.trim()}>
              Create Draft Session
            </button>
          </form>
        </section>
      )}

      {isAskingAxis && (
        <section className="axis-session-panel axis-ask-panel" aria-labelledby="axis-ask-title">
          <div className="axis-session-panel__header">
            <div>
              <p>Local chat</p>
              <h2 id="axis-ask-title">Ask Axis</h2>
            </div>
            <button type="button" onClick={() => setIsAskingAxis(false)}>
              Close
            </button>
          </div>
          <div className="axis-ask-chat" aria-label="Local Ask Axis messages">
            {askMessages.length > 0 ? (
              askMessages.map((message) => (
                <article className="axis-ask-chat__message" key={message.id}>
                  <div>
                    <strong>You</strong>
                    <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                  </div>
                  <p>{message.content}</p>
                </article>
              ))
            ) : (
              <p className="axis-ask-chat__empty">Ask Axis drafts will collect here before real agent wiring.</p>
            )}
          </div>
          <form onSubmit={createAsk}>
            <label>
              Question or note
              <textarea
                autoFocus
                value={askContent}
                onChange={(event) => setAskContent(event.target.value)}
                placeholder="What happened at 0:18?"
                rows={4}
              />
            </label>
            <button type="submit" disabled={!askContent.trim()}>
              Add Message
            </button>
          </form>
        </section>
      )}

      {activeSession && (
        <section className="axis-active-session" aria-label="Current active session">
          <p>Current Session</p>
          <h2>{activeSession.title}</h2>
          <dl>
            <div>
              <dt>Status</dt>
              <dd>{activeSession.status}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{formatSessionType(activeSession.sessionType)}</dd>
            </div>
            {activeSession.playerName && (
              <div>
                <dt>Player</dt>
                <dd>{activeSession.playerName}</dd>
              </div>
            )}
          </dl>
          <span className="axis-active-session__memory">{formatLocalMemoryStatus(localMemoryStatus)}</span>
          <button className="axis-active-session__detail" type="button" onClick={() => setIsViewingSessionDetail(true)}>
            View Session Detail
          </button>
          {activeSession.playerName && (
            <button className="axis-active-session__detail" type="button" onClick={() => setIsViewingPlayerProfile(true)}>
              View Player Profile
            </button>
          )}
          <button className="axis-active-session__detail" type="button" onClick={() => setIsViewingReportPreview(true)}>
            View Report Draft
          </button>
          <button
            className="axis-active-session__detail"
            type="button"
            onClick={() => setFollowUpNotice("Follow-up automation staged locally. No message or reminder was sent.")}
          >
            Stage Follow-Up
          </button>
          {followUpNotice && <span className="axis-active-session__memory">{followUpNotice}</span>}
        </section>
      )}

      {activeSession && isViewingSessionDetail && (
        <section className="axis-session-detail" aria-labelledby="axis-session-detail-title">
          <div className="axis-session-panel__header">
            <div>
              <p>Session Detail</p>
              <h2 id="axis-session-detail-title">{activeSession.title}</h2>
            </div>
            <button type="button" onClick={() => setIsViewingSessionDetail(false)}>
              Close
            </button>
          </div>

          <dl className="axis-session-detail__facts">
            <div>
              <dt>Status</dt>
              <dd>{activeSession.status}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{formatSessionType(activeSession.sessionType)}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatTime(activeSession.createdAt)}</dd>
            </div>
            {activeSession.playerName && (
              <div>
                <dt>Player</dt>
                <dd>{activeSession.playerName}</dd>
              </div>
            )}
          </dl>

          <div className="axis-session-detail__section">
            <h3>Local intake</h3>
            {latestMediaSource ? (
              <ul>
                <li>{latestMediaSource.fileName}</li>
                <li>{formatMediaType(latestMediaSource.mediaType)} - {formatBytes(latestMediaSource.sizeBytes)}</li>
                <li>Local metadata only</li>
              </ul>
            ) : (
              <p>No media draft attached yet.</p>
            )}
          </div>

          <div className="axis-session-detail__section">
            <h3>Latest ask</h3>
            {latestAsk ? <p>{latestAsk.content}</p> : <p>No Ask Axis draft yet.</p>}
          </div>
        </section>
      )}

      {activeSession?.playerName && isViewingPlayerProfile && (
        <section className="axis-player-profile" aria-labelledby="axis-player-profile-title">
          <div className="axis-session-panel__header">
            <div>
              <p>Player Profile</p>
              <h2 id="axis-player-profile-title">{activeSession.playerName}</h2>
            </div>
            <button type="button" onClick={() => setIsViewingPlayerProfile(false)}>
              Close
            </button>
          </div>

          <dl className="axis-session-detail__facts">
            <div>
              <dt>Status</dt>
              <dd>draft</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>current session</dd>
            </div>
            <div>
              <dt>Session</dt>
              <dd>{activeSession.title}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{formatSessionType(activeSession.sessionType)}</dd>
            </div>
          </dl>

          <div className="axis-session-detail__section">
            <h3>Current notes</h3>
            {latestAsk ? <p>{latestAsk.content}</p> : <p>No Ask Axis draft attached yet.</p>}
          </div>

          <div className="axis-session-detail__section">
            <h3>Local boundary</h3>
            <ul>
              <li>Profile preview only</li>
              <li>No saved player memory</li>
              <li>No verified stats or cross-session history</li>
            </ul>
          </div>
        </section>
      )}

      {activeSession && isViewingReportPreview && (
        <section className="axis-report-preview" aria-labelledby="axis-report-preview-title">
          <div className="axis-session-panel__header">
            <div>
              <p>Report Draft</p>
              <h2 id="axis-report-preview-title">{activeSession.title}</h2>
            </div>
            <button type="button" onClick={() => setIsViewingReportPreview(false)}>
              Close
            </button>
          </div>

          <dl className="axis-session-detail__facts">
            <div>
              <dt>Status</dt>
              <dd>draft</dd>
            </div>
            <div>
              <dt>Audience</dt>
              <dd>not selected</dd>
            </div>
            <div>
              <dt>Session</dt>
              <dd>{formatSessionType(activeSession.sessionType)}</dd>
            </div>
            <div>
              <dt>Player</dt>
              <dd>{activeSession.playerName || "not assigned"}</dd>
            </div>
          </dl>

          <div className="axis-session-detail__section">
            <h3>Draft inputs</h3>
            <ul>
              <li>{latestAsk ? `Latest note: ${latestAsk.content}` : "No Ask Axis note yet"}</li>
              <li>{latestMediaSource ? `Local source: ${latestMediaSource.fileName}` : "No media source attached"}</li>
              <li>Session metadata only</li>
            </ul>
          </div>

          <div className="axis-session-detail__section">
            <h3>Report boundary</h3>
            <ul>
              <li>No generated claims yet</li>
              <li>No verified evidence yet</li>
              <li>Export and send are local drafts only</li>
            </ul>
          </div>

          <div className="axis-report-preview__actions" aria-label="Local report actions">
            <button type="button" onClick={() => setReportActionNotice("Export draft staged locally. No PDF was generated.")}>
              Stage Export Draft
            </button>
            <button type="button" onClick={() => setReportActionNotice("Send draft staged locally. Nothing was sent.")}>
              Stage Send Draft
            </button>
            <button
              type="button"
              onClick={() => setReportActionNotice("Follow-up draft staged locally. No automation was scheduled.")}
            >
              Stage Follow-Up
            </button>
          </div>
          {reportActionNotice && <p className="axis-report-preview__notice">{reportActionNotice}</p>}
        </section>
      )}

      {(latestAsk || latestMediaSource) && (
        <div className="axis-local-stack">
          {latestAsk && (
            <section className="axis-local-ask" aria-label="Latest Ask Axis draft">
              <p>Ask Axis Draft</p>
              <blockquote>{latestAsk.content}</blockquote>
              <span>{activeSession ? "Attached to current draft session" : "Not attached to a session"}</span>
            </section>
          )}

          {latestMediaSource && (
            <section className="axis-local-media" aria-label="Latest media intake draft">
              <p>Media Intake Draft</p>
              <h2>{latestMediaSource.fileName}</h2>
              <dl>
                <div>
                  <dt>Type</dt>
                  <dd>{formatMediaType(latestMediaSource.mediaType)}</dd>
                </div>
                <div>
                  <dt>Size</dt>
                  <dd>{formatBytes(latestMediaSource.sizeBytes)}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>local only</dd>
                </div>
              </dl>
              <span>{activeSession ? "Attached to current draft session" : "Not attached to a session"}</span>
            </section>
          )}
        </div>
      )}

      <style>{`
        :root {
          color-scheme: dark;
        }

        html,
        body {
          margin: 0;
          min-height: 100%;
          overflow-x: hidden;
        }

        .axis-blank,
        .axis-blank * {
          box-sizing: border-box;
        }

        .axis-blank {
          align-items: center;
          background: #050608;
          color: #f4f1ea;
          display: flex;
          font-family:
            Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          justify-content: center;
          min-height: 100dvh;
          padding: 1rem;
          position: relative;
          width: 100%;
        }

        .axis-blank__identity {
          display: grid;
          gap: 1rem;
          justify-items: center;
        }

        .axis-blank h1 {
          font-size: clamp(1.8rem, 5vw, 3.5rem);
          font-weight: 850;
          letter-spacing: -0.04em;
          margin: 0;
        }

        .axis-blank h1 span {
          color: #8d42ff;
        }

        .axis-blank__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.7rem;
          justify-content: center;
        }

        .axis-blank a,
        .axis-blank button,
        .axis-upload-trigger {
          border-radius: 999px;
          color: #f4f1ea;
          font: inherit;
          font-size: 0.88rem;
          min-height: 2.65rem;
          padding: 0 1rem;
          text-decoration: none;
        }

        .axis-blank a,
        .axis-upload-trigger {
          align-items: center;
          border: 1px solid rgba(141, 66, 255, 0.55);
          cursor: pointer;
          display: inline-flex;
        }

        .axis-upload-trigger input {
          height: 1px;
          opacity: 0;
          pointer-events: none;
          position: absolute;
          width: 1px;
        }

        .axis-blank button {
          background: #8d42ff;
          border: 1px solid rgba(141, 66, 255, 0.7);
          cursor: pointer;
        }

        .axis-blank button:disabled {
          cursor: default;
          opacity: 0.45;
        }

        .axis-session-panel,
        .axis-active-session,
        .axis-session-detail,
        .axis-player-profile,
        .axis-report-preview,
        .axis-local-ask,
        .axis-local-media {
          background: rgba(12, 14, 20, 0.94);
          border: 1px solid rgba(255, 255, 255, 0.13);
          border-radius: 1rem;
          box-shadow: 0 1.2rem 4rem rgba(0, 0, 0, 0.32);
          width: min(24rem, calc(100vw - 2rem));
        }

        .axis-session-panel,
        .axis-active-session,
        .axis-session-detail,
        .axis-player-profile,
        .axis-report-preview {
          position: fixed;
        }

        .axis-session-panel {
          display: grid;
          gap: 1rem;
          padding: 1rem;
          right: max(1rem, env(safe-area-inset-right));
          top: max(1rem, env(safe-area-inset-top));
        }

        .axis-session-panel__header {
          align-items: start;
          display: flex;
          gap: 1rem;
          justify-content: space-between;
        }

        .axis-session-panel__header p,
        .axis-active-session p {
          color: rgba(244, 241, 234, 0.52);
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          margin: 0 0 0.3rem;
          text-transform: uppercase;
        }

        .axis-session-panel h2,
        .axis-active-session h2 {
          font-size: 1.05rem;
          margin: 0;
        }

        .axis-session-panel__header button {
          background: transparent;
          border-color: rgba(255, 255, 255, 0.16);
          min-height: 2rem;
          padding: 0 0.75rem;
        }

        .axis-session-panel form {
          display: grid;
          gap: 0.85rem;
        }

        .axis-ask-chat {
          display: grid;
          gap: 0.65rem;
          max-height: 13rem;
          overflow-y: auto;
          padding-right: 0.2rem;
        }

        .axis-ask-chat__message {
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 0.75rem;
          padding: 0.7rem;
        }

        .axis-ask-chat__message div {
          align-items: center;
          display: flex;
          gap: 0.5rem;
          justify-content: space-between;
        }

        .axis-ask-chat__message strong,
        .axis-ask-chat__message time,
        .axis-ask-chat__empty {
          color: rgba(244, 241, 234, 0.52);
          font-size: 0.74rem;
        }

        .axis-ask-chat__message p,
        .axis-ask-chat__empty {
          line-height: 1.38;
          margin: 0;
        }

        .axis-ask-chat__message p {
          color: #f4f1ea;
          font-size: 0.88rem;
          margin-top: 0.45rem;
        }

        .axis-session-panel label {
          color: rgba(244, 241, 234, 0.72);
          display: grid;
          font-size: 0.82rem;
          gap: 0.35rem;
        }

        .axis-session-panel label span {
          color: rgba(244, 241, 234, 0.42);
        }

        .axis-session-panel input,
        .axis-session-panel select,
        .axis-session-panel textarea {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 0.7rem;
          color: #f4f1ea;
          font: inherit;
          padding: 0 0.75rem;
        }

        .axis-session-panel input,
        .axis-session-panel select {
          min-height: 2.65rem;
        }

        .axis-session-panel textarea {
          line-height: 1.4;
          padding-bottom: 0.7rem;
          padding-top: 0.7rem;
          resize: vertical;
        }

        .axis-session-panel option {
          background: #101219;
          color: #f4f1ea;
        }

        .axis-session-panel form > button {
          border-radius: 0.8rem;
          margin-top: 0.2rem;
        }

        .axis-session-detail,
        .axis-player-profile,
        .axis-report-preview {
          display: grid;
          gap: 1rem;
          left: 50%;
          padding: 1rem;
          top: max(1rem, env(safe-area-inset-top));
          transform: translateX(-50%);
          width: min(34rem, calc(100vw - 2rem));
          z-index: 3;
        }

        .axis-session-detail__facts {
          display: grid;
          gap: 0.6rem;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin: 0;
        }

        .axis-session-detail__facts div,
        .axis-session-detail__section {
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 0.75rem;
          padding: 0.75rem;
        }

        .axis-session-detail dt,
        .axis-session-detail dd {
          margin: 0;
        }

        .axis-session-detail dt,
        .axis-session-detail h3 {
          color: rgba(244, 241, 234, 0.52);
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          margin: 0 0 0.35rem;
          text-transform: uppercase;
        }

        .axis-session-detail dd,
        .axis-session-detail li,
        .axis-session-detail__section p {
          color: rgba(244, 241, 234, 0.78);
          font-size: 0.86rem;
          line-height: 1.38;
        }

        .axis-session-detail dd {
          color: #f4f1ea;
          text-transform: capitalize;
        }

        .axis-session-detail ul {
          display: grid;
          gap: 0.35rem;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .axis-session-detail li::before {
          color: #8d42ff;
          content: "- ";
        }

        .axis-session-detail__section p {
          margin: 0;
        }

        .axis-report-preview__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.6rem;
        }

        .axis-report-preview__actions button {
          background: transparent;
          border-color: rgba(255, 255, 255, 0.16);
        }

        .axis-report-preview__notice {
          color: rgba(244, 241, 234, 0.62);
          font-size: 0.82rem;
          line-height: 1.35;
          margin: -0.2rem 0 0;
        }

        .axis-active-session {
          bottom: max(1rem, env(safe-area-inset-bottom));
          left: max(1rem, env(safe-area-inset-left));
          padding: 1rem;
        }

        .axis-active-session__detail {
          background: transparent;
          border-color: rgba(255, 255, 255, 0.16);
          margin-top: 0.85rem;
          width: 100%;
        }

        .axis-active-session__memory {
          color: rgba(244, 241, 234, 0.48);
          display: block;
          font-size: 0.76rem;
          margin-top: 0.8rem;
        }

        .axis-local-stack {
          bottom: max(1rem, env(safe-area-inset-bottom));
          display: grid;
          gap: 0.75rem;
          position: fixed;
          right: max(1rem, env(safe-area-inset-right));
          width: min(24rem, calc(100vw - 2rem));
        }

        .axis-local-ask,
        .axis-local-media {
          padding: 1rem;
          width: 100%;
        }

        .axis-active-session dl {
          display: grid;
          gap: 0.55rem;
          margin: 0.9rem 0 0;
        }

        .axis-active-session dl div {
          display: flex;
          justify-content: space-between;
        }

        .axis-active-session dt,
        .axis-active-session dd {
          color: rgba(244, 241, 234, 0.66);
          font-size: 0.84rem;
          margin: 0;
        }

        .axis-active-session dd {
          color: #f4f1ea;
          text-transform: capitalize;
        }

        .axis-local-ask p,
        .axis-local-media p {
          color: rgba(244, 241, 234, 0.52);
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          margin: 0 0 0.55rem;
          text-transform: uppercase;
        }

        .axis-local-media h2 {
          font-size: 0.95rem;
          line-height: 1.2;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .axis-local-media dl {
          display: grid;
          gap: 0.45rem;
          margin: 0.75rem 0 0;
        }

        .axis-local-media dl div {
          display: flex;
          justify-content: space-between;
        }

        .axis-local-media dt,
        .axis-local-media dd {
          color: rgba(244, 241, 234, 0.62);
          font-size: 0.8rem;
          margin: 0;
        }

        .axis-local-media dd {
          color: #f4f1ea;
        }

        .axis-local-ask blockquote {
          color: #f4f1ea;
          font-size: 0.95rem;
          line-height: 1.35;
          margin: 0;
        }

        .axis-local-ask span,
        .axis-local-media span {
          color: rgba(244, 241, 234, 0.48);
          display: block;
          font-size: 0.78rem;
          margin-top: 0.7rem;
        }

        @media (max-width: 720px) {
          .axis-blank {
            align-items: start;
            padding-top: 28dvh;
          }

          .axis-session-panel,
          .axis-active-session,
          .axis-session-detail,
          .axis-player-profile,
          .axis-report-preview,
          .axis-local-stack {
            left: 1rem;
            right: 1rem;
            transform: none;
            width: auto;
          }

          .axis-session-detail,
          .axis-player-profile,
          .axis-report-preview {
            max-height: calc(100dvh - 2rem);
            overflow-y: auto;
          }

          .axis-active-session {
            bottom: calc(8.5rem + env(safe-area-inset-bottom));
          }

          .axis-local-stack {
            bottom: 1rem;
          }
        }
      `}</style>
    </main>
  );
}

function createLocalId(prefix = "axis-session") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}`;
}

function validateLocalRunCommand(
  command: string,
  outputType: AxisOutput["type"],
  mediaSource: AxisMediaSource | null,
): AxisCommandValidationResult {
  if (!command.trim()) {
    return { message: "Add a command first.", ok: false };
  }

  if (command.length > maxLocalCommandLength) {
    return { message: `Keep this preview under ${maxLocalCommandLength} characters for now.`, ok: false };
  }

  if (!localRunOutputTypes.includes(outputType)) {
    return { message: "That output type is not available in the local preview yet.", ok: false };
  }

  if ((outputType === "file" || outputType === "video") && !mediaSource) {
    return { message: `Attach media before drafting a ${formatOutputType(outputType)} run preview.`, ok: false };
  }

  return { ok: true };
}

function hasDuplicateProcessingOutput(
  outputs: AxisOutput[],
  command: string,
  outputType: AxisOutput["type"],
) {
  const normalizedCommand = normalizeLocalCommand(command);
  return outputs.some(
    (output) =>
      output.status === "processing" &&
      output.type === outputType &&
      normalizeLocalCommand(output.title) === normalizedCommand,
  );
}

function normalizeLocalCommand(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function createLocalAttachment(mediaSource: AxisMediaSource): AxisLocalAttachment {
  return {
    id: mediaSource.id,
    type: getAttachmentType(mediaSource.mediaType),
    name: mediaSource.fileName,
    size: mediaSource.sizeBytes,
    createdAt: mediaSource.createdAt,
  };
}

function getAttachmentType(mediaType: AxisMediaSource["mediaType"]): AxisLocalAttachment["type"] {
  if (mediaType === "image" || mediaType === "video" || mediaType === "audio") return mediaType;
  return "file";
}

function formatSessionType(value: SessionType) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function inferMediaType(fileType: string, fileName: string): AxisMediaSource["mediaType"] {
  if (fileType.startsWith("video/")) return "video";
  if (fileType.startsWith("image/")) return "image";
  if (fileType.startsWith("audio/")) return "audio";
  if (/\.(pdf|txt|doc|docx)$/i.test(fileName)) return "document";
  return "unknown";
}

function formatMediaType(value: AxisMediaSource["mediaType"]) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatOutputType(value: AxisOutput["type"]) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatLocalMemoryStatus(status: LocalMemoryStatus) {
  if (status === "loading") return "Loading local memory";
  if (status === "saved") return "Saved in this browser";
  if (status === "unavailable") return "Local memory unavailable";
  return "Local memory ready";
}
