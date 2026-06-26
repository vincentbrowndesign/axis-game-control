"use client";

import { useEffect, useRef, useState } from "react";

type WatchStatus = "queued" | "sampling" | "watching" | "ready" | "failed";

type WatchCandidate = {
  confidence: number;
  evidenceBucket?: "check_this" | "hidden_low_value" | "not_enough_evidence" | "report_ready";
  evidenceScore?: number;
  id: string;
  labels: string[];
  needsReview: boolean;
  note: string;
  timestampSeconds: number;
  title: string;
  status: "pending" | "accepted" | "rejected";
};

type WatchGroup = {
  candidateIds: string[];
  label: string;
};

type WatchJob = {
  acceptedCount: number;
  candidates: WatchCandidate[];
  clipName: string;
  clipSummary?: string;
  compiledIntent?: string;
  createdAt: string;
  error?: string;
  id: string;
  limitations?: string[];
  query: string;
  sampledFrameCount: number;
  status: WatchStatus;
  suggestedNextQueries?: string[];
  triggerRunId?: string;
  watchGroups?: WatchGroup[];
};

export function AxisWatchRoot() {
  const [clipFile, setClipFile] = useState<File | null>(null);
  const [clipUrl, setClipUrl] = useState("");
  const [query, setQuery] = useState("");
  const [jobs, setJobs] = useState<WatchJob[]>([]);
  const [recordingState, setRecordingState] = useState<"idle" | "preview" | "recording">("idle");
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const pollIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  useEffect(() => {
    const intervals = pollIntervalsRef.current;
    return () => {
      intervals.forEach(clearInterval);
      intervals.clear();
    };
  }, []);

  function setUploadedClip(file: File | null) {
    if (!file) return;
    if (clipUrl) URL.revokeObjectURL(clipUrl);
    const nextUrl = URL.createObjectURL(file);
    setClipFile(file);
    setClipUrl(nextUrl);
  }

  async function startRecordingPreview() {
    if (!navigator.mediaDevices?.getUserMedia) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: "environment" } });
    streamRef.current = stream;
    setRecordingState("preview");
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = stream;
      await videoPreviewRef.current.play();
    }
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === "undefined") return;
    recordingChunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordingChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || "video/webm" });
      const file = new File([blob], `axis-recorded-clip-${Date.now()}.webm`, { type: blob.type });
      setUploadedClip(file);
      stopRecordingPreview();
    };
    recorder.start();
    setRecordingState("recording");
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  function stopRecordingPreview() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
    setRecordingState("idle");
  }

  function watchWithAxis() {
    if (!clipUrl || !query.trim()) return;
    const jobId = `watch-${Date.now()}`;
    const baseJob: WatchJob = {
      acceptedCount: 0,
      candidates: [],
      clipName: clipFile?.name || "Recorded clip",
      createdAt: new Date().toISOString(),
      id: jobId,
      query: query.trim(),
      sampledFrameCount: 0,
      status: "queued",
    };
    setJobs((currentJobs) => [baseJob, ...currentJobs]);

    // Compiler decides routing — deep watch (TwelveLabs) when a file is attached.
    // Fast watch (frame sampling) runs when TwelveLabs is unavailable as a fallback.
    if (clipFile) {
      void runDeepWatch(jobId);
    } else {
      void runFastWatch(jobId);
    }
  }

  async function runFastWatch(jobId: string) {
    try {
      updateJob(jobId, { status: "sampling" });
      const frames = await sampleVideoFrames(clipUrl, 60);
      updateJob(jobId, { sampledFrameCount: frames.length, status: "watching" });
      const response = await fetch("/api/axis/watch", {
        body: JSON.stringify({
          clipMetadata: { name: clipFile?.name || "Recorded clip" },
          frames,
          query: query.trim(),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { candidates?: Array<{ id: string; note: string; timestampSeconds: number; title: string }>; error?: string };
      if (!response.ok || !payload.candidates) {
        updateJob(jobId, { error: payload.error || "Axis could not watch this clip.", status: "failed" });
        return;
      }
      updateJob(jobId, {
        candidates: payload.candidates.map((c) => ({
          confidence: 0.50,
          evidenceBucket: "check_this" as const,
          evidenceScore: 0.20,
          id: c.id,
          labels: [],
          needsReview: true,
          note: c.note,
          status: "pending" as const,
          timestampSeconds: c.timestampSeconds,
          title: c.title,
        })),
        status: "ready",
      });
    } catch {
      updateJob(jobId, { error: "Axis could not sample or watch this clip.", status: "failed" });
    }
  }

  async function runDeepWatch(jobId: string) {
    if (!clipFile) {
      updateJob(jobId, { error: "Attach a clip file to use Deep Watch.", status: "failed" });
      return;
    }

    try {
      // "Uploading" — shows while the route sends the clip to TwelveLabs.
      updateJob(jobId, { status: "sampling" });

      const form = new FormData();
      form.append("video", clipFile);
      form.append("query", query.trim());
      form.append("clipName", clipFile.name);
      form.append("mode", "deep_watch");

      const response = await fetch("/api/axis/watch", { body: form, method: "POST" });
      type DeepWatchPayloadResponse = {
        candidateMoments?: Array<{
          confidence: number;
          evidenceBucket?: WatchCandidate["evidenceBucket"];
          evidenceScore?: number;
          id: string;
          labels: string[];
          needsReview: boolean;
          note: string;
          timestampSeconds: number;
          title: string;
        }>;
        candidates?: Array<{ id: string; note: string; timestampSeconds: number; title: string }>;
        clipSummary?: string;
        compiledIntent?: string;
        error?: string;
        jobId?: string;
        limitations?: string[];
        status?: string;
        suggestedNextQueries?: string[];
        watchGroups?: WatchGroup[];
      };
      const payload = (await response.json()) as DeepWatchPayloadResponse;

      if (!response.ok) {
        updateJob(jobId, { error: payload.error || "Deep Watch could not start.", status: "failed" });
        return;
      }

      // Synchronous fallback (no API key) — route returns candidates directly.
      if (payload.candidates || payload.candidateMoments) {
        const moments = payload.candidateMoments ?? payload.candidates?.map((c) => ({
          ...c, confidence: 0.50, evidenceBucket: "check_this" as const, evidenceScore: 0.20,
          labels: [], needsReview: true,
        })) ?? [];
        updateJob(jobId, {
          candidates: moments.map((c) => ({
            confidence: c.confidence,
            evidenceBucket: c.evidenceBucket ?? "check_this",
            evidenceScore: c.evidenceScore ?? 0.20,
            id: c.id,
            labels: c.labels,
            needsReview: c.needsReview,
            note: c.note,
            timestampSeconds: c.timestampSeconds,
            title: c.title,
            status: c.evidenceBucket === "report_ready" ? "accepted"
              : c.evidenceBucket === "hidden_low_value" || c.evidenceBucket === "not_enough_evidence" ? "rejected"
              : "pending" as const,
          })),
          clipSummary: payload.clipSummary,
          compiledIntent: payload.compiledIntent,
          limitations: payload.limitations,
          status: "ready",
          suggestedNextQueries: payload.suggestedNextQueries,
          watchGroups: payload.watchGroups,
        });
        return;
      }

      // Async path — route returned a Trigger.dev run ID; start polling.
      const triggerRunId = payload.jobId;
      if (!triggerRunId) {
        updateJob(jobId, { error: "Deep Watch could not start.", status: "failed" });
        return;
      }

      // Store compiledIntent immediately so it shows during the watch
      updateJob(jobId, { compiledIntent: payload.compiledIntent, status: "watching", triggerRunId });
      startPolling(jobId, triggerRunId);
    } catch {
      updateJob(jobId, { error: "Deep Watch could not reach the server.", status: "failed" });
    }
  }

  function startPolling(jobId: string, triggerRunId: string) {
    const intervalId = setInterval(() => {
      void pollJobStatus(jobId, triggerRunId, intervalId);
    }, 5_000);
    pollIntervalsRef.current.set(jobId, intervalId);
  }

  async function pollJobStatus(
    jobId: string,
    triggerRunId: string,
    intervalId: ReturnType<typeof setInterval>,
  ) {
    try {
      const response = await fetch(`/api/axis/watch/status/${triggerRunId}`);
      type PollResponse = {
        error?: string;
        result?: {
          candidateMoments?: Array<{
            confidence: number;
            evidenceBucket?: WatchCandidate["evidenceBucket"];
            evidenceScore?: number;
            id: string;
            labels: string[];
            needsReview: boolean;
            note: string;
            timestampSeconds: number;
            title: string;
          }>;
          clipSummary?: string;
          compiledIntent?: string;
          limitations?: string[];
          suggestedNextQueries?: string[];
          watchGroups?: WatchGroup[];
        };
        status: WatchStatus;
      };
      const poll = (await response.json()) as PollResponse;

      if (poll.status === "ready" && poll.result?.candidateMoments) {
        clearInterval(intervalId);
        pollIntervalsRef.current.delete(jobId);
        updateJob(jobId, {
          candidates: poll.result.candidateMoments.map((c) => ({
            confidence: c.confidence,
            evidenceBucket: c.evidenceBucket ?? "check_this",
            evidenceScore: c.evidenceScore ?? 0.20,
            id: c.id,
            labels: c.labels,
            needsReview: c.needsReview,
            note: c.note,
            timestampSeconds: c.timestampSeconds,
            title: c.title,
            status: c.evidenceBucket === "report_ready" ? "accepted"
              : c.evidenceBucket === "hidden_low_value" || c.evidenceBucket === "not_enough_evidence" ? "rejected"
              : "pending" as const,
          })),
          clipSummary: poll.result.clipSummary,
          compiledIntent: poll.result.compiledIntent,
          limitations: poll.result.limitations,
          status: "ready",
          suggestedNextQueries: poll.result.suggestedNextQueries,
          watchGroups: poll.result.watchGroups,
        });
        return;
      }

      if (poll.status === "failed") {
        clearInterval(intervalId);
        pollIntervalsRef.current.delete(jobId);
        updateJob(jobId, {
          error: poll.error || "Deep Watch could not process this clip.",
          status: "failed",
        });
        return;
      }

      // Intermediate state — keep the job in "watching" regardless of
      // whether Trigger reports QUEUED or EXECUTING so the badge never
      // regresses from "Processing" back to "Waiting".
      updateJob(jobId, { status: "watching" });
    } catch {
      // Transient network error — keep polling.
    }
  }

  function updateJob(jobId: string, patch: Partial<WatchJob>) {
    setJobs((currentJobs) => currentJobs.map((job) => (job.id === jobId ? { ...job, ...patch } : job)));
  }

  function updateCandidate(jobId: string, candidateId: string, patch: Partial<WatchCandidate>) {
    setJobs((currentJobs) =>
      currentJobs.map((job) => {
        if (job.id !== jobId) return job;
        const candidates = job.candidates.map((candidate) => (candidate.id === candidateId ? { ...candidate, ...patch } : candidate));
        return {
          ...job,
          acceptedCount: candidates.filter((candidate) => candidate.status === "accepted").length,
          candidates,
        };
      }),
    );
  }

  const latestReadyJob = jobs.find((job) => job.status === "ready");
  const activeJob = jobs[0];

  return (
    <main className="axis-watch" aria-labelledby="axis-watch-title">
      <div className="axis-signal axis-signal--grid" aria-hidden="true" />
      <div className="axis-signal axis-signal--scan" aria-hidden="true" />
      <section className="axis-watch__shell">
        <header className="axis-watch__header">
          <p>AXIS</p>
          <h1 id="axis-watch-title">AXIS</h1>
          <span>Attach a clip. Ask Axis what to watch for.</span>
        </header>

        <section className="axis-watch__composer" aria-label="Axis clip composer">
          <label className="axis-watch__query-field">
            <textarea
              aria-label="Ask Axis what to watch for"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ask Axis what to watch for…"
              rows={4}
              value={query}
            />
          </label>
          <input
            accept="video/*"
            aria-label="Attach video clip"
            className="axis-watch__hidden-file"
            onChange={(event) => {
              setUploadedClip(event.target.files?.[0] ?? null);
              setToolMenuOpen(false);
            }}
            ref={fileInputRef}
            type="file"
          />
          <div className="axis-watch__attach-row">
            <div className="axis-watch__plus-wrap">
              <button
                aria-controls="axis-watch-tool-menu"
                aria-expanded={toolMenuOpen ? "true" : "false"}
                aria-label="Open clip tools"
                className="axis-watch__plus"
                onClick={() => setToolMenuOpen((isOpen) => !isOpen)}
                type="button"
              >
                +
              </button>
              {toolMenuOpen && (
                <div className="axis-watch__tool-menu" id="axis-watch-tool-menu" aria-label="Clip tools">
                  <button
                    onClick={() => {
                      fileInputRef.current?.click();
                      setToolMenuOpen(false);
                    }}
                    type="button"
                  >
                    Attach Clip
                  </button>
                  <button
                    onClick={() => {
                      if (recordingState === "idle") void startRecordingPreview();
                      setToolMenuOpen(false);
                    }}
                    type="button"
                  >
                    Record Clip
                  </button>
                  <a href="/axis/routine" onClick={() => setToolMenuOpen(false)}>Routine Context</a>
                  <a href="#watch-queue" onClick={() => setToolMenuOpen(false)}>Clips</a>
                  <a href="#axis-report" onClick={() => setToolMenuOpen(false)}>Report</a>
                </div>
              )}
            </div>
            <span>{clipFile ? `Clip attached: ${clipFile.name}` : "Attach or record a clip to run Axis."}</span>
            <button className="axis-watch__primary" disabled={!clipUrl || !query.trim()} onClick={() => void watchWithAxis()} type="button">
              Watch with Axis
            </button>
          </div>
          {recordingState !== "idle" && (
            <div className="axis-watch__record-controls" aria-label="Recording controls">
              {recordingState === "preview" && <button onClick={startRecording} type="button">Start Recording</button>}
              {recordingState === "recording" && <button onClick={stopRecording} type="button">Stop Recording</button>}
              <button onClick={stopRecordingPreview} type="button">Cancel</button>
            </div>
          )}
          {(clipUrl || recordingState !== "idle") && (
            <div className="axis-watch__video-shell">
              <video className="axis-watch__video" controls muted playsInline ref={videoPreviewRef} src={clipUrl || undefined} />
              <div className="axis-watch__video-overlay" aria-hidden="true">
                <span>00:00:00</span>
                <i />
                <span>{recordingState === "recording" ? "RECORDING" : "SIGNAL READY"}</span>
              </div>
            </div>
          )}
        </section>

        {activeJob && <ExecutionCard job={activeJob} onRetry={() => void watchWithAxis()} />}

        {latestReadyJob && (
          <AxisReport
            job={latestReadyJob}
            onIncludeInReport={(id) => updateCandidate(latestReadyJob.id, id, { status: "accepted" })}
          />
        )}

        {latestReadyJob && (
          <CheckThese
            candidates={latestReadyJob.candidates}
            jobId={latestReadyJob.id}
            onInclude={(id) => updateCandidate(latestReadyJob.id, id, { status: "accepted" })}
            onSkip={(id) => updateCandidate(latestReadyJob.id, id, { status: "rejected" })}
          />
        )}

        <section className="axis-watch__card" aria-labelledby="axis-watch-queue-title" id="watch-queue">
          <div className="axis-watch__section-title">
            <h2 id="axis-watch-queue-title">Clips</h2>
            <span>{jobs.length === 0 ? "No clips yet." : `${jobs.length} clip${jobs.length === 1 ? "" : "s"}`}</span>
          </div>
          <div className="axis-watch__queue">
            {jobs.length === 0 && (
              <div className="axis-watch__empty">
                <strong>Add a clip to start.</strong>
              </div>
            )}
            {jobs.map((job) => (
              <article className="axis-watch__job" data-status={job.status} key={job.id}>
                <div>
                  <strong>{job.clipName}</strong>
                  <span className="axis-watch__status-badge" data-status={job.status}>{getStatusLabel(job.status)}</span>
                </div>
                <p>{job.compiledIntent ?? job.query}</p>
                <small>{job.sampledFrameCount > 0 ? `${job.sampledFrameCount} frames checked` : "Full clip"}</small>
                {job.error && <em>{job.error}</em>}
              </article>
            ))}
          </div>
        </section>

        {latestReadyJob && (
          <section className="axis-watch__card" aria-label="Clip follow up" id="clip-question">
            <label>
              <span>Ask about this clip…</span>
              <input placeholder="Ask about this clip…" type="text" />
            </label>
          </section>
        )}

        {latestReadyJob && <ClipData job={latestReadyJob} />}
      </section>

      <style jsx>{styles}</style>
    </main>
  );
}

function AxisReport({
  job,
  onIncludeInReport,
}: {
  job: WatchJob;
  onIncludeInReport: (id: string) => void;
}) {
  void onIncludeInReport; // available for future promoted-finding UI
  const reportFindings = job.candidates.filter((c) => c.status === "accepted");
  const sorted = [...reportFindings].sort((a, b) => (b.evidenceScore ?? 0) - (a.evidenceScore ?? 0));
  const bestMoment = sorted[0];
  const biggestIssue = reportFindings.find(
    (c) => c.labels.includes("breakdown") || c.labels.includes("spacing_issue"),
  );
  const nextAction = job.suggestedNextQueries?.[0];

  return (
    <section className="axis-watch__card axis-report" aria-labelledby="axis-report-title" id="axis-report">
      <div className="axis-watch__section-title">
        <h2 id="axis-report-title">Axis Report</h2>
        <span>{reportFindings.length} finding{reportFindings.length === 1 ? "" : "s"}</span>
      </div>

      <p className="axis-report__intent">{job.compiledIntent ?? job.query}</p>

      {reportFindings.length === 0 ? (
        <p>Axis found moments worth checking — none cleared automatically. Review below.</p>
      ) : (
        <>
          <div className="axis-report__section">
            <span className="axis-report__label">Key findings</span>
            <ul className="axis-report__findings">
              {reportFindings.map((f) => (
                <li key={f.id}>
                  <strong>[{formatTimestamp(f.timestampSeconds)}] {f.title}</strong>
                  <span>{f.note}</span>
                </li>
              ))}
            </ul>
          </div>

          {bestMoment && (
            <div className="axis-report__section">
              <span className="axis-report__label">Best moment</span>
              <div className="axis-report__highlight">
                <span>{formatTimestamp(bestMoment.timestampSeconds)}</span>
                <strong>{bestMoment.title}</strong>
                <p>{bestMoment.note}</p>
              </div>
            </div>
          )}

          {biggestIssue && biggestIssue.id !== bestMoment?.id && (
            <div className="axis-report__section">
              <span className="axis-report__label">Biggest issue</span>
              <div className="axis-report__highlight">
                <span>{formatTimestamp(biggestIssue.timestampSeconds)}</span>
                <strong>{biggestIssue.title}</strong>
                <p>{biggestIssue.note}</p>
              </div>
            </div>
          )}

          {nextAction && (
            <div className="axis-report__section">
              <span className="axis-report__label">Next</span>
              <p className="axis-report__next-action">{nextAction}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function CheckThese({
  candidates,
  onInclude,
  onSkip,
}: {
  candidates: WatchCandidate[];
  jobId: string;
  onInclude: (id: string) => void;
  onSkip: (id: string) => void;
}) {
  const checkItems = candidates.filter((c) => c.evidenceBucket === "check_this" && c.status === "pending");
  if (checkItems.length === 0) return null;

  return (
    <section className="axis-watch__card axis-check" aria-labelledby="axis-check-title" id="check-these">
      <div className="axis-watch__section-title">
        <h2 id="axis-check-title">Check These</h2>
        <span>{checkItems.length} to verify</span>
      </div>
      <div className="axis-check__list">
        {checkItems.map((c) => (
          <article className="axis-check__item" key={c.id}>
            <div className="axis-watch__candidate-time">
              <i aria-hidden="true" />
              <span>{formatTimestamp(c.timestampSeconds)}</span>
            </div>
            <strong>{c.title}</strong>
            <p>{c.note}</p>
            <div className="axis-check__actions">
              <button onClick={() => onInclude(c.id)} type="button">Include in Report</button>
              <button onClick={() => onSkip(c.id)} type="button">Skip</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ClipData({ job }: { job: WatchJob }) {
  const notEnoughEvidence = job.limitations ?? [];
  const allFindings = job.candidates;

  return (
    <details className="axis-watch__card axis-clip-data">
      <summary>
        <span>Clip Data</span>
        <span className="axis-clip-data__meta">{allFindings.length} finding{allFindings.length === 1 ? "" : "s"} · {job.clipName}</span>
      </summary>
      {notEnoughEvidence.length > 0 && (
        <div className="axis-clip-data__section">
          <span className="axis-report__label">Not enough evidence</span>
          <ul className="axis-clip-data__limits">
            {notEnoughEvidence.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </div>
      )}
      <div className="axis-watch__candidates">
        {allFindings.length === 0 && <p>No clip data available.</p>}
        {allFindings.map((f) => (
          <article data-bucket={f.evidenceBucket} data-review-status={f.status} key={f.id}>
            <div className="axis-watch__candidate-time">
              <i aria-hidden="true" />
              <span>{formatTimestamp(f.timestampSeconds)}</span>
            </div>
            <strong>{f.title}</strong>
            <p>{f.note}</p>
            {f.labels.length > 0 && (
              <span className="axis-clip-data__labels">{f.labels.join(", ")}</span>
            )}
          </article>
        ))}
      </div>
    </details>
  );
}

function ExecutionCard({ job, onRetry }: { job: WatchJob; onRetry: () => void }) {
  const steps: WatchStatus[] = ["queued", "watching", "ready"];
  const statusIndex = job.status === "failed" ? -1 : steps.indexOf(job.status);
  const metaLabel = job.sampledFrameCount > 0
    ? `${job.sampledFrameCount} frames checked`
    : "Full clip";

  return (
    <section className="axis-watch__card axis-watch__execution" aria-labelledby="axis-execution-title" data-status={job.status}>
      <div className="axis-watch__section-title">
        <h2 id="axis-execution-title">Watching clip</h2>
        <span className="axis-watch__status-badge" data-status={job.status}>{getStatusLabel(job.status)}</span>
      </div>
      <div className="axis-watch__execution-main">
        <strong>{job.clipName}</strong>
        <p>{job.compiledIntent ?? job.query}</p>
      </div>
      <ol className="axis-watch__steps" aria-label="Execution progress">
        {steps.map((step, index) => (
          <li data-active={index <= statusIndex} data-current={step === job.status} key={step}>
            <span>{getStatusLabel(step)}</span>
          </li>
        ))}
        {job.status === "failed" && (
          <li data-active="true" data-current="true">
            <span>Failed / retry</span>
          </li>
        )}
      </ol>
      <div className="axis-watch__execution-meta">
        <span>{metaLabel}</span>
        {job.status === "ready" && <span>{job.candidates.length} moments to review</span>}
        {job.status === "failed" && <button onClick={onRetry} type="button">Retry</button>}
      </div>
      {job.error && <em>{job.error}</em>}
    </section>
  );
}

function getStatusLabel(status: WatchStatus) {
  const labels: Record<WatchStatus, string> = {
    failed: "Failed",
    queued: "Waiting",
    ready: "Ready",
    sampling: "Uploading",
    watching: "Processing",
  };
  return labels[status];
}

async function sampleVideoFrames(videoUrl: string, maxFrames: number) {
  const video = document.createElement("video");
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  await waitForVideoMetadata(video);

  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
  const sampleCount = Math.min(maxFrames, Math.max(1, Math.ceil(duration)));
  const canvas = document.createElement("canvas");
  const width = Math.min(480, video.videoWidth || 480);
  const height = Math.max(1, Math.round(width / ((video.videoWidth || 16) / (video.videoHeight || 9))));
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return [];

  const frames: Array<{ imageDataUrl: string; timestampSeconds: number }> = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const timestampSeconds = Math.min(duration, (duration * index) / sampleCount);
    video.currentTime = timestampSeconds;
    await waitForSeek(video);
    context.drawImage(video, 0, 0, width, height);
    frames.push({ imageDataUrl: canvas.toDataURL("image/jpeg", 0.62), timestampSeconds });
  }
  return frames;
}

function waitForVideoMetadata(video: HTMLVideoElement) {
  return new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Clip could not load."));
  });
}

function waitForSeek(video: HTMLVideoElement) {
  return new Promise<void>((resolve) => {
    video.onseeked = () => resolve();
  });
}

function formatTimestamp(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

const styles = `
  .axis-watch {
    background: #f7f3ea;
    color: #141610;
    isolation: isolate;
    min-height: 100dvh;
    overflow-x: hidden;
    padding: max(1rem, env(safe-area-inset-top)) 0.9rem max(4rem, env(safe-area-inset-bottom));
    position: relative;
  }

  .axis-watch,
  .axis-watch * {
    box-sizing: border-box;
  }

  .axis-signal {
    inset: 0;
    pointer-events: none;
    position: fixed;
    z-index: -1;
  }

  .axis-signal--grid {
    background-image:
      linear-gradient(rgba(20, 22, 16, 0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(20, 22, 16, 0.025) 1px, transparent 1px);
    background-position: 0 0, 0 0, 0 0;
    background-size: 44px 44px, 44px 44px;
    mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.65), transparent 72%);
    opacity: 0.36;
  }

  .axis-signal--scan {
    background:
      linear-gradient(90deg, transparent, rgba(20, 22, 16, 0.035), transparent);
    mix-blend-mode: multiply;
    opacity: 0.24;
  }

  .axis-watch__shell {
    display: grid;
    gap: 0.85rem;
    margin: 0 auto;
    max-width: 46rem;
    position: relative;
    z-index: 1;
  }

  .axis-watch__header {
    align-items: center;
    display: grid;
    gap: 0.25rem;
    justify-items: center;
    padding: 0.15rem 0 0.55rem;
    position: relative;
    text-align: center;
  }

  .axis-watch__header::after {
    content: none;
  }

  .axis-watch__header p,
  .axis-watch label span,
  .axis-watch__section-title span,
  .axis-watch__status-badge,
  .axis-watch__candidates span {
    color: rgba(20, 22, 16, 0.58);
    font-size: 0.72rem;
    font-weight: 850;
    letter-spacing: 0.08em;
    margin: 0;
    text-transform: uppercase;
  }

  .axis-watch h1,
  .axis-watch h2,
  .axis-watch p {
    margin: 0;
  }

  .axis-watch h1 {
    font-size: clamp(2.75rem, 14vw, 5.4rem);
    font-weight: 950;
    letter-spacing: 0;
    line-height: 0.9;
  }

  .axis-watch h2 {
    font-size: 1.05rem;
    letter-spacing: 0;
  }

  .axis-watch__header span,
  .axis-watch__job p,
  .axis-watch__job small,
  .axis-watch__card > p {
    color: rgba(20, 22, 16, 0.66);
  }

  .axis-watch__card,
  .axis-watch__composer,
  .axis-watch__job,
  .axis-watch__candidates article {
    background: #fffdf8;
    border: 1px solid rgba(20, 22, 16, 0.1);
    border-radius: 0.7rem;
    box-shadow: 0 1rem 2.4rem rgba(20, 22, 16, 0.055);
    display: grid;
    gap: 0.75rem;
    overflow: hidden;
    padding: 0.95rem;
    position: relative;
  }

  .axis-watch__card::before,
  .axis-watch__job::before,
  .axis-watch__candidates article::before {
    content: none;
  }

  .axis-watch__composer::before {
    background: linear-gradient(90deg, rgba(183, 255, 92, 0.68), transparent 55%);
    content: "";
    height: 2px;
    inset: 0 0 auto;
    opacity: 0.72;
    position: absolute;
  }

  .axis-watch__card > *,
  .axis-watch__composer > *,
  .axis-watch__job > *,
  .axis-watch__candidates article > * {
    position: relative;
    z-index: 1;
  }

  .axis-watch__composer {
    background: #141610;
    border-color: rgba(20, 22, 16, 0.88);
    box-shadow: 0 1.4rem 3.4rem rgba(20, 22, 16, 0.18);
    color: #fffdf7;
    gap: 0.75rem;
    overflow: visible;
    padding: 1rem;
  }

  .axis-watch__composer label span {
    color: rgba(255, 253, 247, 0.68);
  }


  .axis-watch__query-field textarea {
    background: #fffdf8;
    border-color: rgba(255, 253, 247, 0.36);
    box-shadow: none;
    font-size: 1.02rem;
    line-height: 1.45;
    min-height: 7rem;
    resize: vertical;
  }

  .axis-watch__signal-label {
    color: rgba(183, 255, 92, 0.86);
    font-size: 0.65rem;
    font-weight: 950;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .axis-watch__section-title,
  .axis-watch__job > div:first-child {
    align-items: center;
    display: flex;
    gap: 0.65rem;
    justify-content: space-between;
  }

  .axis-watch label {
    display: grid;
    gap: 0.35rem;
  }

  .axis-watch input,
  .axis-watch textarea {
    background: #fffdf8;
    border: 1px solid rgba(20, 22, 16, 0.16);
    border-radius: 0.65rem;
    color: #141610;
    font: inherit;
    min-height: 3rem;
    padding: 0.75rem;
    width: 100%;
  }

  .axis-watch__hidden-file {
    height: 1px;
    opacity: 0;
    pointer-events: none;
    position: absolute;
    width: 1px;
  }

  .axis-watch__video-shell {
    background: #141610;
    border: 1px solid rgba(255, 253, 247, 0.14);
    border-radius: 0.65rem;
    overflow: hidden;
    position: relative;
  }

  .axis-watch__video {
    aspect-ratio: 16 / 9;
    background: #141610;
    display: block;
    width: 100%;
  }

  .axis-watch__video-overlay {
    align-items: flex-start;
    color: rgba(255, 253, 247, 0.72);
    display: flex;
    font-size: 0.58rem;
    font-weight: 950;
    inset: 0;
    justify-content: space-between;
    letter-spacing: 0.12em;
    padding: 0.55rem;
    pointer-events: none;
    position: absolute;
    text-shadow: 0 1px 8px rgba(0, 0, 0, 0.8);
    text-transform: uppercase;
  }

  .axis-watch__video-overlay::before,
  .axis-watch__video-overlay::after {
    border-color: rgba(255, 253, 247, 0.42);
    border-style: solid;
    content: "";
    height: 1.35rem;
    position: absolute;
    width: 1.35rem;
  }

  .axis-watch__video-overlay::before {
    border-width: 2px 0 0 2px;
    left: 0.55rem;
    top: 0.55rem;
  }

  .axis-watch__video-overlay::after {
    border-width: 0 2px 2px 0;
    bottom: 0.55rem;
    right: 0.55rem;
  }

  .axis-watch__video-overlay i {
    background:
      linear-gradient(rgba(255, 253, 247, 0.34), rgba(255, 253, 247, 0.34)) center / 1px 100% no-repeat,
      linear-gradient(90deg, rgba(255, 253, 247, 0.34), rgba(255, 253, 247, 0.34)) center / 100% 1px no-repeat;
    height: 2rem;
    left: 50%;
    opacity: 0.6;
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 2rem;
  }

  .axis-watch button {
    border-radius: 0.65rem;
    font: inherit;
    font-weight: 850;
    min-height: 2.85rem;
    padding: 0 0.8rem;
  }

  .axis-watch a {
    color: inherit;
    text-decoration: none;
  }

  .axis-watch__primary {
    background: #b7ff5c;
    border: 1px solid #b7ff5c;
    color: #141610;
    overflow: hidden;
    position: relative;
    transition: box-shadow 0.18s ease, opacity 0.18s ease, transform 0.12s ease;
    width: 100%;
  }

  .axis-watch__primary::before {
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.28), transparent);
    content: "";
    height: 100%;
    left: -100%;
    pointer-events: none;
    position: absolute;
    top: 0;
    width: 60%;
  }

  .axis-watch__primary:not(:disabled):hover {
    box-shadow: 0 4px 18px rgba(183, 255, 92, 0.38);
    transform: translateY(-1px);
  }

  .axis-watch__primary:not(:disabled):active {
    box-shadow: none;
    transform: translateY(0);
  }

  .axis-watch__primary:disabled {
    opacity: 0.42;
  }

  .axis-watch__record-controls,
  .axis-watch__candidate-actions,
  .axis-watch__next-actions,
  .axis-watch__execution-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .axis-watch__record-controls button,
  .axis-watch__candidates button,
  .axis-watch__next-actions a,
  .axis-watch__execution-meta button {
    background: rgba(20, 22, 16, 0.06);
    border: 1px solid rgba(20, 22, 16, 0.14);
    border-radius: 0.65rem;
    color: #141610;
    font: inherit;
    font-weight: 850;
    min-height: 2.85rem;
    padding: 0 0.8rem;
  }

  .axis-watch__plus-wrap {
    position: relative;
  }

  .axis-watch__plus {
    align-items: center;
    background: rgba(255, 253, 247, 0.09);
    border: 1px solid rgba(255, 253, 247, 0.18);
    color: #fffdf7;
    display: inline-flex;
    font-size: 1.35rem;
    justify-content: center;
    padding: 0;
    transition: background 0.18s ease, box-shadow 0.18s ease, transform 0.12s ease;
    width: 2.85rem;
  }

  .axis-watch__plus:hover {
    background: rgba(255, 253, 247, 0.16);
    box-shadow: 0 0 0 3px rgba(255, 253, 247, 0.07), 0 4px 14px rgba(0, 0, 0, 0.22);
  }

  .axis-watch__plus:active {
    transform: scale(0.94);
  }

  .axis-watch__tool-menu {
    background: #fffdf8;
    border: 1px solid rgba(20, 22, 16, 0.12);
    border-radius: 0.7rem;
    box-shadow: 0 1rem 2rem rgba(20, 22, 16, 0.18);
    display: grid;
    gap: 0.2rem;
    left: 0;
    min-width: min(13rem, calc(100vw - 2.8rem));
    padding: 0.45rem;
    position: absolute;
    top: calc(100% + 0.45rem);
    z-index: 20;
  }

  .axis-watch__tool-menu button,
  .axis-watch__tool-menu a {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: 0.55rem;
    color: #141610;
    display: flex;
    font: inherit;
    font-weight: 850;
    justify-content: flex-start;
    min-height: 2.6rem;
    padding: 0 0.75rem;
    text-align: left;
    transition: background 0.14s ease;
    width: 100%;
  }

  .axis-watch__tool-menu button:hover,
  .axis-watch__tool-menu a:hover {
    background: rgba(20, 22, 16, 0.06);
  }

  .axis-watch__attach-row {
    align-items: center;
    display: grid;
    gap: 0.6rem;
    grid-template-columns: auto minmax(0, 1fr);
  }

  .axis-watch__attach-row > span {
    color: rgba(255, 253, 247, 0.72);
    font-size: 0.92rem;
    font-weight: 750;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .axis-watch__attach-row .axis-watch__primary {
    grid-column: 1 / -1;
  }

  .axis-watch__queue,
  .axis-watch__candidates,
  .axis-watch__report-list {
    display: grid;
    gap: 0.6rem;
  }

  .axis-watch__empty {
    background: #fffdf8;
    border: 1.5px dashed rgba(20, 22, 16, 0.18);
    border-radius: 0.85rem;
    display: grid;
    gap: 0.4rem;
    min-height: 9rem;
    padding: 1.5rem 1rem;
    place-content: center;
    text-align: center;
    transition: background 0.18s ease, border-color 0.18s ease;
  }

  .axis-watch__empty:hover {
    background: rgba(183, 255, 92, 0.04);
    border-color: rgba(20, 22, 16, 0.3);
  }

  .axis-watch__empty span {
    color: rgba(20, 22, 16, 0.48);
    font-size: 0.65rem;
    font-weight: 950;
    letter-spacing: 0.16em;
  }

  .axis-watch__empty strong {
    color: rgba(20, 22, 16, 0.72);
    font-size: 0.95rem;
    font-weight: 850;
  }

  .axis-watch__job::after {
    background: linear-gradient(90deg, transparent, rgba(183, 255, 92, 0.18), transparent);
    content: "";
    inset: 0;
    opacity: 0;
    pointer-events: none;
    position: absolute;
    transform: translateX(-100%);
  }

  .axis-watch__job[data-status="queued"]::after,
  .axis-watch__job[data-status="sampling"]::after,
  .axis-watch__job[data-status="watching"]::after {
    animation: axis-sweep 1.8s linear infinite;
    opacity: 1;
  }

  .axis-watch__job[data-status="ready"] {
    border-color: rgba(20, 22, 16, 0.1);
  }

  .axis-watch__execution[data-status="sampling"],
  .axis-watch__execution[data-status="watching"],
  .axis-watch__execution[data-status="queued"] {
    border-color: rgba(20, 22, 16, 0.1);
  }

  .axis-watch__execution-main {
    display: grid;
    gap: 0.25rem;
  }

  .axis-watch__execution-main strong {
    font-size: 1.05rem;
  }

  .axis-watch__steps {
    display: grid;
    gap: 0.5rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .axis-watch__steps li {
    align-items: center;
    color: rgba(20, 22, 16, 0.52);
    display: flex;
    font-size: 0.72rem;
    font-weight: 900;
    gap: 0.5rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .axis-watch__steps li::before {
    background: rgba(20, 22, 16, 0.12);
    border-radius: 999px;
    content: "";
    height: 0.62rem;
    width: 0.62rem;
  }

  .axis-watch__steps li[data-active="true"] {
    color: #141610;
  }

  .axis-watch__steps li[data-active="true"]::before {
    background: #141610;
    box-shadow: 0 0 0 3px rgba(20, 22, 16, 0.08);
  }

  .axis-watch__steps li[data-current="true"] {
    color: #141610;
  }

  .axis-watch__steps li[data-current="true"]::before {
    background: #141610;
    box-shadow: 0 0 0 4px rgba(20, 22, 16, 0.1);
  }

  .axis-watch__execution-meta {
    align-items: center;
    color: rgba(20, 22, 16, 0.58);
    font-size: 0.82rem;
  }

  .axis-watch__execution-meta span {
    color: inherit;
    font-size: inherit;
    font-weight: 750;
    padding: 0;
  }

  .axis-watch__status-badge {
    background: rgba(20, 22, 16, 0.06);
    border: 1px solid rgba(20, 22, 16, 0.1);
    border-radius: 999px;
    color: rgba(20, 22, 16, 0.68);
    display: inline-flex;
    line-height: 1;
    padding: 0.42rem 0.58rem;
    white-space: nowrap;
  }

  .axis-watch__status-badge[data-status="watching"],
  .axis-watch__status-badge[data-status="sampling"],
  .axis-watch__status-badge[data-status="queued"] {
    background: rgba(183, 255, 92, 0.16);
    border-color: rgba(20, 22, 16, 0.12);
    color: #141610;
  }

  .axis-watch__status-badge[data-status="ready"] {
    background: rgba(72, 150, 48, 0.12);
    color: #214a1a;
  }

  .axis-watch__status-badge[data-status="failed"] {
    background: #fff0d9;
    color: #5d3a00;
  }

  .axis-watch__job em {
    background: #fff0d9;
    border: 1px solid #f1c078;
    border-radius: 0.45rem;
    color: #5d3a00;
    font-style: normal;
    padding: 0.6rem;
  }

  .axis-watch__report-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  /* Axis Report */

  .axis-report {
    border-color: rgba(72, 150, 48, 0.22);
  }

  .axis-report::before {
    background: linear-gradient(90deg, rgba(72, 150, 48, 0.55), transparent 65%);
    content: "";
    height: 2px;
    inset: 0 0 auto;
    position: absolute;
  }

  .axis-report__intent {
    color: rgba(20, 22, 16, 0.68);
    font-size: 0.9rem;
    line-height: 1.45;
  }

  .axis-report__section {
    border-top: 1px solid rgba(20, 22, 16, 0.08);
    display: grid;
    gap: 0.45rem;
    padding-top: 0.72rem;
  }

  .axis-report__label {
    color: rgba(20, 22, 16, 0.54);
    font-size: 0.68rem;
    font-weight: 950;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .axis-report__findings {
    display: grid;
    gap: 0.52rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .axis-report__findings li {
    border-left: 2.5px solid rgba(72, 150, 48, 0.45);
    display: grid;
    gap: 0.18rem;
    padding: 0.18rem 0 0.18rem 0.65rem;
  }

  .axis-report__findings li strong {
    font-size: 0.9rem;
  }

  .axis-report__findings li span {
    color: rgba(20, 22, 16, 0.62);
    font-size: 0.82rem;
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
  }

  .axis-report__highlight {
    background: rgba(72, 150, 48, 0.055);
    border: 1px solid rgba(72, 150, 48, 0.15);
    border-radius: 0.55rem;
    display: grid;
    gap: 0.22rem;
    padding: 0.72rem;
  }

  .axis-report__highlight span {
    color: rgba(20, 22, 16, 0.52);
    font-size: 0.65rem;
    font-weight: 950;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .axis-report__highlight strong {
    font-size: 0.94rem;
  }

  .axis-report__highlight p {
    color: rgba(20, 22, 16, 0.68);
    font-size: 0.85rem;
    margin: 0;
  }

  .axis-report__next-action {
    color: rgba(20, 22, 16, 0.72);
    font-size: 0.88rem;
    line-height: 1.4;
    margin: 0;
  }

  /* Check These */

  .axis-check__list {
    display: grid;
    gap: 0.6rem;
  }

  .axis-check__item {
    background: rgba(20, 22, 16, 0.025);
    border: 1px solid rgba(20, 22, 16, 0.1);
    border-radius: 0.6rem;
    display: grid;
    gap: 0.5rem;
    padding: 0.85rem;
  }

  .axis-check__item strong {
    font-size: 0.92rem;
  }

  .axis-check__item > p {
    color: rgba(20, 22, 16, 0.62);
    font-size: 0.82rem;
    margin: 0;
  }

  .axis-check__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .axis-check__actions button {
    background: rgba(20, 22, 16, 0.06);
    border: 1px solid rgba(20, 22, 16, 0.14);
    color: #141610;
    font-size: 0.8rem;
    min-height: 2.4rem;
  }

  .axis-check__actions button:first-child {
    background: rgba(72, 150, 48, 0.10);
    border-color: rgba(72, 150, 48, 0.26);
    color: #214a1a;
  }

  /* Clip Data */

  .axis-clip-data summary {
    align-items: center;
    cursor: pointer;
    display: flex;
    gap: 0.65rem;
    justify-content: space-between;
    list-style: none;
    padding: 0;
  }

  .axis-clip-data summary::-webkit-details-marker {
    display: none;
  }

  .axis-clip-data summary > span:first-child {
    font-size: 1.05rem;
    font-weight: 900;
    letter-spacing: 0;
  }

  .axis-clip-data__meta {
    color: rgba(20, 22, 16, 0.52);
    font-size: 0.72rem;
    font-weight: 850;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .axis-clip-data[open] summary {
    margin-bottom: 0.75rem;
  }

  .axis-clip-data__section {
    border-top: 1px solid rgba(20, 22, 16, 0.08);
    display: grid;
    gap: 0.4rem;
    margin-bottom: 0.75rem;
    padding-top: 0.7rem;
  }

  .axis-clip-data__limits {
    color: rgba(20, 22, 16, 0.66);
    display: grid;
    font-size: 0.84rem;
    gap: 0.3rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .axis-clip-data .axis-watch__candidates article {
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(20, 22, 16, 0.06);
    border-radius: 0;
    box-shadow: none;
    gap: 0.3rem;
    padding: 0.6rem 0 0.6rem 0.65rem;
  }

  .axis-clip-data .axis-watch__candidates article:last-child {
    border-bottom: none;
  }

  .axis-clip-data .axis-watch__candidates article strong {
    font-size: 0.88rem;
  }

  .axis-clip-data .axis-watch__candidates article > p {
    color: rgba(20, 22, 16, 0.62);
    font-size: 0.8rem;
    margin: 0;
  }

  .axis-clip-data__labels {
    color: rgba(20, 22, 16, 0.4);
    font-size: 0.66rem;
    font-weight: 850;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .axis-watch__report-cover {
    background: transparent;
    border-radius: 0;
    color: #141610;
    margin: 0;
    padding: 0;
  }

  .axis-watch__report-cover span {
    color: rgba(20, 22, 16, 0.58);
  }

  .axis-watch__candidates {
    border-left: 1px solid rgba(20, 22, 16, 0.12);
    margin-left: 0.2rem;
    padding-left: 0.65rem;
  }

  .axis-watch__group-label {
    color: rgba(20, 22, 16, 0.56);
    font-size: 0.7rem;
    font-weight: 950;
    letter-spacing: 0.08em;
    margin: 0.6rem 0 0.3rem;
    text-transform: uppercase;
  }

  .axis-watch__group-label span {
    color: rgba(20, 22, 16, 0.38);
    font-size: inherit;
    font-weight: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
  }

  .axis-watch__candidates article {
    box-shadow: none;
  }

  .axis-watch__candidates article[data-review-status="accepted"] {
    border-color: rgba(72, 150, 48, 0.22);
  }

  .axis-watch__candidates article[data-review-status="rejected"] {
    opacity: 0.66;
  }

  .axis-watch__candidate-time {
    align-items: center;
    display: flex;
    gap: 0.45rem;
    margin-left: -1.23rem;
  }

  .axis-watch__candidate-time i {
    background: #141610;
    border: 2px solid #fffdf8;
    border-radius: 999px;
    display: inline-block;
    height: 0.68rem;
    width: 0.68rem;
  }

  .axis-watch__report-cover {
    background: transparent;
    border-radius: 0;
    color: #141610;
    margin: 0;
    padding: 0;
  }

  .axis-watch__report-cover span {
    color: rgba(20, 22, 16, 0.58);
  }

  .axis-watch__report-list li {
    border-left: 2.5px solid rgba(72, 150, 48, 0.38);
    display: grid;
    gap: 0.2rem;
    padding: 0.22rem 0 0.22rem 0.75rem;
  }

  @keyframes axis-sweep {
    to {
      transform: translateX(100%);
    }
  }

  @keyframes axis-shine {
    to {
      left: 100%;
    }
  }

  @keyframes axis-pulse {
    0%, 100% { box-shadow: 0 0 0 2px rgba(20, 22, 16, 0.08); }
    50% { box-shadow: 0 0 0 5px rgba(20, 22, 16, 0.15); }
  }

  @media (min-width: 760px) {
    .axis-watch {
      padding: 1.6rem;
    }

    .axis-watch__attach-row {
      grid-template-columns: auto minmax(0, 1fr) minmax(14rem, 18rem);
    }

    .axis-watch__attach-row .axis-watch__primary {
      grid-column: auto;
    }

    .axis-watch__steps {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .axis-watch__result-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .axis-signal--scan {
      animation: axis-scan 12s linear infinite;
    }

    .axis-watch__primary:not(:disabled):hover::before {
      animation: axis-shine 0.5s ease forwards;
    }

    .axis-watch__steps li[data-current="true"]::before {
      animation: axis-pulse 1.4s ease-in-out infinite;
    }
  }

  @keyframes axis-scan {
    to {
      background-position: 0 48px, 48rem 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .axis-signal--scan,
    .axis-watch__job::after,
    .axis-watch__primary::before,
    .axis-watch__steps li[data-current="true"]::before {
      animation: none !important;
    }
  }
`;
