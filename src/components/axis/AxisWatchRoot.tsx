"use client";

import { useRef, useState } from "react";

type WatchStatus = "queued" | "sampling" | "watching" | "ready" | "failed";

type WatchCandidate = {
  id: string;
  note: string;
  timestampSeconds: number;
  title: string;
  status: "pending" | "accepted" | "rejected";
};

type WatchJob = {
  acceptedCount: number;
  candidates: WatchCandidate[];
  clipName: string;
  createdAt: string;
  error?: string;
  id: string;
  query: string;
  sampledFrameCount: number;
  status: WatchStatus;
};

const quickQueries = [
  "Watch for spacing breakdowns in Delta offense.",
  "Find rushed decisions.",
  "Find poor transition spacing.",
  "Watch weak-side movement.",
  "Find coachable moments.",
];

export function AxisWatchRoot() {
  const [clipFile, setClipFile] = useState<File | null>(null);
  const [clipUrl, setClipUrl] = useState("");
  const [query, setQuery] = useState("Watch for spacing breakdowns in Delta offense.");
  const [jobs, setJobs] = useState<WatchJob[]>([]);
  const [recordingState, setRecordingState] = useState<"idle" | "preview" | "recording">("idle");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

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

  async function watchWithAxis() {
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

    try {
      updateJob(jobId, { status: "sampling" });
      const frames = await sampleVideoFrames(clipUrl, 60);
      updateJob(jobId, { sampledFrameCount: frames.length, status: "watching" });
      const response = await fetch("/api/axis/watch", {
        body: JSON.stringify({ frames, query: query.trim() }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { candidates?: Array<Omit<WatchCandidate, "status">>; error?: string };
      if (!response.ok || !payload.candidates) {
        updateJob(jobId, { error: payload.error || "Axis could not watch this clip.", status: "failed" });
        return;
      }
      updateJob(jobId, {
        candidates: payload.candidates.map((candidate) => ({ ...candidate, status: "pending" })),
        status: "ready",
      });
    } catch {
      updateJob(jobId, { error: "Axis could not sample or watch this clip.", status: "failed" });
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
  const acceptedCandidates = latestReadyJob?.candidates.filter((candidate) => candidate.status === "accepted") ?? [];

  return (
    <main className="axis-watch" aria-labelledby="axis-watch-title">
      <div className="axis-signal axis-signal--grid" aria-hidden="true" />
      <div className="axis-signal axis-signal--scan" aria-hidden="true" />
      <section className="axis-watch__shell">
        <header className="axis-watch__header">
          <p>AXIS</p>
          <h1 id="axis-watch-title">AXIS</h1>
          <span>Ask, attach, run, review, continue.</span>
        </header>

        <section className="axis-watch__composer" aria-label="Axis execution composer">
          <div className="axis-watch__signal-label" aria-hidden="true">EXECUTION COMPOSER</div>
          <label className="axis-watch__query-field">
            <span>Axis Query Bar</span>
            <textarea onChange={(event) => setQuery(event.target.value)} rows={4} value={query} />
          </label>
          <input
            accept="video/*"
            className="axis-watch__hidden-file"
            onChange={(event) => setUploadedClip(event.target.files?.[0] ?? null)}
            ref={fileInputRef}
            type="file"
          />
          <div className="axis-watch__tool-menu" aria-label="Axis tools">
            <button onClick={() => fileInputRef.current?.click()} type="button">+ Upload Clip</button>
            {recordingState === "idle" && <button onClick={() => void startRecordingPreview()} type="button">+ Record Clip</button>}
            {recordingState === "preview" && <button onClick={startRecording} type="button">Start Recording</button>}
            {recordingState === "recording" && <button onClick={stopRecording} type="button">Stop Recording</button>}
            {recordingState !== "idle" && <button onClick={stopRecordingPreview} type="button">Cancel</button>}
            <a href="/axis/routine">Build Routine Context</a>
            <a href="#watch-queue">Watch Queue</a>
            <a href="#report-preview">Reports</a>
          </div>
          <div className="axis-watch__chips" aria-label="Quick watch queries">
            {quickQueries.map((chip) => (
              <button key={chip} onClick={() => setQuery(chip)} type="button">{chip}</button>
            ))}
          </div>
          <div className="axis-watch__attach-row">
            <span>{clipFile ? `Clip attached: ${clipFile.name}` : "Attach or record a clip to run Axis."}</span>
            <button className="axis-watch__primary" disabled={!clipUrl || !query.trim()} onClick={() => void watchWithAxis()} type="button">
              Watch with Axis
            </button>
          </div>
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
          <section className="axis-watch__card axis-watch__completion" aria-labelledby="axis-completion-title">
            <div className="axis-watch__section-title">
              <h2 id="axis-completion-title">Ready for review</h2>
              <span>{latestReadyJob.candidates.length} candidate{latestReadyJob.candidates.length === 1 ? "" : "s"}</span>
            </div>
            <dl className="axis-watch__result-grid">
              <div>
                <dt>Query used</dt>
                <dd>{latestReadyJob.query}</dd>
              </div>
              <div>
                <dt>Clip name</dt>
                <dd>{latestReadyJob.clipName}</dd>
              </div>
              <div>
                <dt>Frames sampled</dt>
                <dd>{latestReadyJob.sampledFrameCount}</dd>
              </div>
              <div>
                <dt>Candidates found</dt>
                <dd>{latestReadyJob.candidates.length}</dd>
              </div>
            </dl>
            <div className="axis-watch__limitations">
              <span>Limitations</span>
              <p>Axis is creating review candidates from the clip and your query. It is not claiming identity, stats, shots, rim, or ball truth.</p>
            </div>
            <div className="axis-watch__next-actions" aria-label="Next actions">
              <a href="#candidate-review">Review</a>
              <a href="#clip-question">Ask about this clip...</a>
              <a href="#report-preview">Make report</a>
            </div>
          </section>
        )}

        <section className="axis-watch__card" aria-labelledby="axis-watch-queue-title" id="watch-queue">
          <div className="axis-watch__section-title">
            <h2 id="axis-watch-queue-title">Watch Queue</h2>
            <span>{jobs.length === 0 ? "No clips queued yet." : `${jobs.length} local job${jobs.length === 1 ? "" : "s"}`}</span>
          </div>
          <div className="axis-watch__queue">
            {jobs.length === 0 && (
              <div className="axis-watch__empty">
                <span>NO SIGNAL PLACED</span>
                <strong>Queue a clip to create candidate moments.</strong>
              </div>
            )}
            {jobs.map((job) => (
              <article className="axis-watch__job" data-status={job.status} key={job.id}>
                <div>
                  <strong>{job.clipName}</strong>
                  <span>{job.status}</span>
                </div>
                <p>{job.query}</p>
                <small>{job.sampledFrameCount > 0 ? `${job.sampledFrameCount} sampled frames` : "Waiting for frames"}</small>
                {job.error && <em>{job.error}</em>}
                {job.status === "ready" && (
                  <CandidateReview candidates={job.candidates} jobId={job.id} onUpdateCandidate={updateCandidate} sectionId={job.id === latestReadyJob?.id ? "candidate-review" : undefined} />
                )}
              </article>
            ))}
          </div>
        </section>

        {latestReadyJob && (
          <section className="axis-watch__card" aria-label="Clip follow up" id="clip-question">
            <label>
              <span>Ask about this clip...</span>
              <input placeholder="Ask about this clip..." type="text" />
            </label>
          </section>
        )}

        <section className="axis-watch__card" aria-labelledby="axis-report-preview-title" id="report-preview">
          <div className="axis-watch__section-title axis-watch__report-cover">
            <h2 id="axis-report-preview-title">Report Preview</h2>
            <span>Accepted candidates only.</span>
          </div>
          {acceptedCandidates.length === 0 ? (
            <p>No accepted moments yet.</p>
          ) : (
            <ul className="axis-watch__report-list">
              {acceptedCandidates.map((candidate) => (
                <li key={candidate.id}>
                  <strong>{candidate.title}</strong>
                  <span>{formatTimestamp(candidate.timestampSeconds)} - {candidate.note}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>

      <style jsx>{styles}</style>
    </main>
  );
}

function CandidateReview({
  candidates,
  jobId,
  onUpdateCandidate,
  sectionId,
}: {
  candidates: WatchCandidate[];
  jobId: string;
  onUpdateCandidate: (jobId: string, candidateId: string, patch: Partial<WatchCandidate>) => void;
  sectionId?: string;
}) {
  return (
    <div className="axis-watch__candidates" id={sectionId}>
      {candidates.map((candidate) => (
        <article data-review-status={candidate.status} key={candidate.id}>
          <div className="axis-watch__candidate-time">
            <i aria-hidden="true" />
            <span>{formatTimestamp(candidate.timestampSeconds)}</span>
          </div>
          <input
            aria-label="Candidate title"
            onChange={(event) => onUpdateCandidate(jobId, candidate.id, { title: event.target.value })}
            value={candidate.title}
          />
          <textarea
            aria-label="Candidate note"
            onChange={(event) => onUpdateCandidate(jobId, candidate.id, { note: event.target.value })}
            rows={2}
            value={candidate.note}
          />
          <div className="axis-watch__candidate-actions">
            <button onClick={() => onUpdateCandidate(jobId, candidate.id, { status: "accepted" })} type="button">Accept</button>
            <button onClick={() => onUpdateCandidate(jobId, candidate.id, { status: "rejected" })} type="button">Reject</button>
            <button onClick={() => onUpdateCandidate(jobId, candidate.id, { status: "pending" })} type="button">Edit</button>
          </div>
        </article>
      ))}
    </div>
  );
}

function ExecutionCard({ job, onRetry }: { job: WatchJob; onRetry: () => void }) {
  const steps: WatchStatus[] = ["queued", "sampling", "watching", "ready"];
  const statusIndex = job.status === "failed" ? -1 : steps.indexOf(job.status);

  return (
    <section className="axis-watch__card axis-watch__execution" aria-labelledby="axis-execution-title" data-status={job.status}>
      <div className="axis-watch__section-title">
        <h2 id="axis-execution-title">Running job</h2>
        <span>{getStatusLabel(job.status)}</span>
      </div>
      <div className="axis-watch__execution-main">
        <strong>{job.clipName}</strong>
        <p>{job.query}</p>
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
        <span>{job.sampledFrameCount > 0 ? `${job.sampledFrameCount} frames sampled` : "Preparing clip frames"}</span>
        {job.status === "ready" && <span>{job.candidates.length} candidates ready</span>}
        {job.status === "failed" && <button onClick={onRetry} type="button">Retry</button>}
      </div>
      {job.error && <em>{job.error}</em>}
    </section>
  );
}

function getStatusLabel(status: WatchStatus) {
  const labels: Record<WatchStatus, string> = {
    failed: "failed / retry",
    queued: "queued",
    ready: "ready for review",
    sampling: "sampling frames",
    watching: "watching",
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
    background:
      radial-gradient(circle at 18% 8%, rgba(183, 255, 92, 0.24), transparent 22rem),
      radial-gradient(circle at 84% 0%, rgba(28, 92, 255, 0.14), transparent 24rem),
      linear-gradient(180deg, #fbf8ef 0%, #efeadc 100%);
    color: #141610;
    isolation: isolate;
    min-height: 100dvh;
    overflow-x: hidden;
    padding: max(0.9rem, env(safe-area-inset-top)) 0.9rem max(5rem, env(safe-area-inset-bottom));
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
      linear-gradient(rgba(20, 22, 16, 0.045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(20, 22, 16, 0.04) 1px, transparent 1px),
      radial-gradient(circle, rgba(20, 22, 16, 0.14) 1px, transparent 1.5px);
    background-position: 0 0, 0 0, 0 0;
    background-size: 36px 36px, 36px 36px, 12px 12px;
    mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.9), transparent 78%);
    opacity: 0.72;
  }

  .axis-signal--scan {
    background:
      repeating-linear-gradient(180deg, rgba(20, 22, 16, 0.055) 0 1px, transparent 1px 6px),
      linear-gradient(90deg, transparent, rgba(183, 255, 92, 0.16), transparent);
    mix-blend-mode: multiply;
    opacity: 0.42;
  }

  .axis-watch__shell {
    display: grid;
    gap: 0.9rem;
    margin: 0 auto;
    max-width: 52rem;
    position: relative;
    z-index: 1;
  }

  .axis-watch__header {
    display: grid;
    gap: 0.3rem;
    overflow: hidden;
    padding: 0.15rem 0 0.35rem;
    position: relative;
  }

  .axis-watch__header::after {
    color: rgba(20, 22, 16, 0.18);
    content: "AXIS::EXECUTION 0101 / ASK->ATTACH->RUN->REVIEW";
    font-size: 0.64rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    line-height: 1;
    position: absolute;
    right: 0;
    top: 0.25rem;
    transform: translateY(-0.12rem);
    white-space: nowrap;
  }

  .axis-watch__header p,
  .axis-watch label span,
  .axis-watch__section-title span,
  .axis-watch__job span,
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
    font-size: clamp(3.4rem, 18vw, 7rem);
    font-weight: 950;
    letter-spacing: 0;
    line-height: 0.85;
    text-shadow: 0.04em 0 rgba(183, 255, 92, 0.26), -0.03em 0 rgba(20, 22, 16, 0.12);
  }

  .axis-watch h2 {
    font-size: 1.2rem;
    letter-spacing: 0;
  }

  .axis-watch__header span,
  .axis-watch__job p,
  .axis-watch__job small,
  .axis-watch__card > p {
    color: rgba(20, 22, 16, 0.68);
  }

  .axis-watch__card,
  .axis-watch__composer,
  .axis-watch__job,
  .axis-watch__candidates article {
    background: #fffdf7;
    border: 1px solid rgba(20, 22, 16, 0.12);
    border-radius: 0.55rem;
    box-shadow: 0 1.1rem 3rem rgba(20, 22, 16, 0.08);
    display: grid;
    gap: 0.7rem;
    overflow: hidden;
    padding: 0.85rem;
    position: relative;
  }

  .axis-watch__card::before,
  .axis-watch__composer::before,
  .axis-watch__job::before,
  .axis-watch__candidates article::before {
    background: linear-gradient(90deg, #141610, #b7ff5c 40%, transparent 72%);
    content: "";
    height: 3px;
    inset: 0 0 auto;
    opacity: 0.86;
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
    background:
      linear-gradient(135deg, rgba(20, 22, 16, 0.94), rgba(34, 38, 27, 0.92)),
      repeating-linear-gradient(90deg, rgba(183, 255, 92, 0.18) 0 1px, transparent 1px 8px);
    border-color: rgba(183, 255, 92, 0.38);
    color: #fffdf7;
    gap: 0.8rem;
    padding: 0.95rem;
  }

  .axis-watch__composer label span {
    color: rgba(255, 253, 247, 0.7);
  }

  .axis-watch__query-field textarea {
    border-color: rgba(183, 255, 92, 0.28);
    box-shadow: inset 0 0 0 1px rgba(183, 255, 92, 0.05);
    font-size: 1rem;
    line-height: 1.45;
    resize: vertical;
  }

  .axis-watch__signal-label {
    color: #b7ff5c;
    font-size: 0.65rem;
    font-weight: 950;
    letter-spacing: 0.18em;
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
    background: #fffdf7;
    border: 1px solid rgba(20, 22, 16, 0.16);
    border-radius: 0.5rem;
    color: #141610;
    font: inherit;
    min-height: 3rem;
    padding: 0.75rem;
    width: 100%;
  }

  .axis-watch__file input {
    background: #f7f4eb;
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
    border: 1px solid rgba(20, 22, 16, 0.16);
    border-radius: 0.55rem;
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
    color: rgba(183, 255, 92, 0.86);
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
    border-color: rgba(183, 255, 92, 0.72);
    border-style: solid;
    content: "";
    height: 1.8rem;
    position: absolute;
    width: 1.8rem;
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
      linear-gradient(rgba(183, 255, 92, 0.55), rgba(183, 255, 92, 0.55)) center / 1px 100% no-repeat,
      linear-gradient(90deg, rgba(183, 255, 92, 0.55), rgba(183, 255, 92, 0.55)) center / 100% 1px no-repeat;
    height: 2rem;
    left: 50%;
    opacity: 0.6;
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 2rem;
  }

  .axis-watch button {
    border-radius: 0.5rem;
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
    width: 100%;
  }

  .axis-watch__primary:disabled {
    opacity: 0.45;
  }

  .axis-watch__record,
  .axis-watch__tool-menu,
  .axis-watch__chips,
  .axis-watch__candidate-actions,
  .axis-watch__next-actions,
  .axis-watch__execution-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .axis-watch__record button,
  .axis-watch__tool-menu button,
  .axis-watch__tool-menu a,
  .axis-watch__chips button,
  .axis-watch__candidates button,
  .axis-watch__next-actions a,
  .axis-watch__execution-meta button {
    background: rgba(20, 22, 16, 0.06);
    border: 1px solid rgba(20, 22, 16, 0.14);
    border-radius: 0.5rem;
    color: #141610;
    font: inherit;
    font-weight: 850;
    min-height: 2.85rem;
    padding: 0 0.8rem;
  }

  .axis-watch__tool-menu button,
  .axis-watch__tool-menu a,
  .axis-watch__chips button {
    align-items: center;
    background: rgba(255, 253, 247, 0.08);
    border-color: rgba(255, 253, 247, 0.18);
    color: #fffdf7;
    display: inline-flex;
  }

  .axis-watch__tool-menu a {
    min-height: 2.85rem;
  }

  .axis-watch__attach-row {
    align-items: center;
    display: grid;
    gap: 0.6rem;
  }

  .axis-watch__attach-row > span {
    color: rgba(255, 253, 247, 0.72);
    font-size: 0.92rem;
    font-weight: 750;
  }

  .axis-watch__queue,
  .axis-watch__candidates,
  .axis-watch__report-list {
    display: grid;
    gap: 0.6rem;
  }

  .axis-watch__empty {
    background:
      radial-gradient(circle at 18% 50%, rgba(183, 255, 92, 0.22), transparent 12rem),
      repeating-linear-gradient(90deg, rgba(20, 22, 16, 0.08) 0 1px, transparent 1px 10px);
    border: 1px dashed rgba(20, 22, 16, 0.22);
    border-radius: 0.55rem;
    display: grid;
    gap: 0.25rem;
    min-height: 8rem;
    padding: 1rem;
    place-content: center;
    text-align: center;
  }

  .axis-watch__empty span {
    color: rgba(20, 22, 16, 0.52);
    font-size: 0.68rem;
    font-weight: 950;
    letter-spacing: 0.16em;
  }

  .axis-watch__empty strong {
    font-size: 1rem;
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
    border-color: rgba(72, 150, 48, 0.34);
  }

  .axis-watch__execution[data-status="sampling"],
  .axis-watch__execution[data-status="watching"],
  .axis-watch__execution[data-status="queued"] {
    border-color: rgba(183, 255, 92, 0.38);
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
    gap: 0.45rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .axis-watch__steps li {
    align-items: center;
    color: rgba(20, 22, 16, 0.52);
    display: flex;
    font-size: 0.78rem;
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
    background: #b7ff5c;
    box-shadow: 0 0 0 3px rgba(183, 255, 92, 0.22);
  }

  .axis-watch__steps li[data-current="true"] {
    color: #141610;
  }

  .axis-watch__execution-meta {
    align-items: center;
  }

  .axis-watch__execution-meta span {
    background: rgba(20, 22, 16, 0.06);
    border: 1px solid rgba(20, 22, 16, 0.1);
    border-radius: 999px;
    color: rgba(20, 22, 16, 0.66);
    font-size: 0.78rem;
    font-weight: 850;
    padding: 0.45rem 0.65rem;
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

  .axis-watch__completion {
    border-color: rgba(72, 150, 48, 0.34);
  }

  .axis-watch__result-grid {
    display: grid;
    gap: 0.55rem;
    margin: 0;
  }

  .axis-watch__result-grid div,
  .axis-watch__limitations {
    background: rgba(20, 22, 16, 0.045);
    border: 1px solid rgba(20, 22, 16, 0.08);
    border-radius: 0.5rem;
    display: grid;
    gap: 0.2rem;
    margin: 0;
    padding: 0.65rem;
  }

  .axis-watch__result-grid dt,
  .axis-watch__limitations span {
    color: rgba(20, 22, 16, 0.54);
    font-size: 0.68rem;
    font-weight: 950;
    letter-spacing: 0.08em;
    margin: 0;
    text-transform: uppercase;
  }

  .axis-watch__result-grid dd,
  .axis-watch__limitations p {
    margin: 0;
  }

  .axis-watch__next-actions a {
    align-items: center;
    display: inline-flex;
  }

  .axis-watch__candidates {
    border-left: 2px solid rgba(20, 22, 16, 0.14);
    margin-left: 0.38rem;
    padding-left: 0.75rem;
  }

  .axis-watch__candidates article {
    box-shadow: none;
  }

  .axis-watch__candidates article[data-review-status="accepted"] {
    border-color: rgba(72, 150, 48, 0.38);
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
    background: #b7ff5c;
    border: 2px solid #141610;
    border-radius: 999px;
    display: inline-block;
    height: 0.68rem;
    width: 0.68rem;
  }

  .axis-watch__report-cover {
    background:
      linear-gradient(135deg, rgba(20, 22, 16, 0.96), rgba(20, 22, 16, 0.84)),
      repeating-linear-gradient(90deg, rgba(183, 255, 92, 0.18) 0 1px, transparent 1px 9px);
    border-radius: 0.5rem;
    color: #fffdf7;
    margin: -0.2rem -0.2rem 0;
    padding: 0.8rem;
  }

  .axis-watch__report-cover span {
    color: rgba(255, 253, 247, 0.66);
  }

  .axis-watch__report-list li {
    border-left: 3px solid #b7ff5c;
    display: grid;
    gap: 0.15rem;
    padding-left: 0.65rem;
  }

  @keyframes axis-sweep {
    to {
      transform: translateX(100%);
    }
  }

  @media (min-width: 760px) {
    .axis-watch {
      padding: 1.5rem;
    }

    .axis-watch__attach-row {
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
      animation: axis-scan 7s linear infinite;
    }
  }

  @keyframes axis-scan {
    to {
      background-position: 0 48px, 48rem 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .axis-signal--scan,
    .axis-watch__job::after {
      animation: none !important;
    }
  }
`;
