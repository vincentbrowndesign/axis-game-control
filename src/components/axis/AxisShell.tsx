"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import {
  AXIS_RUN_TARGET_ROUTE,
  AXIS_UI_V2_ENABLED,
  createAxisSessionDraftRequest,
  listAxisSessionDraftsRequest,
} from "../../lib/axis/client";
import type {
  AxisAsk,
  AxisChatMessage,
  AxisCommandValidationResult,
  AxisLocalAttachment,
  AxisMediaSource,
  AxisOutput,
  AxisRunDryRunHistoryItem,
  AxisRunDryRunResult,
  AxisRunRequestPreview,
  AxisSession,
} from "../../lib/axis/types";
import { AxisCommandComposer } from "./AxisCommandComposer";
import { AxisOutputSurface } from "./AxisOutputSurface";
import { AxisSidebar } from "./AxisSidebar";
import { AxisStatus } from "./AxisStatus";

type SessionType = AxisSession["sessionType"];
type LocalMemoryStatus = "loading" | "ready" | "saved" | "unavailable";
type SessionDraftSaveStatus = "idle" | "saving" | "saved" | "local";
type SessionDraftListStatus = "idle" | "loading" | "ready" | "unavailable";

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
  const [isViewingSessionDrafts, setIsViewingSessionDrafts] = useState(false);
  const [isViewingPlayerProfile, setIsViewingPlayerProfile] = useState(false);
  const [isViewingReportPreview, setIsViewingReportPreview] = useState(false);
  const [activeSession, setActiveSession] = useState<AxisSession | null>(null);
  const [localFailedOutputIds, setLocalFailedOutputIds] = useState<string[]>([]);
  const [localPendingOutputs, setLocalPendingOutputs] = useState<AxisOutput[]>([]);
  const [routeDryRunResultsByOutputId, setRouteDryRunResultsByOutputId] = useState<Record<string, AxisRunDryRunResult>>({});
  const [routeDryRunHistory, setRouteDryRunHistory] = useState<AxisRunDryRunHistoryItem[]>([]);
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
  const [sessionDraftSaveStatus, setSessionDraftSaveStatus] = useState<SessionDraftSaveStatus>("idle");
  const [sessionDraftListStatus, setSessionDraftListStatus] = useState<SessionDraftListStatus>("idle");
  const [savedSessionDrafts, setSavedSessionDrafts] = useState<AxisSession[]>([]);
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
    if (!hasHydratedLocalMemory) return;
    void loadSavedSessionDrafts();
  }, [hasHydratedLocalMemory]);

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

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const nextSession: AxisSession = {
      id: createLocalId(),
      title: trimmedTitle,
      playerName: playerName.trim() || undefined,
      persisted: false,
      source: "local",
      sessionType,
      status: "draft",
      createdAt: new Date().toISOString(),
    };

    setActiveSession(nextSession);
    setSessionDraftSaveStatus("saving");
    setIsViewingSessionDetail(true);
    setIsCreatingSession(false);

    try {
      const saved = await createAxisSessionDraftRequest(nextSession);
      if (saved.ok) {
        setActiveSession(saved.session);
        setSessionDraftSaveStatus("saved");
        setSavedSessionDrafts((sessions) => mergeSessionDrafts(saved.session, sessions));
        return;
      }
    } catch {
      // Local fallback keeps the session usable when auth or persistence is unavailable.
    }

    setActiveSession(nextSession);
    setSessionDraftSaveStatus("local");
  }

  async function retrySessionDraftSave() {
    if (!activeSession || activeSession.persisted || sessionDraftSaveStatus === "saving") return;

    setSessionDraftSaveStatus("saving");
    try {
      const saved = await createAxisSessionDraftRequest(activeSession);
      if (saved.ok) {
        setActiveSession(saved.session);
        setSessionDraftSaveStatus("saved");
        setSavedSessionDrafts((sessions) => mergeSessionDrafts(saved.session, sessions));
        return;
      }
    } catch {
      // Keep the local draft intact when auth or persistence is unavailable.
    }

    setSessionDraftSaveStatus("local");
  }

  async function loadSavedSessionDrafts() {
    setSessionDraftListStatus("loading");
    try {
      const result = await listAxisSessionDraftsRequest();
      if (result.ok) {
        setSavedSessionDrafts(result.sessions);
        setSessionDraftListStatus("ready");
        return;
      }
    } catch {
      // Draft restore stays quiet when auth or persistence is unavailable.
    }

    setSavedSessionDrafts([]);
    setSessionDraftListStatus("unavailable");
  }

  function restoreSavedSessionDraft(session: AxisSession) {
    setActiveSession({
      ...session,
      persisted: true,
      source: "backend",
    });
    setSessionDraftSaveStatus("saved");
    setIsViewingSessionDrafts(false);
    setIsViewingSessionDetail(true);
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
    setRouteDryRunResultsByOutputId({});
    setRouteDryRunHistory([]);
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
        routeDryRunResult={localPendingOutputs[0] ? routeDryRunResultsByOutputId[localPendingOutputs[0].id] : undefined}
        routeDryRunHistory={routeDryRunHistory}
        runPreview={latestRunPreview}
        runPreviewHistory={runPreviewHistory}
      />
      <AxisOutputSurface
        localRunPreviews={runPreviewHistory}
        localOutputs={localPendingOutputs}
        onClearLocalOutputs={clearLocalOutputs}
        onRetryOutput={retryLocalOutput}
        onRouteDryRunResult={(outputId, result) =>
          handleRouteDryRunResult(outputId, result)
        }
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
        <div className="axis-blank__top-row">
          <h1>AXIS <span>9</span></h1>
          <span className="axis-blank__status">Axis Ready</span>
          <Link className="axis-blank__admin-link" href="/axis/build-map">Open Build Map</Link>
        </div>
        <div className="axis-blank__command-zone">
          <p>Start with the thing you want Axis to make, inspect, summarize, or prepare.</p>
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
            {savedSessionDrafts.length > 0 && (
              <button type="button" onClick={() => setIsViewingSessionDrafts(true)}>
                Saved Drafts
              </button>
            )}
          </div>
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

      {isViewingSessionDrafts && (
        <section className="axis-session-panel" aria-labelledby="axis-saved-drafts-title">
          <div className="axis-session-panel__header">
            <div>
              <p>Saved Drafts</p>
              <h2 id="axis-saved-drafts-title">Session drafts</h2>
            </div>
            <button type="button" onClick={() => setIsViewingSessionDrafts(false)}>
              Close
            </button>
          </div>
          {sessionDraftListStatus === "loading" ? (
            <p className="axis-session-panel__note">Loading saved drafts...</p>
          ) : savedSessionDrafts.length > 0 ? (
            <div className="axis-session-drafts-list">
              {savedSessionDrafts.slice(0, 5).map((session) => (
                <button key={session.id} onClick={() => restoreSavedSessionDraft(session)} type="button">
                  <strong>{session.title}</strong>
                  <span>
                    {formatSessionType(session.sessionType)} - {formatTime(session.createdAt)}
                    {session.playerName ? ` - ${session.playerName}` : ""}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="axis-session-panel__note">No saved session drafts yet.</p>
          )}
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
              <dt>Save</dt>
              <dd>{formatSessionPersistence(activeSession, sessionDraftSaveStatus)}</dd>
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
          {!activeSession.persisted && (
            <button
              className="axis-active-session__detail"
              disabled={sessionDraftSaveStatus === "saving"}
              onClick={retrySessionDraftSave}
              type="button"
            >
              {sessionDraftSaveStatus === "saving" ? "Saving..." : "Retry Save"}
            </button>
          )}
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
              <dt>Save</dt>
              <dd>{formatSessionPersistence(activeSession, sessionDraftSaveStatus)}</dd>
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
          padding: 6rem 1rem 9rem;
          position: relative;
          width: 100%;
        }

        .axis-blank__identity {
          align-items: center;
          display: grid;
          gap: 1.25rem;
          justify-items: center;
          max-width: min(42rem, calc(100vw - 2rem));
          text-align: center;
          width: 100%;
        }

        .axis-blank__top-row {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          justify-content: center;
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

        .axis-blank__status {
          border: 1px solid rgba(121, 226, 145, 0.26);
          border-radius: 999px;
          color: rgba(121, 226, 145, 0.82);
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          padding: 0.32rem 0.62rem;
          text-transform: uppercase;
        }

        .axis-blank__admin-link {
          background: rgba(255, 255, 255, 0.035);
          border-color: rgba(255, 255, 255, 0.12) !important;
          color: rgba(244, 241, 234, 0.62) !important;
          min-height: 2rem !important;
          padding: 0 0.72rem !important;
        }

        .axis-blank__command-zone {
          display: grid;
          gap: 0.9rem;
          justify-items: center;
        }

        .axis-blank__command-zone p {
          color: rgba(244, 241, 234, 0.62);
          font-size: clamp(0.95rem, 2vw, 1.08rem);
          line-height: 1.45;
          margin: 0;
          max-width: 32rem;
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

        .axis-upload-trigger {
          background: rgba(255, 255, 255, 0.035);
        }

        .axis-blank button:disabled {
          cursor: default;
          opacity: 0.45;
        }

        .axis-session-panel,
        .axis-active-session,
        .axis-session-detail,
        .axis-player-profile,
        .axis-report-preview {
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

        .axis-session-panel__note {
          color: rgba(244, 241, 234, 0.58);
          font-size: 0.82rem;
          line-height: 1.35;
          margin: 0;
        }

        .axis-session-drafts-list {
          display: grid;
          gap: 0.55rem;
        }

        .axis-session-drafts-list button {
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 0.75rem;
          color: inherit;
          cursor: pointer;
          display: grid;
          gap: 0.3rem;
          padding: 0.72rem;
          text-align: left;
        }

        .axis-session-drafts-list button:hover,
        .axis-session-drafts-list button:focus-visible {
          border-color: rgba(141, 66, 255, 0.48);
          outline: none;
        }

        .axis-session-drafts-list strong {
          color: #f4f1ea;
          font-size: 0.88rem;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .axis-session-drafts-list span {
          color: rgba(244, 241, 234, 0.52);
          font-size: 0.74rem;
          line-height: 1.3;
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

        @media (max-width: 720px) {
          .axis-blank {
            align-items: start;
            padding: 6rem 1rem 14rem;
          }

          .axis-session-panel,
          .axis-active-session,
          .axis-session-detail,
          .axis-player-profile,
          .axis-report-preview {
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

        }
      `}</style>
    </main>
  );

  function handleRouteDryRunResult(outputId: string, result: AxisRunDryRunResult) {
    const output = localPendingOutputs.find((item) => item.id === outputId);

    setRouteDryRunResultsByOutputId((results) => ({
      ...results,
      [outputId]: result,
    }));
    setRouteDryRunHistory((items) =>
      [
        {
          id: createLocalId("axis-dry-run-history"),
          outputId,
          outputTitle: output?.title ?? "Axis output",
          createdAt: new Date().toISOString(),
          result,
        },
        ...items,
      ].slice(0, 5),
    );
  }
}

function createLocalId(prefix = "axis-session") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}`;
}

function mergeSessionDrafts(session: AxisSession, sessions: AxisSession[]) {
  return [session, ...sessions.filter((item) => item.id !== session.id)].slice(0, 20);
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

function formatSessionPersistence(session: AxisSession, saveStatus: SessionDraftSaveStatus) {
  if (saveStatus === "saving") return "Saving...";
  if (session.persisted && session.source === "backend") return "Saved";
  return "Saved locally";
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
