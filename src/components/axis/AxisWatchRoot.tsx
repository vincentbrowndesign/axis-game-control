"use client";

import { useEffect, useRef, useState } from "react";
import { PlaybackWorkbench, type PlaybackJob } from "./PlaybackWorkbench";

type WatchStatus = "queued" | "sampling" | "watching" | "ready" | "failed";

type CvDetection = {
  bbox: [number, number, number, number]; // normalized [x1, y1, x2, y2]
  class?: string;
  confidence: number;
  kind: "ball" | "object" | "person" | "rim";
  label?: string;
};

type CvContextStatus = "connected" | "failed" | "not_configured";

type CvContext = {
  peakFrame?: {
    detections: CvDetection[];
    imageDataUrl: string;
    peopleCount: number;
    timestampSeconds: number;
  };
  summary: {
    avgPeopleCount: number;
    ballDetected?: boolean;
    classCounts?: Record<string, number>;
    failReason?: string;
    framesWithDetections?: number;
    framesWithPeople: number;
    maxPeopleCount: number;
    reason?: string;
    provider: string;
    status: CvContextStatus;
    totalDetections?: number;
    totalFrames: number;
    usableFrameCount?: number;
  };
};

type CvFrameInput = {
  imageDataUrl: string;
  timestampSeconds: number;
};

type CvSampleResult = {
  frameCount: number;
  frames: CvFrameInput[];
  skippedFrameCount: number;
  usableFrameCount: number;
};

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
  clipUrl?: string;
  compiledIntent?: string;
  createdAt: string;
  cvContext?: CvContext;
  cvStatus?: "failed" | "idle" | "ready" | "sampling";
  error?: string;
  id: string;
  lastViewedTimestamp?: number;
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
  const [workbenchJobId, setWorkbenchJobId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const queryInputRef = useRef<HTMLTextAreaElement | null>(null);
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
    // Don't revoke the old URL if a job's workbench still references it.
    // Object URLs are cheap and sessions are short — let the browser clean up.
    const nextUrl = URL.createObjectURL(file);
    setClipFile(file);
    setClipUrl(nextUrl);
  }

  function watchWithAxis() {
    if (!clipUrl || !query.trim()) return;
    const jobId = `watch-${Date.now()}`;
    const reportContextJob = latestReadyJob;
    const baseJob: WatchJob = {
      acceptedCount: 0,
      candidates: [],
      clipName: clipFile?.name || "Recorded clip",
      clipUrl: clipUrl || undefined,
      createdAt: new Date().toISOString(),
      id: jobId,
      query: query.trim(),
      sampledFrameCount: 0,
      status: "queued",
    };
    setJobs((currentJobs) => [baseJob, ...currentJobs]);

    // CV always fires on Watch with Axis, regardless of path.
    // Deep watch: sequential (CV summary injected into the prompt).
    // Fast watch: parallel (CV runs alongside, no injection needed).
    if (clipFile) {
      void runCvThenDeepWatch(jobId, clipUrl, reportContextJob);
    } else {
      void runCvContext(jobId, clipUrl);
      void runFastWatch(jobId, reportContextJob);
    }
  }

  async function runFastWatch(jobId: string, reportContextJob?: WatchJob) {
    try {
      updateJob(jobId, { status: "sampling" });
      const frames = await sampleVideoFrames(clipUrl, 60);
      updateJob(jobId, { sampledFrameCount: frames.length, status: "watching" });
      const response = await fetch("/api/axis/watch", {
        body: JSON.stringify({
          clipMetadata: { name: clipFile?.name || "Recorded clip" },
          cvContext: reportContextJob?.cvContext?.summary,
          frames,
          query: query.trim(),
          routineContext: buildFollowUpContext(reportContextJob),
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

  async function runCvThenDeepWatch(jobId: string, videoUrl: string, reportContextJob?: WatchJob) {
    const cvSummary = await runCvContext(jobId, videoUrl);
    await runDeepWatch(jobId, cvSummary ?? reportContextJob?.cvContext?.summary, reportContextJob);
  }

  async function runCvContext(jobId: string, videoUrl: string): Promise<CvContext["summary"] | null> {
    if (!videoUrl) {
      console.log("[CV_CLIENT] no videoUrl — CV skipped");
      return null;
    }
    updateJob(jobId, { cvStatus: "sampling" });

    try {
      const sample = await sampleUsableCvFrames(videoUrl);
      const frames = sample.frames;

      console.log(
        `[CV_CLIENT_CALL_START] jobId=${jobId} frameCount=${sample.frameCount} usableFrameCount=${sample.usableFrameCount} skippedFrameCount=${sample.skippedFrameCount}`,
      );

      if (frames.length === 0) {
        // Video loaded but yielded no sampleable frames — surface clearly
        const summary: CvContext["summary"] = {
          avgPeopleCount: 0,
          failReason: "no_frames_sampled",
          framesWithPeople: 0,
          maxPeopleCount: 0,
          provider: "none",
          status: "failed",
          totalFrames: 0,
          usableFrameCount: 0,
        };
        updateJob(jobId, { cvContext: { summary }, cvStatus: "ready" });
        return summary;
      }

      const response = await fetch("/api/axis/cv/detect", {
        body: JSON.stringify({
          frames,
          sampling: {
            frameCount: sample.frameCount,
            skippedFrameCount: sample.skippedFrameCount,
            usableFrameCount: sample.usableFrameCount,
          },
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        console.log(`[CV_CLIENT] route error: HTTP ${response.status}`);
        updateJob(jobId, { cvStatus: "failed" });
        return null;
      }

      const data = (await response.json()) as {
        failReason?: string;
        frameResults?: Array<{
          detections: CvDetection[];
          error?: string;
          peopleCount: number;
          timestampSeconds: number;
        }>;
        provider?: string;
        status?: CvContextStatus;
        summary?: CvContext["summary"];
      };

      const frameResults = data.frameResults ?? [];
      const status = data.status ?? "failed";
      const provider = data.provider ?? "unknown";
      const failReason = data.failReason ?? data.summary?.failReason;

      console.log(`[CV_CLIENT] route returned status=${status} provider=${provider} frames=${frameResults.length} usableFrameCount=${sample.usableFrameCount} failReason=${failReason ?? "none"}`);

      // Build summary from frame results — don't trust server shape alone
      const peopleCounts = frameResults.map((f) => f.peopleCount);
      const maxPeopleCount = peopleCounts.length > 0 ? Math.max(...peopleCounts) : 0;
      const framesWithPeople = peopleCounts.filter((n) => n > 0).length;
      const avgPeopleCount = Number(
        (peopleCounts.length > 0
          ? peopleCounts.reduce((s, n) => s + n, 0) / peopleCounts.length
          : 0
        ).toFixed(1),
      );
      const allDetections = frameResults.flatMap((f) => f.detections);
      const ballDetected = allDetections.some((d) => d.kind === "ball");

      const summary: CvContext["summary"] = {
        avgPeopleCount,
        ballDetected,
        classCounts: data.summary?.classCounts,
        failReason,
        framesWithDetections: frameResults.filter((f) => f.detections.length > 0).length,
        framesWithPeople,
        maxPeopleCount,
        reason: data.summary?.reason,
        provider,
        status,
        totalDetections: allDetections.length,
        totalFrames: frameResults.length,
        usableFrameCount: sample.usableFrameCount,
      };

      // Peak frame — used for overlay canvas preview
      const peakResult = frameResults.reduce<(typeof frameResults)[0] | null>(
        (best, curr) => (curr.peopleCount > (best?.peopleCount ?? 0) ? curr : best),
        null,
      );

      let peakFrame: CvContext["peakFrame"];
      if (peakResult && peakResult.peopleCount > 0) {
        const localFrame = frames.find(
          (f) => Math.abs(f.timestampSeconds - peakResult.timestampSeconds) < 0.5,
        );
        if (localFrame) {
          peakFrame = {
            detections: peakResult.detections,
            imageDataUrl: localFrame.imageDataUrl,
            peopleCount: peakResult.peopleCount,
            timestampSeconds: peakResult.timestampSeconds,
          };
        }
      }

      // Always reach "ready" so UI can show a specific reason instead of silently vanishing
      updateJob(jobId, { cvContext: { peakFrame, summary }, cvStatus: "ready" });
      return summary;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[CV_CLIENT] exception: ${msg}`);
      updateJob(jobId, { cvStatus: "failed" });
      return null;
    }
  }

  async function runDeepWatch(jobId: string, cvSummary?: CvContext["summary"], reportContextJob?: WatchJob) {
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
      const followUpContext = buildFollowUpContext(reportContextJob);
      if (followUpContext) {
        form.append("routineContext", followUpContext);
      }
      if (cvSummary) {
        form.append("cvSummary", JSON.stringify(cvSummary));
      }

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
  const workbenchJob = workbenchJobId ? jobs.find((j) => j.id === workbenchJobId) : null;
  const hasReport = Boolean(latestReadyJob);

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
          <input
            accept="video/*"
            aria-label="Attach video clip"
            className="axis-watch__hidden-file"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setUploadedClip(file);
              if (file) {
                requestAnimationFrame(() => queryInputRef.current?.focus());
              }
            }}
            ref={fileInputRef}
            type="file"
          />
          <div className="axis-watch__attach-row">
            <div className="axis-watch__plus-wrap">
              <button
                aria-label="Attach clip"
                className="axis-watch__plus"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                +
              </button>
            </div>
            <span>{clipFile ? `Clip attached: ${clipFile.name}` : "Attach a clip to run Axis."}</span>
          </div>
          {clipUrl && (
            <div className="axis-watch__video-shell">
              <video className="axis-watch__video" controls muted playsInline ref={videoPreviewRef} src={clipUrl || undefined} />
              <div className="axis-watch__video-overlay" aria-hidden="true">
                <span>00:00:00</span>
                <i />
                <span>SIGNAL READY</span>
              </div>
            </div>
          )}
          <AxisQueryBox
            buttonLabel={hasReport ? "Ask Axis" : "Watch with Axis"}
            disabled={!clipUrl || !query.trim()}
            inputRef={queryInputRef}
            onChange={setQuery}
            onSubmit={() => void watchWithAxis()}
            placeholder={hasReport ? "Ask about this clip…" : "Ask Axis what to watch for…"}
            value={query}
          />
        </section>

        {activeJob && <ExecutionCard job={activeJob} onRetry={() => void watchWithAxis()} />}

        {(activeJob?.cvStatus === "ready" || latestReadyJob?.cvContext) && (
          <CvPreview cvContext={(activeJob?.cvStatus === "ready" ? activeJob : latestReadyJob)?.cvContext} />
        )}

        {latestReadyJob && (
          <AxisReport
            job={latestReadyJob}
            onIncludeInReport={(id) => updateCandidate(latestReadyJob.id, id, { status: "accepted" })}
          />
        )}

        {latestReadyJob && (
          <NextActionCard
            job={latestReadyJob}
            onCopyReport={() =>
              void navigator.clipboard.writeText(buildReportLines(latestReadyJob).join("\n"))
            }
            onOpenWorkbench={() => setWorkbenchJobId(latestReadyJob.id)}
            onSetQuery={setQuery}
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
                {job.status === "ready" && (
                  <button
                    className="axis-watch__open-wb"
                    onClick={() => setWorkbenchJobId(job.id)}
                    type="button"
                  >
                    Open in Workbench
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>

        {latestReadyJob && <ClipData job={latestReadyJob} />}
      </section>

      {workbenchJob && (
        <PlaybackWorkbench
          job={toPlaybackJob(workbenchJob)}
          onClose={(lastTimestamp) => {
            if (lastTimestamp !== undefined) {
              updateJob(workbenchJob.id, { lastViewedTimestamp: lastTimestamp });
            }
            setWorkbenchJobId(null);
          }}
          onUpdateCandidate={(candidateId, patch) =>
            updateCandidate(workbenchJob.id, candidateId, patch)
          }
        />
      )}

      <style jsx>{styles}</style>
    </main>
  );
}

function AxisQueryBox({
  buttonLabel,
  disabled,
  inputRef,
  onChange,
  onSubmit,
  placeholder,
  value,
}: {
  buttonLabel: string;
  disabled: boolean;
  inputRef: { current: HTMLTextAreaElement | null };
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  value: string;
}) {
  return (
    <div className="axis-watch__query-box">
      <label className="axis-watch__query-field">
        <textarea
          aria-label={placeholder}
          ref={inputRef}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={4}
          value={value}
        />
      </label>
      <button className="axis-watch__primary" disabled={disabled} onClick={onSubmit} type="button">
        {buttonLabel}
      </button>
    </div>
  );
}

function buildFollowUpContext(job?: WatchJob): string | undefined {
  if (!job) return undefined;

  const lines = [
    `Previous Axis report for this selected clip: ${job.clipSummary ?? job.compiledIntent ?? job.query}`,
    ...job.candidates
      .filter((candidate) => candidate.status !== "rejected")
      .slice(0, 4)
      .map((candidate) => `${formatTimestamp(candidate.timestampSeconds)} ${candidate.title}: ${candidate.note}`),
  ];

  return lines.join("\n").slice(0, 1800);
}

function toPlaybackJob(job: WatchJob): PlaybackJob {
  return {
    candidates: job.candidates,
    clipName: job.clipName,
    clipUrl: job.clipUrl,
    compiledIntent: job.compiledIntent,
    id: job.id,
    lastViewedTimestamp: job.lastViewedTimestamp,
    query: job.query,
  };
}

function CvPreview({ cvContext }: { cvContext: CvContext | undefined }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const peak = cvContext?.peakFrame;
    if (!canvas || !peak?.imageDataUrl) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = peak.imageDataUrl;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      ctx.lineWidth = 2;
      ctx.font = "bold 11px sans-serif";

      for (const det of peak.detections) {
        const [x1, y1, x2, y2] = det.bbox;
        const px = x1 * img.width;
        const py = y1 * img.height;
        const pw = (x2 - x1) * img.width;
        const ph = (y2 - y1) * img.height;

        ctx.strokeStyle = det.kind === "person" ? "#b7ff5c" : "#ff9800";
        ctx.strokeRect(px, py, pw, ph);

        ctx.fillStyle = det.kind === "person" ? "#b7ff5c" : "#ff9800";
        const detLabel = det.class ?? det.label ?? det.kind;
        ctx.fillRect(px, py - 16, ctx.measureText(detLabel).width + 8, 16);
        ctx.fillStyle = "#141610";
        ctx.fillText(detLabel, px + 4, py - 4);
      }
    };
  }, [cvContext?.peakFrame]);

  if (!cvContext) return null;

  const { summary, peakFrame } = cvContext;
  const needsBetterFrames = summary.maxPeopleCount === 0 && (summary.usableFrameCount ?? summary.totalFrames) < 12;
  const peopleVisibleLabel = needsBetterFrames
    ? "CV needs better frames"
    : `${summary.maxPeopleCount} max · ${summary.avgPeopleCount} avg`;

  return (
    <section className="axis-watch__card axis-cv" aria-labelledby="axis-cv-title">
      <div className="axis-watch__section-title">
        <h2 id="axis-cv-title">What Axis Saw</h2>
        <span className="axis-cv__provider">{summary.provider}</span>
      </div>

      <dl className="axis-cv__summary">
        <div>
          <dt>People visible</dt>
          <dd>{peopleVisibleLabel}</dd>
        </div>
        <div>
          <dt>Frames with people</dt>
          <dd>{summary.framesWithPeople} / {summary.totalFrames}</dd>
        </div>
      </dl>

      {peakFrame && (
        <div className="axis-cv__preview">
          <canvas className="axis-cv__canvas" ref={canvasRef} />
          <span className="axis-cv__frame-label">
            {peakFrame.peopleCount} {peakFrame.peopleCount === 1 ? "person" : "people"} · {formatTimestamp(peakFrame.timestampSeconds)}
          </span>
        </div>
      )}

      {(summary.status === "failed" || summary.status === "not_configured") && (
        <p className="axis-cv__fallback">
          {summary.failReason === "no_frames_sampled"
            ? "Could not read frames from this clip. Check the video format."
            : summary.failReason
              ? summary.failReason
              : summary.status === "not_configured"
                ? "No CV provider configured. Set AXIS_VISION_DETECTOR_URL or ROBOFLOW_API_KEY."
                : "CV provider did not respond."
          }
        </p>
      )}
    </section>
  );
}

function AxisReport({
  job,
  onIncludeInReport,
}: {
  job: WatchJob;
  onIncludeInReport: (id: string) => void;
}) {
  void onIncludeInReport;
  const reportFindings = dedupeById(job.candidates).filter((c) => c.status === "accepted");
  const sorted = [...reportFindings].sort((a, b) => (b.evidenceScore ?? 0) - (a.evidenceScore ?? 0));
  const bestMoment = sorted[0];
  const biggestIssue = reportFindings.find(
    (c) => c.labels.includes("breakdown") || c.labels.includes("spacing_issue"),
  );
  const nextAction = job.suggestedNextQueries?.[0];
  const cv = job.cvContext?.summary;

  return (
    <section className="axis-watch__card axis-report" aria-labelledby="axis-report-title" id="axis-report">
      <div className="axis-watch__section-title">
        <h2 id="axis-report-title">Axis Report</h2>
        <div className="axis-report__title-actions">
          <span>{reportFindings.length} finding{reportFindings.length === 1 ? "" : "s"}</span>
          <button
            className="axis-report__export"
            onClick={() => void navigator.clipboard.writeText(buildReportLines(job).join("\n"))}
            type="button"
          >
            Copy
          </button>
        </div>
      </div>

      <p className="axis-report__intent">{job.compiledIntent ?? job.query}</p>

      {cv && (
        <div className="axis-report__cv-row">
          <span className="axis-report__label">What Axis saw</span>
          <span className="axis-report__cv-stat">
            {cv.maxPeopleCount === 0 && (cv.usableFrameCount ?? cv.totalFrames) < 12
              ? "CV needs better frames"
              : `${cv.maxPeopleCount} people visible · ${cv.framesWithPeople}/${cv.totalFrames} frames · ${cv.provider}`}
          </span>
        </div>
      )}

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
  const checkItems = dedupeById(candidates).filter(
    (c) => c.evidenceBucket === "check_this" && c.status === "pending",
  );
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
  // Deduplicate by id, then exclude findings already surfaced in AxisReport (accepted)
  // and CheckThese (check_this + pending) — those sections own those findings.
  const allUnique = dedupeById(job.candidates);
  const reportedCount = allUnique.filter((c) => c.status === "accepted").length;
  const pendingCount = allUnique.filter(
    (c) => c.evidenceBucket === "check_this" && c.status === "pending",
  ).length;
  const dataFindings = allUnique.filter(
    (c) =>
      c.status !== "accepted" &&
      !(c.evidenceBucket === "check_this" && c.status === "pending"),
  );

  return (
    <details className="axis-watch__card axis-clip-data">
      <summary>
        <span>Clip Data</span>
        <span className="axis-clip-data__meta">{allUnique.length} total · {job.clipName}</span>
      </summary>
      {(reportedCount > 0 || pendingCount > 0) && (
        <p className="axis-clip-data__surfaced">
          {[
            reportedCount > 0 && `${reportedCount} in report`,
            pendingCount > 0 && `${pendingCount} under review`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      {notEnoughEvidence.length > 0 && (
        <div className="axis-clip-data__section">
          <span className="axis-report__label">Not enough evidence</span>
          <ul className="axis-clip-data__limits">
            {notEnoughEvidence.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </div>
      )}
      <div className="axis-watch__candidates">
        {dataFindings.length === 0 && (
          <p className="axis-clip-data__empty">All findings are in the report or under review.</p>
        )}
        {dataFindings.map((f) => (
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

  const cvReady = job.cvStatus === "ready";
  const cvStatus = job.cvContext?.summary.status;
  const cvLabel = (() => {
    if (job.cvStatus === "sampling") return "Scanning…";
    if (job.cvStatus === "failed") return "CV unavailable";
    if (!cvReady) return null;
    if (cvStatus === "not_configured") return null; // hide badge entirely
    if (cvStatus === "failed") return "CV unavailable";
    // connected: show actual count (even 0 — means provider answered with no detections)
    return `${job.cvContext?.summary.maxPeopleCount ?? 0} people`;
  })();

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
        {cvLabel && (
          <span
            className="axis-watch__cv-badge"
            data-cv-status={job.cvStatus}
            title={job.cvContext?.summary.failReason ?? job.cvContext?.summary.provider}
          >
            CV · {cvLabel}
          </span>
        )}
        {job.status === "ready" && <span>{job.candidates.length} findings</span>}
        {job.status === "failed" && <button onClick={onRetry} type="button">Retry</button>}
      </div>
      {job.error && <em>{job.error}</em>}
    </section>
  );
}

// ─── Next Action ──────────────────────────────────────────────────────────────

type NextActionKind =
  | "connect_cv"
  | "export_clip"
  | "recheck_segment"
  | "review_uncertain"
  | "run_ball_watch";

type NextAction = {
  candidateId?: string;
  cta: string;
  description: string;
  kind: NextActionKind;
  timestamp?: number;
};

type HealthResult = {
  overall: "degraded" | "offline" | "ready";
  roboflow: { configured: boolean; error?: string; latencyMs?: number; reachable: boolean; validKey?: boolean };
  yolo: { configured: boolean; error?: string; latencyMs?: number; reachable: boolean; url: string };
};

function computeNextAction(job: WatchJob): NextAction | null {
  const unique = dedupeById(job.candidates);
  const accepted = unique.filter((c) => c.status === "accepted");
  const checkItems = unique.filter(
    (c) => c.evidenceBucket === "check_this" && c.status === "pending",
  );
  const recheckable = unique.filter(
    (c) => c.evidenceBucket === "not_enough_evidence" && c.status !== "rejected",
  );

  // 1. CV failed or not configured → surface the issue
  const cvCtxStatus = job.cvContext?.summary.status;
  if (
    (job.cvStatus === "failed" || cvCtxStatus === "failed" || cvCtxStatus === "not_configured") &&
    job.cvStatus !== "sampling"
  ) {
    return {
      cta: "Check CV Status",
      description:
        cvCtxStatus === "not_configured"
          ? "No CV provider configured. Set AXIS_VISION_DETECTOR_URL or ROBOFLOW_API_KEY to enable detection."
          : "CV provider did not respond. Check that the detector is running and reachable.",
      kind: "connect_cv",
    };
  }

  // 2. Uncertain findings waiting for review
  if (checkItems.length > 0) {
    return {
      cta: "Review Now",
      description: `${checkItems.length} finding${checkItems.length === 1 ? "" : "s"} ${checkItems.length === 1 ? "needs" : "need"} coach sign-off before the report is final.`,
      kind: "review_uncertain",
    };
  }

  // 3. Report ready — export
  if (accepted.length > 0) {
    const best = [...accepted].sort((a, b) => (b.evidenceScore ?? 0) - (a.evidenceScore ?? 0))[0];
    return {
      candidateId: best.id,
      cta: "Copy Report",
      description: `Report has ${accepted.length} confirmed finding${accepted.length === 1 ? "" : "s"}. Export or share.`,
      kind: "export_clip",
    };
  }

  // 4. Segments with insufficient evidence — recheck
  if (recheckable.length > 0) {
    const first = recheckable[0];
    return {
      candidateId: first.id,
      cta: "Open Workbench",
      description: `${recheckable.length} segment${recheckable.length === 1 ? "" : "s"} lacked enough evidence. Recheck in the workbench.`,
      kind: "recheck_segment",
      timestamp: first.timestampSeconds,
    };
  }

  // 5. Shot/ball query with no findings → run a focused ball watch
  if (/shot|make|miss|basket|score|ball/i.test(job.query)) {
    return {
      cta: "Watch for Shots",
      description: "No shot evidence found. Run a focused ball watch with a tighter query.",
      kind: "run_ball_watch",
    };
  }

  return null;
}

function NextActionCard({
  job,
  onCopyReport,
  onOpenWorkbench,
  onSetQuery,
}: {
  job: WatchJob;
  onCopyReport: () => void;
  onOpenWorkbench: () => void;
  onSetQuery: (q: string) => void;
}) {
  const action = computeNextAction(job);
  const [healthResult, setHealthResult] = useState<HealthResult | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  async function runHealthCheck() {
    setHealthLoading(true);
    try {
      const response = await fetch("/api/axis/cv/health");
      const data = (await response.json()) as HealthResult;
      setHealthResult(data);
    } catch {
      setHealthResult(null);
    } finally {
      setHealthLoading(false);
    }
  }

  if (!action) return null;

  function handleCta() {
    if (!action) return;
    if (action.kind === "connect_cv") {
      void runHealthCheck();
      return;
    }
    if (action.kind === "review_uncertain") {
      document.getElementById("check-these")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (action.kind === "export_clip") {
      onCopyReport();
      return;
    }
    if (action.kind === "recheck_segment") {
      onOpenWorkbench();
      return;
    }
    if (action.kind === "run_ball_watch") {
      onSetQuery("Watch for shot attempts and ball movement.");
      document.querySelector<HTMLTextAreaElement>(".axis-watch__query-field textarea")?.focus();
      return;
    }
  }

  return (
    <section
      className="axis-watch__card axis-next-action"
      aria-label="Next action"
      data-kind={action.kind}
    >
      <div className="axis-next-action__body">
        <div className="axis-next-action__text">
          <span className="axis-next-action__kind">{actionKindLabel(action.kind)}</span>
          <p className="axis-next-action__desc">{action.description}</p>
        </div>
        <button
          className="axis-next-action__cta"
          disabled={healthLoading}
          onClick={handleCta}
          type="button"
        >
          {healthLoading ? "Checking…" : action.cta}
        </button>
      </div>

      {healthResult && (
        <div className="axis-health__result" aria-live="polite">
          <HealthStatusRow label="Roboflow" entry={healthResult.roboflow} />
          <HealthStatusRow label="Detector" entry={healthResult.yolo} />
          {healthResult.roboflow.error && (
            <p className="axis-health__hint">{healthResult.roboflow.error}</p>
          )}
          {healthResult.yolo.error && (
            <p className="axis-health__hint">{healthResult.yolo.error}</p>
          )}
        </div>
      )}
    </section>
  );
}

function HealthStatusRow({
  entry,
  label,
}: {
  entry: { configured: boolean; latencyMs?: number; reachable: boolean };
  label: string;
}) {
  const status = !entry.configured
    ? "not configured"
    : entry.reachable
      ? `online · ${entry.latencyMs ?? "–"}ms`
      : "offline";

  return (
    <div className="axis-health__row" data-reachable={entry.reachable && entry.configured}>
      <span className="axis-health__dot" aria-hidden="true" />
      <span className="axis-health__label">{label}</span>
      <span className="axis-health__status">{status}</span>
    </div>
  );
}

function actionKindLabel(kind: NextActionKind): string {
  const labels: Record<NextActionKind, string> = {
    connect_cv: "Connect CV",
    export_clip: "Export Ready",
    recheck_segment: "Recheck",
    review_uncertain: "Review Needed",
    run_ball_watch: "Suggested",
  };
  return labels[kind];
}

function getStatusLabel(status: WatchStatus) {
  const labels: Record<WatchStatus, string> = {
    failed: "Failed",
    queued: "Analyzing clip",
    ready: "Ready",
    sampling: "Finding the play",
    watching: "Building report",
  };
  return labels[status];
}

async function sampleVideoFrames(videoUrl: string, maxFrames: number) {
  const video = document.createElement("video");
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;
  // Do NOT set crossOrigin on blob: URLs — causes CORS rejection on some browsers
  // and blob URLs don't need it.

  try {
    await waitForVideoMetadata(video);
  } catch (err) {
    console.log(`[CV_CLIENT] sampleVideoFrames: metadata failed — ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }

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

async function sampleUsableCvFrames(videoUrl: string): Promise<CvSampleResult> {
  const video = document.createElement("video");
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;

  try {
    await waitForVideoMetadata(video);
  } catch (err) {
    console.log(`[CV_CLIENT] sampleUsableCvFrames: metadata failed - ${err instanceof Error ? err.message : String(err)}`);
    return { frameCount: 0, frames: [], skippedFrameCount: 0, usableFrameCount: 0 };
  }

  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
  const targetInterval = duration >= 60 ? 1 : 0.5;
  const frameCount = Math.min(60, Math.max(24, Math.floor(duration / targetInterval) + 1));
  const canvas = document.createElement("canvas");
  const width = Math.min(640, video.videoWidth || 640);
  const height = Math.max(1, Math.round(width / ((video.videoWidth || 16) / (video.videoHeight || 9))));
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { frameCount, frames: [], skippedFrameCount: frameCount, usableFrameCount: 0 };

  const frames: CvFrameInput[] = [];
  let skippedFrameCount = 0;

  for (let index = 0; index < frameCount; index += 1) {
    const denominator = Math.max(1, frameCount - 1);
    const timestampSeconds = Math.min(duration, (duration * index) / denominator);
    video.currentTime = timestampSeconds;
    await waitForSeek(video);
    context.drawImage(video, 0, 0, width, height);

    const quality = inspectFrameQuality(context, width, height);
    if (!quality.usable) {
      skippedFrameCount += 1;
      continue;
    }

    frames.push({ imageDataUrl: canvas.toDataURL("image/jpeg", 0.72), timestampSeconds });
  }

  console.log(
    `[CV_CLIENT_SAMPLING] frameCount=${frameCount} usableFrameCount=${frames.length} skippedFrameCount=${skippedFrameCount}`,
  );

  return {
    frameCount,
    frames,
    skippedFrameCount,
    usableFrameCount: frames.length,
  };
}

function inspectFrameQuality(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): { reason?: string; usable: boolean } {
  const image = context.getImageData(0, 0, width, height).data;

  let brightnessSum = 0;
  let brightnessSquaredSum = 0;
  let darkPixelCount = 0;
  let edgeSum = 0;
  let greenDominantCount = 0;
  const pixelCount = width * height;

  for (let index = 0; index < image.length; index += 4) {
    const r = image[index] ?? 0;
    const g = image[index + 1] ?? 0;
    const b = image[index + 2] ?? 0;
    const brightness = (r + g + b) / 3;
    brightnessSum += brightness;
    brightnessSquaredSum += brightness * brightness;
    if (brightness < 18) darkPixelCount += 1;
    if (g > r * 1.08 && g > b * 1.08 && brightness > 45) greenDominantCount += 1;

    if (index >= 4) {
      const prev = (image[index - 4] + image[index - 3] + image[index - 2]) / 3;
      edgeSum += Math.abs(brightness - prev);
    }
  }

  const mean = brightnessSum / pixelCount;
  const variance = brightnessSquaredSum / pixelCount - mean * mean;
  const contrast = Math.sqrt(Math.max(0, variance));
  const darkRatio = darkPixelCount / pixelCount;
  const edgeMean = edgeSum / Math.max(1, pixelCount - 1);
  const greenDominantRatio = greenDominantCount / pixelCount;

  if (mean < 24 || darkRatio > 0.9) return { reason: "too_dark", usable: false };
  if (contrast < 5) return { reason: "blank", usable: false };
  if (edgeMean < 1.1) return { reason: "too_blurry", usable: false };
  if (greenDominantRatio > 0.82 && contrast < 18) return { reason: "floor_only", usable: false };

  return { usable: true };
}

function waitForVideoMetadata(video: HTMLVideoElement) {
  return new Promise<void>((resolve, reject) => {
    // 12s timeout — handles slow blob loading and prevents silent hangs
    const timer = setTimeout(
      () => reject(new Error("Video metadata load timed out (12s)")),
      12_000,
    );
    const done = (err?: Error) => { clearTimeout(timer); if (err) reject(err); else resolve(); };
    video.onloadedmetadata = () => done();
    video.onerror = () => done(new Error("Clip could not load — check video format."));
    // Explicit load() call so the browser starts fetching even without autoplay
    video.load();
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

function dedupeById<T extends { id: string }>(arr: T[]): T[] {
  return Array.from(new Map(arr.map((item) => [item.id, item])).values());
}

function buildReportLines(job: WatchJob): string[] {
  const reportFindings = dedupeById(job.candidates).filter((c) => c.status === "accepted");
  const checkItems = dedupeById(job.candidates).filter(
    (c) => c.evidenceBucket === "check_this" && c.status === "pending",
  );
  const cv = job.cvContext?.summary;

  const lines: string[] = [
    `AXIS REPORT — ${job.clipName}`,
    new Date().toLocaleDateString(),
    "",
    `Axis watched for: ${job.compiledIntent ?? job.query}`,
  ];

  if (cv && cv.status === "connected") {
    lines.push("", "CV EVIDENCE");
    lines.push(`Provider: ${cv.provider}`);
    lines.push(`People visible: ${cv.maxPeopleCount} max (avg ${cv.avgPeopleCount})`);
    lines.push(`Frames with people: ${cv.framesWithPeople}/${cv.totalFrames}`);
  }

  if (reportFindings.length > 0) {
    lines.push("", "KEY FINDINGS");
    for (const f of reportFindings) {
      lines.push(`[${formatTimestamp(f.timestampSeconds)}] ${f.title} — ${f.note}`);
    }
  }

  if (checkItems.length > 0) {
    lines.push("", "CHECK THESE");
    for (const c of checkItems) {
      lines.push(`[${formatTimestamp(c.timestampSeconds)}] ${c.title}`);
    }
  }

  return lines;
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

  .axis-watch__query-box {
    display: grid;
    gap: 0.65rem;
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

  .axis-watch__open-wb {
    background: rgba(20, 22, 16, 0.06);
    border: 1px solid rgba(20, 22, 16, 0.14);
    border-radius: 0.65rem;
    color: #141610;
    cursor: pointer;
    font: inherit;
    font-size: 0.78rem;
    font-weight: 850;
    min-height: 2.4rem;
    padding: 0 0.8rem;
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  .axis-watch__open-wb:hover {
    background: rgba(20, 22, 16, 0.1);
    border-color: rgba(20, 22, 16, 0.22);
  }

  /* ── Next Action card ──────────────────────────────────────── */
  .axis-next-action {
    border-left: 3px solid rgba(183, 255, 92, 0.52);
    display: grid;
    gap: 0.6rem;
  }

  .axis-next-action__body {
    align-items: center;
    display: flex;
    gap: 0.9rem;
    justify-content: space-between;
  }

  .axis-next-action__text {
    display: grid;
    gap: 0.2rem;
    min-width: 0;
  }

  .axis-next-action__kind {
    color: rgba(20, 22, 16, 0.52);
    font-size: 0.62rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .axis-next-action[data-kind="connect_cv"] .axis-next-action__kind {
    color: rgba(180, 80, 40, 0.88);
  }

  .axis-next-action[data-kind="review_uncertain"] .axis-next-action__kind {
    color: rgba(20, 22, 16, 0.68);
  }

  .axis-next-action[data-kind="export_clip"] .axis-next-action__kind {
    color: rgba(40, 120, 40, 0.88);
  }

  .axis-next-action__desc {
    color: rgba(20, 22, 16, 0.74);
    font-size: 0.86rem;
    line-height: 1.4;
    margin: 0;
  }

  .axis-next-action__cta {
    background: #141610;
    border: 1px solid #141610;
    border-radius: 0.65rem;
    color: #b7ff5c;
    cursor: pointer;
    flex-shrink: 0;
    font: inherit;
    font-size: 0.8rem;
    font-weight: 900;
    min-height: 2.5rem;
    padding: 0 0.85rem;
    transition: background 0.15s ease, box-shadow 0.15s ease;
    white-space: nowrap;
  }

  .axis-next-action__cta:hover:not(:disabled) {
    background: #1e2016;
    box-shadow: 0 3px 12px rgba(20, 22, 16, 0.18);
  }

  .axis-next-action__cta:disabled {
    opacity: 0.48;
  }

  /* ── CV Health status ──────────────────────────────────────── */
  .axis-health__result {
    border-top: 1px solid rgba(20, 22, 16, 0.1);
    display: grid;
    gap: 0.38rem;
    padding-top: 0.6rem;
  }

  .axis-health__row {
    align-items: center;
    display: flex;
    gap: 0.55rem;
  }

  .axis-health__dot {
    background: rgba(20, 22, 16, 0.24);
    border-radius: 50%;
    flex-shrink: 0;
    height: 0.52rem;
    width: 0.52rem;
  }

  .axis-health__row[data-reachable="true"] .axis-health__dot {
    background: #48a83a;
  }

  .axis-health__label {
    color: #141610;
    font-size: 0.76rem;
    font-weight: 800;
    min-width: 6ch;
  }

  .axis-health__status {
    color: rgba(20, 22, 16, 0.58);
    font-size: 0.76rem;
    font-family: monospace;
  }

  .axis-health__row[data-reachable="true"] .axis-health__status {
    color: rgba(40, 100, 30, 0.88);
  }

  .axis-health__hint {
    color: rgba(20, 22, 16, 0.58);
    font-size: 0.74rem;
    font-style: italic;
    line-height: 1.4;
    margin: 0.15rem 0 0;
  }

  .axis-clip-data__surfaced {
    color: rgba(20, 22, 16, 0.52);
    font-size: 0.76rem;
    margin: 0;
  }

  .axis-clip-data__empty {
    color: rgba(20, 22, 16, 0.52);
    font-size: 0.82rem;
    font-style: italic;
    margin: 0;
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

  .axis-report__title-actions {
    align-items: center;
    display: flex;
    gap: 0.55rem;
  }

  .axis-report__export {
    background: rgba(20, 22, 16, 0.06);
    border: 1px solid rgba(20, 22, 16, 0.14);
    color: #141610;
    font-size: 0.72rem;
    font-weight: 950;
    letter-spacing: 0.06em;
    min-height: 1.9rem;
    padding: 0 0.6rem;
    text-transform: uppercase;
  }

  .axis-report__cv-row {
    align-items: baseline;
    border-top: 1px solid rgba(20, 22, 16, 0.08);
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding-top: 0.65rem;
  }

  .axis-report__cv-stat {
    color: rgba(20, 22, 16, 0.62);
    font-size: 0.82rem;
  }

  /* CV Preview */

  .axis-cv {
    border-color: rgba(20, 22, 16, 0.12);
  }

  .axis-cv__provider {
    color: rgba(20, 22, 16, 0.52);
    font-size: 0.68rem;
    font-weight: 950;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .axis-cv__summary {
    display: grid;
    gap: 0;
    margin: 0;
  }

  .axis-cv__summary div {
    border-top: 1px solid rgba(20, 22, 16, 0.08);
    display: grid;
    gap: 0.15rem;
    padding: 0.55rem 0;
  }

  .axis-cv__summary dt {
    color: rgba(20, 22, 16, 0.52);
    font-size: 0.68rem;
    font-weight: 950;
    letter-spacing: 0.08em;
    margin: 0;
    text-transform: uppercase;
  }

  .axis-cv__summary dd {
    margin: 0;
  }

  .axis-cv__preview {
    border-top: 1px solid rgba(20, 22, 16, 0.08);
    display: grid;
    gap: 0.4rem;
    padding-top: 0.7rem;
  }

  .axis-cv__canvas {
    border-radius: 0.45rem;
    display: block;
    max-height: 24rem;
    object-fit: contain;
    width: 100%;
  }

  .axis-cv__frame-label {
    color: rgba(20, 22, 16, 0.54);
    font-size: 0.68rem;
    font-weight: 950;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .axis-cv__fallback {
    color: rgba(20, 22, 16, 0.52);
    font-size: 0.82rem;
    margin: 0;
  }

  .axis-watch__cv-badge {
    background: rgba(20, 22, 16, 0.06);
    border: 1px solid rgba(20, 22, 16, 0.1);
    border-radius: 999px;
    color: rgba(20, 22, 16, 0.62);
    font-size: 0.68rem;
    font-weight: 950;
    letter-spacing: 0.06em;
    padding: 0.28rem 0.55rem;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .axis-watch__cv-badge[data-cv-status="ready"] {
    background: rgba(72, 150, 48, 0.10);
    border-color: rgba(72, 150, 48, 0.22);
    color: #214a1a;
  }

  .axis-watch__cv-badge[data-cv-status="sampling"] {
    background: rgba(183, 255, 92, 0.14);
    border-color: rgba(20, 22, 16, 0.12);
    color: #141610;
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
      grid-template-columns: auto minmax(0, 1fr);
    }

    .axis-watch__query-box {
      align-items: end;
      grid-template-columns: minmax(0, 1fr) minmax(14rem, 18rem);
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
